// POST /api/track  —— 接收小程序上报的匿名行为事件,写入 D1。
// 绑定:env.DB(D1 数据库,绑定名 DB)。无 CORS 需求(小程序 wx.request 非浏览器)。

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function str(value, max = 60) {
  return String(value === undefined || value === null ? "" : value).slice(0, max);
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, message: "D1 binding 'DB' missing" }, 500);
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, message: "invalid json" }, 400);
  }
  const deviceId = str(body && body.deviceId, 64);
  const events = Array.isArray(body && body.events) ? body.events.slice(0, 200) : [];
  if (!deviceId || !events.length) return json({ ok: false, message: "empty deviceId or events" }, 400);

  const now = Date.now();
  const stmt = env.DB.prepare(
    "INSERT INTO events (device_id, ts, type, brand, name, category, price_band, hour, city, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );
  const rows = events.map((e) => {
    const hour = Number(e && e.hour);
    return stmt.bind(
      deviceId,
      Number(e && e.ts) || now,
      str(e && e.type, 16),
      str(e && e.brand, 40),
      str(e && e.name, 40),
      str(e && e.category, 16),
      str(e && e.priceBand, 16),
      Number.isFinite(hour) ? hour : -1,
      str(e && e.city, 20),
      now
    );
  });

  try {
    await env.DB.batch(rows);
  } catch (error) {
    return json({ ok: false, message: String(error) }, 500);
  }
  return json({ ok: true, received: events.length });
}

// 健康检查
export async function onRequestGet() {
  return json({ ok: true, message: "track endpoint alive" });
}
