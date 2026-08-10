// 전국 도매시장 데이터를 여러 페이지로 모아 서버에서 필터링
// 인증키는 Vercel 환경변수 DATA_GO_KR_KEY 사용
export const config = { maxDuration: 60 };

const BASE = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
const PER = 9999;        // 한 페이지 최대(명세상 4자리)
const MAX_PAGES = 25;    // 안전 상한 (약 25만건)
const OUT_CAP = 3000;    // 폰으로 보내는 최대 건수

export default async function handler(req, res) {
  const KEY = process.env.DATA_GO_KR_KEY;
  const { date = todayKST(), market = "", origin = "", item = "" } = req.query;

  const url = (page) => {
    const p = new URLSearchParams({
      serviceKey: KEY,
      returnType: "JSON",
      numOfRows: String(PER),
      pageNo: String(page),
      "cond[trd_clcln_ymd::EQ]": date,
    });
    return `${BASE}?${p.toString()}`;
  };

  try {
    const first = await fetch(url(1)).then((r) => r.json());
    const total = Number(first?.response?.body?.totalCount ?? 0);
    let raw = extract(first);

    const pages = Math.min(Math.ceil(total / PER) || 1, MAX_PAGES);
    if (pages > 1) {
      const jobs = [];
      for (let p = 2; p <= pages; p++)
        jobs.push(fetch(url(p)).then((r) => r.json()).then(extract).catch(() => []));
      for (const arr of await Promise.all(jobs)) raw = raw.concat(arr);
    }

    // 도매시장 목록(필터 전 전체 기준)
    const markets = Array.from(new Set(raw.map((x) => x.whsl_mrkt_nm).filter(Boolean))).sort();

    let list = raw.map(compact);
    const mkt = market.trim(), org = origin.trim(), it = item.trim();
    if (mkt) list = list.filter((x) => x.mkt === mkt);
    if (org) list = list.filter((x) => (x.origin || "").includes(org));
    if (it) list = list.filter((x) => (x.item || "").includes(it));

    list.sort((a, b) => String(b.dt).localeCompare(String(a.dt)));
    const count = list.length;

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ date, total, markets, count, items: list.slice(0, OUT_CAP) });
  } catch (e) {
    res.status(502).json({ error: "경매정보를 불러오지 못했습니다." });
  }
}

function extract(j) {
  const r = j?.response?.body?.items?.item ?? [];
  return (Array.isArray(r) ? r : [r]).filter(Boolean);
}
function compact(x) {
  return {
    id: x.auctn_seq,
    dt: x.scsbd_dt,
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
  };
}
function fmtTime(s) {
  if (!s) return "";
  const d = String(s).replace(/\D/g, "");
  if (d.length >= 12) return d.slice(8, 10) + ":" + d.slice(10, 12);
  const m = String(s).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : String(s);
}
function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
