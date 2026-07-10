import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const source = fs.readFileSync(new URL("../server/functions/api/shared-card.js", import.meta.url), "utf8");
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

  async first() {
    return this.db.prepare(this.sql).get(...this.args) || null;
  }
}

const sqlite = new DatabaseSync(":memory:");
const env = { DB: { prepare(sql) { return new D1Statement(sqlite, sql); } } };

async function post(body) {
  return api.onRequestPost({
    env,
    request: new Request("https://example.test/api/shared-card", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  });
}

async function get(shareId) {
  return api.onRequestGet({
    env,
    request: new Request(`https://example.test/api/shared-card?shareId=${encodeURIComponent(shareId)}`)
  });
}

async function body(response) {
  return JSON.parse(await response.text());
}

const firstId = "card-test-first-1234567890";
const firstCard = {
  id: "poi-a",
  name: "第一家餐厅",
  address: "测试路 1 号",
  photoGallery: ["https://example.test/a.jpg"],
  arrivalBoard: { rows: [{ label: "Alice", recommendedText: "步行 8 分钟" }] }
};
let response = await post({
  shareId: firstId,
  roomId: "room-one",
  participantId: "host",
  card: firstCard,
  settleText: "就这家",
  departureAdvice: ["18:30 出发"]
});
assert.equal(response.status, 200);
let data = await body(response);
assert.equal(data.shareId, firstId);
assert.deepEqual(data.result.card, firstCard);

response = await get(firstId);
assert.equal(response.status, 200);
data = await body(response);
assert.deepEqual(data.result.card, firstCard);
assert.equal(data.result.settleText, "就这家");
assert.deepEqual(data.result.departureAdvice, ["18:30 出发"]);

// A share id is immutable: a retry cannot replace the card everyone already received.
response = await post({
  shareId: firstId,
  card: { id: "poi-b", name: "不应覆盖" },
  settleText: "另一张"
});
assert.equal(response.status, 200);
data = await body(response);
assert.deepEqual(data.result.card, firstCard);

const secondId = "card-test-second-1234567890";
const secondCard = { id: "poi-c", name: "另一个分享结果" };
data = await body(await post({ shareId: secondId, roomId: "room-two", card: secondCard }));
assert.deepEqual(data.result.card, secondCard);
assert.deepEqual((await body(await get(firstId))).result.card, firstCard);

response = await get("bad");
assert.equal(response.status, 400);
response = await get("card-missing-share-1234567890");
assert.equal(response.status, 404);

console.log(JSON.stringify({ first: firstCard.id, second: secondCard.id, immutable: true }));
console.log("shared card api ok");

