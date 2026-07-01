// 「咖啡 / 奶茶 / 美食外卖」分支回归测试
const assert = require("assert");
const engine = require("../utils/restaurantEngine");
const { matchChainBrand, brandNewDrop, orderAppIdForBrand, ORDER_TARGETS, CATEGORY_PRESETS } = require("../utils/brandData");

// 1. 品牌识别:门店名带后缀也能命中标准品牌名,且归类到 coffee / milktea
assert.strictEqual(matchChainBrand("瑞幸咖啡(中关村店)").name, "瑞幸咖啡");
assert.strictEqual(matchChainBrand("瑞幸咖啡(中关村店)").category, "coffee");
assert.strictEqual(matchChainBrand("一点点(B店)").category, "milktea");
assert.strictEqual(matchChainBrand("KFC 肯德基(西单店)").name, "肯德基");
assert.strictEqual(matchChainBrand("某不知名小店"), null);
// 1b. 扩充后的精品咖啡品牌也能识别(英文/带符号门店名)
assert.strictEqual(matchChainBrand("M Stand咖啡(乐成中心店)").name, "M Stand");
assert.strictEqual(matchChainBrand("Peet's 皮爷咖啡(双井富力广场店)").name, "Peet's皮爷咖啡");
assert.strictEqual(matchChainBrand("% Arabica阿拉比卡咖啡(朝阳店)").name, "% Arabica");
assert.strictEqual(matchChainBrand("Grid Coffee·咖啡(乐成中心店)").name, "Grid Coffee");
assert.strictEqual(matchChainBrand("LAVAZZA拉瓦萨咖啡(富力广场店)").name, "LAVAZZA");

// 2. 新品查询:有维护的品牌返回新品,没有的返回空串
assert.ok(brandNewDrop("瑞幸咖啡"));
assert.strictEqual(brandNewDrop("一点点"), "");

// 3. buildChoiceContext:categoryMode 透传成 choice.category;多人模式下不透传
assert.strictEqual(engine.buildChoiceContext({ categoryMode: "coffee", areaMode: "single" }).category, "coffee");
assert.strictEqual(engine.buildChoiceContext({ categoryMode: "milktea", areaMode: "single" }).category, "milktea");
assert.strictEqual(
  engine.buildChoiceContext({
    categoryMode: "coffee",
    areaMode: "multi",
    multiAreaRows: [{ location: "中关村", people: 1 }, { location: "国贸", people: 1 }]
  }).category,
  ""
);

// 4. applyRestaurantCategoryPlan:咖啡 / 奶茶分支强制各自饮品关键词、不限价、范围收敛到预设
const basePlan = engine.__test.localRestaurantSearchPlan({ question: "想吃火锅", tags: [], scenes: [], needs: [] });
for (const cat of ["coffee", "milktea"]) {
  const drinkPlan = engine.__test.applyRestaurantCategoryPlan(basePlan, cat);
  assert.deepStrictEqual(drinkPlan.keywords, CATEGORY_PRESETS[cat].keywords);
  assert.strictEqual(drinkPlan.minCost, 0);
  assert.strictEqual(drinkPlan.maxCost, 0);
  assert.ok(drinkPlan.radiusMeters <= CATEGORY_PRESETS[cat].radiusMeters);
  assert.strictEqual(drinkPlan.restaurantTypeDiversity, false);
  assert.ok(drinkPlan.searchRequests.length > 0);
  assert.ok(drinkPlan.searchRequests.every((r) => CATEGORY_PRESETS[cat].keywords.includes(r.keyword)));
}

// 外卖分支:保留用户口味(火锅)并叠加外卖关键词
const foodPlan = engine.__test.applyRestaurantCategoryPlan(
  { ...basePlan, restaurantTypeDiversity: false, keywords: ["火锅"] },
  "food"
);
assert.ok(foodPlan.keywords.includes("火锅"));
assert.ok(foodPlan.keywords.includes("快餐"));

