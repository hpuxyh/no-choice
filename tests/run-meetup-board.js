const assert = require("assert");
const engine = require("../utils/restaurantEngine");

assert.strictEqual(typeof engine.resolveMeetupRoomBoard, "function", "应导出 resolveMeetupRoomBoard");
assert.strictEqual(typeof engine.__test.resolveMeetupRoomBoard, "function");

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
