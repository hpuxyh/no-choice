// 零上传·行为养成:从用户在 App 内的每次选择反推消费习惯。
// 数据先存本地(wx.setStorageSync),并以「匿名设备ID + 仅行为字段」批量上报到运营后台。
// 不收集姓名/手机号等个人信息;上线前需在隐私协议声明。
const { matchChainBrand } = require("./brandData");

const DEVICE_KEY = "consumer_device_id";
const EVENTS_KEY = "consumer_events";        // 本地全量事件(用于算画像)
const PENDING_KEY = "consumer_pending_track"; // 待上报队列
const TRACKING_KEY = "consumer_tracking_on";  // 是否开启上报

const MAX_EVENTS = 300;   // 本地事件环形上限
const MAX_PENDING = 500;  // 待上报上限
const FLUSH_DELAY_MS = 4000;
const WORKER_API_BASE = "https://no-choice.pages.dev";
const TRACK_ENDPOINT = WORKER_API_BASE ? `${WORKER_API_BASE}/api/track` : "";

let flushTimer = null;

// ——— 存储封装(node 环境下 wx 不存在时安全降级) ———
function hasWx() {
  return typeof wx !== "undefined" && wx && typeof wx.getStorageSync === "function";
}
function storageGet(key, fallback) {
  if (!hasWx()) return fallback;
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined || value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}
function storageSet(key, value) {
  if (!hasWx()) return;
  try { wx.setStorageSync(key, value); } catch (error) {}
}

function randomHex() {
  return Math.floor(Math.random() * 16).toString(16);
}
function uuid() {
  let out = "";
  for (let i = 0; i < 24; i += 1) out += randomHex();
  return `d_${out}`;
}

function getDeviceId() {
  let id = storageGet(DEVICE_KEY, "");
  if (!id) {
    id = uuid();
    storageSet(DEVICE_KEY, id);
  }
  return id;
}

function isTrackingEnabled() {
  return storageGet(TRACKING_KEY, true) !== false;
}
function setTrackingEnabled(enabled) {
  storageSet(TRACKING_KEY, Boolean(enabled));
}

// ——— 字段归一化 ———
function priceBand(cost) {
  const value = Number(cost);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 20) return "0-20";
  if (value < 40) return "20-40";
  if (value < 80) return "40-80";
  if (value < 150) return "80-150";
  return "150+";
}

// 品类:分支(咖啡奶茶/外卖)优先,否则按门店名/类型粗分,兜底「正餐」
function inferCategory(card = {}) {
  if (card.category === "drink") return "咖啡奶茶";
  if (card.category === "food") return "美食外卖";
  const text = `${card.name || ""} ${card.type || ""}`;
  if (/咖啡|奶茶|茶饮|饮品|甜品/.test(text)) return "咖啡奶茶";
  if (/快餐|简餐|汉堡|炸鸡|小吃|盖饭|面|米线|麻辣烫/.test(text)) return "美食外卖";
  return "正餐";
}

function currentHour() {
  try { return new Date().getHours(); } catch (error) { return -1; }
}
function nowTs() {
  try { return Date.now(); } catch (error) { return 0; }
}

// 把一次选择/动作归一成事件
function buildEvent(type, card = {}, extra = {}) {
  const brand = matchChainBrand(card.name);
  return {
    ts: nowTs(),
    type,                                  // pick(拍板) | navigate(去导航) | order(去下单) | reroll | skip;navigate/order 为强正向
    brand: brand ? brand.name : "",
    name: String(card.name || "").slice(0, 40),
    category: inferCategory(card),
    priceBand: priceBand(card.cost),
    hour: currentHour(),
    city: String(extra.city || card.city || "").slice(0, 20)
  };
}

// ——— 记录 + 上报 ———
function recordEvent(type, card, extra) {
  if (!isTrackingEnabled()) return null;
  const event = buildEvent(type, card, extra);
  const events = storageGet(EVENTS_KEY, []);
  events.push(event);
  while (events.length > MAX_EVENTS) events.shift();
  storageSet(EVENTS_KEY, events);

  const pending = storageGet(PENDING_KEY, []);
  pending.push(event);
  while (pending.length > MAX_PENDING) pending.shift();
  storageSet(PENDING_KEY, pending);

  scheduleFlush();
  return event;
}

function scheduleFlush() {
  if (!hasWx() || typeof wx.request !== "function") return;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushUpload();
  }, FLUSH_DELAY_MS);
}

// 批量上报待发事件;成功后清空队列。后端没上线/失败则保留,下次再发。
function flushUpload() {
  if (!isTrackingEnabled() || !TRACK_ENDPOINT) return;
  if (!hasWx() || typeof wx.request !== "function") return;
  const pending = storageGet(PENDING_KEY, []);
  if (!pending.length) return;
  const batch = pending.slice();
  wx.request({
    url: TRACK_ENDPOINT,
    method: "POST",
    header: { "content-type": "application/json" },
    timeout: 6000,
    data: { deviceId: getDeviceId(), events: batch },
    success: (res) => {
      const ok = res && res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok;
      if (ok) {
        const rest = storageGet(PENDING_KEY, []).slice(batch.length);
        storageSet(PENDING_KEY, rest);
      }
    },
    fail: () => {}
  });
}

// ——— 画像计算(本地) ———
function tally(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}
function topEntries(map, limit) {
  return Object.keys(map)
    .map((key) => ({ key, count: map[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// 「去导航」「去下单」是强正向,计 2 分;普通拍板计 1 分
function eventWeight(event) {
  return event && (event.type === "navigate" || event.type === "order") ? 2 : 1;
}

function computeProfile(eventsInput) {
  const events = Array.isArray(eventsInput) ? eventsInput : storageGet(EVENTS_KEY, []);
  const brands = {};
  const categories = {};
  const prices = {};
  const hours = {};
  let lastTs = 0;
  events.forEach((event) => {
    const weight = eventWeight(event);
    for (let i = 0; i < weight; i += 1) {
      tally(brands, event.brand);
      tally(categories, event.category);
      tally(prices, event.priceBand);
    }
    if (event.hour >= 0) tally(hours, String(event.hour));
    if (event.ts > lastTs) lastTs = event.ts;
  });
  const topPrice = topEntries(prices, 1)[0];
  return {
    totalEvents: events.length,
    topBrands: topEntries(brands, 8),
    topCategories: topEntries(categories, 5),
    priceBand: topPrice ? topPrice.key : "",
    topHours: topEntries(hours, 3),
    lastUpdated: lastTs
  };
}

function getProfile() {
  return computeProfile();
}

// 给推荐排序用:用户最常点的连锁品牌(标准名)
function getPreferredBrands(limit = 5) {
  return computeProfile().topBrands.map((item) => item.key).filter(Boolean).slice(0, limit);
}

function clearProfile() {
  storageSet(EVENTS_KEY, []);
  storageSet(PENDING_KEY, []);
}

module.exports = {
  getDeviceId,
  isTrackingEnabled,
  setTrackingEnabled,
  recordEvent,
  flushUpload,
  computeProfile,
  getProfile,
  getPreferredBrands,
  clearProfile,
  // 测试用
  __test: { buildEvent, priceBand, inferCategory, eventWeight, TRACK_ENDPOINT }
};
