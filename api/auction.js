// 인증키는 코드에 없음 → Vercel 환경변수 DATA_GO_KR_KEY 사용
export default async function handler(req, res) {
  const KEY = process.env.DATA_GO_KR_KEY;
  const { date = todayKST(), market = "", rows = "1000", page = "1" } = req.query;

  const base = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
  const params = new URLSearchParams({
    serviceKey: KEY,
    returnType: "JSON",
    numOfRows: rows,
    pageNo: page,
    "cond[trd_clcln_ymd::EQ]": date,
  });
  if (market) params.set("cond[whsl_mrkt_cd::EQ]", market);

  try {
    const r = await fetch(`${base}?${params.toString()}`);
    const j = await r.json();
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json(j);
  } catch (e) {
    res.status(502).json({ error: "경매정보를 불러오지 못했습니다." });
  }
}
function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
