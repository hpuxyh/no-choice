// 零上传行为养成回归测试(用内存 wx 桩跑通记录/画像/上报)
const assert = require("assert");

const store = {};
global.wx = {
  getStorageSync: (k) => (k in store ? store[k] : ""),
  setStorageSync: (k, v) => { store[k] = v; }
  // 故意不提供 request:避免 recordEvent 触发 4s 上报定时器挂住进程
};

const cp = require("../utils/consumerProfile");

// 1. 字段归一化
assert.strictEqual(cp.__test.priceBand(25), "20-40");
assert.strictEqual(cp.__test.priceBand(0), "");
assert.strictEqual(cp.__test.priceBand(200), "150+");
assert.strictEqual(cp.__test.inferCategory({ category: "drink" }), "咖啡奶茶");
assert.strictEqual(cp.__test.inferCategory({ category: "food" }), "美食外卖");
assert.strictEqual(cp.__test.inferCategory({ name: "海底捞火锅" }), "正餐");
assert.strictEqual(cp.__test.eventWeight({ type: "navigate" }), 2);
assert.strictEqual(cp.__test.eventWeight({ type: "pick" }), 1);

// 2. 设备ID稳定
const id1 = cp.getDeviceId();
assert.ok(id1 && id1 === cp.getDeviceId());

// 3. 记录 + 画像:去导航(权重2)让瑞幸压过麦当劳
cp.recordEvent("pick", { name: "瑞幸咖啡(A店)", category: "drink", cost: "22" });
cp.recordEvent("navigate", { name: "瑞幸咖啡(B店)", category: "drink", cost: "22" });
cp.recordEvent("pick", { name: "麦当劳(X店)", category: "food", cost: "35" });
const p = cp.getProfile();
assert.strictEqual(p.totalEvents, 3);
assert.strictEqual(p.topBrands[0].key, "瑞幸咖啡");
assert.strictEqual(p.topCategories[0].key, "咖啡奶茶");
assert.strictEqual(p.priceBand, "20-40");
assert.ok(cp.getPreferredBrands().includes("瑞幸咖啡"));

// 4. 上报:补上 request 桩,flush 后清空待发队列
let sent = null;
global.wx.request = (opts) => { sent = opts.data; opts.success({ statusCode: 200, data: { ok: true } }); };
cp.flushUpload();
assert.ok(sent && sent.deviceId === id1 && sent.events.length === 3);
assert.deepStrictEqual(store["consumer_pending_track"], []);

// 5. 关闭上报:不再记录
cp.setTrackingEnabled(false);
assert.strictEqual(cp.isTrackingEnabled(), false);
assert.strictEqual(cp.recordEvent("pick", { name: "喜茶" }), null);

// 6. 清空画像
cp.setTrackingEnabled(true);
cp.clearProfile();
assert.strictEqual(cp.getProfile().totalEvents, 0);

console.log("run-consumer-profile: all assertions passed");
