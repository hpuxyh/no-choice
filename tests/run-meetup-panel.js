const assert = require("assert");
const engine = require("../utils/restaurantEngine");

const poiWithPartialRoutes = {
  meetup: {
    label: "北京大学 / 苏州街 / 360大厦",
    participantLabels: ["北京大学", "苏州街", "360大厦"],
    participantDistances: [
      { label: "北京大学", placeLabel: "北京大学", distance: 1300 },
      { label: "苏州街", placeLabel: "苏州街", distance: 950 },
      { label: "360大厦", placeLabel: "360大厦", distance: 760 }
    ],
    avgDistance: 1000,
    maxDistance: 1300
  },
  participantRoutes: [
    {
      label: "北京大学",
      placeLabel: "北京大学",
      straightDistanceMeters: 1300,
      drivingDistanceMeters: 2300,
      drivingDurationSeconds: 540,
      subwayDistanceMeters: 2000,
      subwayDurationSeconds: 1260,
      subwayWalkingDistanceMeters: 1100,
      hasSubway: true
    },
    {
      label: "苏州街",
      placeLabel: "苏州街",
      straightDistanceMeters: 950,
      drivingDistanceMeters: 1600,
      drivingDurationSeconds: 420,
      subwayDistanceMeters: 1800,
      subwayDurationSeconds: 1100,
      subwayWalkingDistanceMeters: 600,
      hasSubway: true
    }
  ]
};

const labels = engine.__test.restaurantMeetupExpectedLabels(poiWithPartialRoutes);
assert.deepStrictEqual(labels, ["北京大学", "苏州街", "360大厦"]);

const routes = engine.__test.restaurantMeetupRouteItems(poiWithPartialRoutes);
assert.deepStrictEqual(routes.map((route) => route.label), ["北京大学", "苏州街", "360大厦"]);
assert(routes[0].text.includes("北京大学："), "北京大学 should keep its route details");
assert(routes[1].text.includes("苏州街："), "苏州街 should keep its route details");
assert(routes[2].text.includes("360大厦： 760m"), `360大厦 should fall back to distance, got ${routes[2].text}`);

const detailRows = engine.__test.detailRouteRowsForPoi(poiWithPartialRoutes);
assert.deepStrictEqual(detailRows.map((route) => route.label), ["北京大学", "苏州街", "360大厦"]);
assert(detailRows[0].stats.some((stat) => stat.includes("驾车")), "detail route should keep driving stats");
assert(detailRows[2].stats.includes("760m"), "detail route should keep fallback distance for 360大厦");

const poiWithCurrentAliasRoute = {
  meetup: {
    label: "当前位置 / 苏州街",
    participantLabels: ["当前位置", "苏州街"],
    participantDistances: [
      { label: "当前位置", placeLabel: "当前位置", distance: 7000 },
      { label: "苏州街", placeLabel: "苏州街", distance: 7200 },
      { label: "同伴1", distance: 7000 }
    ],
    avgDistance: 7100,
    maxDistance: 7200
  },
  participantRoutes: [
    {
      label: "当前位置",
      placeLabel: "当前位置",
      straightDistanceMeters: 7000,
      drivingDistanceMeters: 10000,
      drivingDurationSeconds: 900,
      subwayDistanceMeters: 12000,
      subwayDurationSeconds: 2820,
      subwayWalkingDistanceMeters: 843,
      hasSubway: true
    },
    {
      label: "苏州街",
      placeLabel: "苏州街",
      straightDistanceMeters: 7200,
      drivingDistanceMeters: 10400,
      drivingDurationSeconds: 930,
      subwayDistanceMeters: 12300,
      subwayDurationSeconds: 2880,
      subwayWalkingDistanceMeters: 860,
      hasSubway: true
    },
    {
      label: "同伴1",
      straightDistanceMeters: 7000,
      drivingDistanceMeters: 10000,
      drivingDurationSeconds: 900,
      hasSubway: false
    }
  ]
};

const currentAliasLabels = engine.__test.restaurantMeetupExpectedLabels(poiWithCurrentAliasRoute);
assert.deepStrictEqual(currentAliasLabels, ["位置", "苏州街"]);
const currentAliasRoutes = engine.__test.restaurantMeetupRouteItems(poiWithCurrentAliasRoute);
assert.deepStrictEqual(currentAliasRoutes.map((route) => route.label), ["位置", "苏州街"]);
assert(!currentAliasRoutes.some((route) => /同伴1/.test(`${route.label}${route.text}`)), "current location should not be displayed as 同伴1");
const currentAliasDetailRows = engine.__test.detailRouteRowsForPoi(poiWithCurrentAliasRoute);
assert.deepStrictEqual(currentAliasDetailRows.map((route) => route.label), ["位置", "苏州街"]);

console.log(JSON.stringify({
  labels,
  routes: routes.map((route) => ({ label: route.label, text: route.text })),
  currentAliasLabels,
  currentAliasRoutes: currentAliasRoutes.map((route) => ({ label: route.label, text: route.text }))
}, null, 2));
console.log("meetup panel ok");
