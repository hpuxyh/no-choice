const assert = require("assert");
const engine = require("../utils/restaurantEngine");

const T = engine.__test;

function choice(question) {
  return { question, tags: [], scenes: [], needs: [] };
}

const context = engine.buildChoiceContext({
  problem: "人均金额100以下 自助餐",
  partySize: 2,
  budgetPerPerson: 150,
  sceneTags: [],
  needTags: [],
  moreTags: []
});
assert.match(context.question, /人均金额100以下/);
assert.doesNotMatch(context.question, /人均150元左右/);

const buffetPlan = T.localRestaurantSearchPlan(choice("人均金额100以下 自助餐"));
assert.deepStrictEqual(buffetPlan.keywords, ["自助餐"]);
assert.deepStrictEqual(buffetPlan.mustKeywords, ["自助餐"]);
assert.strictEqual(buffetPlan.strictMustKeywords, true);
assert.strictEqual(buffetPlan.minCost, 0);
assert.strictEqual(buffetPlan.maxCost, 100);
assert.strictEqual(buffetPlan.strictMaxCost, true);

const hotpotPlan = T.localRestaurantSearchPlan(choice("糟粕醋火锅"));
assert.deepStrictEqual(hotpotPlan.keywords, ["糟粕醋火锅"]);
assert.deepStrictEqual(hotpotPlan.searchRequests.map((item) => item.keyword), ["糟粕醋火锅"]);

const remotePlan = T.normalizeRestaurantSearchPlan({
  keywords: ["中餐", "火锅"],
  minCost: 120,
  maxCost: 300,
  searchRequests: [{ keyword: "中餐" }, { keyword: "火锅" }]
}, choice("人均100以下 自助餐"));
assert.deepStrictEqual(remotePlan.keywords, ["自助餐"]);
assert.strictEqual(remotePlan.maxCost, 100);
assert.strictEqual(remotePlan.strictMaxCost, true);
assert.deepStrictEqual(remotePlan.searchRequests.map((item) => item.keyword), ["自助餐"]);

const strictOptions = T.restaurantSearchOptions(buffetPlan);
const kept = T.preferredRestaurantPois([
  { id: "ok", name: "平价自助", cost: "88", searchKeyword: "自助餐" },
  { id: "high", name: "高价自助", cost: "138", searchKeyword: "自助餐" },
  { id: "unknown", name: "价格未知自助", cost: "", searchKeyword: "自助餐" },
  { id: "wrong", name: "普通火锅", cost: "68", searchKeyword: "火锅" }
], strictOptions);
assert.deepStrictEqual(kept.map((item) => item.id), ["ok"]);

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
global.wx = {
  setStorageSync() {},
  getStorageSync() { return null; },
  setInnerAudioOption() {},
  createInnerAudioContext() { return null; },
  getSystemInfoSync() { return { statusBarHeight: 20, windowWidth: 390 }; },
  getMenuButtonBoundingClientRect() { return { left: 320 }; }
};
require("../pages/play/play.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makePage(overrides = {}) {
  return {
    ...pageDefinition,
    ...overrides,
    data: { ...clone(pageDefinition.data), ...(overrides.data || {}) },
    setData(update, callback) {
      this.data = { ...this.data, ...update };
      if (callback) callback.call(this);
    },
    showToast() {}
  };
}

const rowsA = [
  { id: "member-b", role: "B", people: 1, location: "广州塔", latitude: 23.106, longitude: 113.324, pref: "糟粕醋火锅", travels: ["驾车"] },
  { id: "member-a", role: "A", people: 1, location: "天河体育中心", latitude: 23.136, longitude: 113.327, pref: "人均100以下", travels: ["地铁"] }
];
const rowsB = [rowsA[1], rowsA[0]];
const pageA = makePage({ data: { meetupRoomId: "room-same", meetupSharedMode: true, partySize: 2, multiAreaRows: rowsA } });
const pageB = makePage({ data: { meetupRoomId: "room-same", meetupSharedMode: true, partySize: 2, multiAreaRows: rowsB } });
assert.strictEqual(pageA.meetupDeckSignature("AI 模式"), pageB.meetupDeckSignature("AI 模式"));

let publishedCount = 0;
const ownerPage = makePage({
  publishMeetupRoomSettings(value) { publishedCount = value; return Promise.resolve(true); },
  data: {
    meetupRoomId: "room-owner",
    meetupSharedMode: true,
    meetupRoomIsOwner: true,
    meetupSelfId: "member-a",
    partySize: 2,
    multiAreaRows: rowsA
  }
});
ownerPage.adjustMeetupExpectedCount({ currentTarget: { dataset: { delta: 1 } } });
assert.strictEqual(ownerPage.data.partySize, 3);
assert.strictEqual(publishedCount, 3);
assert.match(ownerPage.data.meetupRoomSharePath, /count=3$/);

const guestPage = makePage({
  data: { meetupRoomId: "room-owner", meetupSharedMode: true, meetupRoomIsOwner: false, partySize: 3, multiAreaRows: rowsA }
});
guestPage.adjustMeetupExpectedCount({ currentTarget: { dataset: { delta: 1 } } });
assert.strictEqual(guestPage.data.partySize, 3);

console.log(JSON.stringify({
  buffet: buffetPlan.keywords,
  maxCost: buffetPlan.maxCost,
  hotpot: hotpotPlan.keywords,
  sharedSignature: pageA.meetupDeckSignature("AI 模式"),
  roomSize: ownerPage.data.partySize
}));
console.log("budget category room sync ok");
