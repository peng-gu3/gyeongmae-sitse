import { useEffect, useMemo, useState } from "react";

const today = () => new Date(Date.now() + 32400000).toISOString().slice(0, 10);
const number = (value) => Number(value || 0).toLocaleString("ko-KR");

export default function App() {
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState("origin");
  return (
    <main className="app-shell">
      <header>
        <div className="brand"><span>🌿</span><div><strong>농수산물 경매시세</strong><small>전국 도매시장 실시간 조회</small></div></div>
        <label className="date"><span>날짜</span><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
      </header>
      <nav className="tabs" aria-label="검색 방식">
        <button className={mode === "origin" ? "active" : ""} onClick={() => setMode("origin")}>보낸 곳 검색</button>
        <button className={mode === "item" ? "active" : ""} onClick={() => setMode("item")}>품목별 검색</button>
      </nav>
      {mode === "origin" ? <OriginSearch date={date} /> : <ItemSearch date={date} />}
    </main>
  );
}

function OriginSearch({ date }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const run = () => input.trim() && setQuery(input.trim());
  return (
    <section>
      <div className="search-card">
        <h1>농산물을 보낸 곳을 찾아보세요</h1>
        <p>시·군 이름 일부만 입력해도 됩니다. 예: 밀양, 금산, 제주</p>
        <div className="search-box">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="보낸 곳 입력" />
          <button onClick={run} disabled={!input.trim()}>검색</button>
        </div>
      </div>
      {query ? <TradeResults key={`${date}-${query}`} date={date} filters={{ origin: query }} title={`“${query}”에서 보낸 경매 내역`} /> : <Empty icon="📦" text="보낸 곳을 입력하면 전국 도매시장 경매 내역을 모두 찾습니다." />}
    </section>
  );
}

function ItemSearch({ date }) {
  const [categories, setCategories] = useState([]);
  const [path, setPath] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = `auction-categories:${date}`;
    let hasCache = false;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.categories?.length) {
        setCategories(cached.categories);
        setLoading(false);
        hasCache = true;
      }
    } catch { /* ignore an invalid browser cache */ }
    if (!hasCache) setLoading(true);
    setError(""); setPath([]); setShowResults(false);
    fetch(`/api/categories?date=${encodeURIComponent(date)}`, { signal: controller.signal })
      .then(readJson).then((data) => {
        const nextCategories = data.categories || [];
        setCategories(nextCategories);
        try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), categories: nextCategories })); } catch { /* storage can be unavailable */ }
      })
      .catch((e) => e.name !== "AbortError" && !hasCache && setError(e.message))
      .finally(() => { if (!hasCache) setLoading(false); });
    return () => controller.abort();
  }, [date]);

  const rows = useMemo(() => path.reduce((items, chosen) => items.find((x) => x.code === chosen.code)?.children || [], categories), [categories, path]);
  const filters = { lclsf: path[0]?.code, mclsf: path[1]?.code, sclsf: path[2]?.code };
  if (showResults) return <TradeResults guided date={date} filters={filters} title={path.map((x) => x.name).join(" → ")} onBack={() => setShowResults(false)} />;
  return (
    <section>
      <div className="crumb">{path.length ? path.map((x) => x.name).join(" → ") : "품목 대분류를 선택하세요"}</div>
      {path.length > 0 && <button className="back" onClick={() => setPath((x) => x.slice(0, -1))}>← 이전 단계</button>}
      {loading && <Loading text="전국 분류와 건수를 불러오는 중입니다" />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && <div className="rows">{rows.map((row) => <button className="row" key={`${row.code}-${row.name}`} onClick={() => row.children.length ? setPath((x) => [...x, row]) : (setPath((x) => [...x, row]), setShowResults(true))}><strong>{row.name}</strong><span>{number(row.count)}건　›</span></button>)}</div>}
      {!loading && path.length > 0 && <div className="sticky-action"><button onClick={() => setShowResults(true)}>선택한 조건으로 검색</button></div>}
    </section>
  );
}

