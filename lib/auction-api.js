const ENDPOINT = "https://apis.data.go.kr/B552845/katRealTime2/trades2";
const PAGE_SIZE = 1000;
// Fetch enough pages in parallel to keep a full-day scan responsive while
// still avoiding an unbounded burst against the public API.
const CONCURRENCY = 20;

function extract(payload) {
  const item = payload?.response?.body?.items?.item ?? [];
  return (Array.isArray(item) ? item : [item]).filter(Boolean);
}

async function requestPage(params, page, attempt = 0) {
  const query = new URLSearchParams({
    serviceKey: process.env.DATA_GO_KR_KEY,
    returnType: "JSON",
    numOfRows: String(PAGE_SIZE),
    pageNo: String(page),
    ...params,
  });
  try {
    const response = await fetch(`${ENDPOINT}?${query}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`공공데이터 API ${response.status}`);
    const payload = await response.json();
    const header = payload?.response?.header;
    const resultCode = String(header?.resultCode ?? "");
    if (resultCode && resultCode !== "0" && resultCode !== "00") {
      throw new Error(header.resultMsg || "공공데이터 API 오류");
    }
    return payload;
  } catch (error) {
    if (attempt < 2) return requestPage(params, page, attempt + 1);
    throw error;
  }
}

export async function fetchAll(params) {
  if (!process.env.DATA_GO_KR_KEY) throw new Error("DATA_GO_KR_KEY가 설정되지 않았습니다.");
  const first = await requestPage(params, 1);
  const total = Number(first?.response?.body?.totalCount || 0);
  const pages = Math.ceil(total / PAGE_SIZE);
  const rows = extract(first);

  for (let start = 2; start <= pages; start += CONCURRENCY) {
    const end = Math.min(pages, start + CONCURRENCY - 1);
    const batch = [];
    for (let page = start; page <= end; page += 1) batch.push(requestPage(params, page));
    const payloads = await Promise.all(batch);
    for (const payload of payloads) rows.push(...extract(payload));
  }
  return { total, rows };
}

export function dateCondition(date) {
  return { "cond[trd_clcln_ymd::EQ]": date };
}
