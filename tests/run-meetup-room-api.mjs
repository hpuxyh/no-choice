import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const source = fs.readFileSync(new URL("../server/functions/api/meetup-room.js", import.meta.url), "utf8");
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

class D1Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    return this.db.prepare(this.sql).run(...this.args);
  }

  async all() {
    return { results: this.db.prepare(this.sql).all(...this.args) };
  }

  async first() {
    return this.db.prepare(this.sql).get(...this.args) || null;
  }
}

const sqlite = new DatabaseSync(":memory:");
const env = { DB: { prepare(sql) { return new D1Statement(sqlite, sql); } } };

async function post(body) {
  return api.onRequestPost({
    env,
    request: new Request("https://example.test/api/meetup-room", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  });
}

async function get(roomId, deckSignature = "") {
  const query = new URLSearchParams({ roomId });
  if (deckSignature) query.set("deckSignature", deckSignature);
  return api.onRequestGet({
    env,
    request: new Request(`https://example.test/api/meetup-room?${query}`)
  });
}

async function body(response) {
  return JSON.parse(await response.text());
}

let response = await post({
  roomId: "room-one",
  ownerId: "host",
  expectedCount: 2,
  participant: { id: "host", name: "Alice", location: "徐家汇", lat: 31.19, lng: 121.43 }
});
assert.equal(response.status, 200);
let data = await body(response);
assert.equal(data.room.ownerId, "host");
assert.equal(data.room.expectedCount, 2);

response = await post({
  roomId: "room-one",
  participant: { id: "guest", name: "Bob", location: "静安寺", lat: 31.22, lng: 121.45 }
});
assert.equal(response.status, 200);

data = await body(await get("room-one"));
assert.deepEqual(data.participants.map((item) => item.id), ["host", "guest"]);
assert.equal(data.room.ownerId, "host");

response = await post({ action: "room", roomId: "room-one", participantId: "guest", expectedCount: 3 });
assert.equal(response.status, 403);
response = await post({ action: "room", roomId: "room-one", participantId: "host", expectedCount: 3 });
assert.equal(response.status, 200);
data = await body(response);
assert.equal(data.room.expectedCount, 3);

const signature = "room-deck-v1-same";
const firstDeck = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const competingDeck = [{ id: "c", name: "C" }];
data = await body(await post({
  action: "deck",
  roomId: "room-one",
  participantId: "host",
  deckSignature: signature,
  deck: firstDeck
}));
assert.deepEqual(data.deck, firstDeck);
data = await body(await post({
  action: "deck",
  roomId: "room-one",
  participantId: "guest",
  deckSignature: signature,
  deck: competingDeck
}));
assert.deepEqual(data.deck, firstDeck);
data = await body(await get("room-one", signature));
assert.deepEqual(data.deck, firstDeck);

await post({
  roomId: "room-two",
  ownerId: "host-two",
  expectedCount: 2,
  participant: { id: "host-two", name: "Carol", location: "广州塔" }
});
data = await body(await post({
  action: "deck",
  roomId: "room-two",
  participantId: "host-two",
  deckSignature: signature,
  deck: competingDeck
}));
assert.deepEqual(data.deck, competingDeck);
assert.deepEqual((await body(await get("room-one", signature))).deck, firstDeck);

console.log(JSON.stringify({ roomOneDeck: firstDeck.map((item) => item.id), roomTwoDeck: competingDeck.map((item) => item.id) }));
console.log("meetup room api ok");
