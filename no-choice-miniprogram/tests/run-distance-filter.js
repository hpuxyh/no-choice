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

console.log(JSON.stringify({
  kept: filtered.map((poi) => poi.name),
  cappedRadius: requests[0].radiusMeters,
  normalizedRadius: normalizedPlan.radiusMeters
}));
console.log("distance filter ok");