function TradeResults({ date, filters, title, onBack, guided = false }) {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({ market: "", corp: "", unit: "" });
  const [step, setStep] = useState(guided ? "market" : "results");

  useEffect(() => { setPage(0); setItems([]); }, [date, JSON.stringify(filters), selected.market, selected.corp, selected.unit]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ date, page: String(page), size: "50" });
    for (const [key, value] of Object.entries({ ...filters, ...selected })) if (value) params.set(key, value);
    fetch(`/api/trades?${params}`, { signal: controller.signal }).then(readJson)
      .then((result) => { setData(result); setItems((old) => page ? [...old, ...(result.trades || [])] : result.trades || []); })
      .catch((e) => e.name !== "AbortError" && setError(e.message)).finally(() => setLoading(false));
    return () => controller.abort();
  }, [date, JSON.stringify(filters), selected.market, selected.corp, selected.unit, page]);

  const choose = (key, value) => setSelected((old) => ({ ...old, [key]: old[key] === value ? "" : value, ...(key === "market" ? { corp: "" } : {}) }));
  const goBack = () => {
    if (!guided || step === "market") return onBack?.();
    setStep(step === "results" ? "corp" : "market");
  };

  if (guided && step === "market") return (
    <FacetScreen title="도매시장을 선택하세요" crumb={title} rows={data?.markets || []} loading={loading} error={error} allLabel="전체 도매시장" allCount={data?.count || 0}
      onBack={goBack} onPick={(name) => { choose("market", name); setStep("corp"); }} />
  );
  if (guided && step === "corp") return (
    <FacetScreen title="법인·청과를 선택하세요" crumb={`${title}${selected.market ? ` → ${selected.market}` : " → 전체 도매시장"}`} rows={data?.corps || []} loading={loading} error={error} allLabel="전체 법인·청과" allCount={data?.count || 0}
      onBack={goBack} onPick={(name) => { choose("corp", name); setStep("results"); }} />
  );

  return (
    <section>
      <div className="result-head">{onBack && <button onClick={goBack}>←</button>}<div><h1>{title}{selected.market ? ` → ${selected.market}` : ""}{selected.corp ? ` → ${selected.corp}` : ""}</h1><p>{data ? `전체 ${number(data.count)}건` : "전체 자료 조회 중"}</p></div></div>
      {data && <>
        <Chips label="도매시장" values={data.markets} active={selected.market} onClick={(x) => choose("market", x)} />
        <Chips label="법인·청과" values={data.corps} active={selected.corp} onClick={(x) => choose("corp", x)} />
        <Chips label="규격" values={data.units} active={selected.unit} onClick={(x) => choose("unit", x)} />
      </>}
      {error && <ErrorBox message={error} />}
      <div className="trades">{items.map((trade, index) => <article className="trade" key={`${trade.datetime}-${index}`}><h2>{index + 1}. {trade.item} <em>{trade.variety}</em></h2><p>경락가: <b>{number(trade.price)}원</b>　수량: <strong>{number(trade.quantity)}건</strong></p><p>규격: <strong>{trade.unit || "-"}</strong>　출하지: <strong>{trade.origin || "-"}</strong></p><p>{trade.market} · {trade.corp}</p><time>경매시간: {trade.datetime || trade.time}</time></article>)}</div>
      {loading && <Loading text="빠진 페이지 없이 전체 자료를 확인하는 중입니다" />}
      {!loading && !error && data?.count === 0 && <Empty icon="🔎" text="선택한 조건의 경매 내역이 없습니다." />}
      {!loading && items.length < (data?.count || 0) && <div className="load-more"><button onClick={() => setPage((x) => x + 1)}>더 불러오기 ({items.length}/{number(data.count)}건)</button></div>}
      {data?.count > 0 && <footer>총 {number(data.count)}건 · 건당 평균가 {number(data.averagePrice)}원</footer>}
    </section>
  );
}

function FacetScreen({ title, crumb, rows, loading, error, allLabel, allCount, onBack, onPick }) {
  return <section className="facet-screen">
    <div className="result-head"><button onClick={onBack}>←</button><div><h1>{title}</h1><p>{crumb}</p></div></div>
    {loading && <Loading text="전체 건수를 확인하는 중입니다" />}
    {error && <ErrorBox message={error} />}
    {!loading && !error && <div className="rows">
      <button className="row all-row" onClick={() => onPick("")}><strong>{allLabel}</strong><span>{number(allCount)}건　›</span></button>
      {rows.map((row) => <button className="row" key={row.name} onClick={() => onPick(row.name)}><strong>{row.name}</strong><span>{number(row.count)}건　›</span></button>)}
    </div>}
  </section>;
}

function Chips({ label, values = [], active, onClick }) {
  if (values.length < 2) return null;
  return <div className="chip-group"><small>{label}</small><div>{values.slice(0, 30).map((x) => <button className={active === x.name ? "active" : ""} key={x.name} onClick={() => onClick(x.name)}>{x.name} ({number(x.count)})</button>)}</div></div>;
}
function Loading({ text }) { return <div className="loading"><span></span><p>{text}</p><small>자료가 많으면 잠시 걸릴 수 있습니다.</small></div>; }
function Empty({ icon, text }) { return <div className="empty"><b>{icon}</b><p>{text}</p></div>; }
function ErrorBox({ message }) { return <div className="error"><strong>자료를 불러오지 못했습니다.</strong><p>{message}</p><small>페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.</small></div>; }
async function readJson(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `서버 오류 ${response.status}`); return data; }
