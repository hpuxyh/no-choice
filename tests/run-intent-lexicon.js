// 意图词库接入引擎:健身/暖胃/无烟/素食/嗦面… → 搜/避/口味标记 回归测试
const assert = require("assert");
const engine = require("../utils/restaurantEngine");
const { INTENT_RULES } = require("../utils/intentLexicon");

const M = engine.__test.matchIntentRules;
const applyDiet = engine.__test.applyTextDietaryRules;

// 0. 词库生成正常(来源 CSV),且场景维度存在但引擎匹配会跳过
assert.ok(INTENT_RULES.length >= 20, "意图规则应已生成");
assert.ok(INTENT_RULES.some((r) => r.id === "fitness" && r.avoid.includes("油炸")));

// 1. 健身餐:避油炸/甜品/火锅;没点具体菜系时补轻食/沙拉;结果不含油炸火锅甜品
const fit = M("想吃健身餐");
assert.ok(fit.avoidAdd.includes("油炸") && fit.avoidAdd.includes("甜品") && fit.avoidAdd.includes("火锅"));
assert.ok(fit.searchAdd.includes("轻食") || fit.searchAdd.includes("沙拉"));
const fitPlan = applyDiet({ keywords: ["火锅", "中餐"], avoidKeywords: [] }, { question: "想吃健身餐", tags: [] });
assert.ok(fitPlan.avoidKeywords.includes("油炸"));
assert.ok(!fitPlan.keywords.some((k) => /火锅|油炸|甜品/.test(k)));

// 2. 暖胃/热乎:避沙拉/刺身;补砂锅/粥/汤面这类热食
const warm = M("天冷想吃点热乎的暖胃");
assert.ok(warm.avoidAdd.includes("沙拉") && warm.avoidAdd.includes("刺身"));
assert.ok(warm.searchAdd.some((k) => /砂锅|粥|汤面|煲|羊汤/.test(k)));

// 3. 吃完一身味(无烟):避火锅/烧烤/烤肉;结果剔除这些
const smell = M("约会不想吃完一身味");
assert.ok(smell.avoidAdd.includes("火锅") && smell.avoidAdd.includes("烧烤") && smell.avoidAdd.includes("烤肉"));
const smellPlan = applyDiet({ keywords: ["火锅", "西餐"], avoidKeywords: [] }, { question: "不想吃完一身味", tags: [] });
assert.ok(!smellPlan.keywords.some((k) => /火锅|烧烤|烤肉|铁板/.test(k)));

// 4. 素食:避荤(火锅/海鲜/牛排);补素食
const veg = M("我吃素");
assert.ok(veg.avoidAdd.includes("火锅") && veg.avoidAdd.includes("海鲜") && veg.avoidAdd.includes("牛排"));
assert.ok(veg.searchAdd.includes("素食"));

// 5. "不吃肉" → 命中素食而非"吃肉(硬菜)";否定守卫生效
const noMeat = M("不吃肉");
assert.ok(noMeat.searchAdd.includes("素食"), "不吃肉应走素食");
assert.ok(!noMeat.searchAdd.includes("烤肉") && !noMeat.searchAdd.includes("牛排"), "不吃肉不能推烤肉/牛排");

// 6. "无辣不欢" 是嗜辣,不能被当成不吃辣:noSpicy=false、口味=重口、排除清淡菜系
const spicyLover = M("无辣不欢");
assert.strictEqual(spicyLover.noSpicy, false);
assert.strictEqual(spicyLover.taste, "重口");
assert.ok(spicyLover.avoidAdd.includes("粤菜"));
const spicyPlan = applyDiet({ keywords: ["粤菜", "川菜"], avoidKeywords: [] }, { question: "无辣不欢", tags: [] });
assert.ok(!spicyPlan.keywords.some((k) => /粤菜|日料|清淡/.test(k)), "嗜辣应排除清淡系");
assert.ok(spicyPlan.keywords.some((k) => /川|湘|火锅|麻辣/.test(k)), "嗜辣应保留/补重口");

// 7. 场景维度被跳过:纯"约会吃饭"不改写多样化结果(沿用标签系统)
const dateOnly = M("约会吃饭");
assert.deepStrictEqual(dateOnly.avoidAdd, []);
assert.deepStrictEqual(dateOnly.searchAdd, []);
const datePlan = applyDiet({ keywords: ["中餐", "火锅", "西餐"], avoidKeywords: [], restaurantTypeDiversity: true }, { question: "约会吃饭", tags: ["约会吃饭"] });
assert.deepStrictEqual(datePlan.keywords, ["中餐", "火锅", "西餐"], "纯场景不应改写关键词");
assert.strictEqual(datePlan.restaurantTypeDiversity, true);

// 8. 修正"潮汕牛"误伤:不吃海鲜时,潮汕牛肉火锅不该被排除
const pois = [
  { name: "陈记潮汕牛肉火锅", type: "火锅" },
  { name: "舟山海鲜大排档", type: "海鲜" },
  { name: "望京刺身工房", type: "日本料理" }
];
const seafoodAvoid = engine.__test.parseDietaryFromText("不吃海鲜").avoid;
const kept = engine.__test.filterRestaurantPois(pois, { avoidKeywords: seafoodAvoid });
assert.ok(kept.some((p) => p.name.includes("潮汕牛肉火锅")), "潮汕牛肉火锅不该被海鲜忌口误杀");
assert.ok(!kept.some((p) => /海鲜|刺身/.test(`${p.name}${p.type}`)), "海鲜/刺身应被排除");

console.log("run-intent-lexicon: all assertions passed");
