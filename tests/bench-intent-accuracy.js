// 意图识别准确率基准(loop 用):用"换种说法"的意图词测识别,打分,目标 ≥80%。
// 这是基准/打分脚本(非 run-*,不进常规测试套),手动跑:node tests/bench-intent-accuracy.js
const fs = require("fs");
const path = require("path");
const engine = require("../utils/restaurantEngine");

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "intent-accuracy-cases.json"), "utf8"));
const TARGET = 0.8;

// 还原 App 真实的"意图识别":parseDietaryFromText(辣/海鲜/否定菜系)+ 意图词库
function recognize(text) {
  const parsed = engine.__test.parseDietaryFromText(text);
  const intent = engine.__test.matchIntentRules(text);
  return {
    avoid: [...new Set([...(parsed.avoid || []), ...(intent.avoidAdd || [])])],
    search: intent.searchAdd || [],
    taste: parsed.taste || intent.taste || "",
    noSpicy: Boolean(parsed.noSpicy || intent.noSpicy),
    noSeafood: Boolean(parsed.noSeafood || intent.noSeafood)
  };
}

function checkCase(testCase) {
  const got = recognize(testCase.input);
  const reasons = [];
  if ("taste" in testCase && got.taste !== testCase.taste) reasons.push(`taste=${got.taste || "∅"}≠${testCase.taste}`);
  if ("noSpicy" in testCase && got.noSpicy !== testCase.noSpicy) reasons.push(`noSpicy=${got.noSpicy}≠${testCase.noSpicy}`);
  if ("noSeafood" in testCase && got.noSeafood !== testCase.noSeafood) reasons.push(`noSeafood=${got.noSeafood}≠${testCase.noSeafood}`);
  if (testCase.avoidAny && !got.avoid.some((k) => new RegExp(testCase.avoidAny).test(k))) reasons.push(`avoid缺/${testCase.avoidAny}/ got[${got.avoid.join(",")}]`);
  if (testCase.searchAny && !got.search.some((k) => new RegExp(testCase.searchAny).test(k))) reasons.push(`search缺/${testCase.searchAny}/ got[${got.search.join(",")}]`);
  if (testCase.notSearchAny && got.search.some((k) => new RegExp(testCase.notSearchAny).test(k))) reasons.push(`search误含/${testCase.notSearchAny}/ got[${got.search.join(",")}]`);
  if (testCase.notAvoidAny && got.avoid.some((k) => new RegExp(testCase.notAvoidAny).test(k))) reasons.push(`avoid误含/${testCase.notAvoidAny}/ got[${got.avoid.join(",")}]`);
  return { pass: reasons.length === 0, reasons };
}

let passed = 0;
const failures = [];
const byDim = {};
for (const testCase of cases) {
  const dim = testCase.dim || "?";
  byDim[dim] = byDim[dim] || { pass: 0, total: 0 };
  byDim[dim].total += 1;
  const result = checkCase(testCase);
  if (result.pass) { passed += 1; byDim[dim].pass += 1; }
  else failures.push({ input: testCase.input, dim, reasons: result.reasons });
}

const rate = passed / cases.length;
console.log(`\n=== 意图识别准确率 ===`);
console.log(`总计 ${cases.length} 例 · 通过 ${passed} · 准确率 ${(rate * 100).toFixed(1)}% · 目标 ${(TARGET * 100)}%`);
console.log(`分维度:` + Object.entries(byDim).map(([d, v]) => `${d} ${v.pass}/${v.total}`).join(" | "));
if (failures.length) {
  console.log(`\n--- 未通过(${failures.length}) ---`);
  failures.forEach((f) => console.log(`✗ [${f.dim}] "${f.input}" → ${f.reasons.join("; ")}`));
}
console.log("");
process.exit(rate >= TARGET ? 0 : 1);
