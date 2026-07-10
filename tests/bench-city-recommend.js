// 真实高德跨城市回归:确认搜索中心、具体品类和预算硬条件在北京外仍然生效。
const https = require("https");

let gate = Promise.resolve();
const REQ_GAP_MS = 380;
function schedule(task) {
  const next = gate.then(() => new Promise((resolve) => setTimeout(resolve, REQ_GAP_MS))).then(task);
  gate = next.then(() => {}, () => {});
  return next;
}

global.wx = {
  request({ url, method = "GET", data = {}, header = {}, success, fail }) {
    if (/\/v3\/direction\//.test(url)) {
      success && success({ statusCode: 200, data: { status: "0", info: "skip-route" } });
      return;
    }
    const verb = String(method || "GET").toUpperCase();
    let full = url;
    if (verb === "GET" && data && Object.keys(data).length) {
      const query = new URLSearchParams(Object.entries(data).map(([key, value]) => [key, value == null ? "" : String(value)]));
      full += `${url.includes("?") ? "&" : "?"}${query}`;
    }
    const body = verb === "POST" ? JSON.stringify(data) : null;
    schedule(() => new Promise((resolve) => {
      const req = https.request(full, {
        method: verb,
        headers: { ...header, ...(body ? { "content-type": "application/json" } : {}) }
      }, (res) => {
        let buffer = "";
        res.on("data", (chunk) => { buffer += chunk; });
        res.on("end", () => {
          let parsed = {};
          try { parsed = JSON.parse(buffer); } catch (error) { parsed = {}; }
          success && success({ statusCode: res.statusCode, data: parsed });
          resolve();
        });
      });
      req.on("error", (error) => {
        fail && fail({ errMsg: String(error && error.message || error) });
        resolve();
      });
      if (body) req.write(body);
      req.end();
    }));
  }
};

const engine = require("../utils/restaurantEngine");
const T = engine.__test;

const cases = [
  {
    city: "上海市",
    label: "人民广场",
    coords: { lat: 31.2304, lng: 121.4737, latitude: 31.2304, longitude: 121.4737, city: "上海市", label: "人民广场", amap: true },
    input: "自助餐"
  },
  {
    city: "广州市",
    label: "珠江新城",
    coords: { lat: 23.1193, lng: 113.3213, latitude: 23.1193, longitude: 113.3213, city: "广州市", label: "珠江新城", amap: true },
    input: "糟粕醋火锅"
  },
  {
    city: "成都市",
    label: "春熙路",
    coords: { lat: 30.6570, lng: 104.0810, latitude: 30.6570, longitude: 104.0810, city: "成都市", label: "春熙路", amap: true },
    input: "人均100以下"
  },
  {
    city: "杭州市",
    label: "武林广场",
    coords: { lat: 30.2741, lng: 120.1551, latitude: 30.2741, longitude: 120.1551, city: "杭州市", label: "武林广场", amap: true },
    input: "人均150以下 自助餐"
  }
];

async function runCase(testCase) {
  const choice = { question: testCase.input, tags: [], scenes: [], needs: [] };
  const plan = T.localRestaurantSearchPlan(choice);
  const options = T.restaurantSearchOptions(plan);
  const result = await T.searchRestaurantsWithFallback(
    testCase.coords,
    Math.min(Number(plan.radiusMeters) || 3000, 3000),
    plan.keywords,
    options,
    null,
    { lockSearchCenter: true }
  );
  let cards = T.restaurantCardsForModeAvoiding(result.pois, "AI 模式", { ...options, userCoords: testCase.coords }, new Set());
  cards = T.filterRestaurantCardsWithinAllowedCity(cards, testCase.city).slice(0, 5);
  const violations = cards.filter((card) => {
    const poi = card.poi || card;
    const cost = Number(poi.cost);
    if (plan.strictMaxCost && (!Number.isFinite(cost) || cost > plan.maxCost)) return true;
    const text = `${poi.name || ""} ${poi.type || ""} ${poi.searchKeyword || ""}`;
    if (plan.strictMustKeywords && !plan.mustKeywords.some((keyword) => text.includes(keyword))) return true;
    return false;
  });
  return {
    city: testCase.city,
    input: testCase.input,
    keywords: plan.keywords,
    maxCost: plan.maxCost,
    count: cards.length,
    violations: violations.length,
    cards: cards.map((card) => ({ name: card.name, cost: (card.poi || card).cost || "", keyword: (card.poi || card).searchKeyword || "" }))
  };
}

(async () => {
  const results = [];
  for (const testCase of cases) results.push(await runCase(testCase));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((item) => item.violations > 0)) process.exitCode = 1;
})();
