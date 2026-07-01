// 多人组局:每人自由输入(口味/忌口)+ 多选出行 → 综合筛选 回归测试
const assert = require("assert");
const engine = require("../utils/restaurantEngine");

// 1. 口味汇总(从各自自由输入识别):有人清淡+有人重口=适中;一致取一致;无则空
assert.strictEqual(engine.__test.aggregateMeetupTaste([{ pref: "想吃清淡的" }, { pref: "无辣不欢" }]), "适中");
assert.strictEqual(engine.__test.aggregateMeetupTaste([{ pref: "清淡点" }, { pref: "" }]), "清淡");
assert.strictEqual(engine.__test.aggregateMeetupTaste([{ pref: "重口" }, { pref: "能吃辣" }]), "重口");
assert.strictEqual(engine.__test.aggregateMeetupTaste([{ pref: "随便" }, { pref: "" }]), "");

// 2. 忌口汇总(跨人识别去重)
const diet = engine.__test.aggregateMeetupDiet([{ pref: "不吃辣" }, { pref: "我不吃海鲜" }]);
assert.ok(diet.includes("辣") && diet.includes("海鲜"));

// 3. buildChoiceContext:把每人自由输入折进 question,并聚合忌口/口味
const ctx = engine.buildChoiceContext({
  areaMode: "multi",
  multiAreaRows: [
    { role: "我的位置", location: "中关村", people: 1, pref: "清淡，不吃辣", travels: ["地铁", "公交"] },
    { role: "朋友A", location: "国贸", people: 2, pref: "清淡", travels: ["驾车"] }
  ]
});
assert.strictEqual(ctx.tastePref, "清淡");
assert.ok(ctx.dietAvoid.includes("辣"));
assert.ok(/清淡/.test(ctx.question) && /不吃辣/.test(ctx.question));
assert.ok(/地铁\/公交来/.test(ctx.question)); // 多选出行进了文本

// 4. 忌口 → avoidKeywords(组局chip路径仍可用)
const plan = engine.__test.mergeMeetupDietAvoid({ avoidKeywords: [] }, { dietAvoid: ["川菜", "辣"] });
assert.ok(plan.avoidKeywords.includes("辣"));

// 5. 自然语言"不吃辣"(自由输入)→ 排除辣味 + 不主动搜火锅
const parsed = engine.__test.parseDietaryFromText("有人不吃辣");
assert.strictEqual(parsed.noSpicy, true);
assert.ok(parsed.avoid.includes("辣") && parsed.avoid.includes("重庆"));
const base = engine.__test.localRestaurantSearchPlan({ question: "有人不吃辣", tags: [], scenes: [], needs: [] });
const dietPlan = engine.__test.applyTextDietaryRules(base, { question: "有人不吃辣", tags: [] });
assert.ok(dietPlan.avoidKeywords.includes("辣"));
assert.ok(!dietPlan.keywords.some((k) => /火锅|烧烤|川|湘|麻辣|重庆/.test(k)));

// 6. 多选出行 → 到达榜模式:所选里取有估时且最快;骑行无估时;空回退自动
const t = { walkMin: 40, driveMin: 20, subwayMin: 30 };
assert.strictEqual(engine.__test.pickPreferredArrivalMode(["地铁"], t), "subway");
assert.strictEqual(engine.__test.pickPreferredArrivalMode(["公交"], t), "subway");
assert.strictEqual(engine.__test.pickPreferredArrivalMode(["驾车"], t), "drive");
assert.strictEqual(engine.__test.pickPreferredArrivalMode(["步行"], t), "walk");
assert.strictEqual(engine.__test.pickPreferredArrivalMode(["骑行"], t), "");
assert.strictEqual(engine.__test.pickPreferredArrivalMode(["地铁", "驾车"], t), "drive"); // 取更快
assert.strictEqual(engine.__test.pickPreferredArrivalMode([], t), "");

// 7. 到达榜尊重个人多选出行:只选了步行 → 推荐步行(即便更慢)
const board = engine.__test.restaurantArrivalBoard({
  participantRoutes: [
    { label: "我", preferredModes: ["步行"], walkingDurationSeconds: 1500, drivingDurationSeconds: 300, subwayDurationSeconds: 600 },
    { label: "朋友", drivingDurationSeconds: 600 }
  ]
});
assert.ok(board);
assert.strictEqual(board.rows.find((r) => r.label === "我").recommendedKey, "walk");

