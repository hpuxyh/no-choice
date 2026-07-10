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

const ROOM_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_SHARED_DECK_BYTES = 250000;

function expectedCount(value) {
  return Math.max(2, Math.min(6, Math.round(Number(value) || 2)));
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
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meetup_rooms (
      room_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      expected_count INTEGER DEFAULT 2,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meetup_decks (
      room_id TEXT NOT NULL,
      deck_signature TEXT NOT NULL,
      deck_json TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, deck_signature)
    )`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_meetup_rooms_updated ON meetup_rooms(updated_at)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_meetup_decks_updated ON meetup_decks(updated_at)").run();
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

function rowToRoom(row) {
  if (!row) return null;
  return {
    ownerId: row.owner_id || "",
    expectedCount: expectedCount(row.expected_count),
    updatedAt: Number(row.updated_at) || 0
  };
}

function rowToDeck(row) {
  if (!row || !row.deck_json) return [];
  try {
    const deck = JSON.parse(row.deck_json);
    return Array.isArray(deck) ? deck.slice(0, 5) : [];
  } catch (error) {
    return [];
  }
}

function normalizeDeck(value) {
  const deck = Array.isArray(value) ? value.filter(Boolean).slice(0, 5) : [];
  const jsonText = JSON.stringify(deck);
  return { deck, jsonText, tooLarge: jsonText.length > MAX_SHARED_DECK_BYTES };
}

async function cleanupExpired(env, now = Date.now()) {
  const cutoff = now - ROOM_TTL_MS;
  await env.DB.prepare("DELETE FROM meetup_decks WHERE updated_at < ?").bind(cutoff).run();
  await env.DB.prepare("DELETE FROM meetup_participants WHERE updated_at < ?").bind(cutoff).run();
  await env.DB.prepare("DELETE FROM meetup_rooms WHERE updated_at < ?").bind(cutoff).run();
}

async function loadRoom(env, roomId) {
  return env.DB.prepare("SELECT * FROM meetup_rooms WHERE room_id = ?").bind(roomId).first();
}

async function ensureRoom(env, roomId, ownerId, count, now) {
  if (!ownerId) return loadRoom(env, roomId);
  await env.DB.prepare(
    `INSERT INTO meetup_rooms (room_id, owner_id, expected_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(room_id) DO NOTHING`
  ).bind(roomId, ownerId, expectedCount(count), now, now).run();
  return loadRoom(env, roomId);
}

async function loadDeck(env, roomId, signature) {
  if (!signature) return null;
  return env.DB.prepare(
    "SELECT * FROM meetup_decks WHERE room_id = ? AND deck_signature = ?"
  ).bind(roomId, signature).first();
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, message: "D1 binding 'DB' missing" }, 500);
  await ensureSchema(env);
  const url = new URL(request.url);
  const roomId = str(url.searchParams.get("roomId"), 64);
  if (!roomId) return json({ ok: false, message: "empty roomId" }, 400);
  const deckSignature = str(url.searchParams.get("deckSignature"), 128);
  await cleanupExpired(env);
  const roomRow = await loadRoom(env, roomId);
  const result = await env.DB.prepare(
    "SELECT * FROM meetup_participants WHERE room_id = ? ORDER BY created_at ASC"
  ).bind(roomId).all();
  const deckRow = deckSignature ? await loadDeck(env, roomId, deckSignature) : null;
  return json({
    ok: true,
    roomId,
    room: rowToRoom(roomRow),
    participants: (result.results || []).map(rowToParticipant),
    deckSignature: deckRow ? deckSignature : "",
    deck: rowToDeck(deckRow)
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
  const action = str(body && body.action, 16) || "participant";
  if (!roomId) return json({ ok: false, message: "empty roomId" }, 400);
  const now = Date.now();
  await cleanupExpired(env, now);

  if (action === "deck") {
    const participantId = str(body && body.participantId, 64);
    const signature = str(body && body.deckSignature, 128);
    if (!participantId || !signature) return json({ ok: false, message: "empty participant id or deck signature" }, 400);
    const member = await env.DB.prepare(
      "SELECT participant_id FROM meetup_participants WHERE room_id = ? AND participant_id = ?"
    ).bind(roomId, participantId).first();
    if (!member) return json({ ok: false, message: "participant not in room" }, 403);
    let deckRow = await loadDeck(env, roomId, signature);
    if (!deckRow) {
      const normalized = normalizeDeck(body && body.deck);
      if (!normalized.deck.length) return json({ ok: false, message: "empty deck" }, 400);
      if (normalized.tooLarge) return json({ ok: false, message: "deck too large" }, 413);
      await env.DB.prepare(
        `INSERT INTO meetup_decks (room_id, deck_signature, deck_json, creator_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(room_id, deck_signature) DO NOTHING`
      ).bind(roomId, signature, normalized.jsonText, participantId, now, now).run();
      deckRow = await loadDeck(env, roomId, signature);
    }
    return json({ ok: true, roomId, deckSignature: signature, deck: rowToDeck(deckRow) });
  }

  if (action === "room") {
    const participantId = str(body && body.participantId, 64);
    const roomRow = await loadRoom(env, roomId);
    if (!roomRow || roomRow.owner_id !== participantId) return json({ ok: false, message: "only room owner can change room" }, 403);
    await env.DB.prepare(
      "UPDATE meetup_rooms SET expected_count = ?, updated_at = ? WHERE room_id = ? AND owner_id = ?"
    ).bind(expectedCount(body && body.expectedCount), now, roomId, participantId).run();
    return json({ ok: true, roomId, room: rowToRoom(await loadRoom(env, roomId)) });
  }

  const participant = normalizeParticipant(body || {});
  if (!participant.id) return json({ ok: false, message: "empty participant id" }, 400);
  const ownerCandidate = str(body && body.ownerId, 64);
  let roomRow = await ensureRoom(env, roomId, ownerCandidate, body && body.expectedCount, now);
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
  roomRow = roomRow || await loadRoom(env, roomId);
  if (roomRow && roomRow.owner_id === participant.id) {
    await env.DB.prepare(
      "UPDATE meetup_rooms SET expected_count = ?, updated_at = ? WHERE room_id = ? AND owner_id = ?"
    ).bind(expectedCount(body && body.expectedCount), now, roomId, participant.id).run();
    roomRow = await loadRoom(env, roomId);
  }
  return json({ ok: true, roomId, room: rowToRoom(roomRow), participant: { ...participant, updatedAt: now } });
}
