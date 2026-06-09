const assert = require("assert");

const engine = require("../utils/restaurantEngine");

const center = { lat: 39.904179, lng: 116.407387 };
const pois = [
  {
    id: "near",
    name: "5公里内餐厅",
    distance: 3200,
    location: { lat: 39.914, lng: 116.407 }
  },
  {
    id: "far-location",
    name: "15公里外餐厅",
    distance: 15000,
    location: { lat: 40.039, lng: 116.407 }
  },
  {
    id: "far-amap-distance",
    name: "无坐标但高德距离超限",
    distance: 15000
  },
  {
    id: "unknown-distance",
    name: "无坐标无距离餐厅"
  },
  {
    id: "near-bad-nav",
    name: "附近餐厅但导航点异常",
    distance: 2800,
    location: { lat: 39.914, lng: 116.409 },
    navLocation: { lat: 41.58, lng: 120.45 }
  }
];

const filtered = engine.__test.filterRestaurantPoisWithinSearchRadius(pois, center, 5000);
assert.deepStrictEqual(filtered.map((poi) => poi.id), ["near", "near-bad-nav"]);
assert.deepStrictEqual(filtered.find((poi) => poi.id === "near-bad-nav").navLocation, { lat: 39.914, lng: 116.409 });
const cardFiltered = engine.__test.filterRestaurantCardsWithinSearchRadius([
  { id: "card-near", poi: pois[0] },
  { id: "card-far", poi: pois[1] }
], center, 5000);
assert.deepStrictEqual(cardFiltered.map((card) => card.id), ["card-near"]);
assert.strictEqual(engine.__test.isPreciseRestaurantSearchCenter({ lat: 39.9, lng: 116.4, label: "当前位置" }), true);
assert.strictEqual(engine.__test.isPreciseRestaurantSearchCenter({ lat: 39.9, lng: 116.4, label: "北京市朝阳区朝外街道朝外南街" }), true);
assert.strictEqual(engine.__test.isPreciseRestaurantSearchCenter({ lat: 39.9, lng: 116.4, label: "北京" }), false);
const allowedCity = engine.__test.restaurantAllowedCityFromCoords({
  lat: 39.9,
  lng: 116.4,
  label: "北京市朝阳区朝外街道朝外南街"
});
assert.strictEqual(allowedCity, "北京市");
const cityFiltered = engine.__test.filterRestaurantPoisWithinAllowedCity([
  { id: "beijing", area: "北京市 朝阳区", address: "朝阳门外大街", location: center },
  { id: "qingdao", area: "山东省 青岛市", address: "市北区", location: { lat: 36.08, lng: 120.37 } },
  { id: "qingdao-beijing-road", area: "青岛市 市北区", address: "北京路", location: { lat: 36.08, lng: 120.37 } },
  { id: "qingdao-no-city-text", name: "万与千三六九街头火锅", address: "", area: "", location: { lat: 36.08, lng: 120.37 } },
  { id: "unknown-city", address: "朝外南街", location: center }
], allowedCity);
assert.deepStrictEqual(cityFiltered.map((poi) => poi.id), ["beijing", "unknown-city"]);
const cityCardFiltered = engine.__test.filterRestaurantCardsWithinAllowedCity([
  { id: "card-beijing", poi: { area: "北京市 海淀区", address: "苏州街" } },
  { id: "card-qingdao", poi: { area: "青岛市 市北区", address: "北京路" } },
  { id: "card-qingdao-no-city-text", poi: { name: "万与千三六九街头火锅", location: { lat: 36.08, lng: 120.37 } } }
], allowedCity);
assert.deepStrictEqual(cityCardFiltered.map((card) => card.id), ["card-beijing"]);

const requests = engine.__test.restaurantAmapRequests(5000, ["烤肉"], {
  searchRequests: [
    { keyword: "烤肉", radiusMeters: 15000, types: "050100" }
  ]
});
assert.strictEqual(requests[0].radiusMeters, 5000);

const normalizedPlan = engine.__test.normalizeRestaurantSearchPlan({
  radiusMeters: 3500,
  keywords: ["烤肉", "烧烤"],
  searchRequests: [
    { keyword: "烤肉", radiusMeters: 5000 },
    { keyword: "烧烤", radiusMeters: 5000 }
  ]
}, {
  question: "想吃烤肉，限制5公里以内",
  tags: ["烧烤"],
  scenes: [],
  needs: []
});
assert.strictEqual(normalizedPlan.radiusMeters, 5000);
assert.deepStrictEqual(normalizedPlan.searchRequests.map((item) => item.radiusMeters), [5000, 5000]);

const currentOnlyChoice = {
  question: "火锅",
  tags: ["火锅"],
  scenes: [],
  needs: ["火锅"]
};
const currentOnlyPlan = engine.__test.applyChoiceIntentOverrides(
  engine.__test.localRestaurantSearchPlan(currentOnlyChoice),
  currentOnlyChoice,
  {
    fields: {
      people: "共2人",
      middle: "不取中间点，按当前位置找",
      restaurantTypes: "火锅",
      budget: "人均约100-200元",
      locationDistance: "在你当前位置附近找，约4km内"
    }
  }
);
assert.deepStrictEqual(currentOnlyPlan.locationHints || [], []);
assert.strictEqual(Boolean(currentOnlyPlan.includeCurrentLocationInMeetup), false);
assert.strictEqual(currentOnlyPlan.locationHint || "", "");

const remoteCurrentOnlyPlan = engine.__test.normalizeRestaurantSearchPlan({
  keywords: ["火锅"],
  locationHint: "你当前位置",
  locationHints: ["你当前位置"],
  includeCurrentLocationInMeetup: true,
  locationIntent: {
    strategy: "current_plus_friend_midpoint",
    participantLocations: ["你当前位置"]
  }
}, currentOnlyChoice);
assert.deepStrictEqual(remoteCurrentOnlyPlan.locationHints || [], []);
assert.strictEqual(Boolean(remoteCurrentOnlyPlan.includeCurrentLocationInMeetup), false);
assert.strictEqual(remoteCurrentOnlyPlan.locationHint || "", "");

const controlledFriendChoice = engine.buildChoiceContext({
  problem: "朋友聚餐 朋友在国贸",
  sceneTags: [],
  needTags: [],
  moreTags: [],
  partySize: 2,
  budgetPerPerson: 150
});
assert.strictEqual(controlledFriendChoice.question, "朋友聚餐 朋友在国贸 共2人，人均150元左右");
assert.deepStrictEqual(engine.__test.extractedRestaurantParticipantLocationNames(controlledFriendChoice), ["国贸"]);
const controlledFriendPlan = engine.__test.localRestaurantSearchPlan(controlledFriendChoice);
assert.deepStrictEqual(controlledFriendPlan.locationHints, ["国贸"]);
const ensuredControlledFriendPlan = engine.__test.ensureRestaurantMeetupPlanForMode(controlledFriendPlan, controlledFriendChoice);
assert.strictEqual(ensuredControlledFriendPlan.includeCurrentLocationInMeetup, true);

console.log(JSON.stringify({
  kept: filtered.map((poi) => poi.name),
  cappedRadius: requests[0].radiusMeters,
  normalizedRadius: normalizedPlan.radiusMeters
}));
console.log("distance filter ok");