// 5. rankCategoryPois:有新品品牌置顶 > 普通连锁 > 小店(品牌优先冒头)
const ranked = engine.__test.rankCategoryPois([
  { id: "x", name: "楼下无名快餐" },     // 小店无评分 -> 保留,但排品牌之后
  { id: "lk", name: "瑞幸咖啡(A店)" },  // 有新品 -> 置顶
  { id: "yd", name: "一点点(B店)" }      // 连锁无新品 -> 次之
]);
assert.deepStrictEqual(ranked.map((p) => p.id), ["lk", "yd", "x"]);

// 5b. 头部预留小店名额:6 个连锁 + 1 个达标小店,小店仍能进前 5
const mixed = engine.__test.rankCategoryPois([
  { id: "b1", name: "瑞幸咖啡(1)" },
  { id: "b2", name: "星巴克(2)" },
  { id: "b3", name: "库迪咖啡(3)" },
  { id: "b4", name: "Manner(4)" },
  { id: "b5", name: "M Stand(5)" },
  { id: "b6", name: "Peet's皮爷咖啡(6)" },
  { id: "small", name: "巷子口手冲(7)", rating: "4.6" }
]);
assert.ok(mixed.slice(0, 5).some((p) => p.id === "small")); // 小店进前 5
assert.ok(mixed.slice(0, 5).filter((p) => p.id !== "small").length === 4); // 其余 4 个是品牌

// 6. rankCategoryPois 评分门槛:非连锁评分 <3.5 剔除,≥3.5 或无评分保留;连锁恒保留
const rated = engine.__test.rankCategoryPois([
  { id: "low", name: "无名小店A", rating: "3.0" },   // 剔除
  { id: "ok", name: "无名小店B", rating: "4.2" },     // 保留
  { id: "none", name: "无名小店C" },                  // 无评分:保留
  { id: "chain", name: "蜜雪冰城(C店)", rating: "3.1" } // 连锁:即便低分也保留
]);
const ratedIds = rated.map((p) => p.id);
assert.ok(!ratedIds.includes("low"));
assert.ok(ratedIds.includes("ok"));
assert.ok(ratedIds.includes("none"));
assert.ok(ratedIds.includes("chain"));

// 7. categoryRestaurantCards:卡片带上 brand / newDrop / category 标注
const cards = engine.__test.categoryRestaurantCards(
  [{ id: "lk", name: "瑞幸咖啡(A店)", location: "116.40,39.90" }],
  {},
  [],
  "coffee"
);
assert.ok(cards.length >= 1);
assert.strictEqual(cards[0].brand, "瑞幸咖啡");
assert.ok(cards[0].newDrop);
assert.strictEqual(cards[0].category, "coffee");

// 8. 分类卡不展示距离:summaryPills / meta 里不含通勤文案
const commutePills = engine.__test.categoryRestaurantCards(
  [{ id: "c", name: "无名咖啡馆", rating: "4.5", cost: "25", location: "116.40,39.90" }],
  {},
  [],
  "coffee"
)[0];
assert.ok((commutePills.summaryPills || []).every((pill) => !/步行|驾车|地铁|公里|km|分钟|离你/.test(pill.text)));
assert.ok((commutePills.meta || []).every((text) => !/步行|驾车|地铁|公里|km|分钟|离你/.test(text)));

// 9. 去下单配置:未配置 appId 时返回空串(代码会回退到"复制店名");结构存在
assert.strictEqual(typeof ORDER_TARGETS, "object");
assert.strictEqual(typeof ORDER_TARGETS.brands, "object");
assert.strictEqual(orderAppIdForBrand("瑞幸咖啡"), ORDER_TARGETS.brands["瑞幸咖啡"] || "");
assert.strictEqual(orderAppIdForBrand("不存在的品牌"), "");

console.log("run-category-branch: all assertions passed");
