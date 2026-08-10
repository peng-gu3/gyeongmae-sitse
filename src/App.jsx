import React, { useState, useMemo, useEffect } from "react";
import { Search, Gavel, MapPin, Clock, X, RefreshCw, Send } from "lucide-react";

const UP = "#e5342b", DOWN = "#1f6fd4";
const won = (n) => Number(n || 0).toLocaleString("ko-KR");

export default function App() {
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [market, setMarket] = useState("");
  const [origin, setOrigin] = useState(""); // 보낸 곳(산지)
  const [item, setItem] = useState("");     // 품목
  const [markets, setMarkets] = useState([]);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sort, setSort] = useState("time");
  const [sel, setSel] = useState(null);

  // 입력 디바운스용 즉시값 → 지연 반영
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setNonce((n) => n + 1), 500);
    return () => clearTimeout(id);
  }, [origin, item]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr("");
    const q = new URLSearchParams({ date, market, origin: origin.trim(), item: item.trim() });
    fetch(`/api/auction?${q.toString()}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => {
        if (!alive) return;
        setData(j.items || []);
        setTotal(j.total || 0);
        setCount(j.count || 0);
        if (j.markets?.length) setMarkets(j.markets);
        if (!(j.items || []).length) {
          setErr(origin.trim() ? `"${origin.trim()}"에서 보낸 물량이 아직 없습니다.` : "이 날짜에는 낙찰 데이터가 없습니다.");
        }
      })
      .catch(() => alive && setErr("데이터를 불러오지 못했습니다. 잠시 후 새로고침 해주세요."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [date, market, nonce]);

  const rows = useMemo(() => {
    return [...data].sort((a, b) =>
      sort === "time" ? String(b.dt).localeCompare(String(a.dt)) : (b.price || 0) - (a.price || 0)
    );
  }, [data, sort]);

  const stats = useMemo(() => {
    if (!sel) return null;
    const p = data.filter((d) => d.item === sel.item).map((d) => d.price).filter(Boolean);
    if (!p.length) return null;
    return { n: p.length, min: Math.min(...p), max: Math.max(...p), avg: Math.round(p.reduce((a, b) => a + b, 0) / p.length) };
  }, [sel, data]);

  const refresh = () => setNonce((n) => n + 1);

  return (
    <div className="min-h-screen w-full bg-stone-100 flex justify-center" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md bg-stone-50 min-h-screen shadow-xl relative">
        <div className="sticky top-0 z-20 bg-emerald-900 text-white px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel size={22} className="text-emerald-300" />
              <h1 className="text-xl font-bold tracking-tight">농수산 경매시세</h1>
            </div>
            <button onClick={refresh} className="flex items-center gap-1 text-sm bg-emerald-700/60 px-2.5 py-1.5 rounded-full active:scale-95">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 새로고침
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-sm text-emerald-200">날짜</span>
            <input type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)}
              className="text-sm bg-emerald-800 text-white rounded px-2 py-1 outline-none" />
            <select value={market} onChange={(e) => setMarket(e.target.value)}
              className="text-sm bg-emerald-800 text-white rounded px-2 py-1 outline-none flex-1">
              <option value="">전체 도매시장</option>
              {markets.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* 보낸 곳(산지) */}
          <div className="mt-2 flex items-center gap-2 bg-white rounded-lg px-3 py-2.5">
            <Send size={17} className="text-emerald-600" />
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="보낸 곳 (예: 논산, 제주)"
              className="flex-1 text-base text-stone-800 outline-none placeholder:text-stone-400" />
            {origin && <button onClick={() => setOrigin("")} className="text-stone-400"><X size={18} /></button>}
          </div>
          {/* 품목 */}
          <div className="mt-2 flex items-center gap-2 bg-white rounded-lg px-3 py-2.5">
            <Search size={17} className="text-stone-400" />
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="품목 (예: 배추, 사과)"
              className="flex-1 text-base text-stone-800 outline-none placeholder:text-stone-400" />
            {item && <button onClick={() => setItem("")} className="text-stone-400"><X size={18} /></button>}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-stone-500">
            {loading ? "전국 도매시장 조회 중…" : `${won(count)}건${count > rows.length ? ` 중 ${won(rows.length)}건 표시` : ""}`}
          </span>
          <div className="flex gap-1 text-sm">
            {[["time", "최신순"], ["price", "고가순"]].map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)}
                className={`px-3 py-1.5 rounded-md font-medium ${sort === k ? "bg-stone-800 text-white" : "text-stone-500"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-24 space-y-2">
          {loading && (
            <div className="text-center text-stone-400 text-sm py-10">
              전국 데이터를 모으는 중입니다.<br />처음 조회는 몇 초 걸릴 수 있어요.
            </div>
          )}
          {!loading && err && <div className="text-center text-stone-400 text-base py-16 px-6">{err}</div>}
          {!loading && rows.map((r) => (
            <button key={r.id} onClick={() => setSel(r)}
              className="w-full text-left bg-white rounded-xl border border-stone-200 px-4 py-3.5 active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-900 text-lg truncate">{r.item}</span>
                    {r.vrty && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{r.vrty}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-stone-500">
                    <span className="flex items-center gap-0.5 min-w-0"><MapPin size={13} className="shrink-0" /> <span className="truncate">{r.origin || "-"}</span></span>
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5 truncate">{r.mkt} · {r.corp}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-stone-900 tabular-nums">
                    {won(r.price)}<span className="text-xs font-medium text-stone-400">원/{r.unit}</span>
                  </div>
                  {r.trdSe && <span className="text-xs text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{r.trdSe}</span>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-stone-100 text-sm text-stone-400">
                <span className="flex items-center gap-1"><Clock size={13} /> {r.t} 낙찰</span>
                <span>수량 {won(r.qty)}</span>
              </div>
            </button>
          ))}
        </div>

        {sel && (
          <div className="fixed inset-0 z-30 flex items-end justify-center" onClick={() => setSel(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative w-full max-w-md bg-white rounded-t-2xl p-5 pb-8 max-h-[80%] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-stone-900">{sel.item}</h2>
                    {sel.vrty && <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{sel.vrty}</span>}
                  </div>
                  <p className="text-sm text-stone-500 mt-1">{sel.mkt} · {sel.corp}</p>
                  <p className="text-sm text-stone-500">보낸 곳: {sel.origin || "-"}</p>
                </div>
                <button onClick={() => setSel(null)} className="text-stone-400 p-1"><X size={24} /></button>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold text-stone-900 tabular-nums">{won(sel.price)}</span>
                <span className="text-base text-stone-400 mb-1">원 / {sel.unit}</span>
              </div>
              {sel.trdSe && <p className="text-sm text-stone-400 mt-1">매매방법: {sel.trdSe} · 수량 {won(sel.qty)} · {sel.t} 낙찰</p>}
              {stats && (
                <div className="mt-5">
                  <p className="text-base font-semibold text-stone-700 mb-2">"{sel.item}" 낙찰 요약 ({stats.n}건)</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-3"><p className="text-sm text-stone-500">최저</p><p className="text-lg font-bold tabular-nums" style={{ color: DOWN }}>{won(stats.min)}</p></div>
                    <div className="bg-stone-50 rounded-lg p-3"><p className="text-sm text-stone-500">평균</p><p className="text-lg font-bold tabular-nums text-stone-800">{won(stats.avg)}</p></div>
                    <div className="bg-red-50 rounded-lg p-3"><p className="text-sm text-stone-500">최고</p><p className="text-lg font-bold tabular-nums" style={{ color: UP }}>{won(stats.max)}</p></div>
                  </div>
                  <p className="text-xs text-stone-400 mt-2">※ 현재 조회 조건 내 기준</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
