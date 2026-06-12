const assert = require("assert");
const engine = require("../utils/restaurantEngine");

const choice = {
  question: "吃饭",
  tags: [],
  scenes: [],
  needs: [],
  partySize: 3
};

const basePlan = engine.__test.localRestaurantSearchPlan(choice);
const overrides = engine.__test.normalizeChoiceIntentOverrides({
  fields: {
    scene: "吃饭选择",
    people: "共2人",
    middle: "不取中间点，直接在国贸附近找",
    restaurantTypes: "西餐、安静餐厅",
    budget: "人均约100-200元",
    locationDistance: "在国贸附近找，约4km内"
  },
  basePlan
});

const plan = engine.__test.applyChoiceIntentOverrides(basePlan, choice, overrides);

assert.deepStrictEqual(plan.keywords.slice(0, 2), ["西餐", "安静餐厅"]);
assert.strictEqual(plan.minCost, 100);
assert.strictEqual(plan.maxCost, 200);
assert.strictEqual(plan.radiusMeters, 4000);
assert.strictEqual(plan.locationHint, "国贸");
assert.strictEqual(plan.source, "manual");
assert.strictEqual(plan.searchRequests[0].keyword, "西餐");
assert.strictEqual(plan.searchRequests[0].radiusMeters, 4000);
assert.strictEqual(overrides.fields.people, undefined);
assert.strictEqual(plan.sceneIntent.totalParticipantCount, 3);

console.log(JSON.stringify({
  keywords: plan.keywords,
  budget: [plan.minCost, plan.maxCost],
  radiusMeters: plan.radiusMeters,
  locationHint: plan.locationHint,
  firstSearchRequest: plan.searchRequests[0]
}));
console.log("manual intent overrides ok");
