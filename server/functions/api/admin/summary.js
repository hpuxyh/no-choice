// GET /api/admin/summary?token=XXX&sinceDays=30
// 返回全体用户行为聚合。需 env.ADMIN_TOKEN 鉴权;绑定 env.DB。

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = request.headers.get("x-admin-token") || url.searchParams.get("token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, message: "unauthorized" }, 401);
  }
  if (!env.DB) return json({ ok: false, message: "D1 binding 'DB' missing" }, 500);

  const days = Number(url.searchParams.get("sinceDays"));
  const since = Number.isFinite(days) && days > 0 ? Date.now() - days * 86400000 : 0;
  const tsFilter = since ? `ts >= ${Math.floor(since)}` : "1=1";

  const all = async (sql) => {
    const res = await env.DB.prepare(sql).all();
    return res.results || [];
  };

  try {
    const [totals] = await all(
      `SELECT COUNT(*) AS events, COUNT(DISTINCT device_id) AS users FROM events WHERE ${tsFilter}`
    );
    const brands = await all(
      `SELECT brand, COUNT(*) AS c FROM events WHERE ${tsFilter} AND brand <> '' GROUP BY brand ORDER BY c DESC LIMIT 20`
    );
    const categories = await all(
      `SELECT category, COUNT(*) AS c FROM events WHERE ${tsFilter} AND category <> '' GROUP BY category ORDER BY c DESC`
    );
    const priceBands = await all(
      `SELECT price_band AS band, COUNT(*) AS c FROM events WHERE ${tsFilter} AND price_band <> '' GROUP BY price_band ORDER BY c DESC`
    );
    const hours = await all(
      `SELECT hour, COUNT(*) AS c FROM events WHERE ${tsFilter} AND hour >= 0 GROUP BY hour ORDER BY hour ASC`
    );
    const types = await all(
      `SELECT type, COUNT(*) AS c FROM events WHERE ${tsFilter} AND type <> '' GROUP BY type ORDER BY c DESC`
    );
    return json({ ok: true, sinceDays: since ? days : 0, totals, brands, categories, priceBands, hours, types });
  } catch (error) {
    return json({ ok: false, message: String(error) }, 500);
  }
}