// 8. 通用否定:不吃日料 → 排除日料/寿司,且不拿日料/寿司去搜(回归"说不吃日料却全是日料")
assert.deepStrictEqual(engine.__test.negatedCuisineKeywords("想吃日料"), []); // 正向不误判
const jp = engine.__test.negatedCuisineKeywords("不吃日料");
assert.ok(jp.includes("日料") && jp.includes("寿司") && jp.includes("居酒屋"));
const jpPlan = engine.__test.applyTextDietaryRules(
  { keywords: ["日料", "中餐", "寿司", "火锅"], avoidKeywords: [] },
  { question: "不吃日料", tags: [] }
);
assert.ok(jpPlan.avoidKeywords.includes("日料"));
assert.ok(!jpPlan.keywords.some((k) => /日料|寿司|居酒屋/.test(k)));
assert.ok(jpPlan.keywords.includes("中餐")); // 没被否定的保留

// 9. 其它否定写法也认:西餐不行 / 讨厌火锅
assert.ok(engine.__test.negatedCuisineKeywords("西餐不行").includes("西餐"));
assert.ok(engine.__test.negatedCuisineKeywords("讨厌火锅").includes("火锅"));

// 10. 忌口是"硬过滤":凑不够 5 张也绝不放开(回归"不吃日料/不吃火锅却仍出现")
//    候选里只有 2 家非忌口,其余都是日料/火锅。即便不足 5 张,也不能把忌口的塞回来。
const avoidPois = [
  { name: "清粥小馆", type: "中餐", rating: "4.5", cost: "60" },
  { name: "本帮小炒", type: "上海菜", rating: "4.6", cost: "80" },
  { name: "日勝bistro", type: "日本料理", rating: "4.6", cost: "108" },
  { name: "鲜目录寿司", type: "寿司", rating: "4.4", cost: "90" },
  { name: "老北京牛肉火锅", type: "火锅", rating: "4.7", cost: "120" },
  { name: "海底捞火锅", type: "火锅", rating: "4.8", cost: "150" },
  { name: "居酒屋とり", type: "居酒屋", rating: "4.3", cost: "130" }
];
const hardAvoid = ["日料", "日本料理", "寿司", "居酒屋", "日式", "火锅", "串串"];
// 即便放宽(凑数)也不能带回忌口项
const relaxed = engine.__test.relaxedRestaurantSearchOptions({ avoidKeywords: hardAvoid, minRating: 4.9, maxCost: 1 });
assert.deepStrictEqual(relaxed.avoidKeywords, hardAvoid); // 放宽价格/评分,但忌口原样保留
const picked = engine.__test.preferredRestaurantPois(avoidPois, { avoidKeywords: hardAvoid });
assert.ok(picked.length >= 2 && picked.length <= 2, `应只剩 2 家非忌口,实际 ${picked.length}`);
assert.ok(picked.every((poi) => !/日料|日本料理|寿司|居酒屋|火锅/.test(`${poi.name}${poi.type}`)), "忌口的店绝不能出现在结果里");

// 11. 多人多条忌口(日料+火锅+海鲜)展开后超过旧的 8 上限,也不能被截断丢词
const ctxMulti = engine.buildChoiceContext({
  areaMode: "multi",
  multiAreaRows: [
    { role: "我的位置", location: "中关村", people: 1, pref: "不吃日料", travels: ["地铁"] },
    { role: "朋友A", location: "国贸", people: 1, pref: "不吃火锅", travels: ["驾车"] },
    { role: "朋友B", location: "望京", people: 1, pref: "不吃海鲜", travels: ["步行"] }
  ]
});
const planMulti = engine.__test.mergeMeetupDietAvoid({ avoidKeywords: [] }, ctxMulti);
const optMulti = engine.__test.restaurantSearchOptions(planMulti);
["日本料理", "火锅", "海鲜"].forEach((k) => assert.ok(optMulti.avoidKeywords.includes(k), `多人忌口应保留 ${k},实际 ${optMulti.avoidKeywords.join(",")}`));

// 12. 回归:回到单人后,即便 data 里残留多区行,单人模式也绝不携带组局位置(否则仍按两人居中)
const singleCtx = engine.buildChoiceContext({
  areaMode: "single",
  multiAreaRows: [
    { role: "我的位置", location: "中关村", people: 1 },
    { role: "朋友A", location: "国贸", people: 1 }
  ]
});
assert.deepStrictEqual(singleCtx.multiAreaRows, [], "单人模式不应携带多区行");
assert.deepStrictEqual(singleCtx.multiAreaLocationHints, [], "单人模式不应携带组局位置");
assert.deepStrictEqual(singleCtx.dietAvoid, []);
const multiCtx = engine.buildChoiceContext({
  areaMode: "multi",
  multiAreaRows: [
    { role: "我的位置", location: "中关村", people: 1 },
    { role: "朋友A", location: "国贸", people: 1 }
  ]
});
assert.ok(multiCtx.multiAreaLocationHints.includes("中关村") && multiCtx.multiAreaLocationHints.includes("国贸"), "多人模式仍要携带各自位置以取中间点");

console.log("run-meetup-prefs: all assertions passed");
