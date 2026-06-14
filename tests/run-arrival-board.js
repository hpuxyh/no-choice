const assert = require("assert");
const engine = require("../utils/restaurantEngine");

const board = engine.__test.restaurantArrivalBoard({
  participantRoutes: [
    { placeLabel: "望京", drivingDurationSeconds: 12 * 60, subwayDurationSeconds: 20 * 60, subwayWalkingDistanceMeters: 300, walkingDurationSeconds: 70 * 60 },
    { placeLabel: "西二旗", drivingDurationSeconds: 19 * 60, subwayDurationSeconds: 23 * 60, subwayWalkingDistanceMeters: 360, walkingDurationSeconds: 88 * 60 },
    { placeLabel: "国贸", drivingDurationSeconds: 16 * 60, subwayDurationSeconds: 18 * 60, subwayWalkingDistanceMeters: 0, walkingDurationSeconds: 14 * 60 }
  ]
});

assert.ok(board, "应生成到达榜");
assert.strictEqual(board.rows.length, 3);

// 国贸 步行 14 分钟(≤15)→ 推荐步行
const guomao = board.rows[2];
assert.strictEqual(guomao.recommendedKey, "walk", "≤15分钟应推荐步行");

// 望京 步行太远 → 驾车(12)比地铁(20)快 → 推荐驾车
const wangjing = board.rows[0];
assert.strictEqual(wangjing.recommendedKey, "drive", "应在驾车/地铁中取更快");
assert.strictEqual(wangjing.recommendedMin, 12);

// 最远应是按推荐方式分钟数最大的人:望京12 / 西二旗19 / 国贸14 → 西二旗
assert.strictEqual(board.farthestLabel, "西二旗");
assert.strictEqual(board.rows[1].farthest, true);
assert.strictEqual(board.farthestMin, 19);

// 地铁分段:西二旗 subwayWalk 360m → 步行约5分,乘车=23-5*2=13
const xeqSubway = board.rows[1].modes.find((m) => m.key === "subway");
assert.ok(xeqSubway.walkMin >= 4 && xeqSubway.walkMin <= 6, "地铁步行段约5分");
assert.strictEqual(xeqSubway.rideMin, 23 - xeqSubway.walkMin * 2);

// 步行超30分应标记 tooFar
const wjWalk = wangjing.modes.find((m) => m.key === "walk");
assert.strictEqual(wjWalk.tooFar, true);

// 少于2人不出榜
assert.strictEqual(engine.__test.restaurantArrivalBoard({ participantRoutes: [{ placeLabel: "望京", drivingDurationSeconds: 600 }] }), null);

console.log(JSON.stringify({
  farthest: board.farthestLabel,
  recs: board.rows.map((r) => `${r.label}:${r.recommendedKey}${r.recommendedMin}`)
}));
console.log("arrival board ok");
