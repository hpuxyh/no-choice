// GET/POST /api/shared-card
// Stores an immutable snapshot of one picked restaurant behind an unguessable share id.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

function str(value, max = 80) {
  return String(value === undefined || value === null ? "" : value).trim().slice(0, max);
}

const SHARED_CARD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SHARED_CARD_BYTES = 220000;
const SHARE_ID_PATTERN = /^card-[a-z0-9-]{16,80}$/;

async function ensureSchema(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS shared_cards (
      share_id TEXT PRIMARY KEY,
      room_id TEXT,
      card_json TEXT NOT NULL,
      creator_id TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_shared_cards_expires ON shared_cards(expires_at)").run();
}

async function cleanupExpired(env, now = Date.now()) {
  await env.DB.prepare("DELETE FROM shared_cards WHERE expires_at < ?").bind(now).run();
}

async function loadSharedCard(env, shareId) {
  return env.DB.prepare("SELECT * FROM shared_cards WHERE share_id = ? AND expires_at >= ?")
    .bind(shareId, Date.now())
    .first();
}

function normalizeDepartureAdvice(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => str(item, 100))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizePayload(body, now) {
  const card = body && body.card && typeof body.card === "object" && !Array.isArray(body.card)
    ? body.card
    : null;
  if (!card || !str(card.name, 120)) return { error: "invalid card" };
  const payload = {
    version: 1,
    card,
    settleText: str(body && body.settleText, 80) || "就它了！",
    departureAdvice: normalizeDepartureAdvice(body && body.departureAdvice),
    sharedAt: now
  };
  const jsonText = JSON.stringify(payload);
  if (jsonText.length > MAX_SHARED_CARD_BYTES) return { error: "card too large", status: 413 };
  return { payload, jsonText };
}

function rowToResult(row) {
  if (!row || !row.card_json) return null;
  try {
    const result = JSON.parse(row.card_json);
    return result && result.card ? result : null;
  } catch (error) {
    return null;
  }
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, message: "D1 binding 'DB' missing" }, 500);
  await ensureSchema(env);
  const url = new URL(request.url);
  const shareId = str(url.searchParams.get("shareId"), 96);
  if (!SHARE_ID_PATTERN.test(shareId)) return json({ ok: false, message: "invalid shareId" }, 400);
  await cleanupExpired(env);
  const row = await loadSharedCard(env, shareId);
  const result = rowToResult(row);
  if (!result) return json({ ok: false, message: "shared card not found" }, 404);
  return json({ ok: true, shareId, result });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, message: "D1 binding 'DB' missing" }, 500);
  await ensureSchema(env);
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, message: "invalid json" }, 400);
  }
  const shareId = str(body && body.shareId, 96);
  if (!SHARE_ID_PATTERN.test(shareId)) return json({ ok: false, message: "invalid shareId" }, 400);
  const now = Date.now();
  await cleanupExpired(env, now);
  const normalized = normalizePayload(body, now);
  if (normalized.error) return json({ ok: false, message: normalized.error }, normalized.status || 400);

  await env.DB.prepare(
    `INSERT INTO shared_cards (share_id, room_id, card_json, creator_id, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(share_id) DO NOTHING`
  ).bind(
    shareId,
    str(body && body.roomId, 64),
    normalized.jsonText,
    str(body && body.participantId, 64),
    now,
    now + SHARED_CARD_TTL_MS
  ).run();

  const row = await loadSharedCard(env, shareId);
  const result = rowToResult(row);
  if (!result) return json({ ok: false, message: "shared card unavailable" }, 500);
  return json({ ok: true, shareId, result });
}
