import { dateCondition, fetchAll } from "../lib/auction-api.js";

const SELECT = "scsbd_dt,whsl_mrkt_nm,corp_nm,corp_gds_item_nm,corp_gds_vrty_nm,plor_nm,scsbd_prc,qty,unit_qty,unit_nm,trd_se,gds_sclsf_cd,gds_sclsf_nm";

export default async function handler(req, res) {
  try {
    const { date = kstToday(), lclsf = "", mclsf = "", sclsf = "", includeUnclassified = "", market = "", corp = "", origin = "", unit = "", page = "0", size = "50" } = req.query;
    const params = { ...dateCondition(String(date)), selectable: SELECT };
    if (lclsf) params["cond[gds_lclsf_cd::EQ]"] = String(lclsf);
    if (mclsf) params["cond[gds_mclsf_cd::EQ]"] = String(mclsf);
    if (sclsf && includeUnclassified !== "1") params["cond[gds_sclsf_cd::EQ]"] = String(sclsf);

    const { rows } = await fetchAll(params);
    let all = rows.map(normalize);
    if (sclsf && includeUnclassified === "1") {
      all = all.filter((row) => row.categoryCode === String(sclsf) || row.categoryName === "-" || !row.categoryName);
    }
    const markets = facet(all, "market");
    const byMarket = market ? all.filter((x) => x.market === market) : all;
    const corps = facet(byMarket, "corp");
    const byCorp = corp ? byMarket.filter((x) => x.corp === corp) : byMarket;
    const origins = facet(byCorp, "origin");
    const units = facet(byCorp, "unit");

    let filtered = byCorp;
    if (origin) filtered = filtered.filter((x) => x.origin.includes(String(origin).trim()));
    if (unit) filtered = filtered.filter((x) => x.unit === unit);
    filtered.sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));

    const currentPage = Math.max(0, Number.parseInt(page, 10) || 0);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(size, 10) || 50));
    const start = currentPage * pageSize;
    const prices = filtered.map((x) => x.price).filter((x) => x > 0);

    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
    res.status(200).json({
      count: filtered.length, page: currentPage, size: pageSize,
      markets, corps, origins, units,
      averagePrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      trades: filtered.slice(start, start + pageSize),
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "경매시세 조회에 실패했습니다." });
  }
}

function normalize(row) {
  const unitQuantity = Number(row.unit_qty) || 0;
  const unitName = row.unit_nm || "";
  const price = Number(row.scsbd_prc) || 0;
  return {
    datetime: row.scsbd_dt || "", time: formatTime(row.scsbd_dt),
    market: row.whsl_mrkt_nm || "", corp: row.corp_nm || "",
    categoryCode: String(row.gds_sclsf_cd || ""), categoryName: row.gds_sclsf_nm || "",
    item: row.corp_gds_item_nm || row.gds_sclsf_nm || "",
    variety: row.corp_gds_vrty_nm || "", origin: row.plor_nm || "",
    price, quantity: Number(row.qty) || 0, tradeType: row.trd_se || "",
    unit: `${row.unit_qty ?? ""}${unitName}`.trim() || unitName,
    kgPrice: unitName.toLowerCase().includes("kg") && unitQuantity > 0 ? Math.round(price / unitQuantity) : 0,
  };
}
function facet(rows, key) {
  const counts = new Map();
  for (const row of rows) { const value = row[key] || "-"; counts.set(value, (counts.get(value) || 0) + 1); }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
function formatTime(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 12 ? `${digits.slice(8, 10)}:${digits.slice(10, 12)}` : "";
}
function kstToday() { return new Date(Date.now() + 32400000).toISOString().slice(0, 10); }
