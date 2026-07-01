// 真·端到端基准:真实高德数据 + App 同一套 计划→搜索→过滤→出牌 逻辑,判定推荐餐厅是否符合意图设定。
// 注意:这是 headless(无手机 UI),用固定测试坐标(北京)。跑:node tests/bench-realdata-recommend.js [N]
const fs = require("fs");
const path = require("path");
const https = require("https");

// —— 把小程序的 wx.request 垫成 Node https;跳过路由(估时,不影响选店)——
// 高德免费 key 有 QPS 限制:把所有请求串行化并间隔节流,避免 CUQPS_HAS_EXCEEDED。
let gate = Promise.resolve();
const REQ_GAP_MS = 420;
function schedule(task) {
  const next = gate.then(() => new Promise((r) => setTimeout(r, REQ_GAP_MS))).then(task);
  gate = next.then(() => {}, () => {});
  return next;
}
global.wx = {
  request({ url, method = "GET", data = {}, header = {}, success, fail }) {
    if (/\/v3\/direction\//.test(url)) { success && success({ statusCode: 200, data: { status: "0", info: "skip-route" } }); return; }
    const m = (method || "GET").toUpperCase();
    let full = url;
    if (m === "GET" && data && Object.keys(data).length) {
      const qs = Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v == null ? "" : v)}`).join("&");
      full = url + (url.includes("?") ? "&" : "?") + qs;
    }
    const body = m === "POST" ? JSON.stringify(data) : null;
    const headers = Object.assign({}, header, body ? { "Content-Type": "application/json" } : {});
    schedule(() => new Promise((resolve) => {
      const req = https.request(full, { method: m, headers }, (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let parsed = {};
          try { parsed = JSON.parse(buf); } catch (e) { parsed = {}; }
          success && success({ statusCode: res.statusCode, data: parsed });
          resolve();
        });
      });
      req.on("error", (e) => { fail && fail({ errMsg: String(e && e.message || e) }); resolve(); });
      if (body) req.write(body);
      req.end();
    }));
  }
};

const engine = require("../utils/restaurantEngine");
const T = engine.__test;
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "realdata-cases.json"), "utf8"));
const LIMIT = Number(process.argv[2]) || cases.length;
const COORDS = { lat: 39.9042, lng: 116.4074, latitude: 39.9042, longitude: 116.4074, city: "北京市", amap: true };
const TARGET = 0.8;

// 与 restaurantSearchPlanForMode 的本地分支一致(确定性、不依赖远程 DeepSeek),意图层完全一致
function buildPlan(choice) {
  let plan = T.localRestaurantSearchPlan(choice);
  plan = T.ensureRestaurantMeetupPlanForMode(plan, choice);
  plan = T.applyTextDietaryRules(plan, choice);
  plan = T.mergeMeetupDietAvoid(plan, choice);
  return plan;
}

// 判定按"餐厅类别"(店名+品类),不按菜单单品——"不吃海鲜"是指别推海鲜餐厅,
// 不是指一家涮肉店菜单里不能出现虾。这才对应用户真实意图。
function categoryText(card) {
  const poi = card.poi || {};
  return [card.name, poi.type, poi.typecode].filter(Boolean).join(" ");
}

async function recommend(input) {
  const choice = { question: input, tags: [], scenes: [], needs: [] };
  const plan = buildPlan(choice);
  // 控制网络调用量(节流下太多关键词会很慢):每个 case 最多取前 4 个搜索词
  if (Array.isArray(plan.keywords)) plan.keywords = plan.keywords.slice(0, 4);
  if (Array.isArray(plan.searchRequests)) plan.searchRequests = plan.searchRequests.slice(0, 4);
  const options = T.restaurantSearchOptions(plan);
  const radius = Math.min(Number(plan.radiusMeters) || 3000, 3000);
  const result = await T.searchRestaurantsWithFallback(COORDS, radius, plan.keywords, options, null, { lockSearchCenter: true });
  const cards = T.restaurantCardsForModeAvoiding(result.pois, "AI 模式", { ...options, userCoords: COORDS }, new Set());
  return { plan, cards: cards.slice(0, 5) };
}

function judge(testCase, cards) {
  const texts = cards.map(categoryText);
  const reasons = [];
  if (!cards.length) { reasons.push("没出任何餐厅"); return { pass: false, reasons, violations: [], names: [] }; }
  let violations = [];
  if (testCase.avoid) {
    const re = new RegExp(testCase.avoid);
    violations = texts.filter((t) => re.test(t));
    if (violations.length) reasons.push(`违忌口 ${violations.length}/${cards.length}:[${violations.join(" | ")}]`);
  }
  if (testCase.want) {
    const re = new RegExp(testCase.want);
    if (!texts.some((t) => re.test(t))) reasons.push(`无一家命中期望/${testCase.want}/`);
  }
  return { pass: reasons.length === 0, reasons, violations, names: cards.map((c) => c.name) };
}

(async () => {
  let passed = 0;
  const failures = [];
  const byDim = {};
  const list = cases.slice(0, LIMIT);
  for (let i = 0; i < list.length; i += 1) {
    const tc = list[i];
    byDim[tc.dim] = byDim[tc.dim] || { pass: 0, total: 0 };
    byDim[tc.dim].total += 1;
    let res;
    try { res = await recommend(tc.input); }
    catch (e) { failures.push({ input: tc.input, dim: tc.dim, reasons: [`异常:${e && e.message || e}`], names: [] }); continue; }
    const verdict = judge(tc, res.cards);
    if (verdict.pass) { passed += 1; byDim[tc.dim].pass += 1; }
    else failures.push({ input: tc.input, dim: tc.dim, reasons: verdict.reasons, names: verdict.names });
    process.stdout.write(verdict.pass ? "." : "x");
  }
  const total = list.length;
  const rate = passed / total;
  console.log(`\n\n=== 真实数据·推荐准确率(北京中心,headless)===`);
  console.log(`总计 ${total} · 通过 ${passed} · 准确率 ${(rate * 100).toFixed(1)}% · 目标 ${TARGET * 100}%`);
  console.log(`分维度:` + Object.entries(byDim).map(([d, v]) => `${d} ${v.pass}/${v.total}`).join(" | "));
  if (failures.length) {
    console.log(`\n--- 未通过(${failures.length})---`);
    failures.forEach((f) => console.log(`✗ [${f.dim}] "${f.input}"\n    ${f.reasons.join("; ")}\n    出牌:[${f.names.join(" / ")}]`));
  }
  console.log("");
  process.exit(rate >= TARGET ? 0 : 1);
})();
