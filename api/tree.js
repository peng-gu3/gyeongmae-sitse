// 하루치 분류 트리(중분류>소분류>품종)를 카운트와 함께 1회 생성 → 캐시
// 개별 행은 받지 않고 분류 컬럼만 받아 가볍고 빠르게
export const config = { maxDuration: 60 };

const BASE = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
const PER = 9999, MAX_PAGES = 25;
const COLS = "gds_mclsf_cd,gds_mclsf_nm,gds_sclsf_cd,gds_sclsf_nm,corp_gds_vrty_nm";

export default async function handler(req, res) {
  const KEY = process.env.DATA_GO_KR_KEY;
  const { date = todayKST() } = req.query;
  const url = (page) => `${BASE}?` + new URLSearchParams({
    serviceKey: KEY, returnType: "JSON",
    numOfRows: String(PER), pageNo: String(page),
    "cond[trd_clcln_ymd::EQ]": date, selectable: COLS,
  }).toString();

  try {
    const first = await fetch(url(1)).then((r) => r.json());
    const total = Number(first?.response?.body?.totalCount ?? 0);
    let rows = extract(first);
    const pages = Math.min(Math.ceil(total / PER) || 1, MAX_PAGES);
    if (pages > 1) {
      const jobs = [];
      for (let p = 2; p <= pages; p++) jobs.push(fetch(url(p)).then((r) => r.json()).then(extract).catch(() => []));
      for (const arr of await Promise.all(jobs)) rows = rows.concat(arr);
    }

    // 중분류 > 소분류 > 품종 트리 만들기
    const m = new Map();
    for (const r of rows) {
      const mc = r.gds_mclsf_cd || "", mn = r.gds_mclsf_nm || "기타";
      const sc = r.gds_sclsf_cd || "", sn = r.gds_sclsf_nm || "기타";
      const vn = r.corp_gds_vrty_nm || "기타";
      if (!m.has(mn)) m.set(mn, { cd: mc, nm: mn, n: 0, s: new Map() });
      const M = m.get(mn); M.n++;
      if (!M.s.has(sn)) M.s.set(sn, { cd: sc, nm: sn, n: 0, v: new Map() });
      const S = M.s.get(sn); S.n++;
      S.v.set(vn, (S.v.get(vn) || 0) + 1);
    }
    const tree = [...m.values()].sort(byNm).map((M) => ({
      cd: M.cd, nm: M.nm, n: M.n,
      ch: [...M.s.values()].sort(byNm).map((S) => ({
        cd: S.cd, nm: S.nm, n: S.n,
        ch: [...S.v.entries()].map(([nm, n]) => ({ nm, n })).sort(byNm),
      })),
    }));

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    res.status(200).json({ date, total, tree });
  } catch (e) {
    res.status(502).json({ error: "분류 정보를 불러오지 못했습니다." });
  }
}

function extract(j) { const r = j?.response?.body?.items?.item ?? []; return (Array.isArray(r) ? r : [r]).filter(Boolean); }
function byNm(a, b) { return String(a.nm).localeCompare(String(b.nm), "ko"); }
function todayKST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
