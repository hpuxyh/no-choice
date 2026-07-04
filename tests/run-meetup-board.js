const assert = require("assert");
const engine = require("../utils/restaurantEngine");

assert.strictEqual(typeof engine.resolveMeetupRoomBoard, "function", "应导出 resolveMeetupRoomBoard");
assert.strictEqual(typeof engine.__test.resolveMeetupRoomBoard, "function");
assert.strictEqual(typeof engine.__test.meetupBoardMapGeometry, "function");
assert.strictEqual(typeof engine.__test.meetupBoardRangeRadius, "function");
assert.strictEqual(typeof engine.__test.meetupParticipantFromKnownCoords, "function");

const participants = [
  { label: "我", short: "我", location: { lat: 39.98, lng: 116.31 } },
  { label: "朋友", short: "友", location: { lat: 39.91, lng: 116.43 } }
];
const middle = { lat: 39.945, lng: 116.37 };
const rangeRadius = engine.__test.meetupBoardRangeRadius(participants);
assert(rangeRadius >= 1000 && rangeRadius <= 3000, "组局范围应收束在 1-3km");
const geometry = engine.__test.meetupBoardMapGeometry(participants, middle, 4500, "中关村");
assert.strictEqual(geometry.markers.length, 3, "两个人 + 中点应有 3 个 marker");
assert.deepStrictEqual(geometry.markers[0].anchor, { x: 0.5, y: 1 }, "成员 marker 应用定位针针尖对齐坐标");
assert.deepStrictEqual(geometry.markers[2].anchor, { x: 0.5, y: 1 }, "中点 marker 应用定位针针尖对齐坐标");
assert(geometry.polylines.length > 2, "每个人到中点应拆成多段长虚线");
assert.strictEqual(geometry.circles.length, 1, "有范围半径时应画圈");
assert.strictEqual(geometry.circles[0].radius, 3000);
assert.strictEqual(geometry.circles[0].color, "#f6c518cc");
assert.strictEqual(geometry.circles[0].fillColor, "#00000000");
assert(geometry.polylines.every((line) => line.dottedLine === false), "长虚线不应使用地图默认 dottedLine");
assert.strictEqual(geometry.includePoints.length, 3);
assert(geometry.polylines.some((line) => (
  line.points[1].latitude === middle.lat && line.points[1].longitude === middle.lng
)), "每组长虚线最后一段应抵达中点");

const pickedHost = engine.__test.meetupParticipantFromKnownCoords(
  { isHost: true, roleShort: "我", location: "北京西站", latitude: 39.89491, longitude: 116.32206 },
  { label: "劲松七区", addressMeta: "劲松七区", lat: 39.88, lng: 116.46 }
);
assert.strictEqual(pickedHost.placeLabel, "北京西站", "host 已选出发地时不应用当前 GPS 名称");
assert.strictEqual(pickedHost.location.lat, 39.89491, "host 已选出发地时应使用行内坐标");

const currentHost = engine.__test.meetupParticipantFromKnownCoords(
  { isHost: true, roleShort: "我", location: "" },
  { label: "劲松七区", addressMeta: "劲松七区", lat: 39.88, lng: 116.46 }
);
assert.strictEqual(currentHost.placeLabel, "劲松七区", "host 没填出发地时才使用当前 GPS");

(async () => {
  // 少于 2 行 → 直接 null(不触发网络)
  const r1 = await engine.resolveMeetupRoomBoard([{ isHost: true, location: "" }], null);
  assert.strictEqual(r1, null, "不足两人应返回 null");

  // host 无坐标 + 朋友位都空 → 可解析参与者 < 2 → null(不触发网络)
  const r2 = await engine.resolveMeetupRoomBoard([
    { isHost: true, location: "" },
    { location: "" },
    { location: "" }
  ], null);
  assert.strictEqual(r2, null, "无可解析位置应返回 null");

  // 当前位置类提示也不算可解析地点 → null(不触发网络)
  const r3 = await engine.resolveMeetupRoomBoard([
    { location: "当前位置" },
    { location: "我的位置" }
  ], null);
  assert.strictEqual(r3, null, "仅当前位置类提示应返回 null");

  console.log("meetup board guards ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
