import React, { useState, useMemo, useEffect } from "react";
import { Search, Gavel, MapPin, Clock, X, RefreshCw } from "lucide-react";

const UP = "#e5342b", DOWN = "#1f6fd4";
const won = (n) => Number(n || 0).toLocaleString("ko-KR");

function fmtTime(s) {
  if (!s) return "";
  const d = String(s).replace(/\D/g, "");
  if (d.length >= 12) return d.slice(8, 10) + ":" + d.slice(10, 12);
  const m = String(s).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : String(s);
}

async function loadAuctions(date) {
  const r = await fetch(`/api/auction?date=${date}`);
  if (!r.ok) throw new Error("api error");
  const j = await r.json();
  const raw = j?.response?.body?.items?.item ?? j?.body?.items?.item ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((x, i) => ({
    id: x.auctn_seq ?? i,
    mkt: x.whsl_mrkt_nm || "",
    corp: x.corp_nm || "",
    item: x.corp_gds_item_nm || x.gds_sclsf_nm || "",
    vrty: x.corp_gds_vrty_nm || "",
    origin: x.plor_nm || "",
    unit: `${x.unit_qty ?? ""}${x.unit_nm ?? ""}`.trim() || x.unit_nm || "",
    price: Number(x.scsbd_prc),
    qty: Number(x.qty),
    trdSe: x.trd_se || "",
    t: fmtTime(x.scsbd_dt),
  }));
}

export default function App() {
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [mkt, setMkt] = useState("전체");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("time");
  const [sel, setSel] = useState(null);

  const fetchData = () => {
    setLoading(true); setErr("");
    loadAuctions(date)
      .then((d) => { setData(d); if (!d.length) setErr("이 날짜에는 낙찰 데이터가 없습니다."); })
      .catch(() => setErr("데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."))
      .finally(() => setLoading(false));
  };
  useEffect(fetchData, [date]);

  const markets = useMemo(() => ["전체", ...Array.from(new Set(data.map((d) => d.mkt))).filter(Boolean)], [data]);
  const rows = useMemo(() => {
    let r = data.filter((x) => (mkt === "전체" ? true : x.mkt === mkt));
    if (q.trim()) r = r.filter((x) => x.item.includes(q.trim()) || x.origin.includes(q.trim()));
    return [...r].sort((a, b) => (sort === "time" ? String(b.t).localeCompare(String(a.t)) : (b.price || 0) - (a.price || 0)));
  }, [data, mkt, q, sort]);

  const stats = useMemo(() => {
    if (!sel) return null;
    const p = data.filter((d) => d.item === sel.item).map((d) => d.price).filter(Boolean);
    if (!p.length) return null;
    return { n: p.length, min: Math.min(...p), max: Math.max(...p), avg: Math.round(p.reduce((a, b) => a + b, 0) / p.length) };
  }, [sel, data]);

  return (
    <div className="min-h-screen w-full bg-stone-100 flex justify-center" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md bg-stone-50 min-h-screen shadow-xl relative">
        <div className="sticky top-0 z-20 bg-emerald-900 text-white px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel size={22} className="text-emerald-300" />
              <h1 className="text-xl font-bold tracking-tight">농수산 경매시세</h1>
            </div>
            <button onClick={fetchData} className="flex items-center gap-1 text-sm bg-emerald-700/60 px-2.5 py-1.5 rounded-full active:scale-95">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 새로고침
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-sm text-emerald-200">조회 날짜</span>
            <input type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)}
              className="text-sm bg-emerald-800 text-white rounded px-2 py-1 outline-none" />
          </div>
          <div className="mt-3 flex items-center gap-2 bg-white rounded-lg px-3 py-2.5">
            <Search size={18} className="text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="품목·산지 검색 (예: 배추, 제주)"
              className="flex-1 text-base text-stone-800 outline-none placeholder:text-stone-400" />
            {q && <button onClick={() => setQ("")} className="text-stone-400"><X size={18} /></button>}
          </div>
        </div>

        <div className="bg-stone-50 border-b border-stone-200 px-3 py-2 overflow-x-auto">
          <div className="flex gap-1.5 w-max">
            {markets.map((m) => (
              <button key={m} onClick={() => setMkt(m)}
                className={`px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${mkt === m ? "bg-emerald-800 text-white" : "bg-white text-stone-600 border border-stone-200"}`}>
                {m.replace("도매시장", "")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-stone-500">{loading ? "불러오는 중…" : `${rows.length}건`}</span>
          <div className="flex gap-1 text-sm">
            {[["time", "최신순"], ["price", "고가순"]].map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)}
                className={`px-3 py-1.5 rounded-md font-medium ${sort === k ? "bg-stone-800 text-white" : "text-stone-500"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-24 space-y-2">
          {!loading && err && <div className="text-center text-stone-400 text-base py-16 px-6">{err}</div>}
          {rows.map((r) => (
            <button key={r.id} onClick={() => setSel(r)}
              className="w-full text-left bg-white rounded-xl border border-stone-200 px-4 py-3.5 active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-900 text-lg truncate">{r.item}</span>
                    {r.vrty && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{r.vrty}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-stone-500">
                    <span className="flex items-center gap-0.5"><MapPin size={13} /> {r.origin || "-"}</span>
                    <span>·</span>
                    <span className="truncate">{r.mkt.replace("도매시장", "")} {r.corp}</span>
                  </div>
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
                  <p className="text-sm text-stone-500 mt-1">{sel.mkt} · {sel.corp} · {sel.origin}</p>
                </div>
                <button onClick={() => setSel(null)} className="text-stone-400 p-1"><X size={24} /></button>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold text-stone-900 tabular-nums">{won(sel.price)}</span>
                <span className="text-base text-stone-400 mb-1">원 / {sel.unit}</span>
              </div>
              {sel.trdSe && <p className="text-sm text-stone-400 mt-1">매매방법: {sel.trdSe} · 수량 {won(sel.qty)}</p>}
              {stats && (
                <div className="mt-5">
                  <p className="text-base font-semibold text-stone-700 mb-2">오늘 "{sel.item}" 낙찰 요약 ({stats.n}건)</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-3"><p className="text-sm text-stone-500">최저</p><p className="text-lg font-bold tabular-nums" style={{ color: DOWN }}>{won(stats.min)}</p></div>
                    <div className="bg-stone-50 rounded-lg p-3"><p className="text-sm text-stone-500">평균</p><p className="text-lg font-bold tabular-nums text-stone-800">{won(stats.avg)}</p></div>
                    <div className="bg-red-50 rounded-lg p-3"><p className="text-sm text-stone-500">최고</p><p className="text-lg font-bold tabular-nums" style={{ color: UP }}>{won(stats.max)}</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
