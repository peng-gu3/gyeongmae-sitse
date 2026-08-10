import { dateCondition, fetchAll } from "../lib/auction-api.js";

const SELECT = "gds_lclsf_cd,gds_lclsf_nm,gds_mclsf_cd,gds_mclsf_nm,gds_sclsf_cd,gds_sclsf_nm";

export default async function handler(req, res) {
  try {
    const date = String(req.query.date || kstToday());
    const params = { ...dateCondition(date), selectable: SELECT };
    const lclsfName = String(req.query.lclsfName || "").trim();
    if (lclsfName) params["cond[gds_lclsf_nm::EQ]"] = lclsfName;
    const { total, rows } = await fetchAll(params);
    const large = new Map();

    for (const row of rows) {
      const lKey = row.gds_lclsf_cd || row.gds_lclsf_nm || "기타";
      const mKey = row.gds_mclsf_cd || row.gds_mclsf_nm || "기타";
      const sKey = row.gds_sclsf_cd || row.gds_sclsf_nm || "기타";
      if (!large.has(lKey)) large.set(lKey, node(row.gds_lclsf_cd, row.gds_lclsf_nm));
      const l = large.get(lKey); l.count += 1;
      if (!l.children.has(mKey)) l.children.set(mKey, node(row.gds_mclsf_cd, row.gds_mclsf_nm));
      const m = l.children.get(mKey); m.count += 1;
      if (!m.children.has(sKey)) m.children.set(sKey, node(row.gds_sclsf_cd, row.gds_sclsf_nm));
      m.children.get(sKey).count += 1;
    }

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    res.status(200).json({ date, total, categories: serialize(large) });
  } catch (error) {
    res.status(502).json({ error: error.message || "분류 조회에 실패했습니다." });
  }
}

function node(code, name) { return { code: code || "", name: name || "기타", count: 0, children: new Map() }; }
function serialize(map) {
  return [...map.values()].sort(sortName).map((x) => ({
    code: x.code, name: x.name, count: x.count,
    children: mergeUnclassified(serialize(x.children)),
  }));
}
function mergeUnclassified(children) {
  const unclassified = children.find((child) => child.name === "-" || !child.name);
  const general = children.find((child) => /\(일반\)$/.test(child.name));
  if (!unclassified || !general) {
    return children.map((child) => child.name === "-" ? { ...child, name: "분류명 없음" } : child);
  }
  return children.filter((child) => child !== unclassified).map((child) => child === general
    ? { ...child, count: child.count + unclassified.count, includeUnclassified: true }
    : child);
}
function sortName(a, b) { return a.name.localeCompare(b.name, "ko"); }
function kstToday() { return new Date(Date.now() + 32400000).toISOString().slice(0, 10); }
