import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, Gavel, Search as SearchIcon, Loader2, Send } from "lucide-react";

const won = (n) => Number(n || 0).toLocaleString("ko-KR");
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export default function App() {
  const [date, setDate] = useState(kstToday());
  const [tab, setTab] = useState("item"); // item(품목별) | origin(보낸곳별)

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex justify-center" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md min-h-screen relative pb-4">
        <div className="sticky top-0 z-20 bg-emerald-900">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel size={20} className="text-emerald-300" />
              <span className="text-lg font-bold">농수산 경매시세</span>
            </div>
            <input type="date" value={date} max={kstToday()} onChange={(e) => setDate(e.target.value)}
              className="text-sm bg-emerald-800 text-white rounded px-2 py-1 outline-none" />
          </div>
          <div className="flex">
            {[["item", "품목별"], ["origin", "보낸 곳별"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-2.5 text-base font-bold border-b-2 ${tab === k ? "border-emerald-300 text-white" : "border-transparent text-emerald-200/60"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "item" ? <ItemTab date={date} /> : <OriginTab date={date} />}
      </div>
    </div>
  );
}

/* ============ 품목별 탭 ============ */
function ItemTab({ date }) {
  const [tree, setTree] = useState(null);
  const [treeErr, setTreeErr] = useState("");
  const [treeLoading, setTreeLoading] = useState(true);
  const [sel, setSel] = useState({});
  const [screen, setScreen] = useState("catL1");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true; setTreeLoading(true); setTreeErr("");
    fetch(`/api/tree?date=${date}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => { if (alive) { setTree(j.tree || []); if (!j.tree?.length) setTreeErr("이 날짜에는 데이터가 없습니다."); } })
      .catch(() => alive && setTreeErr("데이터를 불러오지 못했습니다. 새로고침 해주세요."))
      .finally(() => alive && setTreeLoading(false));
    setSel({}); setScreen("catL1"); setQ("");
    return () => { alive = false; };
  }, [date]);

  const node1 = tree?.find((m) => m.nm === sel.mclsfNm);
  const node2 = node1?.ch?.find((s) => s.nm === sel.sclsfNm);
  const goResult = (extra = {}) => { setSel((s) => ({ ...s, ...extra })); setScreen("result"); };

  if (treeLoading) return <Loading msg="전국 도매시장 분류를 준비 중…" />;
  if (treeErr) return <div className="text-center text-stone-400 py-20 px-6">{treeErr}</div>;

  return (
    <>
      {screen === "catL1" && (
        <CatList title="품목 분류를 고르세요" crumb="" rows={filterRows(tree, q)} q={q} setQ={setQ}
          onPick={(m) => { setSel({ mclsf: m.cd, mclsfNm: m.nm }); setScreen("catL2"); setQ(""); }} />
      )}
      {screen === "catL2" && node1 && (
        <CatList title="품목을 고르세요" crumb={sel.mclsfNm} rows={filterRows(node1.ch, q)} q={q} setQ={setQ}
          onBack={() => { setScreen("catL1"); setQ(""); }}
          onPick={(s) => { setSel((v) => ({ ...v, sclsf: s.cd, sclsfNm: s.nm, vrty: undefined })); setScreen("catL3"); setQ(""); }}
          onSearch={() => goResult()} />
      )}
      {screen === "catL3" && node2 && (
        <CatList title="품종을 고르세요" crumb={`${sel.mclsfNm} › ${sel.sclsfNm}`}
          rows={[{ nm: "전체(품종 무관)", n: node2.n, all: true }, ...node2.ch]}
          onBack={() => setScreen("catL2")}
          onPick={(v) => { setSel((s) => ({ ...s, vrty: v.all ? undefined : v.nm, market: undefined, corp: undefined })); setScreen("market"); }}
          onSearch={() => goResult()} />
      )}
      {screen === "market" && (
        <FacetList kind="market" date={date} sel={sel} crumb={crumb(sel)} onBack={() => setScreen("catL3")}
          onPick={(m) => { setSel((s) => ({ ...s, market: m.all ? undefined : m.nm, corp: undefined })); setScreen(m.all ? "result" : "corp"); }}
          onSearch={() => goResult()} />
      )}
      {screen === "corp" && (
        <FacetList kind="corp" date={date} sel={sel} crumb={crumb(sel)} onBack={() => setScreen("market")}
          onPick={(c) => goResult({ corp: c.all ? undefined : c.nm })} onSearch={() => goResult()} />
      )}
      {screen === "result" && (
        <Result date={date} sel={sel} setSel={setSel} onBack={() => setScreen(sel.market ? "corp" : "market")} />
      )}
    </>
  );
}

/* ============ 보낸 곳별 탭 ============ */
function OriginTab({ date }) {
  const [origin, setOrigin] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [sel, setSel] = useState({}); // {item, market, unit}
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [list, setList] = useState([]);
  const size = 50;

  useEffect(() => { setPage(0); setList([]); }, [submitted, sel.item, sel.market, sel.unit, date]);

  useEffect(() => {
    if (!submitted) return;
    let alive = true; setLoading(true);
    fetch(`/api/origin?${qs({ date, origin: submitted, ...sel, size, page })}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; setData(j); setList((prev) => page === 0 ? (j.list || []) : [...prev, ...(j.list || [])]); })
      .catch(() => alive && setData({ error: true }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [submitted, date, sel.item, sel.market, sel.unit, page]);

  const s = data?.summary;
  const totalPages = data ? Math.ceil((data.count || 0) / size) : 1;
  const toggle = (key, val) => setSel((v) => ({ ...v, [key]: v[key] === val ? undefined : val }));
  const run = () => { setSel({}); setSubmitted(origin.trim()); };

  return (
    <div className="pb-6">
      <div className="p-3 border-b border-stone-800">
        <div className="flex items-center gap-2 bg-stone-800 rounded-lg px-3 py-2.5">
          <Send size={18} className="text-emerald-400" />
          <input value={origin} onChange={(e) => setOrigin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="보낸 곳 입력 (예: 논산, 제주, 밀양)"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-stone-500" />
        </div>
        <button onClick={run} disabled={!origin.trim()}
          className="mt-2 w-full bg-emerald-600 disabled:bg-stone-700 text-white text-base font-bold py-3 rounded-full">
          이 곳에서 보낸 것 찾기
        </button>
        <p className="text-xs text-stone-500 mt-2">전국을 훑어서 찾습니다. 처음 조회는 몇 초 걸릴 수 있어요.</p>
      </div>

      {!submitted && <div className="text-center text-stone-500 py-20 px-6">보낸 곳을 입력하고 검색하세요.<br />예) "논산" → 논산에서 보낸 모든 품목</div>}

      {submitted && (
        <>
          <div className="bg-stone-800 text-stone-300 text-sm px-4 py-2">
            보낸 곳: <b className="text-white">{submitted}</b>{data ? ` · ${won(data.count)}건` : " · 조회 중…"}
          </div>
          {data?.items?.length > 1 && <ChipRow label="품목" items={data.items} active={sel.item} onTap={(v) => toggle("item", v)} />}
          {data?.markets?.length > 1 && <ChipRow label="도매시장" items={data.markets} active={sel.market} onTap={(v) => toggle("market", v)} />}
          {data?.units?.length > 1 && <ChipRow label="규격" items={data.units} active={sel.unit} onTap={(v) => toggle("unit", v)} />}

          <div className="divide-y divide-stone-800">
            {list.map((r, i) => <ResultItem key={i} r={r} />)}
          </div>

          {loading && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-stone-500" /></div>}
          {!loading && !list.length && <div className="text-center text-stone-500 py-16">"{submitted}"에서 보낸 낙찰이 없습니다.</div>}
          {!loading && page + 1 < totalPages && (
            <div className="px-4 py-3">
              <button onClick={() => setPage((p) => p + 1)} className="w-full bg-emerald-700 text-white font-bold py-3 rounded-full">
                더 불러오기 ({page + 1}/{totalPages} 페이지)
              </button>
            </div>
          )}
          {s && s.n > 0 && <Summary s={s} />}
        </>
      )}
    </div>
  );
}

/* ============ 공통 ============ */
function crumb(s) { return [s.mclsfNm, s.sclsfNm, s.vrty, s.market, s.corp].filter(Boolean).join(" › "); }
function filterRows(rows, q) { return q.trim() ? rows.filter((r) => r.nm.includes(q.trim())) : rows; }

function Loading({ msg }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-stone-400">
      <Loader2 className="animate-spin mb-3" size={28} />
      <p className="text-base">{msg}</p>
      <p className="text-sm mt-1">처음 한 번만 몇 초 걸려요.</p>
    </div>
  );
}
function SearchBtn({ onSearch }) {
  if (!onSearch) return null;
  return (
    <div className="sticky bottom-0 p-3 bg-gradient-to-t from-stone-950 to-transparent">
      <button onClick={onSearch} className="w-full bg-emerald-600 text-white text-lg font-bold py-3.5 rounded-full active:scale-[0.99]">
        선택한 조건으로 검색
      </button>
    </div>
  );
}
function Row({ nm, n, onClick, bold }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-4 border-b border-stone-800 active:bg-stone-900">
      <span className={`text-lg ${bold ? "font-bold" : "font-semibold"}`}>{nm}</span>
      <span className="flex items-center gap-1 text-stone-400 text-base">{won(n)}건 <ChevronRight size={18} /></span>
    </button>
  );
}
function TopBar({ crumb, onBack }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-800">
      {onBack && <button onClick={onBack} className="p-1 text-stone-300"><ChevronLeft size={24} /></button>}
      <span className="text-sm text-stone-400 truncate">{crumb || "전체"}</span>
    </div>
  );
}
function CatList({ title, crumb, rows, q, setQ, onPick, onBack, onSearch }) {
  return (
    <div className="pb-24">
      <TopBar crumb={crumb} onBack={onBack} />
      <div className="px-4 pt-3 pb-2 text-base font-bold text-emerald-300">{title}</div>
      {setQ && (
        <div className="mx-4 mb-2 flex items-center gap-2 bg-stone-800 rounded-lg px-3 py-2">
          <SearchIcon size={16} className="text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름으로 찾기"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-stone-500" />
        </div>
      )}
      {rows.map((r) => <Row key={r.nm} nm={r.nm} n={r.n} bold={r.all} onClick={() => onPick(r)} />)}
      {!rows.length && <div className="text-center text-stone-500 py-16">결과가 없습니다.</div>}
      <SearchBtn onSearch={onSearch} />
    </div>
  );
}
function FacetList({ kind, date, sel, crumb, onBack, onPick, onSearch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true; setLoading(true);
    fetch(`/api/list?${qs({ date, ...sel, size: 10, page: 0 })}`)
      .then((r) => r.json()).then((j) => alive && setData(j))
      .catch(() => alive && setData({ error: true })).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [date, sel.mclsf, sel.sclsf, sel.vrty, sel.market]);

  const listArr = kind === "market" ? data?.markets : data?.corps;
  const allLabel = kind === "market" ? "전체 도매시장" : "전체 법인";
  const allN = sum(listArr);
  return (
    <div className="pb-24">
      <TopBar crumb={crumb} onBack={onBack} />
      <div className="px-4 pt-3 pb-2 text-base font-bold text-emerald-300">{kind === "market" ? "도매시장을 고르세요" : "도매법인을 고르세요"}</div>
      {loading && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-stone-500" /></div>}
      {!loading && (
        <>
          <Row nm={allLabel} n={allN} bold onClick={() => onPick({ all: true })} />
          {(listArr || []).map((r) => <Row key={r.nm} nm={r.nm} n={r.n} onClick={() => onPick(r)} />)}
          {!listArr?.length && <div className="text-center text-stone-500 py-16">해당 조건 데이터가 없습니다.</div>}
        </>
      )}
      <SearchBtn onSearch={onSearch} />
    </div>
  );
}
function Result({ date, sel, setSel, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const size = 50;
  useEffect(() => { setPage(0); setItems([]); }, [sel.origin, sel.unit, sel.market, sel.corp, sel.vrty, sel.sclsf, date]);
  useEffect(() => {
    let alive = true; setLoading(true);
    fetch(`/api/list?${qs({ date, ...sel, size, page })}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; setData(j); setItems((prev) => page === 0 ? (j.items || []) : [...prev, ...(j.items || [])]); })
      .catch(() => alive && setData({ error: true })).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [date, sel.mclsf, sel.sclsf, sel.vrty, sel.market, sel.corp, sel.origin, sel.unit, page]);

  const s = data?.summary;
  const totalPages = data ? Math.ceil((data.count || 0) / size) : 1;
  const toggle = (key, val) => setSel((v) => ({ ...v, [key]: v[key] === val ? undefined : val }));
  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-800">
        <button onClick={onBack} className="p-1 text-stone-300"><ChevronLeft size={24} /></button>
        <span className="text-base font-bold">{data ? `${won(data.count)}건` : "…"}</span>
      </div>
      <div className="bg-stone-800 text-stone-300 text-sm px-4 py-2">분류: {crumb(sel)}</div>
      {data?.origins?.length > 1 && <ChipRow label="보낸 곳" items={data.origins} active={sel.origin} onTap={(v) => toggle("origin", v)} />}
      {data?.units?.length > 1 && <ChipRow label="규격" items={data.units} active={sel.unit} onTap={(v) => toggle("unit", v)} />}
      <div className="divide-y divide-stone-800">{items.map((r, i) => <ResultItem key={i} r={r} />)}</div>
      {loading && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-stone-500" /></div>}
      {!loading && !items.length && <div className="text-center text-stone-500 py-16">조건에 맞는 낙찰이 없습니다.</div>}
      {!loading && page + 1 < totalPages && (
        <div className="px-4 py-3">
          <button onClick={() => setPage((p) => p + 1)} className="w-full bg-emerald-700 text-white font-bold py-3 rounded-full">
            더 불러오기 ({page + 1}/{totalPages} 페이지)
          </button>
        </div>
      )}
      {s && s.n > 0 && <Summary s={s} />}
    </div>
  );
}
function ResultItem({ r }) {
  return (
    <div className="px-4 py-3">
      <div className="flex justify-between items-start">
        <div className="font-bold text-base">{r.item} <span className="text-emerald-300 text-sm">{r.vrty}</span></div>
        <div className="text-right">
          <div className="text-lg font-bold text-red-400 tabular-nums">{won(r.price)}원</div>
          {r.kgPrice > 0 && <div className="text-xs text-stone-500">kg당 {won(r.kgPrice)}원</div>}
        </div>
      </div>
      <div className="text-sm text-stone-400 mt-1">규격 {r.unit} · 수량 {won(r.qty)}건 · {r.trdSe}</div>
      <div className="text-sm text-stone-400">보낸 곳 {r.origin || "-"} · {r.mkt} {r.corp}</div>
      <div className="text-xs text-stone-500 mt-0.5">{r.t} 낙찰</div>
    </div>
  );
}
function Summary({ s }) {
  return (
    <div className="mx-4 mt-2 mb-4 bg-stone-900 rounded-xl p-4 text-center">
      <div className="text-sm text-stone-400">총 {won(s.n)}건</div>
      <div className="text-base mt-1">건당 평균 <b className="text-white">{won(s.avg)}원</b>
        {s.kgAvg > 0 && <> · kg당 평균 <b className="text-white">{won(s.kgAvg)}원</b></>}
      </div>
    </div>
  );
}
function ChipRow({ label, items, active, onTap }) {
  return (
    <div className="px-3 py-2 border-b border-stone-800">
      <div className="text-xs text-stone-500 mb-1.5">{label}</div>
      <div className="flex gap-2 overflow-x-auto">
        {items.slice(0, 20).map((it) => (
          <button key={it.nm} onClick={() => onTap(it.nm)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${active === it.nm ? "bg-emerald-600 border-emerald-600 text-white" : "border-stone-700 text-stone-300"}`}>
            {it.nm} ({won(it.n)})
          </button>
        ))}
      </div>
    </div>
  );
}
function qs(o) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && !k.endsWith("Nm")) p.set(k, v);
  return p.toString();
}
function sum(arr) { return (arr || []).reduce((a, b) => a + b.n, 0); }
