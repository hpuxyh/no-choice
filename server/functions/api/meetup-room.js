// GET/POST /api/meetup-room
// Tiny shared-room store for group dining: each participant updates only their own row.

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

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function ensureSchema(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meetup_participants (
      room_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      name TEXT,
      people INTEGER DEFAULT 1,
      location TEXT,
      lat REAL,
      lng REAL,
      pref TEXT,
      travels TEXT,
      status TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, participant_id)
    )`
  ).run();
  await ensureColumn(env, "status", "TEXT");
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_meetup_room_updated ON meetup_participants(room_id, updated_at)").run();
}

async function ensureColumn(env, name, type) {
  try {
    await env.DB.prepare(`ALTER TABLE meetup_participants ADD COLUMN ${name} ${type}`).run();
  } catch (error) {
    if (!/duplicate column|already exists/i.test(String(error && (error.message || error)))) {
      throw error;
    }
  }
}

function normalizeParticipant(body = {}) {
  const source = body.participant && typeof body.participant === "object" ? body.participant : body;
  const travels = Array.isArray(source.travels) ? source.travels.map((item) => str(item, 12)).filter(Boolean).slice(0, 6) : [];
  const location = str(source.location, 120);
  const rawStatus = str(source.status || source.fillStatus, 16);
  const status = rawStatus === "done" || rawStatus === "editing" ? rawStatus : (location ? "done" : "editing");
  return {
    id: str(source.id || source.participantId || body.participantId, 64),
    name: str(source.name || source.nickName || source.role, 24),
    people: Math.max(1, Math.min(20, Math.round(Number(source.people) || 1))),
    location,
    lat: numberOrNull(source.lat ?? source.latitude),
    lng: numberOrNull(source.lng ?? source.longitude),
    pref: str(source.pref, 120),
    travels,
    status
  };
}

function rowToParticipant(row) {
  let travels = [];
  try {
    travels = JSON.parse(row.travels || "[]");
  } catch (error) {
    travels = [];
  }
  return {
    id: row.participant_id,
    name: row.name || "",
    people: row.people || 1,
    location: row.location || "",
    lat: row.lat,
    lng: row.lng,
    pref: row.pref || "",
    travels: Array.isArray(travels) ? travels : [],
    status: row.status || (row.location ? "done" : "editing"),
    updatedAt: row.updated_at
  };
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, message: "D1 binding 'DB' missing" }, 500);
  await ensureSchema(env);
  const url = new URL(request.url);
  const roomId = str(url.searchParams.get("roomId"), 64);
  if (!roomId) return json({ ok: false, message: "empty roomId" }, 400);
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  await env.DB.prepare("DELETE FROM meetup_participants WHERE updated_at < ?").bind(cutoff).run();
  const result = await env.DB.prepare(
    "SELECT * FROM meetup_participants WHERE room_id = ? ORDER BY created_at ASC"
  ).bind(roomId).all();
  return json({
    ok: true,
    roomId,
    participants: (result.results || []).map(rowToParticipant)
  });
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
  const roomId = str(body && body.roomId, 64);
  const participant = normalizeParticipant(body || {});
  if (!roomId || !participant.id) return json({ ok: false, message: "empty roomId or participant id" }, 400);
  const now = Date.now();
  const cutoff = now - 72 * 60 * 60 * 1000;
  await env.DB.prepare("DELETE FROM meetup_participants WHERE updated_at < ?").bind(cutoff).run();
  await env.DB.prepare(
    `INSERT INTO meetup_participants
      (room_id, participant_id, name, people, location, lat, lng, pref, travels, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_id, participant_id) DO UPDATE SET
      name = excluded.name,
      people = excluded.people,
      location = excluded.location,
      lat = excluded.lat,
      lng = excluded.lng,
      pref = excluded.pref,
      travels = excluded.travels,
      status = excluded.status,
      updated_at = excluded.updated_at`
  ).bind(
    roomId,
    participant.id,
    participant.name,
    participant.people,
    participant.location,
    participant.lat,
    participant.lng,
    participant.pref,
    JSON.stringify(participant.travels),
    participant.status,
    now,
    now
  ).run();
  return json({ ok: true, roomId, participant: { ...participant, updatedAt: now } });
}
