const assert = require("assert");
const engine = require("../utils/restaurantEngine");

const choice = {
  question: "朋友聚餐 朋友在上海静安 我在徐家汇",
  tags: ["朋友聚餐"],
  scenes: ["朋友聚餐"],
  needs: []
};

assert.deepStrictEqual(
  engine.__test.extractedRestaurantParticipantLocationNames(choice),
  ["上海静安", "徐家汇"]
);

const compoundPlan = engine.__test.localRestaurantSearchPlan({
  question: "想吃火锅和烤肉",
  tags: [],
  scenes: [],
  needs: []
});

assert.deepStrictEqual(compoundPlan.keywords, ["火锅", "烤肉"]);
assert.deepStrictEqual(compoundPlan.searchRequests.map((request) => request.keyword), ["火锅", "烤肉"]);

const targetCity = engine.__test.restaurantAllowedCityFromCoords({
  lat: 31.2397,
  lng: 121.4998,
  city: "上海市",
  label: "上海外滩附近"
});
const currentCity = engine.__test.restaurantAllowedCityFromCoords({
  lat: 39.9042,
  lng: 116.4074,
  city: "北京市",
  label: "北京市"
});
const allowedCity = targetCity || currentCity;

assert.strictEqual(allowedCity, "上海市");
assert.strictEqual(engine.__test.restaurantPoiMatchesAllowedCity({
  name: "外滩餐厅",
  city: "上海市",
  area: "黄浦区",
  location: "121.4998,31.2397"
}, allowedCity), true);
assert.strictEqual(engine.__test.restaurantPoiMatchesAllowedCity({
  name: "北京餐厅",
  city: "北京市",
  area: "朝阳区",
  location: "116.4074,39.9042"
}, allowedCity), false);

console.log(JSON.stringify({ allowedCity, compoundKeywords: compoundPlan.keywords }));
console.log("engine regressions ok");
