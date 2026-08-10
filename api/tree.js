// 하루치 분류 트리(대분류>중분류>소분류)를 카운트와 함께 1회 생성 → 캐시
export const config = { maxDuration: 60 };

const BASE = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
// The upstream API returns at most 1,000 rows per response.
const PER = 1000;
const COLS = "gds_lclsf_cd,gds_lclsf_nm,gds_mclsf_cd,gds_mclsf_nm,gds_sclsf_cd,gds_sclsf_nm";

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
    const pages = Math.ceil(total / PER) || 1;
    if (pages > 1) {
      const jobs = [];
      for (let p = 2; p <= pages; p++) jobs.push(fetch(url(p)).then((r) => r.json()).then(extract).catch(() => []));
      for (const arr of await Promise.all(jobs)) rows = rows.concat(arr);
    }

    // 대분류 > 중분류 > 소분류
    const L = new Map();
    for (const r of rows) {
      const lc = r.gds_lclsf_cd || "", ln = r.gds_lclsf_nm || "기타";
      const mc = r.gds_mclsf_cd || "", mn = r.gds_mclsf_nm || "기타";
      const sc = r.gds_sclsf_cd || "", sn = r.gds_sclsf_nm || "기타";
      if (!L.has(ln)) L.set(ln, { cd: lc, nm: ln, n: 0, m: new Map() });
      const Ln = L.get(ln); Ln.n++;
      if (!Ln.m.has(mn)) Ln.m.set(mn, { cd: mc, nm: mn, n: 0, s: new Map() });
      const Mn = Ln.m.get(mn); Mn.n++;
      if (!Mn.s.has(sn)) Mn.s.set(sn, { cd: sc, nm: sn, n: 0 });
      Mn.s.get(sn).n++;
    }
    const tree = [...L.values()].sort(byNm).map((Ln) => ({
      cd: Ln.cd, nm: Ln.nm, n: Ln.n,
      ch: [...Ln.m.values()].sort(byNm).map((Mn) => ({
        cd: Mn.cd, nm: Mn.nm, n: Mn.n,
        ch: [...Mn.s.values()].sort(byNm),
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
