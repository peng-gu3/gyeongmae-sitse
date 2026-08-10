// 고른 분류(대/중/소 코드)로 서버에서 콕 집어 조회 → 작고 빠르며 정확
export const config = { maxDuration: 30 };

const BASE = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
const PER = 9999, MAX_PAGES = 15;
const COLS = "scsbd_dt,whsl_mrkt_nm,corp_nm,corp_gds_item_nm,corp_gds_vrty_nm,plor_nm,scsbd_prc,qty,unit_qty,unit_nm,trd_se,gds_sclsf_nm";

export default async function handler(req, res) {
  const KEY = process.env.DATA_GO_KR_KEY;
  const {
    date = todayKST(), lclsf = "", mclsf = "", sclsf = "",
    market = "", corp = "", origin = "", unit = "",
    page = "0", size = "50",
  } = req.query;

  const url = (p) => {
    const q = new URLSearchParams({
      serviceKey: KEY, returnType: "JSON",
      numOfRows: String(PER), pageNo: String(p),
      "cond[trd_clcln_ymd::EQ]": date, selectable: COLS,
    });
    if (lclsf) q.set("cond[gds_lclsf_cd::EQ]", lclsf);
    if (mclsf) q.set("cond[gds_mclsf_cd::EQ]", mclsf);
    if (sclsf) q.set("cond[gds_sclsf_cd::EQ]", sclsf);
    return `${BASE}?${q.toString()}`;
  };

  try {
    const first = await fetch(url(1)).then((r) => r.json());
    const total = Number(first?.response?.body?.totalCount ?? 0);
    let raw = extract(first);
    const pages = Math.min(Math.ceil(total / PER) || 1, MAX_PAGES);
    if (pages > 1) {
      const jobs = [];
      for (let p = 2; p <= pages; p++) jobs.push(fetch(url(p)).then((r) => r.json()).then(extract).catch(() => []));
      for (const arr of await Promise.all(jobs)) raw = raw.concat(arr);
    }

    const base = raw.map(compact);
    const marketFacet = countBy(base, (x) => x.mkt);
    const afterMkt = market ? base.filter((x) => x.mkt === market) : base;
    const corpFacet = countBy(afterMkt, (x) => x.corp);
    const afterCorp = corp ? afterMkt.filter((x) => x.corp === corp) : afterMkt;
    const originFacet = countBy(afterCorp, (x) => x.origin);
    const unitFacet = countBy(afterCorp, (x) => x.unit);

    let final = afterCorp;
    if (origin) final = final.filter((x) => (x.origin || "").includes(origin));
    if (unit) final = final.filter((x) => x.unit === unit);
    final.sort((a, b) => String(b.dt).localeCompare(String(a.dt)));

    const prices = final.map((x) => x.price).filter(Boolean);
    const kgs = final.map((x) => x.kgPrice).filter((v) => v > 0);
    const summary = {
      n: final.length,
      avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      kgAvg: kgs.length ? Math.round(kgs.reduce((a, b) => a + b, 0) / kgs.length) : 0,
    };

    const pg = Math.max(0, parseInt(page)), sz = Math.min(100, Math.max(10, parseInt(size)));
    const items = final.slice(pg * sz, pg * sz + sz);

    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
    res.status(200).json({ count: final.length, page: pg, size: sz, markets: marketFacet, corps: corpFacet, origins: originFacet, units: unitFacet, summary, items });
  } catch (e) {
    res.status(502).json({ error: "조회 실패" });
  }
}
function extract(j) { const r = j?.response?.body?.items?.item ?? []; return (Array.isArray(r) ? r : [r]).filter(Boolean); }
function compact(x) {
  const uq = Number(x.unit_qty) || 0, un = x.unit_nm || "";
  const unit = `${x.unit_qty ?? ""}${un}`.trim() || un;
  const price = Number(x.scsbd_prc) || 0;
  const kgPrice = un.includes("kg") && uq > 0 ? Math.round(price / uq) : 0;
  return {
    dt: x.scsbd_dt, t: fmtTime(x.scsbd_dt),
    mkt: x.whsl_mrkt_nm || "", corp: x.corp_nm || "",
    item: x.corp_gds_item_nm || x.gds_sclsf_nm || "",
    vrty: x.corp_gds_vrty_nm || "", origin: x.plor_nm || "",
    unit, price, kgPrice, qty: Number(x.qty) || 0, trdSe: x.trd_se || "",
  };
}
function countBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x) || "-"; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([nm, n]) => ({ nm, n })).sort((a, b) => b.n - a.n);
}
function fmtTime(s) {
  if (!s) return "";
  const d = String(s).replace(/\D/g, "");
  if (d.length >= 12) return d.slice(8, 10) + ":" + d.slice(10, 12);
  const m = String(s).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : String(s);
}
function todayKST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
