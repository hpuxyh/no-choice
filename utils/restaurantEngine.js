const { SCENE_TAGS, NEED_TAGS, MORE_TAGS, TAG_SEARCH_KEYWORDS, TASTE_SEARCH_KEYWORDS, DIET_EXCLUDE_KEYWORDS } = require("./choiceData");
const { INTENT_RULES } = require("./intentLexicon");
const { CATEGORY_PRESETS, matchChainBrand, brandNewDrop } = require("./brandData");

const AMAP_WEB_SERVICE_KEY = "7f40078338209e23255e8f8e0ca8cc37";
const ENABLE_REMOTE_AI_PLAN = true;
const WORKER_API_BASE = "https://no-choice.pages.dev";
const RESTAURANT_SEARCH_PLAN_ENDPOINT = WORKER_API_BASE ? `${WORKER_API_BASE}/api/restaurant-search-plan` : "";
const RESTAURANT_POI_ENDPOINT = WORKER_API_BASE ? `${WORKER_API_BASE}/api/poi` : "";
const DEFAULT_AMAP_CENTER = { lat: 39.904179, lng: 116.407387, amap: true, label: "北京" };
const MIN_RESTAURANT_COST = 150;
const AMAP_RESTAURANT_LIMIT = 20;
const AMAP_SEARCH_PAGES = 3;
const AMAP_SHOW_FIELDS_DEFAULT = "children,business,indoor,navi,photos";
const AMAP_SEARCH_MIN_RADIUS = 1000;
const AMAP_SEARCH_MAX_RADIUS = 30000;
const AMAP_PRICE_POOL_SIZE = 30;
const GPS_LOCATION_TIMEOUT_MS = 3500;
const AMAP_REQUEST_TIMEOUT_MS = 8000;
const RESTAURANT_NAV_LOCATION_MAX_DRIFT_METERS = 2000;
const TOTAL = 5;
// 到店吃(自己走过去)的硬性上限:3km。配送类(咖啡/奶茶/外卖)和组局/目的地不受此限。
const EATIN_MAX_RADIUS = 3000;
const RESTAURANT_KEYWORD_FALLBACK = "餐厅";
const RESTAURANT_CITY_GEO_BOUNDS = {
  "北京市": { latMin: 39.25, latMax: 41.15, lngMin: 115.25, lngMax: 117.65 },
  "上海市": { latMin: 30.65, latMax: 31.9, lngMin: 120.8, lngMax: 122.15 },
  "天津市": { latMin: 38.55, latMax: 40.25, lngMin: 116.7, lngMax: 118.05 },
  "重庆市": { latMin: 28.15, latMax: 32.35, lngMin: 105.25, lngMax: 110.2 },
  "广州市": { latMin: 22.45, latMax: 23.95, lngMin: 112.55, lngMax: 114.1 },
  "深圳市": { latMin: 22.35, latMax: 22.9, lngMin: 113.7, lngMax: 114.65 },
  "杭州市": { latMin: 29.15, latMax: 30.95, lngMin: 118.35, lngMax: 120.75 },
  "成都市": { latMin: 30.05, latMax: 31.45, lngMin: 103.25, lngMax: 104.9 },
  "苏州市": { latMin: 30.75, latMax: 32.1, lngMin: 119.9, lngMax: 121.35 },
  "南京市": { latMin: 31.2, latMax: 32.65, lngMin: 118.35, lngMax: 119.25 },
  "武汉市": { latMin: 29.95, latMax: 31.4, lngMin: 113.65, lngMax: 115.1 },
  "西安市": { latMin: 33.65, latMax: 34.75, lngMin: 107.65, lngMax: 109.8 },
  "青岛市": { latMin: 35.55, latMax: 37.2, lngMin: 119.5, lngMax: 121.0 }
};
const PRIORITY_TAGS = new Set(["西餐", "火锅", "日料", "烧烤", "夜宵", "通宵熬夜"]);
const RESTAURANT_MEETUP_MAX_RADIUS = 3000;
const RESTAURANT_MEETUP_MIN_RADIUS = 1000;
const RESTAURANT_MEETUP_RADIUS_RATIO = 0.18;
const LOCATION_SUFFIX_PATTERN = "(?:区|县|市|镇|乡|街道|商圈|机场|火车站|高铁站|大学|学院|大厦|写字楼|广场|公园|园区|CBD)";
const RESTAURANT_ACTOR_PATTERN = "(?:我|本人|自己|朋友|对象|男朋友|女朋友|男友|女友|对方|同事|他|她|一个|一个人|另一个|另一个人|一位|另一位|第一个|第二个|第三个|第四个|A|B|a|b)";
const RESTAURANT_LOCATION_CAPTURE = "([\\u4e00-\\u9fa5A-Za-z0-9·\\-]{2,24}?)(?=\\s*(?:附近|周边|这边|那边|吃什么|吃啥|吃点什么|吃点啥|吃饭|吃|找|搜|搜索|安排|看看|餐厅|饭店|一个|另一个|一位|另一位|第一个|第二个|第三个|第四个|两个人|三个人|几个人|共?\\d+(?:到|-)?\\d*人|[一二两三四五六七八九十]+人|人均|预算|折中|，|,|。|!|！|\\?|？|；|;|但|但是|不过|可是|我|本人|自己|朋友|对方|同事|他|她|我们|咱们|大家|一起|$))";
const FOOD_SEARCH_TERMS = ["火锅", "夜宵", "烤肉", "烧烤", "日料", "日本料理", "寿司", "韩餐", "韩国料理", "泰餐", "西餐", "牛排", "意面", "披萨", "粤菜", "川菜", "湘菜", "云南菜", "云贵菜", "傣味", "菌子火锅", "过桥米线", "云南米线", "贵州菜", "东北菜", "新疆菜", "西北菜", "北京菜", "烤鸭", "本帮菜", "江浙菜", "海鲜", "素食", "轻食", "咖啡甜品", "咖啡", "甜品", "brunch", "早午餐", "小酒馆", "酒吧", "烧鸟", "居酒屋", "麻辣烫", "拉面", "面馆", "米粉", "私房菜", "中餐", "餐厅"];
const GENERIC_FOOD_INTENT_TERMS = new Set(["餐厅", "夜宵"]);
const DEFAULT_DIVERSE_RESTAURANT_INTENTS = [
  { keyword: "中餐", types: "050100" },
  { keyword: "火锅", types: "050117" },
  { keyword: "西餐", types: "050200" },
  { keyword: "日料", types: "050200" },
  { keyword: "烧烤", types: "050100" }
];
const ART_COLORS = ["#ff5a4d", "#28c76f", "#f6c518", "#6c5ce7", "#3d6bff"];
const ART_THEMES = [
  { match: /火锅|麻辣|川|湘|串串|烤鱼|辣/, bg: "#ff5a4d", accent: "#f6c518" },
  { match: /日|寿司|料理|烧鸟|居酒屋|刺身|拉面/, bg: "#28c76f", accent: "#f6c518" },
  { match: /西|牛排|意面|披萨|法|bistro|brunch/i, bg: "#f6c518", accent: "#ff5a4d" },
  { match: /粤|港|茶餐|点心|本帮|江浙|中餐|私房/, bg: "#ff7ab8", accent: "#f6c518" },
  { match: /咖啡|甜品|蛋糕|酒|吧|奶茶/, bg: "#6c5ce7", accent: "#f6c518" }
];
const DEFAULT_ART_THEMES = [
  { bg: "#ff5a4d", accent: "#f6c518" },
  { bg: "#28c76f", accent: "#f6c518" },
  { bg: "#f6c518", accent: "#ff5a4d" },
  { bg: "#6c5ce7", accent: "#28c76f" },
  { bg: "#3d6bff", accent: "#ff7ab8" }
];
const FALLBACK_FOOD_IMAGES = [
  "/assets/food/hot-noodles.jpg",
  "/assets/food/sushi.jpg",
  "/assets/food/steak.jpg",
  "/assets/food/pasta.jpg",
  "/assets/food/izakaya.jpg"
];

function isAiMode(modeName) {
  return modeName === "AI 模式" || modeName === "智能模式";
}

function isMysticMode(modeName) {
  return modeName === "玄学模式" || modeName === "灵感模式";
}

let restaurantSearchPlan = null;
let restaurantSearchPlanSignature = "";
let restaurantSearchPlanPromise = null;
const restaurantRouteCityCache = new Map();

function wxRequest({ url, method = "GET", data = {}, header = {}, timeout = AMAP_REQUEST_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header,
      timeout,
      success: (res) => {
        const status = Number(res.statusCode) || 0;
        if (status >= 200 && status < 300) {
          resolve(res.data || {});
          return;
        }
        const body = res.data || {};
        reject(new Error(body.message || body.info || `HTTP ${status}`));
      },
      fail: (err) => reject(new Error(err.errMsg || "网络请求失败"))
    });
  });
}

function normalizeCoord(coords) {
  if (!coords) return null;
  const lat = Number(coords && (coords.lat ?? coords.latitude));
  const lng = Number(coords && (coords.lng ?? coords.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    accuracy: Math.round(Number(coords.accuracy) || 0),
    amap: coords.amap !== false,
    label: coords.label || "",
    city: coords.city || "",
    addressMeta: coords.addressMeta || coords.detail || ""
  };
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("定位超时，改用城市定位"));
    }, GPS_LOCATION_TIMEOUT_MS);
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000,
      success: (res) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(normalizeCoord({
          lat: Number(res.latitude.toFixed(6)),
          lng: Number(res.longitude.toFixed(6)),
          accuracy: res.accuracy,
          amap: true,
          label: "当前位置"
        }));
      },
      fail: (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error(locationErrorText(err)));
      }
    });
  });
}

function locationErrorText(err) {
  const text = err && err.errMsg ? String(err.errMsg) : "";
  if (/auth|deny|denied|authorize|permission/i.test(text)) return "你拒绝了定位，改用城市定位";
  if (/timeout/i.test(text)) return "定位超时，改用城市定位";
  return "暂时拿不到当前位置，改用城市定位";
}

async function getApproxPosition() {
  try {
    const data = await amapRequest("https://restapi.amap.com/v3/ip", { key: AMAP_WEB_SERVICE_KEY, output: "json" }, { timeout: 2500 });
    if (data.status === "1") {
      const center = centerFromRectangle(data.rectangle);
      if (center) {
        const city = Array.isArray(data.city) ? data.city[0] : data.city;
        const province = Array.isArray(data.province) ? data.province[0] : data.province;
        return normalizeCoord({ ...center, amap: true, label: city || province || "当前城市" });
      }
    }
  } catch (error) {
    console.warn("Amap city location unavailable", error);
  }
  return normalizeCoord(DEFAULT_AMAP_CENTER);
}

async function reverseGeocodeLocation(coords) {
  const center = normalizeCoord(coords);
  if (!center) return "";
  return firstReverseGeocodeResult([
    { label: "附近地址兜底", promise: reverseGeocodeByWorkerPoi(center) },
    { label: "高德逆地址", promise: reverseGeocodeByAmap(center) }
  ]);
}

async function reverseGeocodeByAmap(center) {
  const data = await amapRequest("https://restapi.amap.com/v3/geocode/regeo", {
    key: AMAP_WEB_SERVICE_KEY,
    location: `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`,
    radius: "1000",
    extensions: "base",
    roadlevel: "0",
    output: "json"
  }, { timeout: 4000 });
  if (data.status !== "1") throw new Error(data.info || "高德逆地理编码失败");
  const regeocode = data.regeocode || {};
  const component = regeocode.addressComponent || {};
  const province = amapAddressText(component.province);
  const city = amapAddressText(component.city);
  const district = amapAddressText(component.district);
  const township = amapAddressText(component.township);
  const street = amapAddressText(component.streetNumber && component.streetNumber.street);
  const streetNo = amapAddressText(component.streetNumber && component.streetNumber.number);
  const neighborhood = amapAddressText(component.neighborhood && (component.neighborhood.name || component.neighborhood));
  const building = amapAddressText(component.building && (component.building.name || component.building));
  const formatted = String(regeocode.formatted_address || "").replace(/^中国/, "").trim();
  const componentAddress = compactLocationParts([
    province,
    city,
    district,
    township,
    street,
    neighborhood
  ]).join("");
  const fallbackAddress = stripDetailedLocationAddress(formatted, [streetNo, building]);
  const title = (componentAddress || fallbackAddress || formatted).slice(0, 90);
  const meta = compactLocationParts([city || province, district, township, street, streetNo, neighborhood, building]).join(" · ").slice(0, 90);
  return title ? { title, meta } : null;
}

async function reverseGeocodeByWorkerPoi(center) {
  if (!RESTAURANT_POI_ENDPOINT) throw new Error("缺少地址兜底接口");
  const data = await wxRequest({
    url: RESTAURANT_POI_ENDPOINT,
    timeout: 4000,
    data: {
      lat: center.lat,
      lng: center.lng,
      module: "dinner",
      keyword: "餐厅"
    }
  });
  if (!data || data.ok === false) throw new Error(data && data.message || "附近地址兜底失败");
  const poi = Array.isArray(data.pois)
    ? data.pois.find((item) => item && (item.address || item.area))
    : null;
  if (!poi) throw new Error("附近地址为空");
  const areaParts = compactLocationParts(String(poi.area || "").split(/\s+/).map(normalizeLocationAreaText));
  const address = removeLocationAreaPrefix(stripDetailedLocationAddress(poi.address, [poi.name]), areaParts);
  const title = compactLocationParts([...areaParts, address]).join("").slice(0, 80);
  if (!title) throw new Error("附近地址为空");
  return {
    title: /附近$/.test(title) ? title : `${title}附近`,
    meta: compactLocationParts([...areaParts, poi.name]).join(" · ").slice(0, 90)
  };
}

function firstReverseGeocodeResult(tasks) {
  return new Promise((resolve, reject) => {
    const errors = [];
    let pending = tasks.length;
    let done = false;
    tasks.forEach((task) => {
      task.promise
        .then((detail) => {
          if (done) return;
          if (detail) {
            done = true;
            resolve(detail);
            return;
          }
          errors.push(`${task.label}: 地址为空`);
          pending -= 1;
          if (!pending) reject(new Error(errors.join("；") || "地址解析失败"));
        })
        .catch((error) => {
          errors.push(`${task.label}: ${error && error.message || "失败"}`);
          pending -= 1;
          if (!pending && !done) reject(new Error(errors.join("；") || "地址解析失败"));
        });
    });
  });
}

function amapAddressText(value) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function normalizeLocationAreaText(value) {
  return String(value || "").replace(/^中国/, "").replace(/北京城区/g, "北京市").replace(/\s+/g, "").trim();
}

function stripDetailedLocationAddress(value, removals = []) {
  let text = normalizeLocationAreaText(value);
  removals.forEach((item) => {
    const part = normalizeLocationAreaText(item);
    if (part) text = text.replace(part, "");
  });
  return text
    .replace(/北京城区/g, "")
    .replace(/\([^)]*\)|（[^）]*）/g, "")
    .replace(/\d+\s*(?:号院|号楼|号|弄|单元|室|层|楼|栋).*/u, "")
    .replace(/(?:东楼|西楼|南楼|北楼|主楼|副楼).*/u, "")
    .trim();
}

function removeLocationAreaPrefix(value, areaParts = []) {
  let text = String(value || "").trim();
  compactLocationParts([...areaParts, "北京市", "北京城区"]).forEach((part) => {
    if (text.startsWith(part)) text = text.slice(part.length);
  });
  return text.trim();
}

function compactLocationParts(parts) {
  const seen = new Set();
  return parts.map((part) => String(part || "").trim()).filter(Boolean).filter((part) => {
    const key = normalizeMatchText(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function centerFromRectangle(rectangle) {
  const points = String(rectangle || "").split(";");
  if (points.length < 2) return null;
  const [lng1, lat1] = points[0].split(",").map(Number);
  const [lng2, lat2] = points[1].split(",").map(Number);
  if ([lng1, lat1, lng2, lat2].some((value) => !Number.isFinite(value))) return null;
  return { lng: (lng1 + lng2) / 2, lat: (lat1 + lat2) / 2 };
}

async function amapRequest(url, data, options = {}) {
  const result = await wxRequest({ url, data, timeout: options.timeout || AMAP_REQUEST_TIMEOUT_MS });
  if (result && result.status && result.status !== "1") throw new Error(result.info || "高德接口返回异常");
  return result;
}

function buildChoiceContext(data) {
  const scenes = selectedTagTexts([data.sceneTags]);
  const needs = selectedTagTexts([data.needTags, data.moreTags]);
  const tags = selectedTagTexts([data.sceneTags, data.needTags, data.moreTags]);
  const multiAreaRows = normalizeChoiceMultiAreaRows(data.multiAreaRows);
  const isMultiArea = data.areaMode === "multi" && multiAreaRows.length >= 2;
  const multiAreaTotal = multiAreaRows.reduce((sum, row) => sum + row.people, 0);
  const partySize = isMultiArea ? multiAreaTotal : Math.max(0, Math.min(20, Math.round(Number(data.partySize) || 0)));
  const budgetPerPerson = Math.max(0, Math.min(2000, Math.round(Number(data.budgetPerPerson) || 0)));
  const hasBudgetControl = data.budgetPerPerson !== undefined && data.budgetPerPerson !== null && data.budgetPerPerson !== "";
  const intentOverrides = normalizeChoiceIntentOverrides(data.confirmedChoiceIntent || data.intentOverrides);
  const multiAreaText = isMultiArea ? choiceMultiAreaQuestionText(multiAreaRows, multiAreaTotal) : "";
  const multiAreaLocationHints = multiAreaRows.map((row) => row.location);
  const dietAvoid = isMultiArea ? aggregateMeetupDiet(multiAreaRows) : [];
  const tastePref = isMultiArea ? aggregateMeetupTaste(multiAreaRows) : "";
  const controls = [
    partySize ? `共${partySize}人` : "",
    hasBudgetControl ? `人均${budgetPerPerson}元左右` : ""
  ].filter(Boolean).join("，");
  return {
    question: [multiAreaText, cleanChoiceQuestion(data.problem || ""), controls].filter(Boolean).join(" "),
    scenes,
    needs,
    tags,
    partySize,
    budgetPerPerson,
    areaMode: isMultiArea ? "multi" : (data.areaMode || "single"),
    category: isMultiArea ? "" : (data.categoryMode || ""),
    // 单人模式不携带任何组局位置,避免残留的"两个人"导致仍按中间点找(单人=就近,多人才居中)
    multiAreaRows: isMultiArea ? multiAreaRows : [],
    multiAreaLocationHints: isMultiArea ? multiAreaLocationHints : [],
    dietAvoid,
    tastePref,
    intentOverrides
  };
}

function normalizeChoiceMultiAreaRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const location = cleanRestaurantLocationHint(row && row.location);
    const people = Math.max(1, Math.min(20, Math.round(Number(row && row.people) || 1)));
    const role = String(row && row.role || "").trim();
    const pref = String(row && row.pref || "").trim();
    const travels = Array.isArray(row && row.travels)
      ? row.travels.filter(Boolean).map(String)
      : (row && row.travel ? [String(row.travel)] : []);
    return location ? { location, people, role, pref, travels } : null;
  }).filter(Boolean).slice(0, 6);
}

// 汇总所有人的忌口(从各自自由输入里识别,去重)
function aggregateMeetupDiet(rows = []) {
  const set = new Set();
  rows.forEach((row) => parseDietaryFromText(row && row.pref || "").avoid.forEach((tag) => tag && set.add(tag)));
  return [...set];
}

// 汇总口味:有人重口且有人清淡=众口难调取适中;否则取大家一致的那种
function aggregateMeetupTaste(rows = []) {
  const tastes = rows.map((row) => parseDietaryFromText(row && row.pref || "").taste).filter(Boolean);
  const light = tastes.filter((t) => t === "清淡").length;
  const heavy = tastes.filter((t) => t === "重口").length;
  if (light && heavy) return "适中";
  if (light) return "清淡";
  if (heavy) return "重口";
  return "";
}

function choiceMultiAreaQuestionText(rows = [], total = 0) {
  const locations = rows.map((row) => row.location).filter(Boolean);
  if (locations.length < 2) return "";
  const participantText = rows.map((row) => {
    const role = row.role || "朋友";
    const extras = [
      row.pref ? row.pref : "",
      (row.travels && row.travels.length) ? `${row.travels.join("/")}来` : ""
    ].filter(Boolean).join("，");
    const suffix = extras ? `(${extras})` : "";
    if (/^(我的位置|当前位置|位置|我)$/u.test(role)) return `我从${row.location}出发${suffix}`;
    return `${role}在${row.location}${suffix}`;
  }).join("，");
  const peopleText = rows.map((row) => `${row.role ? `${row.role}：` : ""}${row.location}${row.people}人`).join("、");
  const dietAll = aggregateMeetupDiet(rows);
  const tasteAll = aggregateMeetupTaste(rows);
  const constraintText = [
    tasteAll ? `综合口味偏${tasteAll}` : "",
    dietAll.length ? `全体忌口需避开:${dietAll.join("、")}` : ""
  ].filter(Boolean).join("，");
  const tail = constraintText ? `${constraintText}。` : "";
  return `多区域饭局：${participantText}，共${total || rows.length}人。区域人数：${peopleText}。${tail}按${locations.join(" / ")}取中间点找餐厅。`;
}

function normalizeChoiceIntentOverrides(value) {
  if (!value || typeof value !== "object") return null;
  const sourceFields = value.fields && typeof value.fields === "object" ? value.fields : {};
  const fields = {};
  ["scene", "middle", "restaurantTypes", "budget", "locationDistance"].forEach((key) => {
    const text = String(sourceFields[key] || "").trim();
    if (text) fields[key] = text;
  });
  const searchText = Object.values(fields).filter(Boolean).join(" ");
  if (!searchText) return null;
  return {
    fields,
    searchText,
    basePlan: value.basePlan && typeof value.basePlan === "object" ? value.basePlan : null
  };
}

function selectedTagTexts(groups) {
  return groups
    .reduce((acc, group) => acc.concat(group || []), [])
    .filter((item) => item.selected)
    .map((item) => item.text);
}

function cleanChoiceQuestion(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => cleanChoiceQuestionLine(line))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function cleanChoiceQuestionLine(line) {
  const text = String(line || "").trim();
  const index = text.indexOf("标签：");
  if (index < 0) return text;
  const before = text.slice(0, index).trim();
  const after = stripKnownChoiceTags(text.slice(index + 3));
  return [before, after].filter(Boolean).join(" ").trim();
}

function stripKnownChoiceTags(value) {
  let text = String(value || "").trim();
  const tags = [...SCENE_TAGS, ...NEED_TAGS, ...MORE_TAGS].sort((a, b) => b.length - a.length);
  tags.forEach((tag) => {
    text = text.replace(new RegExp(`(^|[、,，;；/|\\s])${escapeRegExp(tag)}(?=$|[、,，;；/|\\s])`, "g"), "$1");
  });
  return text.replace(/[、,，;；/|]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadRestaurantDeck({ modeName, choice, coords, setLoading, toast, avoidCardKeys = [] }) {
  const center = normalizeCoord(coords) || await getApproxPosition();
  const searchPlan = await restaurantSearchPlanForMode(modeName, choice, center, { setLoading, toast });
  const destination = await resolveRestaurantDestinationContext(center, searchPlan, choice);
  const meetup = destination ? null : await resolveRestaurantMeetupContext(center, searchPlan, choice);
  const searchCoords = destination?.searchCoords || meetup?.searchCoords || await resolveRestaurantSearchCoords(center, searchPlan);
  const allowedCity = restaurantAllowedCityFromCoords(searchCoords) || restaurantAllowedCityFromCoords(center);
  const searchOptions = restaurantSearchOptions(searchPlan);
  const boundedSearchOptions = allowedCity
    ? { ...searchOptions, region: searchOptions.region || allowedCity, cityLimit: true, allowedCity }
    : searchOptions;
  // 到店吃(无分类、非组局、非指定目的地)= 自己走过去,硬性 ≤3km;
  // 咖啡/奶茶/外卖(choice.category)是配送、组局/目的地是中间点,均可更远。
  const isDeliveryCategory = Boolean(choice && choice.category);
  const baseRadius = destination?.radiusMeters || meetup?.radiusMeters || searchPlan.radiusMeters || 3500;
  const radius = (!isDeliveryCategory && !destination && !meetup)
    ? Math.min(baseRadius, EATIN_MAX_RADIUS)
    : baseRadius;
  const radiusTarget = restaurantSearchRadiusTarget({ userCoords: center, searchCoords, destination, meetup });
  const avoidSet = normalizeRestaurantReplayKeySet(avoidCardKeys);
  if (toast) toast(restaurantSearchToast(searchPlan.keywords, meetup, destination));
  const lockSearchCenter = Boolean(destination || meetup || isPreciseRestaurantSearchCenter(center));
  const result = await searchRestaurantsWithFallback(searchCoords, radius, searchPlan.keywords, boundedSearchOptions, meetup, { lockSearchCenter });
  let rawPois = filterRestaurantPoisWithinAllowedCity(filterRestaurantPoisWithinSearchRadius(result.pois, radiusTarget, radius), allowedCity);
  if (meetup) rawPois = rankRestaurantPoisForMeetup(rawPois, meetup);
  const cardOptions = { ...boundedSearchOptions, userCoords: center, searchCoords: result.coords, destination, meetup };
  const category = choice && choice.category;
  const buildCards = (poiList) => category
    ? categoryRestaurantCards(poiList, cardOptions, avoidSet, category, choice && choice.preferredBrands)
    : restaurantCardsForModeAvoiding(poiList, modeName, cardOptions, avoidSet);
  let pois = await enrichRestaurantTravelMetrics(rawPois, cardOptions, setLoading);
  let cards = buildCards(pois);
  if (cards.length < TOTAL) {
    const wide = await searchRestaurantsWithFallback(searchCoords, Math.max(radius, 8000), searchPlan.keywords, boundedSearchOptions, meetup, { lockSearchCenter });
    let widePois = filterRestaurantPoisWithinAllowedCity(filterRestaurantPoisWithinSearchRadius(wide.pois, radiusTarget, radius), allowedCity);
    if (meetup) widePois = rankRestaurantPoisForMeetup(widePois, meetup);
    const mergedPois = uniquePois([...rawPois, ...widePois]);
    pois = await enrichRestaurantTravelMetrics(mergedPois, cardOptions, setLoading);
    cards = buildCards(pois);
  }
  cards = filterRestaurantCardsWithinAllowedCity(filterRestaurantCardsWithinSearchRadius(cards, radiusTarget, radius), allowedCity);
  if (toast && cards.length) toast(`已准备好 ${cards.length} 家附近餐厅候选`);
  return { cards: cards.slice(0, TOTAL), searchPlan, searchCoords: result.coords, destination, meetup };
}

async function restaurantSearchPlanForMode(modeName, choice, coords, helpers) {
  const manualOverrides = normalizeChoiceIntentOverrides(choice && choice.intentOverrides);
  let plan;
  if (manualOverrides) {
    const basePlan = manualOverrides.basePlan
      ? cloneRestaurantPlan(manualOverrides.basePlan)
      : localRestaurantSearchPlan(choice);
    plan = ensureRestaurantMeetupPlanForMode(applyChoiceIntentOverrides(basePlan, choice, manualOverrides), choice);
  } else {
    const basePlan = (!ENABLE_REMOTE_AI_PLAN || !isAiMode(modeName))
      ? localRestaurantSearchPlan(choice, { forceGeneric: !isAiMode(modeName) })
      : await aiRestaurantSearchPlan(choice, coords, helpers);
    plan = ensureRestaurantMeetupPlanForMode(basePlan, choice);
  }
  // 自然语言"不吃辣/清淡/不吃海鲜"等规则识别(补 AI 不准),AI/本地两条路都生效
  plan = applyTextDietaryRules(plan, choice);
  // 多人组局忌口chip:汇总成 avoidKeywords,AI/本地两条路都过滤(放在分类前)
  plan = mergeMeetupDietAvoid(plan, choice);
  // 咖啡奶茶 / 美食外卖 分支:用分支预设覆盖关键词与范围(价格等大模型解析仍保留)
  if (choice && choice.category) plan = applyRestaurantCategoryPlan(plan, choice.category);
  return plan;
}

// 把「咖啡奶茶 / 美食外卖」分支的预设套到搜索计划上
function applyRestaurantCategoryPlan(plan, category) {
  const preset = CATEGORY_PRESETS[category];
  if (!preset) return plan;
  const next = {
    ...plan,
    category,
    restaurantTypeDiversity: false,
    minRating: 0,
    sortrule: "distance",
    types: preset.types,
    preferOpenLate: false,
    openAtHour: 0,
    radiusMeters: Math.min(plan.radiusMeters || preset.radiusMeters, preset.radiusMeters)
  };
  if (category === "coffee" || category === "milktea") {
    // 咖啡 / 奶茶分支强制走各自饮品关键词,且不限价
    next.minCost = 0;
    next.maxCost = 0;
    next.keywords = preset.keywords.slice();
  } else {
    // 外卖分支:用户若已表达具体口味(非默认多样化),保留并叠加外卖关键词
    const userKeywords = plan.restaurantTypeDiversity
      ? []
      : (plan.keywords || []).filter((keyword) => keyword && keyword !== RESTAURANT_KEYWORD_FALLBACK);
    next.keywords = uniqueKeywords([...userKeywords, ...preset.keywords]).slice(0, 6);
  }
  next.searchRequests = normalizePlanSearchRequests([], next.keywords, next);
  return next;
}

// 分支卡组:品牌优先(用户常点 + 有新品的排最前),并给卡片标注品牌/新品
function categoryRestaurantCards(pois, options, avoidKeys, category, preferredBrands = []) {
  const avoidSet = normalizeRestaurantReplayKeySet(avoidKeys);
  const ranked = rankCategoryPois(pois, preferredBrands);
  const fresh = ranked.filter((poi) => !avoidSet.has(restaurantCardReplayKey(poi)));
  const ordered = fresh.length >= TOTAL
    ? fresh
    : [...fresh, ...ranked.filter((poi) => avoidSet.has(restaurantCardReplayKey(poi)))];
  const cards = poisToCards(ordered.slice(0, TOTAL), options);
  return cards.map((card) => annotateCategoryCard(card, category, preferredBrands));
}

// 分支评分门槛:小品牌(非连锁)需评分≥此值才纳入;连锁直接保留
const CATEGORY_MIN_RATING = 3.5;

// 评分是否过门槛:连锁恒过;非连锁评分≥3.5 才过;无评分给予保留(多为小店,不误杀)
function categoryPoiRatingPass(poi, isChain) {
  if (isChain) return true;
  const rating = parseFloat(poi && poi.rating);
  if (!Number.isFinite(rating) || rating <= 0) return true; // 无评分:保留
  return rating >= CATEGORY_MIN_RATING;
}

// 前 TOTAL 张里给附近小店预留的名额(保证"大牌为主、也有小店")
const CATEGORY_RESERVE_SMALL = 1;

// 品牌优先打分:用户常点(+4) > 有新品(+2) > 连锁/通用品牌(+1) > 小店(0)。
// 头部以品牌为主(让 M Stand / Manner 这类大牌冒头),但预留 1 个名额给附近评分达标(≥3.5)
// 的小店,既不被无名小咖啡按距离挤掉大牌,又能混进一家小店。
function rankCategoryPois(pois, preferredBrands = []) {
  const preferred = new Set((preferredBrands || []).filter(Boolean));
  const scored = (Array.isArray(pois) ? pois : [])
    .map((poi, index) => {
      const brand = matchChainBrand(poi && poi.name);
      let score = 0;
      if (brand) {
        score += 1;
        if (brandNewDrop(brand.name)) score += 2;
        if (preferred.has(brand.name)) score += 4;
      }
      return { poi, index, isBrand: Boolean(brand), score };
    })
    .filter((item) => categoryPoiRatingPass(item.poi, item.isBrand));

  const brands = scored.filter((x) => x.isBrand).sort((a, b) => b.score - a.score || a.index - b.index);
  const smalls = scored.filter((x) => !x.isBrand).sort((a, b) => a.index - b.index); // 小店按距离

  // 头部:品牌占 TOTAL-预留 个,余下给最近的小店;不足则互相补齐
  const reserve = smalls.length ? CATEGORY_RESERVE_SMALL : 0;
  const head = [];
  head.push(...brands.slice(0, Math.max(0, TOTAL - reserve)));
  head.push(...smalls.slice(0, TOTAL - head.length));
  const headSet = new Set(head.map((x) => x.poi));
  const tail = [...brands, ...smalls].filter((x) => !headSet.has(x.poi)); // 其余按品牌优先补后面
  return [...head, ...tail].map((item) => item.poi);
}

function annotateCategoryCard(card, category, preferredBrands = []) {
  if (!card) return card;
  const brand = matchChainBrand(card.name);
  const brandName = brand ? brand.name : "";
  const newDrop = brandName ? brandNewDrop(brandName) : "";
  const preferred = Boolean(brandName && (preferredBrands || []).includes(brandName));
  // 分类卡不展示距离/通勤(用户只想看品牌/新品),卡面只留评分+人均
  return {
    ...card,
    category,
    brand: brandName,
    newDrop,
    preferred,
    summaryPills: dropCommuteSummaryPills(card.summaryPills),
    meta: dropCommuteMetaTexts(card.meta)
  };
}

// 卡面距离/通勤相关文案的识别(用于在分类卡里剔除)
const COMMUTE_TEXT_PATTERN = /步行|驾车|地铁|公里|千米|km|\d+\s*米|分钟|离你|距地铁/i;
function dropCommuteSummaryPills(pills) {
  return (Array.isArray(pills) ? pills : []).filter(
    (pill) => pill && pill.text && !COMMUTE_TEXT_PATTERN.test(pill.text)
  );
}
function dropCommuteMetaTexts(meta) {
  return (Array.isArray(meta) ? meta : []).filter(
    (text) => text && !COMMUTE_TEXT_PATTERN.test(text)
  );
}

async function aiRestaurantSearchPlan(choice, coords, { setLoading, toast } = {}) {
  const signature = JSON.stringify({
    question: choice.question,
    tags: choice.tags,
    destination: extractRestaurantDestinationHint(choice)?.name || "",
    locations: extractedRestaurantParticipantLocationNames(choice),
    targetHints: extractRestaurantParticipantTargetHints(choice),
    coords: coords ? [coords.lat, coords.lng, coords.label || "", coords.addressMeta || ""] : null,
    version: "search-plan-v13-location-keyword-fix"
  });
  if (restaurantSearchPlan && restaurantSearchPlanSignature === signature) return restaurantSearchPlan;
  if (restaurantSearchPlanPromise && restaurantSearchPlanPromise.signature === signature) return restaurantSearchPlanPromise;
  if (setLoading) setLoading("发牌中…", "正在按你这句话挑真实餐厅，先发 5 张。");
  restaurantSearchPlanPromise = fetchRestaurantSearchPlan(choice, coords).then((plan) => {
    const resolved = normalizeRestaurantSearchPlan(plan, choice);
    if (!resolved.keywords.length) throw new Error("AI 没有返回有效搜索关键词");
    restaurantSearchPlan = resolved;
    restaurantSearchPlanSignature = signature;
    return resolved;
  }).catch((error) => {
    console.warn("AI restaurant search plan unavailable", error);
    const fallback = localRestaurantSearchPlan(choice);
    restaurantSearchPlan = fallback;
    restaurantSearchPlanSignature = signature;
    if (toast) toast("AI 解析暂不可用，按标签搜索高德");
    return fallback;
  }).finally(() => {
    restaurantSearchPlanPromise = null;
  });
  restaurantSearchPlanPromise.signature = signature;
  return restaurantSearchPlanPromise;
}

async function fetchRestaurantSearchPlan(choice, coords) {
  const questionWithTags = [
    choice.question,
    choice.tags && choice.tags.length ? `标签：${choice.tags.join("、")}` : ""
  ].filter(Boolean).join("\n");
  const data = await wxRequest({
    url: RESTAURANT_SEARCH_PLAN_ENDPOINT,
    method: "POST",
    header: { "content-type": "application/json" },
    timeout: 6500,
    data: {
      moduleId: "dinner",
      question: questionWithTags || choice.question,
      scenes: choice.scenes,
      needs: choice.needs,
      tags: choice.tags,
      locationHint: extractRestaurantDestinationHint(choice)?.name || "",
      locationHints: extractedRestaurantParticipantLocationNames(choice),
      dietAvoid: Array.isArray(choice.dietAvoid) ? choice.dietAvoid : [],
      tastePref: choice.tastePref || "",
      memberPrefs: Array.isArray(choice.multiAreaRows)
        ? choice.multiAreaRows.map((row) => ({ role: row.role || "", pref: row.pref || "", travels: row.travels || [] }))
        : [],
      location: coords ? { lat: coords.lat, lng: coords.lng, label: coords.label || "", accuracy: coords.accuracy || 0 } : null,
      currentLocationLabel: coords && coords.label || "",
      currentLocationDetail: coords && coords.addressMeta || ""
    }
  });
  if (!data || !data.ok) throw new Error(data && data.message ? data.message : "AI 搜索条件解析失败");
  return data.plan || data.searchPlan || data;
}

function normalizeRestaurantSearchPlan(plan, choice) {
  const source = plan && (plan.plan || plan.searchPlan || plan) || {};
  const amapFields = source.amapFields || source.amapParams || source.amap || {};
  const fallback = localRestaurantSearchPlan(choice);
  const rawKeywords = normalizePlanKeywords(source.keywords || source.searchKeywords || source.amapKeywords || source.tags);
  const minCost = readPlanCost(source.minCost ?? source.min_price ?? source.minPrice);
  const maxCost = readPlanCost(source.maxCost ?? source.max_price ?? source.maxPrice);
  const minRating = readPlanRating(source.minRating ?? source.min_rating ?? source.ratingMin);
  const radius = source.radiusMeters || source.radius || source.radius_meters || amapFields.radiusMeters || amapFields.radius || amapFields.radius_meters;
  const explicitRadius = inferExplicitRestaurantRadiusMeters(choice);
  const participantTargets = extractRestaurantParticipantTargetHints(choice);
  const sourceLocationIntent = source.locationIntent || {};
  const sourceIncludesCurrentLocation = Boolean(
    source.includeCurrentLocationInMeetup ||
    source.include_current_location_in_meetup ||
    sourceLocationIntent.includeCurrentLocationInMeetup ||
    (Array.isArray(sourceLocationIntent.participantAudit) && sourceLocationIntent.participantAudit.some((item) => item && item.source === "currentLocation"))
  );
  const sourceCurrentLocationHints = restaurantCurrentLocationHintsFromPlan(source);
  const locationHints = filterRestaurantCurrentLocationHints(
    normalizeRestaurantLocationHints(source.locationHints || source.locations || source.participantLocations || source.meetingLocations),
    sourceIncludesCurrentLocation ? sourceCurrentLocationHints : []
  );
  const fallbackLocationHints = extractedRestaurantParticipantLocationNames(choice);
  const forceCurrentPlusFallbackMeetup = shouldUseCurrentLocationForMeetup(choice, fallbackLocationHints);
  const keywordLocationHints = restaurantLocationHintsFromKeywords(rawKeywords, choice);
  const textLocationHints = participantTargets.length >= 2 ? participantTargets : fallbackLocationHints;
  const resolvedLocationHints = textLocationHints.length >= 2
    ? uniqueRestaurantLocationHints([...textLocationHints, ...locationHints, ...keywordLocationHints])
    : forceCurrentPlusFallbackMeetup
      ? fallbackLocationHints
      : uniqueRestaurantLocationHints([...locationHints, ...fallbackLocationHints, ...keywordLocationHints]);
  const currentPlusFriendMeetup = forceCurrentPlusFallbackMeetup || shouldUseCurrentLocationForMeetup(choice, resolvedLocationHints);
  const multiParticipantMeetup = participantTargets.length >= 2 || resolvedLocationHints.length >= 2 || currentPlusFriendMeetup || (sourceIncludesCurrentLocation && resolvedLocationHints.length >= 1);
  const includeCurrentLocationInMeetup = Boolean((sourceIncludesCurrentLocation && resolvedLocationHints.length >= 1) || (currentPlusFriendMeetup && resolvedLocationHints.length === 1));
  const meetupParticipantCount = resolvedLocationHints.length + (includeCurrentLocationInMeetup ? 1 : 0);
  const keywords = multiParticipantMeetup
    ? restaurantKeywordsWithoutLocationHints(rawKeywords, [...resolvedLocationHints, ...sourceCurrentLocationHints], { fallbackKeywords: fallback.keywords })
    : rawKeywords;
  const fallbackDestinationHint = multiParticipantMeetup ? "" : (extractRestaurantDestinationHint(choice)?.name || "");
  const sourceLocationHint = multiParticipantMeetup ? "" : cleanRestaurantDestinationHint(source.locationHint || source.destinationHint || source.destination || source.area || source.landmark || "");
  const resolvedMinCost = Number.isFinite(minCost) ? minCost : fallback.minCost;
  const fallbackMaxCost = fallback.maxCost && (!resolvedMinCost || fallback.maxCost >= resolvedMinCost) ? fallback.maxCost : 0;
  const resolvedRadiusMeters = explicitRadius || (forceCurrentPlusFallbackMeetup
    ? normalizeAmapRadius(fallback.radiusMeters, fallback.radiusMeters)
    : normalizeAmapRadius(radius, fallback.radiusMeters));
  const declaredTypes = source.types || source.typeCodes || source.amapTypes || amapFields.types || amapFields.typeCodes;
  const inferredTypes = inferRestaurantAmapTypes([choice.question, choice.tags, keywords, source.restaurantTypeIntent, source.typeIntent].flat().join(" "));
  const broadSceneTypes = (keywords.length ? keywords : fallback.keywords).some((keyword) => isBroadRestaurantSceneKeyword(keyword)) ? "050000" : "";
  const normalizedLocationIntent = multiParticipantMeetup && source.locationIntent && typeof source.locationIntent === "object"
    ? {
      ...source.locationIntent,
      destination: "",
      region: "",
      street: "",
      participantLocations: resolvedLocationHints,
      strategy: "midpoint",
      textLocationCount: resolvedLocationHints.length,
      totalParticipantCount: Math.max(Number(source.locationIntent.totalParticipantCount) || 0, meetupParticipantCount),
      totalLocationCount: meetupParticipantCount
    }
    : (source.locationIntent || null);
  const resolved = {
    keywords: keywords.length ? keywords : fallback.keywords,
    minCost: resolvedMinCost,
    maxCost: Number.isFinite(maxCost) && (!resolvedMinCost || maxCost >= resolvedMinCost) ? maxCost : fallbackMaxCost,
    radiusMeters: resolvedRadiusMeters,
    types: mergeAmapTypes(declaredTypes, inferredTypes !== "050000" ? inferredTypes : "", broadSceneTypes),
    sortrule: normalizeAmapSortRule(source.sortrule || source.sortRule || amapFields.sortrule || amapFields.sortRule || fallback.sortrule),
    region: cleanRestaurantKeyword(source.region || amapFields.region || source.city || source.locationIntent?.region || source.locationIntent?.street || ""),
    cityLimit: Boolean(source.cityLimit ?? source.city_limit ?? amapFields.cityLimit ?? amapFields.city_limit ?? (source.region || amapFields.region ? true : fallback.cityLimit)),
    showFields: normalizeAmapShowFields(source.showFields || source.show_fields || amapFields.showFields || amapFields.show_fields),
    minRating: Number.isFinite(minRating) ? minRating : fallback.minRating,
    preferOpenLate: Boolean(source.preferOpenLate || source.openLate || source.lateNight || fallback.preferOpenLate),
    openAtHour: readPlanHour(source.openAtHour || source.open_at_hour || source.openAt),
    mustKeywords: normalizeSimpleKeywords(source.mustKeywords || source.includeKeywords || source.requiredKeywords, 8),
    avoidKeywords: normalizeSimpleKeywords(source.avoidKeywords || source.excludeKeywords || source.negativeKeywords, 8),
    locationHint: multiParticipantMeetup ? "" : (fallbackDestinationHint || sourceLocationHint || (resolvedLocationHints.length === 1 ? resolvedLocationHints[0] : fallback.locationHint)),
    locationHints: resolvedLocationHints,
    includeCurrentLocationInMeetup,
    sceneIntent: source.sceneIntent || source.scenarioIntent || null,
    keywordStrategy: Array.isArray(source.keywordStrategy) ? source.keywordStrategy.slice(0, 8) : [],
    priceIntent: source.priceIntent || null,
    locationIntent: normalizedLocationIntent,
    restaurantTypeIntent: source.restaurantTypeIntent || source.typeIntent || null,
    explanation: String(source.explanation || source.reason || "").slice(0, 120),
    source: source.source || "deepseek"
  };
  if (!resolved.region) resolved.cityLimit = false;
  resolved.needsCompanionLocation = needsRestaurantCompanionLocation(choice, resolved);
  resolved.searchRequests = normalizePlanSearchRequests(source.searchRequests || source.queries || source.queryIntents, resolved.keywords, resolved)
    .map((request) => ({ ...request, radiusMeters: Math.min(request.radiusMeters, resolved.radiusMeters) }));
  applyDefaultRestaurantTypeDiversity(resolved, choice);
  if (multiParticipantMeetup) {
    resolved.region = restaurantCityLabelFromText(resolved.region) ? resolved.region : "";
    resolved.cityLimit = Boolean(resolved.region && resolved.cityLimit);
    resolved.searchRequests = resolved.searchRequests.map((request) => {
      const region = restaurantCityLabelFromText(request.region) ? request.region : "";
      return { ...request, region, cityLimit: Boolean(region && request.cityLimit) };
    });
  }
  return resolved;
}

function localRestaurantSearchPlan(choice, { forceGeneric = false } = {}) {
  const keywords = forceGeneric ? [RESTAURANT_KEYWORD_FALLBACK] : restaurantSearchKeywords(choice);
  const locationHints = extractedRestaurantParticipantLocationNames(choice);
  const currentPlusFriendMeetup = shouldUseCurrentLocationForMeetup(choice, locationHints);
  const destinationHint = extractRestaurantParticipantTargetHints(choice).length >= 2 || currentPlusFriendMeetup
    ? ""
    : (extractRestaurantDestinationHint(choice)?.name || (locationHints.length === 1 ? locationHints[0] : ""));
  const preferOpenLate = choice.tags.includes("夜宵") || choice.tags.includes("通宵熬夜");
  const inferredTypes = inferRestaurantAmapTypes([choice.question, choice.tags, keywords].flat().join(" ")) || "050000";
  const types = mergeAmapTypes(inferredTypes !== "050000" ? inferredTypes : "", keywords.some((keyword) => isBroadRestaurantSceneKeyword(keyword)) ? "050000" : "");
  const radiusMeters = inferRestaurantSearchRadius(choice, { hasDestination: Boolean(destinationHint), participantCount: locationHints.length + (currentPlusFriendMeetup ? 1 : 0) });
  const sortrule = inferRestaurantSortRule(choice);
  const costRange = forceGeneric ? { minCost: 0, maxCost: 0 } : inferRestaurantCostRange(choice);
  const plan = {
    keywords,
    minCost: !forceGeneric && choice.tags.includes("人均150+") ? Math.max(MIN_RESTAURANT_COST, costRange.minCost || 0) : costRange.minCost,
    maxCost: costRange.maxCost,
    radiusMeters,
    types,
    sortrule,
    region: "",
    cityLimit: false,
    showFields: AMAP_SHOW_FIELDS_DEFAULT,
    minRating: 0,
    preferOpenLate: !forceGeneric && preferOpenLate,
    openAtHour: !forceGeneric && preferOpenLate ? 23 : 0,
    mustKeywords: [],
    avoidKeywords: [],
    locationHint: destinationHint,
    locationHints,
    explanation: "",
    needsCompanionLocation: false,
    source: "local"
  };
  plan.needsCompanionLocation = needsRestaurantCompanionLocation(choice, plan);
  plan.searchRequests = normalizePlanSearchRequests([], plan.keywords, plan);
  applyDefaultRestaurantTypeDiversity(plan, choice);
  applyMeetupTasteKeywords(plan, choice); // 组局综合口味覆盖(清淡/重口)
  return plan;
}

function applyDefaultRestaurantTypeDiversity(plan, choice = {}) {
  if (!plan || hasExplicitRestaurantFoodPreference(choice)) return false;
  const intents = DEFAULT_DIVERSE_RESTAURANT_INTENTS;
  plan.restaurantTypeDiversity = true;
  plan.keywords = intents.map((item) => item.keyword);
  plan.types = "050000";
  plan.searchRequests = intents.map((item, index) => ({
    keyword: item.keyword,
    types: normalizeAmapTypes(item.types || inferRestaurantAmapTypes(item.keyword)),
    radiusMeters: normalizeAmapRadius(plan.radiusMeters || 3500),
    sortrule: normalizeAmapSortRule(plan.sortrule),
    region: cleanRestaurantKeyword(plan.region || ""),
    cityLimit: Boolean(plan.cityLimit && plan.region),
    showFields: normalizeAmapShowFields(plan.showFields),
    priority: index + 1
  }));
  return true;
}

function hasExplicitRestaurantFoodPreference(choice = {}) {
  const tags = Array.isArray(choice.tags) ? choice.tags : [];
  if (tags.some((tag) => MORE_TAGS.includes(tag))) return true;
  const sourceText = cleanChoiceQuestion(`${choice.question || ""} ${tags.join(" ")}`);
  const normalizedText = normalizeMatchText(sourceText);
  return FOOD_SEARCH_TERMS.some((term) => {
    if (GENERIC_FOOD_INTENT_TERMS.has(term)) return false;
    const key = normalizeMatchText(term);
    return key && normalizedText.includes(key);
  });
}

// 多人组局综合口味:清淡/重口 → 关键词覆盖(仅当没人显式点具体菜系时,尊重显式选择)
function applyMeetupTasteKeywords(plan, choice = {}) {
  const taste = choice && choice.tastePref;
  if (!plan || !taste || !TASTE_SEARCH_KEYWORDS[taste]) return plan;
  if (hasExplicitRestaurantFoodPreference(choice)) return plan;
  plan.restaurantTypeDiversity = false;
  plan.keywords = TASTE_SEARCH_KEYWORDS[taste].slice(0, 6);
  plan.types = "050000";
  plan.searchRequests = normalizePlanSearchRequests([], plan.keywords, plan);
  return plan;
}

// 多人组局忌口:choice.dietAvoid 已是识别好的排除关键词,直接并入 avoidKeywords(AI/本地都生效)
function mergeMeetupDietAvoid(plan, choice = {}) {
  const dietAvoid = Array.isArray(choice && choice.dietAvoid) ? choice.dietAvoid : [];
  if (!plan || !dietAvoid.length) return plan;
  const avoid = new Set(plan.avoidKeywords || []);
  dietAvoid.forEach((keyword) => keyword && avoid.add(keyword));
  plan.avoidKeywords = [...avoid];
  return plan;
}

// 忌口/否定词是硬过滤(店名/品类命中即剔除,永不放宽),上限给大一些:多人多条忌口也不会被截断
const AVOID_KEYWORD_LIMIT = 32;
// 搜索关键词里"辣味相关"的项(不吃辣时不主动搜这些;清汤火锅等若自然出现不硬杀)
const SPICY_SEARCH_KEYWORD_PATTERN = /川|湘|麻辣|水煮|干锅|重庆|火锅|烧烤|烤肉|串|麻辣烫|辣/;
const SEAFOOD_SEARCH_KEYWORD_PATTERN = /海鲜|海产|生蚝|海鲜大咖/;
// 否定词(出现在某菜系前/后即视为"不要这个")
const NEGATION_PREFIX = "(?:不吃|不要|不想吃|别吃|别点|不点|忌|不喜欢|讨厌|不爱吃|不来|拒绝|没有|不沾|戒)";
const NEGATION_SUFFIX = "(?:过敏|忌口|不行|免了|不沾|就免)";
// 某些菜系展开成相关词,排除/不搜时更彻底(否定"日料"也连带寿司/居酒屋等)
const CUISINE_RELATED = {
  "日料": ["日料", "日本料理", "日本菜", "日式料理", "和食", "寿司", "刺身", "居酒屋", "寿喜烧", "日式", "烧鸟", "鳗鱼"],
  "日本料理": ["日料", "日本料理", "日本菜", "和食", "寿司", "刺身", "居酒屋", "日式"],
  "韩餐": ["韩餐", "韩国料理", "部队锅", "石锅", "韩式", "炸鸡啤酒"],
  "韩国料理": ["韩餐", "韩国料理", "部队锅", "石锅", "韩式"],
  "火锅": ["火锅", "串串", "麻辣烫", "冒菜"],
  "西餐": ["西餐", "牛排", "意面", "披萨", "法餐", "意大利"],
  "烧烤": ["烧烤", "烤肉", "烧鸟", "串"],
  "川菜": ["川菜", "麻辣", "水煮", "干锅", "重庆", "辣子"],
  "湘菜": ["湘菜", "剁椒", "辣"],
  "粤菜": ["粤菜", "茶餐厅", "早茶", "点心"]
};

// 扫描问题里被否定的菜系(不吃日料/西餐不行/讨厌韩餐…),返回需排除的关键词
function negatedCuisineKeywords(text) {
  const t = String(text || "");
  const out = [];
  FOOD_SEARCH_TERMS.forEach((term) => {
    if (GENERIC_FOOD_INTENT_TERMS.has(term)) return; // 跳过"餐厅/夜宵"这种泛词
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${NEGATION_PREFIX}\\s*${esc}|${esc}\\s*${NEGATION_SUFFIX}`);
    if (re.test(t)) out.push(...(CUISINE_RELATED[term] || [term]));
  });
  return [...new Set(out)];
}

// 自然语言忌口/口味识别(规则映射,补 AI 的不准:如"不吃辣"被推火锅、"不吃日料"却全是日料)
function parseDietaryFromText(text) {
  const t = String(text || "");
  const avoid = [];
  let taste = "";
  let noSpicy = false;
  let noSeafood = false;
  if (/(不吃辣|不要辣|不能吃辣|怕辣|忌辣|不吃辛辣|别太辣|不沾辣|无辣(?!不欢)|不辣|清淡|少辣)/.test(t)) {
    avoid.push(...(DIET_EXCLUDE_KEYWORDS["不吃辣"] || []));
    noSpicy = true;
    if (/清淡/.test(t)) taste = "清淡";
  }
  if (/(不吃海鲜|海鲜过敏|不吃鱼虾|海鲜忌口|不吃虾|不吃蟹|海鲜不行)/.test(t)) {
    avoid.push(...(DIET_EXCLUDE_KEYWORDS["海鲜忌口"] || []));
    noSeafood = true;
  }
  // 通用否定:不吃日料/不要西餐/讨厌火锅…
  avoid.push(...negatedCuisineKeywords(t));
  if (!taste && /(重口|重辣|无辣不欢|能吃辣|爱吃辣|重油|够味|越辣越好)/.test(t)) {
    taste = "重口";
  }
  return { avoid: [...new Set(avoid)], taste, noSpicy, noSeafood };
}

// 否定守卫只对"正向想吃"类规则生效:这些词被否定时意思相反(如"吃肉"在"不想吃肉"里 → 不算想吃肉)。
// 忌口/避味类规则(不辣/不吃海鲜/无烟/清淡)本身就靠否定表达,前面有"别/不"是确认而非反转,故不设防。
const INTENT_NEGATION_PREFIX_CHARS = "不没别无忌";
const NEGATION_GUARDED_RULE_IDS = new Set(["meat", "noodle", "midSpicy", "heavy", "heavySpicy"]);
function intentRuleHitsText(rule, text) {
  const guarded = NEGATION_GUARDED_RULE_IDS.has(rule.id);
  return (rule.match || []).some((word) => {
    if (!word) return false;
    if (!guarded) return text.indexOf(word) >= 0;
    let idx = text.indexOf(word);
    while (idx >= 0) {
      // 看 token 前最多 2 个字是否有否定字(如"吃肉"出现在"不想吃肉"里 → 不算命中)
      const before = text.slice(Math.max(0, idx - 2), idx);
      if (![...before].some((ch) => INTENT_NEGATION_PREFIX_CHARS.indexOf(ch) >= 0)) return true;
      idx = text.indexOf(word, idx + 1);
    }
    return false;
  });
}

// 用意图词库(docs/意图词库-映射表.csv 生成)匹配整段文本,聚合出 搜/避/口味标记。
// 场景维度(约会/商务/夜宵…)由标签系统负责,这里跳过,避免与多样化逻辑打架。
function matchIntentRules(text) {
  const t = String(text || "");
  const fired = INTENT_RULES.filter((rule) => rule.dim !== "场景" && intentRuleHitsText(rule, t));
  const firedIds = new Set(fired.map((rule) => rule.id));
  // 辣度冲突:嗜辣(heavySpicy)命中 → 压制"不吃辣/清淡/微辣"等反向判定(如"无辣不欢"含"无辣")
  const suppress = firedIds.has("heavySpicy") ? new Set(["noSpicy", "light", "midSpicy"]) : new Set();
  const searchAdd = [];
  const avoidAdd = [];
  let taste = "";
  let noSpicy = false;
  let noSeafood = false;
  fired.forEach((rule) => {
    if (suppress.has(rule.id)) return;
    (rule.search || []).forEach((keyword) => keyword && searchAdd.push(keyword));
    (rule.avoid || []).forEach((keyword) => keyword && avoidAdd.push(keyword));
    if (rule.taste && (!taste || rule.taste === "重口")) taste = rule.taste;
    if (rule.noSpicy) noSpicy = true;
    if (rule.noSeafood) noSeafood = true;
  });
  return { searchAdd: [...new Set(searchAdd)], avoidAdd: [...new Set(avoidAdd)], taste, noSpicy, noSeafood };
}

// 把自然语言识别到的忌口/口味落到 plan:加 POI 排除 + 不主动搜被排除/辣味词 + 必要时换清淡/中性词
function applyTextDietaryRules(plan, choice = {}) {
  if (!plan) return plan;
  const text = `${(choice && choice.question) || ""} ${Array.isArray(choice && choice.tags) ? choice.tags.join(" ") : ""}`;
  const parsed = parseDietaryFromText(text);
  const intent = matchIntentRules(text);
  const avoidList = [...new Set([...parsed.avoid, ...intent.avoidAdd])];
  const taste = parsed.taste || intent.taste;
  const noSpicy = parsed.noSpicy || intent.noSpicy;
  const noSeafood = parsed.noSeafood || intent.noSeafood;
  // 出现忌口/口味信号,或有明确的正向推荐意图(嗦面/硬菜/清爽…)时接管;否则不动多样化结果
  if (!avoidList.length && !taste && !noSpicy && !noSeafood && !intent.searchAdd.length) return plan;
  // 1) POI 层排除(店名/品类命中即过滤,硬过滤永不放宽)
  const avoidSet = new Set(plan.avoidKeywords || []);
  avoidList.forEach((keyword) => keyword && avoidSet.add(keyword));
  plan.avoidKeywords = [...avoidSet];
  // 2) 不主动搜任何会被排除的词(含被否定的菜系,如"不吃日料"→剔除日料/寿司)+ 辣味/海鲜
  const avoidNorm = plan.avoidKeywords.map(normalizeMatchText).filter(Boolean);
  const stripBad = (list) => (Array.isArray(list) ? list : []).filter((keyword) => {
    const n = normalizeMatchText(keyword);
    if (!n) return false;
    if (avoidNorm.some((a) => n.includes(a) || a.includes(n))) return false;
    if (noSpicy && SPICY_SEARCH_KEYWORD_PATTERN.test(keyword)) return false;
    if (noSeafood && SEAFOOD_SEARCH_KEYWORD_PATTERN.test(keyword)) return false;
    return true;
  });
  let keywords = stripBad(plan.keywords);
  // 3) 用户没点具体菜系时,用意图词库的推荐词补位,且让意图词**领先**通用词(健身→先搜轻食沙拉、嗦面→先搜面)
  if (!hasExplicitRestaurantFoodPreference(choice) && intent.searchAdd.length) {
    const merged = uniqueKeywords([...stripBad(intent.searchAdd), ...keywords]);
    if (merged.length) keywords = merged.slice(0, 6);
  }
  if (!keywords.length) {
    keywords = (taste === "清淡" || noSpicy) && TASTE_SEARCH_KEYWORDS["清淡"]
      ? TASTE_SEARCH_KEYWORDS["清淡"].slice(0, 6)
      : [RESTAURANT_KEYWORD_FALLBACK];
  }
  // 4) 明确清淡(且没人点具体菜系)→ 直接走清淡系
  if (taste === "清淡" && TASTE_SEARCH_KEYWORDS["清淡"] && !hasExplicitRestaurantFoodPreference(choice)) {
    keywords = TASTE_SEARCH_KEYWORDS["清淡"].slice(0, 6);
  }
  plan.keywords = keywords;
  plan.restaurantTypeDiversity = false;
  plan.types = "050000";
  plan.searchRequests = normalizePlanSearchRequests([], plan.keywords, plan);
  return plan;
}

function restaurantSearchKeywords(choice) {
  const raw = [];
  const questionKeywords = extractRestaurantQuestionKeywords(choice.question);
  const hasQuestionKeywords = questionKeywords.length > 0;
  choice.tags.filter((tag) => PRIORITY_TAGS.has(tag)).forEach(pushRestaurantTagKeywords);
  questionKeywords.forEach((keyword) => raw.push(keyword));
  choice.tags.filter((tag) => !PRIORITY_TAGS.has(tag)).forEach(pushRestaurantTagKeywords);
  const text = [choice.question, choice.tags.join(" ")].join(" ");
  FOOD_SEARCH_TERMS.forEach((term) => {
    if (text.toLowerCase().includes(term.toLowerCase())) raw.push(term);
  });
  const cleaned = uniqueKeywords(raw.map(cleanRestaurantKeyword).filter(Boolean));
  return limitRestaurantKeywords(cleaned, 6, { includeFallback: !hasQuestionKeywords });

  function pushRestaurantTagKeywords(tag) {
    (TAG_SEARCH_KEYWORDS[tag] || [tag]).forEach((keyword) => {
      if (hasQuestionKeywords && keyword === RESTAURANT_KEYWORD_FALLBACK) return;
      raw.push(keyword);
    });
  }
}

function extractRestaurantQuestionKeywords(question) {
  const text = cleanChoiceQuestion(question).replace(/\s+/g, " ");
  const keywords = [];
  const actionPattern = /(?:想吃|想要吃|要吃|吃点|吃|来点|找|搜|搜索|安排)([\u4e00-\u9fa5A-Za-z0-9]{1,12})/g;
  let match;
  while ((match = actionPattern.exec(text))) {
    const keyword = normalizeQuestionFoodKeyword(match[1]);
    expandQuestionFoodKeywords(keyword).forEach((item) => keywords.push(item));
  }
  FOOD_SEARCH_TERMS.forEach((term) => {
    if (text.toLowerCase().includes(term.toLowerCase())) keywords.push(term);
  });
  return uniqueKeywords(keywords.map(cleanRestaurantKeyword).filter(Boolean)).slice(0, 4);
}

function normalizeQuestionFoodKeyword(value) {
  const keyword = String(value || "")
    .replace(/^(点|个|家|些|一点|一家)/, "")
    .replace(/(附近|周边|餐厅|饭店|店|馆|人均.*|便宜|贵|安静|好聊|少排队).*$/u, "")
    .trim();
  if (!keyword || /^(饭|饭饭|东西|什么|啥|随便|都行)$/.test(keyword)) return "";
  return keyword;
}

function expandQuestionFoodKeywords(keyword) {
  const value = cleanRestaurantKeyword(keyword);
  if (!value) return [];
  if (!/.+(?:和|跟|与|及|、|,|，|\/).+/.test(value)) return [value];
  const parts = value.split(/(?:和|跟|与|及|、|,|，|\/)+/).map(cleanRestaurantKeyword).filter(Boolean);
  if (parts.length < 2) return [value];
  const normalizedTerms = new Set(FOOD_SEARCH_TERMS.map((term) => normalizeMatchText(term)));
  const foodParts = parts.filter((part) => normalizedTerms.has(normalizeMatchText(part)));
  return foodParts.length >= 2 ? foodParts : parts;
}

function cleanRestaurantKeyword(keyword) {
  const value = String(keyword || "").replace(/标签：.*/u, "").replace(/[，,。.!！?？；;:：]/g, " ").trim();
  if (!value || /^(人均.*|离我近|少排队)$/.test(value)) return "";
  return value.slice(0, 12);
}

function cleanRestaurantLocationHint(value) {
  const cleaned = String(value || "")
    .replace(/标签：.*/u, "")
    .replace(/[，,。.!！?？；;:：]/g, " ")
    .replace(/^.+(?:住在|出发地是|位置在|位置是|在|从|出发)(?=.{2,}$)/u, "")
    .replace(/^(?:想去|想到|要去|希望去|打算去|准备去|倾向去|想在|想约在|想选在|想定在|去|到)\s*/u, "")
    .replace(/^(?:(?:我|本人|对方|朋友|同事|他|她|一个|一个人|另一个|另一个人|一位|另一位|第一个|第二个|第三个|第四个|A|B)(?:是|在|是在|住在|出发地是|位置在|位置是|从|出发)?|(?:住在|出发地是|位置在|位置是|在|出发))/i, "")
    .replace(/(?:附近|周边|这边|那边)(?:吃饭|吃|找|搜|搜索|安排|看看|餐厅|饭店)?.*$/u, "")
    .replace(/(?:共?\d+(?:到|-)?\d*人|[一二两三四五六七八九十]+人|人均.*|预算.*).*$/u, "")
    .replace(/(?:两个人|三个人|几个人|多人|我们|咱们|大家|一起|一块).*$/u, "")
    .replace(/(?:吃什么|吃啥|吃点什么|吃点啥|吃饭|找个地方|找餐厅|找饭店|找|搜|搜索|安排|看看|餐厅|饭店|聚餐|约饭|见面|碰头).*$/u, "")
    .replace(/(?:附近|周边|这边|那边|出发|上班|下班|过去|过来)$/u, "")
    .trim();
  if (!cleaned || /^(附近|周边|当前位置|当前城市|中间|中间点|折中|餐厅|饭店|吃饭)$/.test(cleaned)) return "";
  if (isRestaurantCurrentLocationHint(cleaned)) return "";
  if (isInvalidRestaurantLocationHint(cleaned)) return "";
  return cleaned.slice(0, 24);
}

function isRestaurantCurrentLocationHint(value) {
  const key = normalizeMatchText(value);
  if (!key) return false;
  if (/^(?:按|用|以|根据|照顾|在)?(?:你|我|本人|自己|你自己|我自己)?(?:的)?(?:当前|现在|目前)?(?:位置|定位|定位地址|gps)$/.test(key)) return true;
  if (/^(?:按|用|以|根据|照顾|在)?(?:你|我|本人|自己|你自己|我自己)?(?:的)?(?:当前位置|当前定位|现在位置|目前位置|gps定位|gps位置)$/.test(key)) return true;
  return /^(?:当前|当前位置|当前定位|定位地址|定位|gps|已定位|已获取|当前城市)$/.test(key);
}

function isInvalidRestaurantLocationHint(value) {
  const text = String(value || "").trim();
  const key = normalizeMatchText(text);
  if (!key) return true;
  if (isRestaurantCurrentLocationHint(text)) return true;
  if (/^(你|我|本人|自己|你自己|我自己|当前位置|当前定位|定位地址|定位|gps|已定位|已获取)$/.test(key)) return true;
  if (/^(朋友|我朋友|我的朋友|对象|男朋友|女朋友|男友|女友|对方|同事|同伴|同伴\d+|伙伴|伙伴\d+|客户|同学|室友|搭子|家人|亲戚)$/.test(key)) return true;
  if (/^(a|b|c|d|甲|乙|丙|丁)$/.test(key)) return true;
  if (/^(共)?\d+(?:到|-)?\d*人$/.test(key) || /^(一|二|两|三|四|五|六|七|八|九|十)+人$/.test(key)) return true;
  if (/^(们|我们|咱们|大家|一起|一块|今晚|晚上|明天|今天|中午|下午|早上|周末)$/.test(key)) return true;
  return /(?:你自己|我自己|自己|当前位置|当前定位).{0,8}(?:获取|定位|拿到)/.test(key);
}

function cleanRestaurantDestinationHint(value) {
  const withoutNearbyTail = String(value || "")
    .replace(/(?:附近|周边|这边|那边)(?:吃饭|吃|找|搜|搜索|安排|看看|餐厅|饭店)?.*$/u, "")
    .replace(/(?:吃饭|餐厅|饭店).*$/u, "");
  return cleanRestaurantLocationHint(withoutNearbyTail);
}

function extractRestaurantDestinationHint(choice) {
  const text = cleanChoiceQuestion(choice.question || "").replace(/\s+/g, " ");
  if (extractRestaurantParticipantTargetHints(choice).length >= 2) return null;
  const hints = [];
  const collect = (match, valueIndex = 1) => {
    const start = match.index + match[0].indexOf(match[valueIndex]);
    if (isParticipantLocationContext(text, start)) return;
    const hint = cleanRestaurantDestinationHint(match[valueIndex]);
    if (hint) hints.push(hint);
  };
  const destinationPatterns = [
    new RegExp(`(?:目的地|见面地|集合地|会合地|碰头地|吃饭地点|吃饭地|地点|位置|区域|商圈)(?:定在|选在|放在|在|是|到)?\\s*${RESTAURANT_LOCATION_CAPTURE}`, "gi"),
    new RegExp(`(?:定在|约在|聚在|集合在|会合在|碰头在|见面在|就在|想去|想到|要去|希望去|打算去|准备去|去|到)\\s*${RESTAURANT_LOCATION_CAPTURE}`, "gi"),
    /(?:在|到|去)?\s*([\u4e00-\u9fa5A-Za-z0-9·\-]{2,24})(?:附近|周边|这边|那边)(?:吃饭|吃|找|搜|搜索|安排|看看|餐厅|饭店)/gi
  ];
  destinationPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text))) collect(match);
  });
  const name = uniqueRestaurantLocationHints(hints)[0];
  return name ? { name } : null;
}

function isParticipantLocationContext(text, index) {
  const before = text.slice(Math.max(0, index - 14), index);
  return /(?:我|本人|朋友|对方|他|她|同事|一个|一个人|另一个|另一个人|一位|另一位|第一个|第二个|第三个|第四个|a|b)\s*(?:是|在|是在|住在|从|出发地是|出发|位置在|位置是)?\s*$/i.test(before);
}

function extractRestaurantParticipantTargetHints(choice) {
  const text = cleanChoiceQuestion(choice.question || "").replace(/\s+/g, " ");
  const hints = [];
  const targetVerbPattern = "(?:想去|想到|要去|希望去|打算去|准备去|倾向去|想在|想约在|想选在|想定在)";
  const pattern = new RegExp(`(${RESTAURANT_ACTOR_PATTERN})([\\s\\S]{0,18}?${targetVerbPattern})\\s*${RESTAURANT_LOCATION_CAPTURE}`, "gi");
  let match;
  while ((match = pattern.exec(text))) {
    const bridge = match[2] || "";
    if (hasInterveningRestaurantActor(bridge)) continue;
    const hint = cleanRestaurantDestinationHint(match[3]);
    if (hint) hints.push(hint);
  }
  return uniqueRestaurantLocationHints(hints);
}

function hasInterveningRestaurantActor(value) {
  const bridge = String(value || "").replace(/(?:想去|想到|要去|希望去|打算去|准备去|倾向去|想在|想约在|想选在|想定在).*$/u, "");
  return /(?:朋友|对方|同事|他|她|另一个|另一个人|另一位|第二个|第三个|第四个|我们|咱们|大家|一起)/.test(bridge);
}

function hasRestaurantMeetupIntent(choice) {
  const text = cleanChoiceQuestion(`${choice.question || ""} ${(choice.tags || []).join(" ")}`);
  return /(?:朋友|对象|男朋友|女朋友|男友|女友|对方|同事|他|她|我们|咱们|大家|一起|一块|见面|碰头|集合|会合|约饭|聚餐|找个地方|折中|两个人|三个人|几个人|多人)/.test(text);
}

function hasSingleRelationCompanionIntent(choice) {
  const text = cleanChoiceQuestion(`${choice.question || ""} ${(choice.tags || []).join(" ")}`);
  if (!/(?:朋友|对象|男朋友|女朋友|男友|女友|对方|同事|客户|同学|室友|搭子|伙伴)/.test(text)) return false;
  if (/(?:另一个|另一个人|另一位|第二个|第三个|第四个|两个朋友|两位朋友|多个朋友|三个人|多人|大家|几个朋友|一群)/.test(text)) return false;
  return /(?:我|跟|和|约|找|见|一起|一块|小聚|聚餐|吃饭|约饭|见面|碰头|集合|会合)/.test(text);
}

function shouldUseCurrentLocationForMeetup(choice, hints = extractedRestaurantParticipantLocationNames(choice)) {
  const cleanHints = uniqueRestaurantLocationHints(hints);
  if (cleanHints.length !== 1) return false;
  if (!hasRestaurantMeetupIntent(choice)) return false;
  if (extractRestaurantParticipantTargetHints(choice).length >= 2) return false;
  return !extractRestaurantDestinationHint(choice)?.name;
}

function extractRestaurantLocationHints(choice) {
  const targetHints = extractRestaurantParticipantTargetHints(choice);
  if (targetHints.length >= 2) return targetHints.map((name) => ({ name }));
  const text = cleanChoiceQuestion(choice.question || "");
  const hints = [];
  const relationPattern = new RegExp(`(?:${RESTAURANT_ACTOR_PATTERN}\\s*(?:是|在|是在|住在|从|出发地是|出发|位置在|位置是)|(?:出发地是|位置在|位置是))\\s*${RESTAURANT_LOCATION_CAPTURE}`, "gi");
  let match;
  while ((match = relationPattern.exec(text))) {
    const hint = cleanRestaurantLocationHint(match[1]);
    if (hint) hints.push(hint);
  }
  extractRestaurantRelationLocationHints(choice, text).forEach((hint) => hints.push(hint));
  if (!hints.length) extractRestaurantListedLocationHints(choice, text).forEach((hint) => hints.push(hint));
  if (!hints.length) {
    const suffixPattern = new RegExp(`([\\u4e00-\\u9fa5A-Za-z0-9·\\-]{2,18}${LOCATION_SUFFIX_PATTERN})`, "g");
    while ((match = suffixPattern.exec(text))) {
      const hint = cleanRestaurantLocationHint(match[1]);
      if (hint) hints.push(hint);
    }
  }
  return uniqueRestaurantLocationHints(hints).map((name) => ({ name }));
}

function extractRestaurantRelationLocationHints(choice, text) {
  if (!hasRestaurantMeetupIntent(choice)) return [];
  const hints = [];
  const personPattern = "(?:朋友|对象|男朋友|女朋友|男友|女友|对方|同事|客户|同学|室友|搭子|伙伴|家人|亲戚)";
  const leadVerbPattern = "(?:和|跟|约|找|见|去见|联系|碰|聚|小聚|一起|一块|是|在|改成|换成|改到|换到)";
  const pattern = new RegExp(`(?:^|[\\s，,。.!！?？；;])${leadVerbPattern}?\\s*([\\u4e00-\\u9fa5A-Za-z0-9·\\-]{2,24})\\s*的\\s*${personPattern}`, "gi");
  let match;
  while ((match = pattern.exec(text))) {
    const raw = String(match[1] || "").replace(new RegExp(`^${leadVerbPattern}\\s*`, "u"), "");
    const hint = cleanRestaurantLocationHint(raw);
    if (hint) hints.push(hint);
  }
  return uniqueRestaurantLocationHints(hints);
}

function extractRestaurantListedLocationHints(choice, text) {
  if (!hasRestaurantMeetupIntent(choice)) return [];
  const hints = [];
  const listPattern = /((?:[\u4e00-\u9fa5A-Za-z0-9·\-]{2,24}\s*[、,，\/和跟与]\s*){1,4}[\u4e00-\u9fa5A-Za-z0-9·\-]{2,24})(?=\s*(?:两个人|三个人|几个人|多人|我们|大家|一起|一块|折中|见面|碰头|集合|会合|约饭|聚餐|吃饭|吃|找个地方|找餐厅))/g;
  let match;
  while ((match = listPattern.exec(text))) {
    String(match[1]).split(/[、,，\/和跟与]+/).map(cleanRestaurantLocationHint).filter(Boolean).forEach((hint) => hints.push(hint));
  }
  return uniqueRestaurantLocationHints(hints);
}

function extractedRestaurantParticipantLocationNames(choice) {
  const structuredHints = normalizeRestaurantLocationHints(choice ? (choice.multiAreaLocationHints || (choice.multiAreaRows || []).map((row) => row && row.location)) : []);
  if (structuredHints.length >= 2) return structuredHints;
  const targetHints = extractRestaurantParticipantTargetHints(choice);
  if (targetHints.length >= 2) return targetHints;
  const destinationKey = normalizeMatchText(extractRestaurantDestinationHint(choice)?.name || "");
  return extractRestaurantLocationHints(choice)
    .map((item) => item.name)
    .filter((name) => !destinationKey || normalizeMatchText(name) !== destinationKey);
}

function normalizeRestaurantLocationHints(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[、,，;；/|]+/);
  return uniqueRestaurantLocationHints(list.map((item) => cleanRestaurantLocationHint(typeof item === "string" ? item : (item && (item.name || item.label || item.location || item.area)))).filter(Boolean));
}

function uniqueRestaurantLocationHints(hints) {
  const seen = new Set();
  const cleaned = (hints || []).map(cleanRestaurantLocationHint).filter(Boolean);
  return cleaned.filter((hint, index, arr) => {
    const key = normalizeMatchText(hint);
    if (!key || seen.has(key)) return false;
    const containedByMoreSpecific = arr.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const otherKey = normalizeMatchText(other);
      return otherKey.length > key.length && key.length >= 2 && otherKey.includes(key);
    });
    if (containedByMoreSpecific) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function cloneRestaurantPlan(plan = {}) {
  return {
    ...plan,
    keywords: Array.isArray(plan.keywords) ? plan.keywords.slice() : [],
    locationHints: Array.isArray(plan.locationHints) ? plan.locationHints.slice() : [],
    searchRequests: Array.isArray(plan.searchRequests) ? plan.searchRequests.map((item) => ({ ...item })) : [],
    locationIntent: plan.locationIntent && typeof plan.locationIntent === "object" ? { ...plan.locationIntent } : plan.locationIntent
  };
}

function ensureRestaurantMeetupPlanForMode(plan = {}, choice = {}) {
  const merged = cloneRestaurantPlan(plan);
  const hints = uniqueRestaurantLocationHints([
    ...restaurantParticipantLocationHints(merged, choice),
    ...restaurantLocationHintsFromKeywords(merged.keywords, choice)
  ]);
  const strategy = String(merged.locationIntent && (merged.locationIntent.strategy || merged.locationIntent.locationStrategy) || "").toLowerCase();
  const explicitDestination = extractRestaurantDestinationHint(choice)?.name || "";
  const shouldUseCurrent = Boolean(
    merged.includeCurrentLocationInMeetup ||
    /current/.test(strategy) ||
    shouldUseCurrentLocationForMeetup(choice, hints)
  );
  const shouldUseMeetup = hints.length >= 2 || (shouldUseCurrent && hints.length >= 1) || /midpoint|折中|中间/.test(strategy);
  if (!shouldUseMeetup || (explicitDestination && !/midpoint|current/.test(strategy) && !shouldUseCurrent)) return merged;
  const participantCount = hints.length + (shouldUseCurrent ? 1 : 0);
  if (participantCount < 2) return merged;
  merged.locationHint = "";
  merged.locationHints = hints;
  merged.includeCurrentLocationInMeetup = shouldUseCurrent;
  merged.region = "";
  merged.cityLimit = false;
  merged.radiusMeters = clampRestaurantMeetupRadius(merged.radiusMeters || RESTAURANT_MEETUP_MAX_RADIUS);
  merged.locationIntent = {
    ...(merged.locationIntent && typeof merged.locationIntent === "object" ? merged.locationIntent : {}),
    destination: "",
    region: "",
    street: "",
    participantLocations: hints,
    strategy: "midpoint",
    textLocationCount: hints.length,
    totalParticipantCount: Math.max(Number(merged.locationIntent && merged.locationIntent.totalParticipantCount) || 0, participantCount),
    totalLocationCount: participantCount
  };
  merged.sceneIntent = {
    ...(merged.sceneIntent && typeof merged.sceneIntent === "object" ? merged.sceneIntent : {}),
    companions: shouldUseCurrent ? `你 + ${participantCount - 1}位同伴，共${participantCount}人` : `共${participantCount}人`
  };
  merged.keywords = restaurantKeywordsWithoutLocationHints(
    merged.keywords,
    [...hints, ...restaurantCurrentLocationHintsFromPlan(merged)],
    { fallbackKeywords: [RESTAURANT_KEYWORD_FALLBACK] }
  );
  merged.searchRequests = normalizePlanSearchRequests([], merged.keywords, merged);
  return merged;
}

function applyChoiceIntentOverrides(plan = {}, choice = {}, overrides = {}) {
  const merged = cloneRestaurantPlan(plan || {});
  const fields = overrides.fields || {};
  const manualText = Object.values(fields).filter(Boolean).join(" ");
  const controlledPartySize = Math.max(0, Math.min(20, Math.round(Number(choice.partySize) || 0)));
  const keywords = manualRestaurantKeywords(fields.restaurantTypes);
  if (keywords.length) {
    merged.keywords = keywords;
    merged.types = mergeAmapTypes(inferRestaurantAmapTypes(keywords.join(" ")), merged.types);
    merged.restaurantTypeIntent = {
      ...(merged.restaurantTypeIntent && typeof merged.restaurantTypeIntent === "object" ? merged.restaurantTypeIntent : {}),
      primaryType: keywords[0],
      keywords
    };
    merged.restaurantTypeDiversity = false;
  }

  const budget = manualBudgetRange(fields.budget);
  if (budget) {
    merged.minCost = budget.minCost;
    merged.maxCost = budget.maxCost;
    merged.priceIntent = {
      ...(merged.priceIntent && typeof merged.priceIntent === "object" ? merged.priceIntent : {}),
      minCost: budget.minCost,
      maxCost: budget.maxCost,
      source: "manual"
    };
  }

  const radius = manualRadiusMeters(`${fields.middle || ""} ${fields.locationDistance || ""}`);
  if (radius) merged.radiusMeters = radius;

  const currentAsParticipant = /当前位置|当前定位|我的位置|你的位置|用你|按你/.test(`${fields.middle || ""} ${fields.locationDistance || ""}`);
  const participantHints = manualParticipantLocationHints(fields);
  const destinationHint = participantHints.length >= 2 || (currentAsParticipant && participantHints.length >= 1)
    ? ""
    : manualDestinationHint(fields);
  if (participantHints.length >= 2 || (currentAsParticipant && participantHints.length >= 1)) {
    const participantCount = participantHints.length + (currentAsParticipant ? 1 : 0);
    merged.locationHint = "";
    merged.locationHints = participantHints;
    merged.includeCurrentLocationInMeetup = currentAsParticipant;
    merged.region = "";
    merged.cityLimit = false;
    merged.locationIntent = {
      ...(merged.locationIntent && typeof merged.locationIntent === "object" ? merged.locationIntent : {}),
      destination: "",
      region: "",
      street: "",
      participantLocations: participantHints,
      strategy: "midpoint",
      textLocationCount: participantHints.length,
      totalParticipantCount: Math.max(controlledPartySize, participantCount),
      totalLocationCount: participantCount,
      source: "manual"
    };
  } else if (destinationHint) {
    merged.locationHint = destinationHint;
    merged.locationHints = [];
    merged.includeCurrentLocationInMeetup = false;
    merged.locationIntent = {
      ...(merged.locationIntent && typeof merged.locationIntent === "object" ? merged.locationIntent : {}),
      destination: destinationHint,
      strategy: "destination",
      source: "manual"
    };
  }

  const partySize = controlledPartySize;
  if (partySize) {
    merged.sceneIntent = {
      ...(merged.sceneIntent && typeof merged.sceneIntent === "object" ? merged.sceneIntent : {}),
      primaryScenario: fields.scene || merged.sceneIntent?.primaryScenario || "",
      companions: partySize === 1 ? "1人" : `共${partySize}人`,
      totalParticipantCount: partySize,
      source: "manual"
    };
  } else if (fields.scene) {
    merged.sceneIntent = {
      ...(merged.sceneIntent && typeof merged.sceneIntent === "object" ? merged.sceneIntent : {}),
      primaryScenario: fields.scene,
      source: "manual"
    };
  }

  merged.source = "manual";
  merged.explanation = manualText.slice(0, 120);
  merged.needsCompanionLocation = needsRestaurantCompanionLocation(choice, merged);
  merged.searchRequests = normalizePlanSearchRequests([], merged.keywords, merged);
  return merged;
}

function manualRestaurantKeywords(value) {
  const text = String(value || "")
    .replace(/餐厅类型/g, "")
    .replace(/人均\d+.*$/u, "")
    .replace(/约\d+(?:\.\d+)?\s*(?:km|公里|千米|m|米).*$/iu, "");
  const keywords = normalizePlanKeywords(text).filter((keyword) => keyword !== RESTAURANT_KEYWORD_FALLBACK);
  return keywords.length ? keywords.slice(0, 6) : [];
}

function manualBudgetRange(value) {
  const text = String(value || "")
    .replace(/[￥¥]/g, "")
    .replace(/人均约/g, "人均")
    .replace(/预算约/g, "预算")
    .trim();
  if (!/\d/.test(text)) return null;
  const rangeMatch = text.match(/(?:人均|预算)?\s*(\d{1,4})\s*(?:-|~|到|至)\s*(\d{1,4})/);
  if (rangeMatch) {
    const first = Math.round(Number(rangeMatch[1]));
    const second = Math.round(Number(rangeMatch[2]));
    return { minCost: Math.min(first, second), maxCost: Math.max(first, second) };
  }
  const underMatch = text.match(/(?:人均|预算)?\s*(\d{1,4})\s*(?:元)?\s*(?:以内|以下|内|封顶)/);
  if (underMatch) return { minCost: 0, maxCost: Math.round(Number(underMatch[1])) };
  const plusMatch = text.match(/(?:人均|预算)?\s*(\d{1,4})\s*(?:元)?\s*(?:\+|以上|起)/);
  if (plusMatch) {
    const minCost = Math.round(Number(plusMatch[1]));
    return { minCost, maxCost: Math.max(minCost, Math.round(minCost * 2.2)) };
  }
  const exactMatch = text.match(/(?:人均|预算)?\s*(\d{1,4})(?:元)?/);
  if (!exactMatch) return null;
  const target = Math.round(Number(exactMatch[1]));
  return { minCost: Math.max(0, Math.round(target * 0.75)), maxCost: Math.round(target * 1.25) };
}

function manualRadiusMeters(value) {
  return inferExplicitRestaurantRadiusMeters({ question: String(value || ""), tags: [] });
}

function manualParticipantLocationHints(fields = {}) {
  const text = `${fields.middle || ""} ${fields.locationDistance || ""}`;
  const chunks = [];
  const midpointMatch = text.match(/(?:按|用|照顾)(.+?)(?:取中间点|的?中间点|折中|之间|附近|找|$)/);
  if (midpointMatch) chunks.push(midpointMatch[1]);
  const directMatch = text.match(/(?:当前位置|当前定位|我的位置|你的位置)\s*(?:和|\/|、|,|，|跟|与)\s*([^，。；]+?)(?:取中间点|折中|附近|找|$)/);
  if (directMatch) chunks.push(directMatch[1]);
  return uniqueRestaurantLocationHints(chunks.flatMap((chunk) => String(chunk || "").split(/[、,，/和跟与]+/)).map(cleanRestaurantLocationHint).filter(Boolean));
}

function manualDestinationHint(fields = {}) {
  const text = `${fields.middle || ""} ${fields.locationDistance || ""}`;
  const wantsMidpoint = /取中间点|折中/.test(text) && !/不取中间点/.test(text);
  if (wantsMidpoint) return "";
  const patterns = [
    /(?:直接在|就在|在|到|去|目的地\s*[:：]?)([^，。；]{2,24}?)(?:附近|周边|找|搜索)/,
    /([^，。；]{2,24})(?:附近|周边)(?:找|搜索|餐厅|饭店)?/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const hint = match && cleanRestaurantDestinationHint(match[1]);
    if (hint) return hint;
  }
  return "";
}

function restaurantCurrentLocationHintsFromPlan(plan = {}) {
  const intent = plan.locationIntent || {};
  const audit = Array.isArray(intent.participantAudit) ? intent.participantAudit : [];
  return uniqueRestaurantLocationHints([
    plan.currentLocation,
    plan.currentLocationLabel,
    plan.currentLocationDetail,
    intent.currentLocation,
    ...audit.filter((item) => item && item.source === "currentLocation").map((item) => item.location)
  ].filter(Boolean));
}

function filterRestaurantCurrentLocationHints(hints = [], currentHints = []) {
  if (!currentHints.length) return hints;
  return (hints || []).filter((hint) => !restaurantLocationHintMatchesAny(hint, currentHints));
}

function restaurantLocationHintMatchesAny(hint, candidates = []) {
  const key = normalizeMatchText(hint);
  if (!key) return false;
  const short = normalizeMatchText(restaurantShortPlaceLabel(hint));
  return (candidates || []).some((candidate) => {
    const candidateKey = normalizeMatchText(candidate);
    const candidateShort = normalizeMatchText(restaurantShortPlaceLabel(candidate));
    if (!candidateKey && !candidateShort) return false;
    if (candidateKey && (candidateKey === key || candidateKey.includes(key) || key.includes(candidateKey))) return true;
    if (short && candidateShort && (short === candidateShort || short.includes(candidateShort) || candidateShort.includes(short))) return true;
    if (short && candidateKey && candidateKey.includes(short)) return true;
    if (candidateShort && key.includes(candidateShort)) return true;
    return false;
  });
}

function restaurantKeywordsWithoutLocationHints(keywords = [], locationHints = [], { fallbackKeywords = [] } = {}) {
  const hints = uniqueRestaurantLocationHints(locationHints);
  const cleaned = uniqueKeywords((Array.isArray(keywords) ? keywords : String(keywords || "").split(/[、,，;；/|\s]+/)).map(cleanRestaurantKeyword).filter(Boolean));
  if (!hints.length) return cleaned;
  const filtered = cleaned.filter((keyword) => !restaurantLocationHintMatchesAny(keyword, hints));
  if (filtered.length) return filtered;
  const fallback = uniqueKeywords((Array.isArray(fallbackKeywords) ? fallbackKeywords : [fallbackKeywords]).map(cleanRestaurantKeyword).filter(Boolean))
    .filter((keyword) => keyword && !restaurantLocationHintMatchesAny(keyword, hints));
  return fallback.length ? fallback : [RESTAURANT_KEYWORD_FALLBACK];
}

function restaurantLocationHintsFromKeywords(keywords = [], choice = {}) {
  if (!hasRestaurantMeetupIntent(choice)) return [];
  const foodTerms = new Set(FOOD_SEARCH_TERMS.map((item) => normalizeMatchText(item)));
  return uniqueRestaurantLocationHints((Array.isArray(keywords) ? keywords : String(keywords || "").split(/[、,，;；/|\s]+/))
    .map(cleanRestaurantKeyword)
    .filter((keyword) => {
      const key = normalizeMatchText(keyword);
      if (!key || foodTerms.has(key) || isBroadRestaurantSceneKeyword(keyword)) return false;
      return /(?:街|路|桥|站|宫|园|门|村|里|坊|城|谷|口|营|庄|寺|院|湖|湾|区|镇|乡|CBD)$/i.test(keyword);
    }));
}

function restaurantSearchRequestLocationHints(defaults = {}) {
  const intent = defaults.locationIntent || {};
  return uniqueRestaurantLocationHints([
    ...(Array.isArray(defaults.locationHints) ? defaults.locationHints : []),
    ...(Array.isArray(defaults.locations) ? defaults.locations : []),
    ...(Array.isArray(defaults.participantLocations) ? defaults.participantLocations : []),
    ...(Array.isArray(defaults.meetingLocations) ? defaults.meetingLocations : []),
    ...(Array.isArray(intent.participantLocations) ? intent.participantLocations : [])
  ]);
}

function uniqueKeywords(keywords) {
  const seen = new Set();
  return (keywords || []).filter((keyword) => {
    if (!keyword || seen.has(keyword)) return false;
    seen.add(keyword);
    return true;
  });
}

function uniqueImageUrls(urls) {
  const seen = new Set();
  return (urls || []).map((url) => String(url || "").trim()).filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function limitRestaurantKeywords(keywords, limit = 6, { includeFallback = true } = {}) {
  const unique = uniqueKeywords((keywords || []).map(cleanRestaurantKeyword).filter(Boolean));
  const specific = unique.filter((keyword) => keyword !== RESTAURANT_KEYWORD_FALLBACK).slice(0, includeFallback ? Math.max(0, limit - 1) : limit);
  return includeFallback ? [...specific, RESTAURANT_KEYWORD_FALLBACK] : specific;
}

function normalizePlanKeywords(value) {
  return limitRestaurantKeywords(normalizeSimpleKeywords(value, 6), 6, { includeFallback: false });
}

function normalizeSimpleKeywords(value, limit = 8) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[、,，;；/|\s]+/);
  return uniqueKeywords(list.map(cleanRestaurantKeyword).filter(Boolean)).slice(0, limit);
}

function amapTypeCodes(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[、,，;；/|]+/);
  return uniqueKeywords(list.map((item) => String(item || "").trim()).filter((item) => /^05\d{4}$/.test(item)));
}

function normalizeAmapTypes(value) {
  const codes = amapTypeCodes(value).slice(0, 8);
  return codes.length ? codes.join("|") : "050000";
}

function mergeAmapTypes(...values) {
  const codes = uniqueKeywords(values.flatMap((value) => amapTypeCodes(value))).slice(0, 8);
  return codes.length ? codes.join("|") : "050000";
}

function isBroadRestaurantSceneKeyword(keyword) {
  return /^(餐厅|附近餐厅|聚餐|朋友聚餐|约会餐厅|安静餐厅|放松餐厅|高级餐厅|商务宴请餐厅|夜宵|一人食|好吃餐厅|家常菜)$/i.test(cleanRestaurantKeyword(keyword));
}

function normalizeAmapSortRule(value) {
  const rule = String(value || "").toLowerCase();
  if (rule === "weight" || /综合|权重|推荐/.test(rule)) return "weight";
  return "distance";
}

function normalizeAmapShowFields(value) {
  const allowed = new Set(["children", "business", "indoor", "navi", "photos"]);
  const fields = uniqueKeywords(String(value || AMAP_SHOW_FIELDS_DEFAULT).split(/[、,，;；/|]+/).map((item) => item.trim()).filter((item) => allowed.has(item))).slice(0, 5);
  return fields.length ? fields.join(",") : AMAP_SHOW_FIELDS_DEFAULT;
}

function normalizeAmapRadius(value, fallback = 3500) {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return Math.max(AMAP_SEARCH_MIN_RADIUS, Math.min(AMAP_SEARCH_MAX_RADIUS, Math.round(Number(fallback) || 3500)));
  return Math.max(AMAP_SEARCH_MIN_RADIUS, Math.min(AMAP_SEARCH_MAX_RADIUS, Math.round(radius)));
}

function inferRestaurantAmapTypes(value) {
  const text = String(value || "").toLowerCase();
  const buckets = [
    { re: /火锅|涮|串串|羊蝎子|铜锅/, code: "050117" },
    { re: /咖啡|coffee|下午茶/, code: "050500" },
    { re: /茶馆|茶艺|喝茶|茶室/, code: "050600" },
    { re: /甜品|糖水|冰淇淋|冷饮|奶茶|饮品/, code: "050700|050900" },
    { re: /蛋糕|面包|烘焙|糕点|点心/, code: "050800" },
    { re: /快餐|简餐|汉堡|炸鸡|麦当劳|肯德基|kfc|mcdonald/, code: "050300" },
    { re: /西餐|牛排|披萨|意面|法餐|bistro|brunch|西式/, code: "050200" },
    { re: /日料|日本|寿司|料理|刺身|烧鸟|居酒屋|拉面|韩餐|韩国|泰餐|越南|东南亚|印度|墨西哥/, code: "050200" },
    { re: /川菜|湘菜|粤菜|云南|云贵|东北|本帮|江浙|北京菜|烤鱼|烧烤|烤肉|小龙虾|中餐|私房菜|家常菜/, code: "050100" }
  ];
  const matched = buckets.filter((bucket) => bucket.re.test(text)).flatMap((bucket) => bucket.code.split("|"));
  return uniqueKeywords(matched).slice(0, 4).join("|") || "050000";
}

function inferRestaurantSearchRadius(choice, { hasDestination = false, participantCount = 0 } = {}) {
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")}`;
  const explicitRadius = inferExplicitRestaurantRadiusMeters(choice);
  if (explicitRadius) return explicitRadius;
  if (participantCount >= 2) return RESTAURANT_MEETUP_MAX_RADIUS;
  if (/跨区|远一点|折中|中间/.test(text)) return 8000;
  if (hasDestination) return 3000;
  if (/离我近|附近|就近|最近|少走|马上|现在/.test(text)) return 2000;
  if (/约会|聚餐|请客|安静|环境|好吃|评分|不踩雷|推荐/.test(text)) return 5000;
  return 3500;
}

function inferExplicitRestaurantRadiusMeters(choice) {
  const text = cleanChoiceQuestion(`${choice.question || ""} ${(choice.tags || []).join(" ")}`);
  const match = text.match(/(?:半径|距离|范围|附近|周边|控制|限制|不超过|别超过|以内|内|约)?\s*(\d+(?:\.\d+)?)\s*(km|公里|千米|米|m)\s*(?:以内|内|左右|附近|半径|范围)?/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = String(match[2] || "").toLowerCase();
  const meters = /^(米|m)$/.test(unit) ? value : value * 1000;
  return normalizeAmapRadius(meters, 3500);
}

function inferRestaurantSortRule(choice) {
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")}`;
  if (/离我近|附近|就近|最近|少走|马上|现在/.test(text)) return "distance";
  if (/约会|聚餐|请客|安静|环境|好吃|评分|不踩雷|推荐|满意/.test(text)) return "weight";
  return "distance";
}

function inferRestaurantCostRange(choice) {
  const text = cleanChoiceQuestion(`${choice.question || ""} ${(choice.tags || []).join(" ")} ${(choice.scenes || []).join(" ")} ${(choice.needs || []).join(" ")}`);
  const rangeMatch = text.match(/人均\s*(\d{1,4})\s*(?:-|~|到|至)\s*(\d{1,4})/);
  if (rangeMatch) {
    const first = Math.round(Number(rangeMatch[1]));
    const second = Math.round(Number(rangeMatch[2]));
    return { minCost: Math.min(first, second), maxCost: Math.max(first, second) };
  }
  const plusMatch = text.match(/(?:人均\s*)?(\d{2,4})\s*(?:\+|以上|起)/);
  if (plusMatch) {
    const minCost = Math.max(MIN_RESTAURANT_COST, Math.round(Number(plusMatch[1])));
    return { minCost, maxCost: Math.max(300, Math.round(minCost * 2.2)) };
  }
  const underMatch = text.match(/(?:人均|预算)\s*(\d{1,4})\s*(?:元)?\s*(?:以内|以下|内|封顶|左右)?/);
  if (underMatch) {
    const maxCost = Math.round(Number(underMatch[1]));
    return { minCost: maxCost <= 90 ? 25 : 50, maxCost };
  }
  const exactMatch = text.match(/人均\s*(\d{1,4})(?!\s*(?:-|~|到|至|\+|以上|起|以内|以下|内|封顶))/);
  if (exactMatch) {
    const target = Math.round(Number(exactMatch[1]));
    return { minCost: Math.max(20, Math.round(target * 0.75)), maxCost: Math.round(target * 1.25) };
  }
  if (/不差钱|预算不限|高端|高级|奢侈|米其林|黑珍珠|贵一点|贵的|仪式感/.test(text)) return { minCost: 250, maxCost: 600 };
  if (/约会|对象|情侣|请客|纪念日|精致|环境好|有氛围/.test(text)) return { minCost: 150, maxCost: 350 };
  if (/朋友|聚餐|多人|同事|安静|好聊|不踩雷|好吃|评分|推荐/.test(text)) return { minCost: 80, maxCost: 220 };
  if (/夜宵|通宵|熬夜|烧烤|小酒馆|喝酒|酒吧/.test(text)) return { minCost: 50, maxCost: 160 };
  if (/咖啡|甜品|奶茶|蛋糕|下午茶/.test(text)) return { minCost: 30, maxCost: 120 };
  if (/西餐|日料|日本料理|寿司|牛排|brunch|法餐|bistro/.test(text)) return { minCost: 120, maxCost: 300 };
  if (/火锅|烤肉|烤鱼|海鲜/.test(text)) return { minCost: 80, maxCost: 220 };
  if (/便宜|省钱|随便|简单|快餐|简餐|一人食|一个人|工作餐|午饭|午餐|少排队|马上|现在/.test(text)) return { minCost: 25, maxCost: 90 };
  return { minCost: 60, maxCost: 180 };
}

function readCostValue(value) {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function readPlanCost(value) {
  const cost = readCostValue(value);
  return Number.isFinite(cost) && cost > 0 ? Math.round(cost) : Number.NaN;
}

function readPlanRating(value) {
  const rating = readCostValue(value);
  return Number.isFinite(rating) && rating > 0 ? Math.max(0, Math.min(5, Number(rating.toFixed(1)))) : Number.NaN;
}

function readPlanHour(value) {
  const hour = readCostValue(value);
  return Number.isFinite(hour) && hour >= 0 ? Math.max(0, Math.min(29, Math.round(hour))) : 0;
}

function normalizePlanSearchRequests(value, fallbackKeywords = [], defaults = {}) {
  const items = Array.isArray(value) ? value : [];
  const locationHints = restaurantSearchRequestLocationHints(defaults);
  const requests = items.map((item, index) => {
    const keyword = cleanRestaurantKeyword(item && (item.keyword || item.keywords || item.query || item.searchKeyword) || item);
    if (!keyword || restaurantLocationHintMatchesAny(keyword, locationHints)) return null;
    const radius = Number(item && (item.radiusMeters || item.radius) || defaults.radiusMeters);
    const inferredTypes = inferRestaurantAmapTypes(keyword);
    const inferredSpecificTypes = inferredTypes !== "050000" ? inferredTypes : "";
    const requestTypes = item && (item.types || item.typeCodes)
      ? mergeAmapTypes(item.types || item.typeCodes, inferredSpecificTypes)
      : (inferredSpecificTypes || (isBroadRestaurantSceneKeyword(keyword) ? mergeAmapTypes("050000", defaults.types) : defaults.types));
    return {
      keyword,
      types: normalizeAmapTypes(requestTypes),
      radiusMeters: normalizeAmapRadius(radius, defaults.radiusMeters || 3500),
      sortrule: normalizeAmapSortRule(item && (item.sortrule || item.sortRule) || defaults.sortrule),
      region: cleanRestaurantKeyword(item && item.region || defaults.region || ""),
      cityLimit: Boolean((item ? (item.cityLimit ?? item.city_limit ?? defaults.cityLimit) : defaults.cityLimit) && (item && item.region || defaults.region)),
      showFields: normalizeAmapShowFields(item && (item.showFields || item.show_fields) || defaults.showFields),
      priority: Number.isFinite(Number(item && item.priority)) ? Number(item.priority) : index + 1
    };
  }).filter(Boolean).sort((a, b) => a.priority - b.priority).slice(0, 8);
  if (requests.length) return requests;
  const requestKeywords = restaurantKeywordsWithoutLocationHints(fallbackKeywords, locationHints, { fallbackKeywords: [RESTAURANT_KEYWORD_FALLBACK] }).slice(0, 6);
  return (requestKeywords.length ? requestKeywords : [RESTAURANT_KEYWORD_FALLBACK]).map((keyword, index) => ({
    keyword,
    types: normalizeAmapTypes((inferRestaurantAmapTypes(keyword) !== "050000" ? inferRestaurantAmapTypes(keyword) : (isBroadRestaurantSceneKeyword(keyword) ? mergeAmapTypes("050000", defaults.types) : defaults.types))),
    radiusMeters: normalizeAmapRadius(defaults.radiusMeters || 3500),
    sortrule: normalizeAmapSortRule(defaults.sortrule),
    region: cleanRestaurantKeyword(defaults.region || ""),
    cityLimit: Boolean(defaults.cityLimit && defaults.region),
    showFields: normalizeAmapShowFields(defaults.showFields),
    priority: index + 1
  }));
}

function restaurantSearchOptions(searchPlan = {}) {
  return {
    minCost: searchPlan.minCost || 0,
    maxCost: searchPlan.maxCost || 0,
    minRating: searchPlan.minRating || 0,
    preferOpenLate: Boolean(searchPlan.preferOpenLate),
    openAtHour: searchPlan.openAtHour || 0,
    mustKeywords: normalizeSimpleKeywords(searchPlan.mustKeywords, 8),
    avoidKeywords: normalizeSimpleKeywords(searchPlan.avoidKeywords, AVOID_KEYWORD_LIMIT),
    types: normalizeAmapTypes(searchPlan.types),
    sortrule: normalizeAmapSortRule(searchPlan.sortrule),
    region: cleanRestaurantKeyword(searchPlan.region || ""),
    cityLimit: Boolean(searchPlan.cityLimit),
    showFields: normalizeAmapShowFields(searchPlan.showFields),
    searchRequests: normalizePlanSearchRequests(searchPlan.searchRequests, searchPlan.keywords, searchPlan)
  };
}

function normalizeMatchText(value) {
  return String(value || "").toLowerCase().replace(/[\s·・.,，。'"“”‘’()（）\\-_/&＋+|]/g, "");
}

async function searchRestaurantsWithFallback(coords, radius = 3500, keywords = [RESTAURANT_KEYWORD_FALLBACK], options = {}, meetup = null, { lockSearchCenter = false } = {}) {
  const broadKeywords = limitRestaurantKeywords([...(Array.isArray(keywords) ? keywords : [keywords]), RESTAURANT_KEYWORD_FALLBACK], 6);
  const relaxedOptions = relaxedRestaurantSearchOptions(options);
  let activeCoords = normalizeCoord(coords);
  let pois = await trySearchNearbyRestaurants(activeCoords, radius, keywords, options, "primary", meetup);
  if (pois.length < TOTAL) pois = uniquePois([...pois, ...await trySearchNearbyRestaurants(activeCoords, Math.max(radius, 8000), keywords, options, "wide-primary", meetup)]);
  if (pois.length < TOTAL) pois = uniquePois([...pois, ...await trySearchNearbyRestaurants(activeCoords, Math.max(radius, 8000), broadKeywords, relaxedOptions, "relaxed", meetup)]);
  if (!lockSearchCenter && pois.length < TOTAL) {
    const fallbackCoords = await getApproxPosition();
    if (!sameRestaurantCoords(activeCoords, fallbackCoords)) {
      const fallbackPois = await trySearchNearbyRestaurants(fallbackCoords, 8000, broadKeywords, relaxedOptions, "city-fallback", null);
      if (fallbackPois.length > pois.length && (!meetup || !pois.length)) {
        activeCoords = fallbackCoords;
        pois = fallbackPois;
      } else {
        pois = uniquePois([...pois, ...fallbackPois]);
      }
    }
  }
  if (!lockSearchCenter && pois.length < TOTAL && !sameRestaurantCoords(activeCoords, DEFAULT_AMAP_CENTER)) {
    const defaultPois = await trySearchNearbyRestaurants(normalizeCoord(DEFAULT_AMAP_CENTER), 8000, broadKeywords, relaxedOptions, "default-fallback", null);
    if (defaultPois.length > pois.length && (!meetup || !pois.length)) {
      activeCoords = normalizeCoord(DEFAULT_AMAP_CENTER);
      pois = defaultPois;
    } else {
      pois = uniquePois([...pois, ...defaultPois]);
    }
  }
  return { coords: activeCoords, pois: diverseRestaurantPois(rankRestaurantPoisForMeetup(pois, meetup), AMAP_PRICE_POOL_SIZE) };
}

async function trySearchNearbyRestaurants(coords, radius, keywords, options, label, meetup = null) {
  try {
    const directPois = await searchNearbyRestaurants(coords, radius, keywords, options, meetup);
    if (directPois.length || !RESTAURANT_POI_ENDPOINT) return directPois;
    const workerPois = await searchNearbyRestaurantsByWorker(coords, radius, keywords, options, meetup);
    if (workerPois.length) return workerPois;
    return directPois;
  } catch (error) {
    console.warn("Restaurant search attempt failed", label, error);
    try {
      return await searchNearbyRestaurantsByWorker(coords, radius, keywords, options, meetup);
    } catch (workerError) {
      console.warn("Restaurant worker search attempt failed", label, workerError);
      return [];
    }
  }
}

function relaxedRestaurantSearchOptions(options = {}) {
  // 放宽价格/评分/必含词/区域来凑够候选,但"忌口/否定"(avoidKeywords)是硬性约束,永不放开
  return { ...options, minCost: 0, maxCost: 0, minRating: 0, mustKeywords: [], avoidKeywords: normalizeSimpleKeywords(options.avoidKeywords, AVOID_KEYWORD_LIMIT), region: "", cityLimit: false, types: "050000", sortrule: "distance", showFields: AMAP_SHOW_FIELDS_DEFAULT, searchRequests: [] };
}

async function searchNearbyRestaurants(coords, radius = 3500, keywords = [RESTAURANT_KEYWORD_FALLBACK], options = {}, meetup = null) {
  const center = normalizeCoord(coords);
  if (!center) return [];
  const pois = [];
  const searchRequests = restaurantAmapRequests(radius, keywords, options);
  const hasEnoughCandidates = () => diverseRestaurantPois(preferredRestaurantPois(pois.map(normalizeAmapPoi).filter(Boolean), options), AMAP_PRICE_POOL_SIZE).length >= AMAP_PRICE_POOL_SIZE;
  for (let requestIndex = 0; requestIndex < searchRequests.length; requestIndex += 1) {
    const request = searchRequests[requestIndex];
    for (let page = 1; page <= AMAP_SEARCH_PAGES; page += 1) {
      const data = await amapRequest("https://restapi.amap.com/v5/place/around", {
        key: AMAP_WEB_SERVICE_KEY,
        location: `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`,
        radius: String(request.radiusMeters),
        types: request.types,
        keywords: request.keyword,
        sortrule: request.sortrule,
        page_size: String(AMAP_RESTAURANT_LIMIT),
        page_num: String(page),
        show_fields: request.showFields,
        region: request.region,
        city_limit: request.cityLimit ? "true" : "",
        output: "json"
      });
      const pagePois = data.pois || [];
      pois.push(...pagePois.map((poi) => ({ ...poi, __searchKeyword: request.keyword })));
      if (hasEnoughCandidates()) break;
      if (pagePois.length < AMAP_RESTAURANT_LIMIT) break;
    }
    if (hasEnoughCandidates()) break;
  }
  return diverseRestaurantPois(rankRestaurantPoisForMeetup(preferredRestaurantPois(pois.map(normalizeAmapPoi).filter(Boolean), options), meetup), AMAP_PRICE_POOL_SIZE);
}

async function searchNearbyRestaurantsByWorker(coords, radius = 3500, keywords = [RESTAURANT_KEYWORD_FALLBACK], options = {}, meetup = null) {
  if (!RESTAURANT_POI_ENDPOINT) return [];
  const center = normalizeCoord(coords);
  if (!center) return [];
  const pois = [];
  const searchRequests = restaurantAmapRequests(radius, keywords, relaxedRestaurantSearchOptions(options)).slice(0, 4);
  for (const request of searchRequests) {
    const data = await wxRequest({
      url: RESTAURANT_POI_ENDPOINT,
      data: {
        lat: center.lat,
        lng: center.lng,
        module: "dinner",
        keyword: request.keyword,
        radius: request.radiusMeters,
        types: request.types,
        coordsys: "amap",
        city: options.allowedCity || request.region || options.region || "",
        minCost: Number(options.minCost) || 0,
        maxCost: Number(options.maxCost) || 0,
        limit: AMAP_PRICE_POOL_SIZE
      }
    });
    const pagePois = Array.isArray(data && data.pois) ? data.pois : [];
    pois.push(...pagePois.map((poi) => normalizeWorkerRestaurantPoi(poi, request.keyword)).filter(Boolean));
    if (diverseRestaurantPois(preferredRestaurantPois(pois, options), AMAP_PRICE_POOL_SIZE).length >= AMAP_PRICE_POOL_SIZE) break;
  }
  return diverseRestaurantPois(rankRestaurantPoisForMeetup(preferredRestaurantPois(pois, options), meetup), AMAP_PRICE_POOL_SIZE);
}

function normalizeRestaurantDetailList(value) {
  const items = [];
  const visit = (current) => {
    if (current == null) return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current === "object") {
      ["name", "title", "tag", "value", "text", "label", "dish", "food", "menu", "recommend", "special"].forEach((key) => visit(current[key]));
      return;
    }
    const text = String(current || "").trim();
    if (text) items.push(text);
  };
  visit(value);
  return uniqueKeywords(items).slice(0, 24);
}

function normalizeAmapChildren(children) {
  return (Array.isArray(children) ? children : []).map((child) => {
    if (!child || typeof child !== "object") return null;
    const location = parseAmapLocation(child.location);
    return {
      id: child.id || "",
      name: child.name || child.title || "",
      type: child.type || "",
      address: child.address || "",
      location
    };
  }).filter((item) => item && item.name).slice(0, 12);
}

function normalizeWorkerRestaurantPoi(poi, searchKeyword = "") {
  if (!poi || !poi.name) return null;
  const location = normalizeCoord(poi.location || { lat: poi.lat, lng: poi.lng });
  const navLocation = normalizeCoord(poi.navLocation || poi.nav_location);
  const photoItems = normalizeAmapPoiPhotoItems([
    ...(Array.isArray(poi.photoItems) ? poi.photoItems : []),
    ...(Array.isArray(poi.photos) ? poi.photos : []),
    poi.image
  ].filter(Boolean));
  const photoUrls = photoItems.map((item) => item.url);
  const area = Array.isArray(poi.area) ? poi.area.join(" ") : String(poi.area || "");
  const menuItems = normalizeRestaurantDetailList(poi.menuItems || poi.menu_items || poi.menu || poi.dishes || poi.dish || poi.specialDishes || poi.special_dishes || poi.foods || poi.recommendDishes);
  return {
    id: poi.id || poi.name,
    name: poi.name,
    address: Array.isArray(poi.address) ? poi.address.join("") : String(poi.address || ""),
    type: poi.type || "餐厅",
    typecode: poi.typecode || "",
    area,
    city: poi.city || poi.cityname || "",
    district: poi.district || poi.adname || "",
    businessArea: poi.businessArea || poi.business_area || "",
    tag: poi.tag || "",
    recommend: poi.recommend || "",
    keytag: poi.keytag || poi.keyTag || "",
    rectag: poi.rectag || poi.recTag || "",
    menuItems,
    children: normalizeAmapChildren(poi.children || []),
    indoor: poi.indoor || null,
    tel: poi.tel || "",
    opentimeToday: poi.opentimeToday || poi.opentime_today || "",
    opentimeWeek: poi.opentimeWeek || poi.opentime_week || "",
    distance: Number(poi.distance) || 0,
    rating: poi.rating || "",
    cost: poi.cost || "",
    image: photoUrls[0] || normalizeAmapPhotoUrl(poi.image),
    photos: photoUrls,
    photoItems,
    searchKeyword: cleanRestaurantKeyword(poi.searchKeyword || searchKeyword),
    location: location ? { lat: location.lat, lng: location.lng } : null,
    navLocation: navLocation ? { lat: navLocation.lat, lng: navLocation.lng } : null
  };
}

function restaurantAmapRequests(radius, keywords, options = {}) {
  const radiusCap = normalizeAmapRadius(radius, 3500);
  const base = normalizePlanSearchRequests(options.searchRequests, keywords, { ...options, radiusMeters: radius });
  return base.map((request) => ({
    keyword: cleanRestaurantKeyword(request.keyword) || RESTAURANT_KEYWORD_FALLBACK,
    types: normalizeAmapTypes(request.types || options.types),
    radiusMeters: Math.min(normalizeAmapRadius(request.radiusMeters || radius, radiusCap), radiusCap),
    sortrule: normalizeAmapSortRule(request.sortrule || options.sortrule),
    region: cleanRestaurantKeyword(request.region || options.region || ""),
    cityLimit: Boolean((request.cityLimit ?? options.cityLimit) && (request.region || options.region)),
    showFields: normalizeAmapShowFields(request.showFields || options.showFields)
  }));
}

function normalizeAmapPoi(poi) {
  if (!poi || !poi.name) return null;
  const photos = Array.isArray(poi.photos) ? poi.photos : [];
  const photoItems = normalizeAmapPoiPhotoItems(photos);
  const photoUrls = photoItems.map((item) => item.url);
  const image = photoUrls[0] || "";
  const business = poi.business || {};
  const [lng, lat] = String(poi.location || "").split(",").map(Number);
  const navLocation = parseAmapLocation(poi.navi?.entr_location || poi.navi?.entrance_location || poi.entr_location);
  const typeParts = String(poi.type || "").split(";");
  const menuItems = normalizeRestaurantDetailList([
    business.menu,
    business.menus,
    business.dish,
    business.dishes,
    business.special,
    business.special_food,
    business.specialDishes,
    business.recommend,
    business.recommendation,
    poi.menu,
    poi.menus,
    poi.dishes,
    poi.specialDishes
  ]);
  return {
    id: poi.id || poi.name,
    name: poi.name,
    address: Array.isArray(poi.address) ? poi.address.join("") : (poi.address || ""),
    type: typeParts[typeParts.length - 1] || typeParts[0] || "餐厅",
    typecode: poi.typecode || "",
    area: [poi.cityname, poi.adname].filter(Boolean).join(" "),
    city: poi.cityname || "",
    district: poi.adname || "",
    businessArea: business.business_area || business.businessArea || "",
    tag: business.tag || poi.tag || "",
    recommend: business.recommend || business.recommendation || "",
    keytag: business.keytag || business.key_tag || poi.keytag || "",
    rectag: business.rectag || business.rec_tag || poi.rectag || "",
    menuItems,
    children: normalizeAmapChildren(poi.children || []),
    indoor: poi.indoor || null,
    tel: business.tel || poi.tel || "",
    opentimeToday: business.opentime_today || business.opentimeToday || "",
    opentimeWeek: business.opentime_week || business.opentimeWeek || "",
    distance: Number(poi.distance) || 0,
    rating: business.rating || "",
    cost: business.cost || "",
    image,
    photos: photoUrls,
    photoItems,
    searchKeyword: cleanRestaurantKeyword(poi.__searchKeyword || ""),
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    navLocation
  };
}

function parseAmapLocation(value) {
  const [lng, lat] = String(value || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const AMAP_PHOTO_CATEGORY_SCORE = { menu: 460, food: 420, drink: 410, interior: 300, storefront: 220, unknown: 100, fallback: 40 };

function normalizeAmapPoiPhotoItems(photos) {
  return (Array.isArray(photos) ? photos : []).map((photo, index) => {
    const url = normalizeAmapPhotoUrl(typeof photo === "string" ? photo : photo && photo.url);
    if (!url) return null;
    const category = inferAmapPhotoCategory(photo, url);
    const sourceBonus = url.includes("aos-comment.amap.com") ? 30 : 0;
    return {
      url,
      kind: category,
      label: restaurantPhotoKindLabel(category, photo && (photo.label || photo.category || photo.type || photo.imageCategory || photo.tag || photo.title)),
      title: typeof photo === "string" ? "" : String(photo && (photo.title || photo.name || photo.label || "") || ""),
      source: "amap",
      score: (AMAP_PHOTO_CATEGORY_SCORE[category] || AMAP_PHOTO_CATEGORY_SCORE.unknown) + sourceBonus - index
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score).filter(uniquePhotoItemByUrl).slice(0, 8);
}

function selectAmapPoiPhotoUrls(photos) {
  return uniqueRestaurantPhotoItems(photos, 8).map((item) => item.url).slice(0, 6);
}

function selectAmapPoiPhotoUrl(photos) {
  return uniqueRestaurantPhotoItems(photos, 8)[0]?.url || "";
}

function normalizeAmapPhotoUrl(url) {
  const text = String(url || "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  return text.replace(/^http:\/\//i, "https://");
}

function inferAmapPhotoCategory(photo, url) {
  const text = String([photo?.category, photo?.type, photo?.imageCategory, photo?.tag, photo?.title].filter(Boolean).join(" ")).toLowerCase();
  if (/(菜单|菜谱|菜牌|点菜单|价目|价格表|酒水单|套餐|menu|bill of fare|price list)/i.test(text)) return "menu";
  if (/(饮品|饮料|咖啡|茶|酒|果汁|奶茶|饮|drink|beverage|coffee|tea|wine|cocktail|beer)/i.test(text)) return "drink";
  if (/(菜品|菜|餐|饭|面|粉|粥|锅|肉|鱼|虾|蟹|小吃|甜品|蛋糕|点心|烧烤|火锅|寿司|刺身|food|dish|meal|dessert|snack|hotpot|sushi|noodle|rice|bbq|grill|cake)/i.test(text)) return "food";
  if (/(环境|室内|店内|装修|包厢|座位|大厅|餐桌|吧台|露台|interior|inside|indoor|dining|seat|table|bar)/i.test(text)) return "interior";
  if (/(门头|招牌|门面|外观|入口|店门|门店|店铺|档口|柜台|storefront|facade|entrance|signboard|shopfront|counter)/i.test(text)) return "storefront";
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("aos-comment.amap.com")) return "food";
  if (lowerUrl.includes("store.is.autonavi.com")) return "storefront";
  return "unknown";
}

function normalizeRestaurantPhotoKind(kind) {
  const value = String(kind || "").toLowerCase();
  return ["menu", "food", "drink", "interior", "storefront", "fallback", "unknown"].includes(value) ? value : "unknown";
}

function restaurantPhotoKindLabel(kind, rawLabel = "") {
  const normalized = normalizeRestaurantPhotoKind(kind);
  const cleaned = String(rawLabel || "").replace(/\s+/g, "").slice(0, 8);
  if (/菜单|菜谱|菜牌|价目|价格|套餐|menu/i.test(cleaned)) return "菜单";
  if (/环境|店内|室内|大厅|包厢|座位/i.test(cleaned)) return "环境";
  if (/门头|门面|外观|招牌|入口/i.test(cleaned)) return "门头";
  if (/饮品|饮料|酒水|咖啡|茶/i.test(cleaned)) return "饮品";
  if (/菜品|菜|餐|小吃|甜品/i.test(cleaned)) return "菜品";
  return ({ menu: "菜单", food: "菜品", drink: "饮品", interior: "环境", storefront: "门头", fallback: "图片", unknown: "图片" })[normalized] || "图片";
}

function normalizeRestaurantPhotoItem(item, index = 0) {
  const rawUrl = typeof item === "string" ? item : item && item.url;
  const url = normalizeAmapPhotoUrl(rawUrl);
  if (!url) return null;
  const kind = normalizeRestaurantPhotoKind(typeof item === "string" ? "unknown" : item.kind || inferAmapPhotoCategory(item, url));
  return {
    url,
    kind,
    label: typeof item === "string" ? restaurantPhotoKindLabel(kind) : restaurantPhotoKindLabel(kind, item.label || item.category || item.title || item.tag),
    title: typeof item === "string" ? "" : String(item.title || item.name || item.label || "").trim(),
    source: typeof item === "string" ? "amap" : (item.source || "amap"),
    score: Number(item && item.score) || ((AMAP_PHOTO_CATEGORY_SCORE[kind] || AMAP_PHOTO_CATEGORY_SCORE.unknown) - index)
  };
}

function uniquePhotoItemByUrl(item, index, arr) {
  return item && arr.findIndex((candidate) => candidate && candidate.url === item.url) === index;
}

function uniqueRestaurantPhotoItems(items, limit = 8) {
  return (items || []).map(normalizeRestaurantPhotoItem).filter(uniquePhotoItemByUrl).slice(0, limit);
}

function realRestaurantPhotoItems(items, fallbackImage = "", limit = 8) {
  const fallbackUrl = normalizeAmapPhotoUrl(fallbackImage);
  return uniqueRestaurantPhotoItems(items, limit).filter((item) => {
    if (!item || item.kind === "fallback" || item.source === "fallback") return false;
    return !fallbackUrl || item.url !== fallbackUrl;
  });
}

function restaurantCardImages(poi = {}, fallbackImage = "") {
  const realItems = realRestaurantPhotoItems([...(poi.photoItems || []), ...(poi.photos || []), poi.image].filter(Boolean), fallbackImage, 12);
  const picked = [];
  const used = new Set();
  const pushWhere = (predicate, limit = 1) => {
    for (const item of realItems) {
      if (picked.length >= 6 || limit <= 0) break;
      if (!item || used.has(item.url) || !predicate(item)) continue;
      picked.push(item);
      used.add(item.url);
      limit -= 1;
    }
  };
  pushWhere((item) => item.kind === "storefront");
  pushWhere((item) => item.kind === "interior");
  pushWhere((item) => item.kind === "food" || item.kind === "drink", 3);
  pushWhere((item) => item.kind === "menu");
  pushWhere(() => true, 6);
  return realRestaurantPhotoItems(picked, fallbackImage, 6);
}

function filterRestaurantPois(pois, { minCost = 0, maxCost = 0, minRating = 0, mustKeywords = [], avoidKeywords = [] } = {}) {
  const must = normalizeSimpleKeywords(mustKeywords, 8).map(normalizeMatchText).filter(Boolean);
  const avoid = normalizeSimpleKeywords(avoidKeywords, AVOID_KEYWORD_LIMIT).map(normalizeMatchText).filter(Boolean);
  return (pois || []).filter((poi) => {
    if (!poi || !poi.name) return false;
    if (minCost || maxCost) {
      const cost = readCostValue(poi.cost);
      if (!Number.isFinite(cost)) return false;
      if (minCost && cost < minCost) return false;
      if (maxCost && cost > maxCost) return false;
    }
    if (minRating && readRatingValue(poi.rating) < minRating) return false;
    if (must.length || avoid.length) {
      const text = normalizeMatchText([poi.name, poi.type, poi.typecode, poi.address, poi.area, poi.businessArea, poi.tag, poi.searchKeyword].join(" "));
      if (must.length && !must.some((keyword) => text.includes(keyword))) return false;
      if (avoid.some((keyword) => text.includes(keyword))) return false;
    }
    return true;
  });
}

function preferredRestaurantPois(pois, options = {}) {
  const strict = filterRestaurantPois(pois, options);
  if (strict.length >= TOTAL) return strict;
  const relaxedMust = normalizeSimpleKeywords(options.mustKeywords, 8).length ? filterRestaurantPois(pois, { ...options, mustKeywords: [] }) : [];
  const strictAndMust = uniquePois([...strict, ...relaxedMust]);
  if (strictAndMust.length >= TOTAL) return strictAndMust;
  const relaxedCost = filterRestaurantPois(pois, relaxedRestaurantSearchOptions(options));
  return uniquePois([...strict, ...relaxedMust, ...relaxedCost]);
}

function restaurantCardsForMode(pois, modeName, options = {}) {
  if (modeName === "霸总模式") return poisToCards(topRatingPois(pois).slice(0, TOTAL), options);
  if (isMysticMode(modeName)) return poisToCards(randomPick(pois, TOTAL), options);
  return poisToCards(diverseRestaurantPois(pois, TOTAL), options);
}

function restaurantCardsForModeAvoiding(pois, modeName, options = {}, avoidKeys = new Set()) {
  const avoidSet = normalizeRestaurantReplayKeySet(avoidKeys);
  if (!avoidSet.size) return restaurantCardsForMode(pois, modeName, options);
  const freshPois = (pois || []).filter((poi) => !avoidSet.has(restaurantCardReplayKey(poi)));
  const freshCards = restaurantCardsForMode(freshPois, modeName, options);
  if (freshCards.length >= TOTAL) return freshCards.slice(0, TOTAL);
  const freshCardKeys = new Set(freshCards.map(restaurantCardReplayKey).filter(Boolean));
  const fallbackPois = (pois || []).filter((poi) => {
    const key = restaurantCardReplayKey(poi);
    return avoidSet.has(key) && !freshCardKeys.has(key);
  });
  const fallbackCards = restaurantCardsForMode(fallbackPois, modeName, options)
    .filter((card) => !freshCardKeys.has(restaurantCardReplayKey(card)));
  return [...freshCards, ...fallbackCards].slice(0, TOTAL);
}

function poisToCards(pois, options = {}) {
  const named = preferredRestaurantPois(pois, options);
  return named.map((p, index) => {
    const locationPoint = restaurantPoiLocationPoint(p) || restaurantNavigationPointForPoi(p);
    const navPoint = restaurantNavigationPointForPoi(p);
    const art = artThemeForPoi(p, index);
    const fallbackImage = fallbackImageForPoi(p, index);
    const photoItems = restaurantCardImages(p, fallbackImage);
    const photoGallery = photoItems.map((item) => item.url);
    const detail = restaurantDetailPayloadForPoi(p, { ...options, photoItems });
    return {
      id: p.id,
      poi: p,
      emoji: foodEmojiForPoi(p),
      name: p.name,
      art: ART_COLORS[index % ART_COLORS.length],
      artBg: art.bg,
      artAccent: art.accent,
      image: photoGallery[0] || "",
      photoGallery,
      photoItems,
      carouselImages: photoItems,
      detailPhotos: detail.photos,
      venueImage: p.image || "",
      fallbackImage,
      reason: poiReason(p, options),
      meta: restaurantPoiMeta(p, options),
      summaryPills: restaurantCardSummaryPills(p, options),
      meetupPanel: restaurantMeetupPanelForPoi(p),
      arrivalBoard: restaurantArrivalBoard(p),
      routeTags: restaurantTravelTags(p, options).map(metaTagText).filter(Boolean),
      ratingText: p.rating ? `${p.rating}分` : "",
      costText: p.cost ? `${formatCost(p.cost)}元` : "",
      openTimeText: detail.openTimeText,
      detailFacts: detail.facts,
      detailFeatures: detail.features,
      detailRoutes: detail.routes,
      detailRows: detail.rows,
      tag: p.tag || "",
      businessArea: p.businessArea || "",
      opentimeToday: p.opentimeToday || "",
      opentimeWeek: p.opentimeWeek || "",
      rating: p.rating || "",
      cost: p.cost || "",
      tel: p.tel || "",
      recommend: p.recommend || "",
      keytag: p.keytag || "",
      rectag: p.rectag || "",
      menuItems: p.menuItems || [],
      routeMetrics: p.routeMetrics || null,
      participantRoutes: p.participantRoutes || [],
      meetup: p.meetup || null,
      location: locationPoint ? { latitude: locationPoint.lat, longitude: locationPoint.lng, lat: locationPoint.lat, lng: locationPoint.lng } : null,
      navLocation: navPoint || null,
      address: p.address || "",
      type: p.type || "",
      area: p.area || "",
      navUrl: amapNavigationUrl(p),
      orderUrl: amapStoreUrl(p)
    };
  }).slice(0, TOTAL);
}

function restaurantPoiMeta(p, options = {}) {
  const travel = restaurantTravelTags(p, options).map(metaTagText).filter(Boolean);
  const quality = p && p.rating ? `${p.rating}分` : "";
  const priceOrType = p && p.cost ? `人均${formatCost(p.cost)}` : (p && p.type || "");
  return [...travel, quality, priceOrType].filter(Boolean).slice(0, 6);
}

function restaurantCardSummaryPills(p, options = {}) {
  const meetup = restaurantMeetupSummaryPills(p);
  const rating = p && p.rating ? { text: `${p.rating}分`, wide: false } : null;
  const cost = p && p.cost ? { text: `人均${formatCost(p.cost)}`, wide: false } : null;
  if (meetup.length) return [rating, cost].filter(Boolean);
  const travelTexts = restaurantTravelTags(p, options)
    .map(metaTagText)
    .filter(Boolean)
    .filter((text) => !/：/.test(text));
  const commute = pickPrimaryCommuteText(travelTexts);
  return [commute ? { text: commute, wide: true } : null, rating, cost].filter(Boolean);
}

// 卡面只保留一个“到达成本”:可步行优先步行,否则驾车/地铁取其一,细节进详情页
function pickPrimaryCommuteText(texts = []) {
  const walk = texts.find((text) => text.startsWith("步行"));
  if (walk) {
    const match = walk.match(/(\d+)\s*分钟/);
    if (match && Number(match[1]) <= 30) return walk;
  }
  const drive = texts.find((text) => text.startsWith("驾车"));
  const subway = texts.find((text) => text.startsWith("地铁"));
  return drive || subway || walk || texts[0] || "";
}

function restaurantMeetupSummaryPills(p = {}) {
  const meetup = p && p.meetup;
  if (!meetup) return [];
  const avg = formatDistance(meetup.avgDistance);
  const participantDistances = Array.isArray(meetup.participantDistances) ? meetup.participantDistances : [];
  const farthest = participantDistances.reduce((picked, item, index) => {
    const distance = Number(item && item.distance);
    if (!Number.isFinite(distance) || distance <= 0) return picked;
    if (!picked || distance > picked.distance) return { ...item, index, distance };
    return picked;
  }, null);
  const maxDistance = formatDistance((farthest && farthest.distance) || meetup.maxDistance);
  const farthestLabel = farthest ? restaurantRoutePlaceLabel(farthest, farthest.index) : "";
  return [
    avg ? { text: `平均${avg}`, wide: true } : null,
    maxDistance ? { text: `最远${farthestLabel || ""}${maxDistance}`, wide: true } : null
  ].filter(Boolean);
}

function restaurantMeetupExpectedLabels(p = {}) {
  const meetup = p && p.meetup || {};
  const labelParts = String(meetup.label || "").split(/[\/、,，]+/);
  const distances = Array.isArray(meetup.participantDistances) ? meetup.participantDistances : [];
  const routes = Array.isArray(p && p.participantRoutes) ? p.participantRoutes : [];
  return uniqueRestaurantMeetupRouteLabels([
    ...(Array.isArray(meetup.participantLabels) ? meetup.participantLabels : []),
    ...labelParts,
    ...distances.map((item) => item && (item.placeLabel || item.label)),
    ...routes.map((route) => route && (route.placeLabel || route.label))
  ]);
}

function restaurantMeetupPanelForPoi(p = {}) {
  const summaryPills = restaurantMeetupSummaryPills(p);
  const routeItems = restaurantMeetupRouteItems(p);
  if (!summaryPills.length && routeItems.length < 2) return null;
  return {
    summaryPills,
    routes: routeItems,
    selectedIndex: 0,
    activeRoute: routeItems[0] || null
  };
}

// 到达榜:逐人到店的推荐方式 + 分钟数 + 地铁分段,点开看驾车/地铁/步行三方式
function restaurantArrivalBoard(p = {}) {
  const routes = Array.isArray(p && p.participantRoutes) ? p.participantRoutes : [];
  if (routes.length < 2) return null;
  const rows = routes.map((route, index) => {
    const label = restaurantRoutePlaceLabel(route, index);
    const walkMin = minutesFromSeconds(route.walkingDurationSeconds);
    const driveMin = minutesFromSeconds(route.drivingDurationSeconds);
    const subwayMin = minutesFromSeconds(route.subwayDurationSeconds);
    const subwayWalkMeters = Math.round(Number(route.subwayWalkingDistanceMeters) || 0);
    const subwayWalkMin = subwayWalkMeters ? Math.max(1, Math.round(subwayWalkMeters / 75)) : 0;
    const subwayRideMin = subwayMin ? Math.max(1, subwayMin - subwayWalkMin * 2) : 0;
    const recommendedKey = pickPreferredArrivalMode(route.preferredModes, { walkMin, driveMin, subwayMin })
      || pickArrivalMode({ walkMin, driveMin, subwayMin });
    const modes = [];
    if (driveMin) {
      modes.push({ key: "drive", icon: "🚗", name: "驾车", min: driveMin, minText: `${driveMin} 分钟`, note: "晚高峰已计入", on: recommendedKey === "drive" });
    }
    if (subwayMin) {
      modes.push({
        key: "subway", icon: "🚇", name: "地铁", min: subwayMin, minText: `${subwayMin} 分钟`,
        walkMin: subwayWalkMin, rideMin: subwayRideMin,
        note: subwayWalkMin ? `含步行换乘 ${subwayWalkMin * 2} 分` : "", on: recommendedKey === "subway"
      });
    }
    if (walkMin) {
      modes.push({ key: "walk", icon: "🚶", name: "步行", min: walkMin, minText: `${walkMin} 分钟`, tooFar: walkMin > 30, note: walkMin > 30 ? "太远，不推荐" : "", on: recommendedKey === "walk" });
    }
    const recMode = modes.find((m) => m.key === recommendedKey) || modes[0] || null;
    return {
      label,
      short: (label || "友").slice(0, 1),
      modes,
      recommendedKey: recMode ? recMode.key : "",
      recommendedIcon: recMode ? recMode.icon : "",
      recommendedMin: recMode ? recMode.min : 0,
      recommendedText: recMode ? `${recMode.icon} ${recMode.min} 分钟` : "",
      farthest: false,
      expanded: false
    };
  }).filter((row) => row.recommendedMin > 0);
  if (rows.length < 2) return null;
  let farthestIndex = -1;
  let farthestMin = 0;
  rows.forEach((row, index) => {
    if (row.recommendedMin > farthestMin) {
      farthestMin = row.recommendedMin;
      farthestIndex = index;
    }
  });
  if (farthestIndex >= 0) rows[farthestIndex].farthest = true;
  return {
    rows,
    expandedIndex: -1,
    farthestLabel: farthestIndex >= 0 ? rows[farthestIndex].label : "",
    farthestMin,
    summary: farthestMin ? `最远的${rows[farthestIndex].label}到这儿 ${farthestMin} 分钟` : ""
  };
}

function minutesFromSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

// 个人指定的出行方式(可多选)→ 到达榜模式 key:在所选方式里取有估时且最快的那种;
// 骑行无估时,公交近似走地铁;都没有则回退自动选择。
function pickPreferredArrivalMode(travels, { walkMin, driveMin, subwayMin } = {}) {
  const list = Array.isArray(travels) ? travels : (travels ? [travels] : []);
  if (!list.length) return "";
  const candidates = [];
  list.forEach((travel) => {
    if ((travel === "地铁" || travel === "公交") && subwayMin) candidates.push(["subway", subwayMin]);
    if (travel === "驾车" && driveMin) candidates.push(["drive", driveMin]);
    if (travel === "步行" && walkMin) candidates.push(["walk", walkMin]);
  });
  if (!candidates.length) return "";
  candidates.sort((a, b) => a[1] - b[1]);
  return candidates[0][0];
}

// 自动推荐:可步行(≤15分)优先步行;否则驾车与地铁取更快;只有一种则用它
function pickArrivalMode({ walkMin, driveMin, subwayMin }) {
  if (walkMin && walkMin <= 15) return "walk";
  const candidates = [];
  if (driveMin) candidates.push(["drive", driveMin]);
  if (subwayMin) candidates.push(["subway", subwayMin]);
  if (candidates.length) {
    candidates.sort((a, b) => a[1] - b[1]);
    return candidates[0][0];
  }
  return walkMin ? "walk" : "";
}

function restaurantMeetupRouteItems(p = {}) {
  const routes = Array.isArray(p && p.participantRoutes) ? p.participantRoutes : [];
  const fromRoutes = routes.map((route, index) => {
    const label = restaurantRoutePlaceLabel(route, index);
    const stats = restaurantRouteStatTexts(route);
    const text = stats.length ? `${label}： ${stats.join(" · ")}` : "";
    return text ? restaurantMeetupRouteItem(label, text, index) : null;
  }).filter(Boolean);
  const distances = Array.isArray(p && p.meetup && p.meetup.participantDistances) ? p.meetup.participantDistances : [];
  const fromDistances = distances.map((item, index) => {
    const label = restaurantRoutePlaceLabel(item, index);
    const distance = formatDistance(item && item.distance);
    return distance ? restaurantMeetupRouteItem(label, `${label}： ${distance}`, index) : null;
  }).filter(Boolean);
  const expectedLabels = restaurantMeetupExpectedLabels(p);
  if (!expectedLabels.length) return (fromRoutes.length ? fromRoutes : fromDistances).slice(0, 4);
  return expectedLabels.map((label) => {
    const route = findRestaurantMeetupRouteItem(fromRoutes, label);
    if (route) return { ...route, label, long: restaurantMeetupRouteLabelIsLong(label) };
    const distance = findRestaurantMeetupRouteItem(fromDistances, label);
    if (distance) return { ...distance, label, long: restaurantMeetupRouteLabelIsLong(label) };
    return restaurantMeetupRouteItem(label, `${label}： 路线正在计算`);
  }).filter(Boolean).slice(0, 4);
}

function restaurantMeetupRouteItem(label, text, index = 0) {
  const cleanLabel = restaurantMeetupRouteDisplayLabel(label, index);
  return {
    label: cleanLabel,
    text: String(text || "").replace(String(label || ""), cleanLabel),
    long: restaurantMeetupRouteLabelIsLong(cleanLabel)
  };
}

function uniqueRestaurantMeetupRouteLabels(labels = []) {
  const rawLabels = (labels || []).map((label) => String(label || "").trim()).filter(Boolean);
  const hasPosition = rawLabels.some((label) => isRestaurantPositionLabel(label));
  return uniqueRestaurantMiddlePointLabels(rawLabels.map((label, index) => (
    restaurantMeetupRouteDisplayLabel(label, index, { hasPosition })
  )));
}

function restaurantMeetupRouteDisplayLabel(label, index = 0, options = {}) {
  const raw = String(label || "").trim();
  if (isRestaurantPositionLabel(raw)) return "位置";
  if (isRestaurantGenericCompanionLabel(raw) && (index === 0 || options.hasPosition)) return "位置";
  const display = restaurantMiddlePointDisplayLabel(raw) || cleanParticipantLabel(raw, index);
  if (isRestaurantPositionLabel(display)) return "位置";
  if (isRestaurantGenericCompanionLabel(display) && (index === 0 || options.hasPosition)) return "位置";
  return display;
}

function isRestaurantPositionLabel(label) {
  const key = normalizeMatchText(label);
  return key === "位置" || isRestaurantCurrentLocationHint(label);
}

function isRestaurantGenericCompanionLabel(label) {
  return /^同伴\d*$/.test(normalizeMatchText(label));
}

function restaurantMeetupRouteLabelIsLong(label) {
  return String(label || "").replace(/[A-Za-z0-9]/g, "aa").length >= 5;
}

function findRestaurantMeetupRouteItem(items = [], label = "") {
  const key = normalizeMatchText(label);
  if (!key) return null;
  return (items || []).find((item) => {
    const itemKey = normalizeMatchText(item && item.label);
    if (!itemKey) return false;
    return itemKey === key || itemKey.includes(key) || key.includes(itemKey);
  }) || null;
}

function restaurantTravelTags(p, options = {}) {
  const participantTags = restaurantParticipantRouteTags(p);
  if (participantTags.length) return participantTags;
  const route = p && p.routeMetrics;
  if (route) {
    const distance = formatDistance(restaurantRouteDisplayDistanceMeters(route));
    const stats = restaurantRouteStatTexts(route).slice(1);
    return [
      distance ? `离你${distance}` : "",
      ...stats
    ].filter(Boolean);
  }
  return restaurantDistanceTags(p, options).slice(0, 3);
}

function restaurantParticipantRouteTags(p) {
  const routes = Array.isArray(p && p.participantRoutes) ? p.participantRoutes : [];
  return routes.slice(0, 2).map((route, index) => {
    const label = restaurantRoutePlaceLabel(route, index);
    const details = restaurantRouteStatTexts(route).join(" · ");
    return details ? { text: `${label}：${details}`, kind: "route" } : null;
  }).filter(Boolean);
}

function restaurantRoutePlaceLabel(route = {}, index = 0) {
  const raw = route.placeLabel || route.label;
  if (isRestaurantPositionLabel(raw)) return "位置";
  if (index === 0 && isRestaurantGenericCompanionLabel(raw)) return "位置";
  return restaurantShortPlaceLabel(raw) || cleanParticipantLabel(route.label, index);
}

function restaurantRouteStraightDistanceMeters(route = {}) {
  const distance = Number(route.straightDistanceMeters || route.distanceMeters || route.distance);
  return Number.isFinite(distance) && distance > 0 ? Math.round(distance) : 0;
}

function restaurantRouteDisplayDistanceMeters(route = {}) {
  const distance = restaurantRouteStraightDistanceMeters(route)
    || Number(route.distanceMeters || route.walkingDistanceMeters || route.drivingDistanceMeters || route.subwayDistanceMeters || route.distance);
  return Number.isFinite(distance) && distance > 0 ? Math.round(distance) : 0;
}

function restaurantRouteModeDisplayDistanceMeters(route = {}, value) {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  const anchor = restaurantRouteDisplayDistanceMeters(route);
  if (anchor && distance > Math.max(anchor * 2.8, anchor + 12000)) return 0;
  return Math.round(distance);
}

function restaurantRouteStatTexts(route = {}, { prefixDistance = false } = {}) {
  const distance = formatDistance(restaurantRouteDisplayDistanceMeters(route));
  const rawWalkingMeters = Number(route.walkingDistanceMeters);
  const walkingMeters = restaurantRouteModeDisplayDistanceMeters(route, route.walkingDistanceMeters);
  const showWalking = (!Number.isFinite(rawWalkingMeters) || rawWalkingMeters <= 0 || rawWalkingMeters <= 1000) && (!walkingMeters || walkingMeters <= 1000);
  const walkingDistance = showWalking ? formatDistance(walkingMeters) : "";
  const walkingTime = showWalking ? formatDuration(route.walkingDurationSeconds) : "";
  const drivingDistance = formatDistance(restaurantRouteModeDisplayDistanceMeters(route, route.drivingDistanceMeters));
  const drivingTime = formatDuration(route.drivingDurationSeconds);
  const subwayDistance = formatDistance(restaurantRouteModeDisplayDistanceMeters(route, route.subwayDistanceMeters));
  const subwayWalk = formatDistance(restaurantRouteModeDisplayDistanceMeters(route, route.subwayWalkingDistanceMeters));
  const subwayTime = formatDuration(route.subwayDurationSeconds);
  const estimateSuffix = route.estimatedRouteMetrics ? "约" : "";
  return [
    distance ? `${prefixDistance ? "距离 " : ""}${distance}` : "",
    walkingDistance || walkingTime ? `步行 ${[walkingDistance, walkingTime].filter(Boolean).join(" / ")}` : "",
    drivingDistance || drivingTime ? `驾车${estimateSuffix} ${[drivingDistance, drivingTime].filter(Boolean).join(" / ")}` : "",
    subwayDistance || subwayTime ? `地铁${estimateSuffix} ${[subwayDistance, subwayTime].filter(Boolean).join(" / ")}` : "",
    subwayWalk ? `距地铁步行 ${subwayWalk}` : ""
  ].filter(Boolean);
}

function restaurantDistanceTags(p, options = {}) {
  const tags = [];
  const target = restaurantTargetDistanceText(p, options);
  const user = restaurantUserDistanceText(p, options);
  if (target) tags.push(target);
  if (user) tags.push(user);
  if (p && p.meetup && p.meetup.maxDistance) tags.push(`最远${formatDistance(p.meetup.maxDistance)}`);
  return tags;
}

function restaurantTargetDistanceText(p, options = {}) {
  if (!restaurantHasTarget(options)) return "";
  const targetCoords = options.targetCoords || options.destination?.searchCoords || options.meetup?.searchCoords || options.searchCoords;
  const distance = restaurantDistanceFromPoi(p, targetCoords) || Number(p && p.distance) || 0;
  const formatted = formatDistance(distance);
  return formatted ? `距${restaurantTargetLabel(options)}${formatted}` : "";
}

function restaurantUserDistanceText(p, options = {}) {
  const distance = restaurantDistanceFromPoi(p, options.userCoords) || (!restaurantHasTarget(options) ? Number(p && p.distance) || 0 : 0);
  const formatted = formatDistance(distance);
  return formatted ? `离你${formatted}` : "";
}

function restaurantDistanceFromPoi(p, coords) {
  const point = restaurantPoiDistancePoint(p);
  if (!point || !coords) return 0;
  const distance = Math.round(restaurantDistanceMeters(coords, point));
  return Number.isFinite(distance) && distance > 0 && distance < 999000 ? distance : 0;
}

function restaurantPoiLocationPoint(poi) {
  const location = normalizeCoord(poi && poi.location);
  return location && restaurantValidCoords(location) ? { lat: location.lat, lng: location.lng } : null;
}

function restaurantPoiNavPoint(poi) {
  const navLocation = normalizeCoord(poi && poi.navLocation);
  return navLocation && restaurantValidCoords(navLocation) ? { lat: navLocation.lat, lng: navLocation.lng } : null;
}

function restaurantNavigationPointForPoi(poi) {
  const location = restaurantPoiLocationPoint(poi);
  const navLocation = restaurantPoiNavPoint(poi);
  if (location && navLocation) {
    const drift = restaurantDistanceMeters(location, navLocation);
    if (!Number.isFinite(drift) || drift > RESTAURANT_NAV_LOCATION_MAX_DRIFT_METERS) return location;
  }
  return navLocation || location;
}

function restaurantPoiDistancePoint(poi) {
  return restaurantPoiLocationPoint(poi) || restaurantNavigationPointForPoi(poi);
}

function sanitizeRestaurantPoiNavigationPoint(poi) {
  if (!poi) return poi;
  const location = restaurantPoiLocationPoint(poi);
  const navLocation = restaurantNavigationPointForPoi(poi);
  if (!location && !navLocation) return poi;
  return {
    ...poi,
    location: location || navLocation,
    navLocation: navLocation || location
  };
}

function restaurantPoiDistanceFromPoint(poi, targetCoords) {
  const target = normalizeCoord(targetCoords);
  const point = restaurantPoiDistancePoint(poi);
  if (!target || !point) return 0;
  const distance = Math.round(restaurantDistanceMeters(target, point));
  return Number.isFinite(distance) && distance > 0 && distance < 999000 ? distance : 0;
}

function restaurantSearchRadiusTarget(options = {}) {
  if (options.destination?.searchCoords) return options.destination.searchCoords;
  if (options.meetup?.searchCoords) return options.meetup.searchCoords;
  return options.userCoords || options.searchCoords || null;
}

function restaurantPoiDistanceFromTarget(poi, targetCoords) {
  const byLocation = restaurantPoiDistanceFromPoint(poi, targetCoords);
  if (byLocation) return byLocation;
  return 0;
}

function filterRestaurantPoisWithinSearchRadius(pois, targetCoords, radiusMeters) {
  const target = normalizeCoord(targetCoords);
  const radius = Number(radiusMeters);
  if (!target || !Number.isFinite(radius) || radius <= 0) return (pois || []).filter(Boolean);
  const tolerance = Math.min(250, Math.max(100, radius * 0.03));
  const cap = radius + tolerance;
  return (pois || []).map(sanitizeRestaurantPoiNavigationPoint).filter((poi) => {
    const distance = restaurantPoiDistanceFromTarget(poi, target);
    return distance > 0 && distance <= cap;
  });
}

function filterRestaurantCardsWithinSearchRadius(cards, targetCoords, radiusMeters) {
  const target = normalizeCoord(targetCoords);
  const radius = Number(radiusMeters);
  if (!target || !Number.isFinite(radius) || radius <= 0) return (cards || []).filter(Boolean);
  const tolerance = Math.min(250, Math.max(100, radius * 0.03));
  const cap = radius + tolerance;
  return (cards || []).filter((card) => {
    const source = card && card.poi ? card.poi : card;
    const distance = restaurantPoiDistanceFromTarget(source, target);
    return distance > 0 && distance <= cap;
  });
}

function restaurantAllowedCityFromCoords(coords) {
  const center = normalizeCoord(coords);
  if (!center) return "";
  return restaurantCityLabelFromText([
    center.city,
    center.addressMeta,
    center.label
  ].filter(Boolean).join(" "));
}

function restaurantCityLabelsFromText(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  const labels = [];
  const seen = new Set();
  const push = (city) => {
    const label = restaurantCityLabelFromText(city);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  };
  const matches = text.match(/[\u4e00-\u9fa5]{2,}(?:市|自治州|地区|盟)/gu) || [];
  matches.forEach(push);
  if (labels.length) return labels;
  const direct = text.match(/(?:^|[\s,，。;；、])?(北京|上海|天津|重庆)(?=市|城区|市区|[区县路街道乡镇村]|$)/g) || [];
  direct.forEach((item) => push(String(item).replace(/^[\s,，。;；、]+/, "")));
  return labels;
}

function restaurantCityBaseName(city) {
  return String(city || "").replace(/(?:市|自治州|地区|盟)$/u, "");
}

function restaurantSameCity(left, right) {
  const a = restaurantCityLabelFromText(left);
  const b = restaurantCityLabelFromText(right);
  if (!a || !b) return false;
  return a === b || restaurantCityBaseName(a) === restaurantCityBaseName(b);
}

function restaurantPoiCityText(poi) {
  return [
    poi && poi.city,
    poi && poi.area,
    poi && poi.address,
    poi && poi.district,
    poi && poi.businessArea
  ].filter(Boolean).join(" ");
}

function restaurantPoiMatchesAllowedCity(poi, allowedCity) {
  const city = restaurantCityLabelFromText(allowedCity);
  if (!city) return true;
  const geoMatches = restaurantPoiWithinAllowedCityGeo(poi, city);
  const text = restaurantPoiCityText(poi);
  if (!text) return geoMatches;
  const labels = restaurantCityLabelsFromText(text);
  if (labels.length) return labels.some((label) => restaurantSameCity(label, city)) && geoMatches;
  return geoMatches;
}

function restaurantPoiWithinAllowedCityGeo(poi, allowedCity) {
  const city = restaurantCityLabelFromText(allowedCity);
  const bounds = city && RESTAURANT_CITY_GEO_BOUNDS[city];
  if (!bounds) return true;
  const point = restaurantPoiLocationPoint(poi) || restaurantNavigationPointForPoi(poi);
  if (!point) return true;
  return point.lat >= bounds.latMin
    && point.lat <= bounds.latMax
    && point.lng >= bounds.lngMin
    && point.lng <= bounds.lngMax;
}

function filterRestaurantPoisWithinAllowedCity(pois, allowedCity) {
  const city = restaurantCityLabelFromText(allowedCity);
  if (!city) return (pois || []).filter(Boolean);
  return (pois || []).filter((poi) => restaurantPoiMatchesAllowedCity(poi, city));
}

function filterRestaurantCardsWithinAllowedCity(cards, allowedCity) {
  const city = restaurantCityLabelFromText(allowedCity);
  if (!city) return (cards || []).filter(Boolean);
  return (cards || []).filter((card) => restaurantPoiMatchesAllowedCity(card && card.poi ? card.poi : card, city));
}

function isPreciseRestaurantSearchCenter(coords) {
  const center = normalizeCoord(coords);
  const label = String(center && center.label || "");
  return Boolean(
    center
    && (
      Number(center.accuracy) > 0
      || label === "当前位置"
      || /(?:街道|街|路|社区|小区|大厦|广场|商场|胡同|村|园区)/.test(label)
    )
  );
}

function restaurantHasTarget(options = {}) {
  return Boolean(options.destination || options.meetup || options.targetCoords);
}

function restaurantTargetLabel(options = {}) {
  if (options.meetup) return "折中点";
  const label = String(options.destination?.label || "目标").replace(/附近|周边|这边|那边/g, "").trim();
  return (label || "目标").slice(0, 6);
}

function metaTagText(item) {
  return typeof item === "string" ? item : String(item && item.text || "").trim();
}

function poiReason(p, options = {}) {
  if (p && p.meetup) {
    const balance = p.meetup.imbalance && p.meetup.imbalance < 2500 ? "两边到店时间比较接近" : "先把见面距离压平";
    return `${restaurantMeetupReasonSubject(p)}的折中点找店，${balance}，再看口味、评分和人均。`;
  }
  const distanceText = restaurantTravelTags(p, options).slice(0, 3).map(metaTagText).join("，");
  const rating = p && p.rating ? `评分 ${p.rating}` : "";
  const cost = p && p.cost ? `人均 ${formatCost(p.cost)}` : "";
  return [distanceText || "离你不远", rating, cost].filter(Boolean).join("，") + "。先按真实附近餐厅推进，少一点纠结。";
}

async function enrichRestaurantTravelMetrics(pois, options = {}, setLoading) {
  const list = (pois || []).filter(Boolean).slice(0, AMAP_PRICE_POOL_SIZE);
  if (!list.length) return list;
  const top = list.slice(0, TOTAL);
  const rest = list.slice(TOTAL).map((poi) => addEstimatedRestaurantRoute(poi, options));
  const participants = await restaurantRouteParticipants(options);
  if (participants.length >= 2) {
    if (setLoading) setLoading("正在计算每个人到店时间", "正在确认每个人的距离、步行、驾车和地铁时间。", { done: 0, total: top.length });
    const enrichedTop = [];
    let done = 0;
    for (const poi of top) {
      try {
        const participantRoutes = await fetchRestaurantParticipantRouteMetrics(participants, poi);
        enrichedTop.push({ ...poi, participantRoutes });
      } catch (error) {
        console.warn("Restaurant participant route metrics unavailable", poi && poi.name, error);
        enrichedTop.push(addEstimatedRestaurantRoute(poi, options));
      } finally {
        done += 1;
        if (setLoading) setLoading("正在计算每个人到店时间", `第 ${done} 家已确认。`, { done, total: top.length });
      }
    }
    return [...enrichedTop, ...rest];
  }
  const origin = await restaurantRouteOrigin(options);
  if (!origin) return list.map((poi) => addEstimatedRestaurantRoute(poi, options));
  if (setLoading) setLoading("正在计算到店时间", "正在确认距离、步行、驾车和地铁时间。", { done: 0, total: top.length });
  let done = 0;
  const enrichedTop = await Promise.all(top.map(async (poi) => {
    try {
      const routeMetrics = await fetchRestaurantRouteMetrics(origin, poi);
      const fallbackDistance = restaurantDistanceFromPoi(poi, origin) || Number(poi.distance) || 0;
      const fallbackMetrics = restaurantEstimatedRouteMetrics(routeMetrics, fallbackDistance);
      return {
        ...addEstimatedRestaurantRoute(poi, options),
        routeMetrics: {
          ...(routeMetrics || {}),
          ...fallbackMetrics,
          distanceMeters: routeMetrics?.distanceMeters || fallbackDistance,
          estimatedRouteMetrics: Boolean(fallbackMetrics.estimated)
        }
      };
    } catch (error) {
      console.warn("Restaurant route metrics unavailable", poi && poi.name, error);
      return addEstimatedRestaurantRoute(poi, options);
    } finally {
      done += 1;
      if (setLoading) setLoading("正在计算到店时间", `第 ${done} 家已确认。`, { done, total: top.length });
    }
  }));
  return [...enrichedTop, ...rest];
}

function addEstimatedRestaurantRoute(poi, options = {}) {
  if (!poi) return poi;
  if (poi.meetup && !Array.isArray(poi.participantRoutes)) {
    const routes = (poi.meetup.participantDistances || []).map((item, index) => {
      const metrics = restaurantEstimatedRouteMetrics(null, item.distance || 0);
      const placeLabel = restaurantShortPlaceLabel(item.placeLabel || item.label) || cleanParticipantLabel(item.label, index);
      return { ...metrics, label: placeLabel, placeLabel, straightDistanceMeters: item.distance || 0, distanceMeters: item.distance || 0 };
    });
    return { ...poi, participantRoutes: routes };
  }
  if (poi.routeMetrics) return poi;
  const distance = restaurantDistanceFromPoi(poi, options.userCoords) || Number(poi.distance) || 0;
  return distance ? { ...poi, routeMetrics: { distanceMeters: distance, ...restaurantEstimatedRouteMetrics(null, distance), estimatedRouteMetrics: true } } : poi;
}

async function restaurantRouteParticipants(options = {}) {
  const participants = Array.isArray(options.meetup?.participants) ? options.meetup.participants : [];
  if (participants.length < 2) return [];
  return participants.slice(0, 6).map((participant, index) => {
    const location = normalizeCoord(participant && participant.location);
    if (!location) return null;
    const placeLabel = restaurantShortPlaceLabel(participant.placeLabel || location.label || participant.label);
    return {
      label: placeLabel || cleanParticipantLabel(participant.label, index),
      placeLabel,
      travels: Array.isArray(participant.travels) ? participant.travels : [],
      location: { ...location, amap: true, label: placeLabel || location.label || participant.label || "" }
    };
  }).filter(Boolean);
}

async function restaurantRouteOrigin(options = {}) {
  const origin = normalizeCoord(options.userCoords || options.searchCoords || options.destination?.searchCoords || options.meetup?.searchCoords);
  return origin && restaurantValidCoords(origin) ? origin : null;
}

async function fetchRestaurantParticipantRouteMetrics(participants, poi) {
  const routes = [];
  for (const participant of participants) {
    try {
      const metrics = await fetchRestaurantRouteMetrics(participant.location, poi);
      const fallbackDistance = restaurantDistanceFromPoi(poi, participant.location);
      const fallbackMetrics = restaurantEstimatedRouteMetrics(metrics, fallbackDistance);
      routes.push({
        label: participant.label,
        placeLabel: participant.placeLabel,
        preferredModes: Array.isArray(participant.travels) ? participant.travels : [],
        distanceMeters: metrics?.distanceMeters || fallbackDistance,
        straightDistanceMeters: metrics?.straightDistanceMeters || fallbackDistance,
        walkingDistanceMeters: metrics?.walkingDistanceMeters || fallbackMetrics.walkingDistanceMeters || 0,
        walkingDurationSeconds: metrics?.walkingDurationSeconds || fallbackMetrics.walkingDurationSeconds || 0,
        drivingDistanceMeters: metrics?.drivingDistanceMeters || fallbackMetrics.drivingDistanceMeters || 0,
        drivingDurationSeconds: metrics?.drivingDurationSeconds || fallbackMetrics.drivingDurationSeconds || 0,
        subwayDistanceMeters: metrics?.subwayDistanceMeters || fallbackMetrics.subwayDistanceMeters || 0,
        subwayWalkingDistanceMeters: metrics?.subwayWalkingDistanceMeters || fallbackMetrics.subwayWalkingDistanceMeters || 0,
        subwayDurationSeconds: metrics?.subwayDurationSeconds || fallbackMetrics.subwayDurationSeconds || 0,
        hasSubway: Boolean(metrics?.hasSubway || fallbackMetrics.hasSubway),
        estimatedRouteMetrics: Boolean(fallbackMetrics.estimated)
      });
    } catch (error) {
      console.warn("Restaurant participant route metric unavailable", participant && participant.label, error);
      const fallbackDistance = restaurantDistanceFromPoi(poi, participant.location);
      if (fallbackDistance) {
        const fallbackMetrics = restaurantEstimatedRouteMetrics(null, fallbackDistance);
        routes.push({
          ...fallbackMetrics,
          label: participant.label,
          placeLabel: participant.placeLabel || participant.label,
          preferredModes: Array.isArray(participant.travels) ? participant.travels : [],
          distanceMeters: fallbackDistance,
          straightDistanceMeters: fallbackDistance,
          estimatedRouteMetrics: true
        });
      }
    }
  }
  return routes.filter(Boolean);
}

async function fetchRestaurantRouteMetrics(origin, poi) {
  const destination = normalizeCoord(restaurantNavigationPointForPoi(poi));
  if (!restaurantValidCoords(origin) || !restaurantValidCoords(destination)) return null;
  const straightDistanceMeters = restaurantDistanceFromPoi(poi, origin);
  const [walkingResult, drivingResult, subwayResult] = await Promise.allSettled([
    fetchAmapRouteMetric("walking", origin, destination),
    fetchAmapRouteMetric("driving", origin, destination),
    fetchAmapSubwayTransitMetric(origin, destination)
  ]);
  const walking = walkingResult.status === "fulfilled" ? walkingResult.value : null;
  const driving = drivingResult.status === "fulfilled" ? drivingResult.value : null;
  const subway = subwayResult.status === "fulfilled" ? subwayResult.value : null;
  const distanceMeters = straightDistanceMeters || walking?.distanceMeters || driving?.distanceMeters || subway?.distanceMeters;
  if (!distanceMeters && !walking?.durationSeconds && !driving?.durationSeconds && !subway?.durationSeconds) return null;
  return {
    distanceMeters,
    straightDistanceMeters,
    walkingDistanceMeters: walking?.distanceMeters || 0,
    walkingDurationSeconds: walking?.durationSeconds || 0,
    drivingDistanceMeters: driving?.distanceMeters || 0,
    drivingDurationSeconds: driving?.durationSeconds || 0,
    subwayDistanceMeters: subway?.distanceMeters || 0,
    subwayWalkingDistanceMeters: subway?.walkingDistanceMeters || 0,
    subwayDurationSeconds: subway?.durationSeconds || 0,
    hasSubway: Boolean(subway?.hasSubway)
  };
}

async function fetchAmapRouteMetric(mode, origin, destination) {
  const endpoint = mode === "driving" ? "https://restapi.amap.com/v3/direction/driving" : "https://restapi.amap.com/v3/direction/walking";
  const data = await amapRequest(endpoint, {
    key: AMAP_WEB_SERVICE_KEY,
    origin: amapLngLat(origin),
    destination: amapLngLat(destination),
    extensions: mode === "driving" ? "base" : "",
    output: "json"
  });
  if (data.status !== "1") throw new Error(data.info || "高德路径规划失败");
  const path = Array.isArray(data.route?.paths) ? data.route.paths[0] : null;
  const distanceMeters = Math.round(Number(path?.distance) || 0);
  const durationSeconds = Math.round(Number(path?.duration) || 0);
  return { distanceMeters, durationSeconds };
}

async function fetchAmapSubwayTransitMetric(origin, destination) {
  const city = await restaurantRouteCity(origin);
  if (!city) return null;
  const cityd = await restaurantRouteCity(destination);
  const params = {
    key: AMAP_WEB_SERVICE_KEY,
    origin: amapLngLat(origin),
    destination: amapLngLat(destination),
    city,
    strategy: "0",
    nightflag: "0",
    output: "json"
  };
  if (cityd && cityd !== city) params.cityd = cityd;
  const data = await amapRequest("https://restapi.amap.com/v3/direction/transit/integrated", params);
  if (data.status !== "1") throw new Error(data.info || "高德公交路径规划失败");
  const transits = Array.isArray(data.route?.transits) ? data.route.transits : [];
  const plans = transits
    .map(parseAmapTransitMetric)
    .filter((item) => item.durationSeconds)
    .sort((a, b) => a.durationSeconds - b.durationSeconds);
  return plans.find((item) => item.hasSubway) || plans[0] || null;
}

function parseAmapTransitMetric(transit) {
  const subwayLine = firstSubwayLineName(transit);
  return {
    distanceMeters: Math.round(Number(transit && transit.distance) || 0),
    walkingDistanceMeters: Math.round(Number(transit && transit.walking_distance) || 0),
    durationSeconds: Math.round(Number(transit && transit.duration) || 0),
    hasSubway: Boolean(subwayLine),
    subwayLine
  };
}

function firstSubwayLineName(transit) {
  const segments = Array.isArray(transit && transit.segments) ? transit.segments : [];
  for (const segment of segments) {
    const buslines = Array.isArray(segment?.bus?.buslines) ? segment.bus.buslines : [];
    for (const line of buslines) {
      const text = `${line?.type || ""} ${line?.name || ""}`;
      if (/地铁|轨道交通|轻轨|磁悬浮|subway|metro/i.test(text)) return String(line?.name || line?.type || "地铁").split("(")[0].slice(0, 10);
    }
    const railway = segment?.railway;
    const railwayText = `${railway?.type || ""} ${railway?.name || ""}`;
    if (/地铁|轨道交通|轻轨|磁悬浮|subway|metro/i.test(railwayText)) return String(railway?.name || railway?.type || "地铁").slice(0, 10);
  }
  return "";
}

async function restaurantRouteCity(coords) {
  const labeled = restaurantCityLabelFromText(coords && (coords.label || coords.city) || "");
  if (labeled) return labeled;
  if (!restaurantValidCoords(coords)) return "";
  const key = `${Number(coords.lat).toFixed(3)},${Number(coords.lng).toFixed(3)}`;
  if (restaurantRouteCityCache.has(key)) return restaurantRouteCityCache.get(key);
  const promise = restaurantGeocodeCity(coords).catch((error) => {
    console.warn("Restaurant route city unavailable", error);
    return "";
  });
  restaurantRouteCityCache.set(key, promise);
  const city = await promise;
  restaurantRouteCityCache.set(key, city || "");
  return city || "";
}

async function restaurantGeocodeCity(coords) {
  const data = await amapRequest("https://restapi.amap.com/v3/geocode/regeo", {
    key: AMAP_WEB_SERVICE_KEY,
    location: amapLngLat(coords),
    extensions: "base",
    output: "json"
  });
  const component = data.regeocode && data.regeocode.addressComponent || {};
  const city = amapAddressText(component.city) || amapAddressText(component.province);
  return restaurantCityLabelFromText(city);
}

function amapLngLat(coords) {
  return `${Number(coords.lng).toFixed(6)},${Number(coords.lat).toFixed(6)}`;
}

function restaurantValidCoords(coords) {
  return Number.isFinite(Number(coords && coords.lat)) && Number.isFinite(Number(coords && coords.lng));
}

function restaurantEstimatedRouteMetrics(metrics = null, fallbackDistance = 0) {
  if (metrics?.walkingDurationSeconds || metrics?.drivingDurationSeconds || metrics?.subwayDurationSeconds) return {};
  const distance = Math.round(Number(metrics?.distanceMeters || metrics?.straightDistanceMeters || fallbackDistance) || 0);
  if (!distance) return {};
  const drivingDistanceMeters = Math.round(distance * 1.25);
  const subwayDistanceMeters = distance >= 1500 ? Math.round(distance * 1.35) : 0;
  const subwayWalkingDistanceMeters = subwayDistanceMeters ? Math.round(Math.min(1800, Math.max(450, distance * 0.12))) : 0;
  const walkingDistanceMeters = distance <= 1000 ? distance : 0;
  return {
    walkingDistanceMeters,
    walkingDurationSeconds: walkingDistanceMeters ? Math.round((walkingDistanceMeters / 75) * 60) : 0,
    drivingDistanceMeters,
    drivingDurationSeconds: Math.max(4 * 60, Math.round((drivingDistanceMeters / 1000 / 22) * 3600)),
    subwayDistanceMeters,
    subwayWalkingDistanceMeters,
    subwayDurationSeconds: subwayDistanceMeters ? Math.max(14 * 60, Math.round((subwayDistanceMeters / 1000 / 28) * 3600 + subwayWalkingDistanceMeters / 75 * 60 + 7 * 60)) : 0,
    hasSubway: Boolean(subwayDistanceMeters),
    estimated: true
  };
}

function restaurantDetailPayloadForPoi(poi = {}, { photoGallery = [], photoItems = [] } = {}) {
  const routeTags = restaurantTravelTags(poi).map(metaTagText).filter(Boolean);
  const rating = poi.rating ? `${poi.rating}分` : "";
  const cost = poi.cost ? `${formatCost(poi.cost)}元` : "";
  const openTimeText = compactDetailText(poi.opentimeToday || poi.opentimeWeek || "营业以高德为准", 18);
  const primaryDistance = primaryDetailDistanceText(poi, routeTags) || "距离待算";
  const photos = detailPhotoItemsForPoi(poi, photoItems.length ? photoItems : photoGallery);
  const menuDishes = restaurantDishHintsForPoi(poi);
  const features = uniqueKeywords([...menuDishes, ...restaurantFeatureTagsForPoi(poi)]).slice(0, 12);
  return {
    openTimeText,
    photos,
    facts: [
      { label: "距离", value: primaryDistance },
      { label: "评分", value: rating || "暂无" },
      { label: "人均", value: cost || "暂无" },
      { label: "营业", value: openTimeText }
    ],
    features,
    routes: detailRouteRowsForPoi(poi, routeTags),
    rows: detailRowsForPoi(poi)
  };
}

function detailPhotoItemsForPoi(poi = {}, photoGallery = []) {
  return restaurantCardImages({
    ...poi,
    photoItems: [
      ...(photoGallery || []),
      ...(poi.photoItems || []),
      ...(poi.photos || []),
      poi.image
    ].filter(Boolean)
  }, poi.fallbackImage || "").slice(0, 6).map((item) => ({
    url: item.url,
    label: item.label || restaurantPhotoKindLabel(item.kind, item.label)
  }));
}

function primaryDetailDistanceText(poi = {}, routeText = []) {
  const participantDistances = Array.isArray(poi.participantRoutes)
    ? poi.participantRoutes.slice(0, 2).map((route) => formatDistance(restaurantRouteDisplayDistanceMeters(route))).filter(Boolean)
    : [];
  if (participantDistances.length >= 2) return participantDistances.join(" / ");
  if (participantDistances.length === 1) return participantDistances[0];
  if (poi.routeMetrics) {
    const distance = formatDistance(restaurantRouteDisplayDistanceMeters(poi.routeMetrics));
    if (distance) return distance;
  }
  const text = (routeText || []).find((item) => /离你|距|你：|朋友：/.test(item)) || routeText[0] || "";
  return String(text || "").split(/[·；;]/)[0].replace(/^你：/, "").replace(/^朋友：/, "").trim();
}

function restaurantFeatureTagsForPoi(poi = {}) {
  const rawTags = [poi.tag, poi.recommend, poi.keytag, poi.rectag, poi.searchKeyword].join(" ");
  const tags = uniqueKeywords(rawTags.split(/[、,，;；/|\s]+/).filter(Boolean))
    .filter((tag) => !["餐厅", "美食", "附近真实餐厅"].includes(tag))
    .slice(0, 6);
  if (tags.length) return tags;
  return uniqueKeywords(String(poi.type || "").split(/[;、,，/|\s]+/).filter(Boolean)).slice(0, 3);
}

function restaurantDishHintsForPoi(poi = {}) {
  const photoTitles = (Array.isArray(poi.photoItems) ? poi.photoItems : [])
    .filter((item) => item && (item.kind === "food" || item.kind === "drink" || item.kind === "menu"))
    .map((item) => item.title || item.label || "");
  return normalizeRestaurantDishTokens([
    poi.menuItems,
    poi.menu,
    poi.menus,
    poi.dishes,
    poi.dish,
    poi.specialDishes,
    poi.specialDish,
    poi.foods,
    poi.recommendDishes,
    poi.recommend,
    poi.tag,
    poi.keytag,
    poi.rectag,
    photoTitles
  ], 12);
}

function normalizeRestaurantDishTokens(values, limit = 12) {
  const text = normalizeRestaurantDetailList(values).join("、");
  const generic = new Set([
    "餐厅", "美食", "菜品", "菜单", "推荐", "特色", "环境", "门头", "图片", "饮品", "饮料",
    "中餐", "西餐", "快餐", "小吃", "附近真实餐厅", "午餐", "晚餐", "早餐",
    "restaurant", "food", "menu", "dish", "photo", "interior", "storefront"
  ]);
  const seen = new Set();
  return text
    .split(/[、,，;；/|｜\n\r\t]+|\s{2,}/)
    .map((item) => String(item || "").replace(/[【】\[\]()（）<>《》]/g, "").trim())
    .filter((item) => {
      if (!item || item.length < 2 || item.length > 18) return false;
      if (/^https?:\/\//i.test(item) || /^\d+(?:\.\d+)?$/.test(item)) return false;
      if (/[省市区县路街号层楼室]/.test(item) && item.length > 8) return false;
      const key = normalizeMatchText(item);
      if (!key || generic.has(item) || generic.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function detailRouteRowsForPoi(poi = {}, routeTags = []) {
  const meetupRows = restaurantMeetupRouteItems(poi).map((item) => ({
    label: item.label,
    long: item.long,
    stats: detailRouteStatsFromText(item.text, item.label)
  })).filter((item) => item.stats.length);
  if (meetupRows.length >= 2) return meetupRows;
  const participantRows = Array.isArray(poi.participantRoutes) ? poi.participantRoutes.slice(0, 2).map((route, index) => {
    const stats = detailRouteStatsFromMetric(route);
    return stats.length ? { label: restaurantRoutePlaceLabel(route, index), stats } : null;
  }).filter(Boolean) : [];
  if (participantRows.length) return participantRows;
  if (poi.routeMetrics) {
    const stats = detailRouteStatsFromMetric(poi.routeMetrics);
    if (stats.length) return [{ label: "你", stats }];
  }
  return (routeTags || []).filter(Boolean).slice(0, 2).map((text, index) => ({ label: index ? "路线" : "距离", stats: [text] }));
}

function detailRouteStatsFromText(text = "", label = "") {
  const body = String(text || "").replace(new RegExp(`^${escapeRegExp(String(label || ""))}\\s*[：:]\\s*`), "").trim();
  return body ? body.split(/\s*·\s*/).filter(Boolean) : [];
}

function detailRouteStatsFromMetric(route = {}) {
  return restaurantRouteStatTexts(route, { prefixDistance: true });
}

function detailRowsForPoi(poi = {}) {
  const address = [poi.area, poi.businessArea, poi.address].filter(Boolean).join(" · ");
  const phone = String(poi.tel || "").replace(/;/g, "；");
  return [
    { label: "地址", value: address || "暂无地址", wide: true },
    { label: "电话", value: phone || "高德暂无电话", wide: phone.length > 16 },
    { label: "位置", value: poi.businessArea || poi.area || poi.type || "暂无区域" },
    { label: "用户评价", value: poi.rating ? `高德评分 ${poi.rating}，评论正文暂无公开字段` : "评论正文暂无公开字段", wide: true, secondary: true },
    { label: "实时排队", value: "公开接口暂无排队字段", secondary: true },
    { label: "历史评价", value: "公开接口暂无评价明细", secondary: true }
  ];
}

function compactDetailText(value, limit = 12) {
  const text = String(value || "").replace(/\s+/g, "").replace(/;/g, "；");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function cleanParticipantLabel(label, index = 0) {
  if (isRestaurantPositionLabel(label)) return "位置";
  const cleaned = restaurantShortPlaceLabel(label) || String(label || "").replace(/附近|周边|折中点|当前位置/g, "").trim();
  const key = normalizeMatchText(cleaned);
  if (/^(你|我|本人)$/.test(key)) return "你";
  if (/朋友|对象|男朋友|女朋友|男友|女友|对方|同事|客户|同学|室友|搭子|伙伴/.test(cleaned)) return cleaned.slice(0, 4);
  if (cleaned && cleaned.length <= 8) return cleaned;
  return ["同伴1", "同伴2", "同伴3", "同伴4"][index] || `同伴${index + 1}`;
}

function restaurantMeetupReasonSubject(p) {
  const routeLabels = Array.isArray(p && p.participantRoutes)
    ? p.participantRoutes.slice(0, 2).map((route, index) => restaurantRoutePlaceLabel(route, index)).filter(Boolean)
    : [];
  const labels = routeLabels.length >= 2
    ? routeLabels
    : (p && p.meetup && p.meetup.participantDistances || []).slice(0, 2).map((item, index) => cleanParticipantLabel(item.label, index)).filter(Boolean);
  if (labels.includes("你") && labels.includes("朋友")) return "按你和朋友";
  if (labels.length >= 2) return `按${labels.join("和")}`;
  return "按两边";
}

function amapStoreUrl(poi = {}) {
  return `https://www.amap.com/search?query=${encodeURIComponent(poi.name || "餐厅")}`;
}

function foodEmojiForPoi(p) {
  const text = `${p && p.name || ""} ${p && p.type || ""}`;
  if (/寿司|日料|料理|刺身/.test(text)) return "🍣";
  if (/牛排|西餐|bistro|法餐/i.test(text)) return "🥩";
  if (/咖啡|甜品|蛋糕/.test(text)) return "🍰";
  if (/酒|居酒屋|烧鸟/.test(text)) return "🍶";
  if (/面|粉|拉面/.test(text)) return "🍜";
  if (/火锅|麻辣|川|湘|串串|烤鱼/.test(text)) return "🍲";
  return "🍽️";
}

function fallbackImageForPoi(p, index) {
  const text = `${p && p.name || ""} ${p && p.type || ""}`;
  if (/寿司|日料|料理|刺身|烧鸟|居酒屋/.test(text)) return "/assets/food/sushi.jpg";
  if (/牛排|西餐|bistro|法餐|意面|披萨/i.test(text)) return "/assets/food/steak.jpg";
  if (/酒|居酒屋|烧鸟/.test(text)) return "/assets/food/izakaya.jpg";
  if (/面|粉|拉面|意面/.test(text)) return "/assets/food/pasta.jpg";
  if (/火锅|麻辣|川|湘|串串|烤鱼|辣/.test(text)) return "/assets/food/hot-noodles.jpg";
  return FALLBACK_FOOD_IMAGES[index % FALLBACK_FOOD_IMAGES.length];
}

function artThemeForPoi(p, index) {
  const text = `${p && p.name || ""} ${p && p.type || ""}`;
  const found = ART_THEMES.find((item) => item.match.test(text));
  return found || DEFAULT_ART_THEMES[index % DEFAULT_ART_THEMES.length];
}

function formatDistance(distance) {
  const value = Number(distance);
  if (!Number.isFinite(value) || value <= 0) return "";
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 3000 ? 0 : 1)}km` : `${Math.round(value)}m`;
}

function formatCost(cost) {
  const value = readCostValue(cost);
  return Number.isFinite(value) ? String(Math.round(value)) : "";
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分` : `${hours}小时`;
}

function topRatingPois(pois) {
  return uniquePois(pois).filter(Boolean).sort(comparePoiRatingDesc);
}

function comparePoiRatingDesc(a, b) {
  const ratingDiff = readRatingValue(b && b.rating) - readRatingValue(a && a.rating);
  if (Number.isFinite(ratingDiff) && ratingDiff !== 0) return ratingDiff;
  return (Number(a && a.distance) || Infinity) - (Number(b && b.distance) || Infinity);
}

function readRatingValue(value) {
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : -1;
}

function randomPick(items, count) {
  const arr = (items || []).filter(Boolean).slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = arr[i];
    arr[i] = arr[j];
    arr[j] = swap;
  }
  return arr.slice(0, count);
}

function diverseRestaurantPois(pois, limit = AMAP_PRICE_POOL_SIZE) {
  const sorted = uniquePois(pois).filter(Boolean).sort(compareRestaurantCandidate);
  const buckets = new Map();
  sorted.forEach((poi) => {
    const bucket = restaurantDiversityBucket(poi);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(poi);
  });
  const bucketEntries = Array.from(buckets.entries()).sort((a, b) => restaurantCandidateScore(b[1][0]) - restaurantCandidateScore(a[1][0]));
  const selected = [];
  const usedIds = new Set();
  const usedNames = new Set();
  for (let pass = 0; pass < 2 && selected.length < limit; pass += 1) {
    let took = true;
    while (took && selected.length < limit) {
      took = false;
      for (const [, list] of bucketEntries) {
        const next = list.find((poi) => {
          const id = String(poi.id || poi.name || "");
          if (!id || usedIds.has(id)) return false;
          const nameKey = restaurantBrandKey(poi.name);
          return pass > 0 || !nameKey || !usedNames.has(nameKey);
        });
        if (!next) continue;
        selected.push(next);
        usedIds.add(String(next.id || next.name));
        const nameKey = restaurantBrandKey(next.name);
        if (nameKey) usedNames.add(nameKey);
        took = true;
        if (selected.length >= limit) break;
      }
    }
  }
  if (selected.length < limit) {
    sorted.forEach((poi) => {
      const id = String(poi.id || poi.name || "");
      if (id && !usedIds.has(id) && selected.length < limit) {
        selected.push(poi);
        usedIds.add(id);
      }
    });
  }
  return selected.slice(0, limit);
}

function restaurantDiversityBucket(poi) {
  const text = `${poi && poi.searchKeyword || ""} ${poi && poi.name || ""} ${poi && poi.type || ""}`.toLowerCase();
  if (/火锅|川|湘|辣|麻辣|串串|烤鱼/.test(text)) return "辣味";
  if (/日料|日本|寿司|烧鸟|居酒屋|刺身|拉面/.test(text)) return "日料";
  if (/西餐|牛排|bistro|法餐|意面|披萨|brunch|早午餐/i.test(text)) return "西餐";
  if (/粤|港|茶餐|点心|本帮|江浙|中餐|私房/.test(text)) return "中餐";
  if (/韩餐|韩国|烤肉/.test(text)) return "韩餐";
  if (/泰|东南亚|越南/.test(text)) return "东南亚";
  if (/海鲜|鱼|蟹|虾/.test(text)) return "海鲜";
  if (/咖啡|甜品|蛋糕|酒吧|小酒馆/.test(text)) return "轻食酒咖";
  return poi && poi.searchKeyword && poi.searchKeyword !== RESTAURANT_KEYWORD_FALLBACK ? `关键词:${poi.searchKeyword}` : String(poi && poi.type || "餐厅");
}

function restaurantBrandKey(name) {
  return normalizeMatchText(String(name || "").replace(/[（(].*?[）)]/g, "").replace(/·.*$/g, "")).slice(0, 12);
}

function compareRestaurantCandidate(a, b) {
  const scoreDiff = restaurantCandidateScore(b) - restaurantCandidateScore(a);
  if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
  return comparePoiCostDesc(a, b);
}

function restaurantCandidateScore(poi) {
  const rating = Number(poi && poi.rating) || 0;
  const cost = readCostValue(poi && poi.cost);
  const distance = Number(poi && poi.distance) || 99999;
  const costScore = Number.isFinite(cost) ? Math.min(cost, 500) / 35 : 0;
  const distancePenalty = Math.min(distance, 8000) / 1200;
  const meetupPenalty = poi && poi.meetup ? (Math.min(poi.meetup.maxDistance || 0, 18000) / 1800) + (Math.min(poi.meetup.imbalance || 0, 12000) / 3000) : 0;
  return rating * 8 + costScore - distancePenalty - meetupPenalty;
}

function comparePoiCostDesc(a, b) {
  const costDiff = readCostValue(b && b.cost) - readCostValue(a && a.cost);
  if (Number.isFinite(costDiff) && costDiff !== 0) return costDiff;
  return (Number(a && a.distance) || Infinity) - (Number(b && b.distance) || Infinity);
}

function uniquePois(pois) {
  const seen = new Set();
  return (pois || []).filter((poi) => {
    const key = String((poi && poi.id) || (poi && poi.name) || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRestaurantReplayKeySet(keys = []) {
  if (keys instanceof Set) return new Set(Array.from(keys).map(normalizeRestaurantReplayKey).filter(Boolean));
  return new Set((Array.isArray(keys) ? keys : [keys]).map(normalizeRestaurantReplayKey).filter(Boolean));
}

function normalizeRestaurantReplayKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(id|text):/.test(text)) return text;
  return `text:${normalizeMatchText(text)}`;
}

function restaurantCardReplayKey(item = {}) {
  const source = item.poi && typeof item.poi === "object" ? item.poi : item;
  const id = String(source.id || item.id || "").trim();
  if (id) return `id:${id}`;
  const text = [source.name || item.name, source.address || item.address, source.area || item.area, source.businessArea || item.businessArea]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("|");
  return text ? `text:${normalizeMatchText(text)}` : "";
}

function sameRestaurantCoords(a, b) {
  const left = normalizeCoord(a);
  const right = normalizeCoord(b);
  if (!left || !right) return false;
  return Math.abs(left.lat - right.lat) < 0.0005 && Math.abs(left.lng - right.lng) < 0.0005;
}

function restaurantDistanceMeters(a, b) {
  const lat1 = Number(a && a.lat), lng1 = Number(a && a.lng), lat2 = Number(b && b.lat), lng2 = Number(b && b.lng);
  if ([lat1, lng1, lat2, lng2].some((value) => !Number.isFinite(value))) return 999999;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function rankRestaurantPoisForMeetup(pois, meetup) {
  if (!meetup || !meetup.participants || !meetup.participants.length) return pois;
  return (pois || []).map((poi) => withRestaurantMeetupMetrics(poi, meetup)).sort(compareRestaurantCandidate);
}

function withRestaurantMeetupMetrics(poi, meetup) {
  if (!poi || !poi.location || !meetup || !meetup.participants || !meetup.participants.length) return poi;
  const participantDistances = meetup.participants.map((participant) => ({
    label: participant.label,
    placeLabel: participant.placeLabel,
    distance: Math.round(restaurantDistanceMeters(participant.location, poi.location))
  })).filter((item) => Number.isFinite(item.distance));
  if (!participantDistances.length) return poi;
  const distances = participantDistances.map((item) => item.distance);
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances);
  const avgDistance = Math.round(distances.reduce((sum, value) => sum + value, 0) / distances.length);
  const participantLabels = uniqueRestaurantMiddlePointLabels([
    ...(Array.isArray(meetup.participantLabels) ? meetup.participantLabels : []),
    ...String(meetup.label || "").split(/[\/、,，]+/),
    ...participantDistances.map((item) => item.placeLabel || item.label)
  ].map(restaurantMiddlePointDisplayLabel));
  return { ...poi, meetup: { label: meetup.label, participantLabels, participantDistances, maxDistance, minDistance, avgDistance, imbalance: maxDistance - minDistance } };
}

async function resolveRestaurantDestinationContext(coords, searchPlan, choice) {
  const hint = restaurantDestinationHint(searchPlan, choice);
  if (!hint) return null;
  const point = await geocodeRestaurantLocationHint(hint, coords);
  if (!point) return null;
  return {
    strategy: "destination",
    label: hint,
    searchCoords: { ...point, label: `${hint}附近` },
    radiusMeters: searchPlan && searchPlan.radiusMeters || 3500
  };
}

function restaurantDestinationHint(searchPlan = {}, choice) {
  if (extractRestaurantParticipantTargetHints(choice).length >= 2) return "";
  if (shouldUseCurrentLocationForMeetup(choice, restaurantParticipantLocationHints(searchPlan, choice))) return "";
  const explicit = extractRestaurantDestinationHint(choice)?.name || "";
  const hint = cleanRestaurantDestinationHint(searchPlan.locationHint || searchPlan.destinationHint || searchPlan.destination || searchPlan.area || searchPlan.landmark || "");
  return explicit || hint;
}

// 从组局行里建"位置→出行方式(多选)"查表(供到达榜按个人指定方式展示)
function meetupTravelLookup(choice) {
  const rows = Array.isArray(choice && choice.multiAreaRows) ? choice.multiAreaRows : [];
  return rows
    .map((row) => ({ loc: normalizeMatchText(row.location || ""), role: String(row.role || ""), travels: Array.isArray(row.travels) ? row.travels : [] }))
    .filter((row) => row.travels.length);
}
function travelForHint(hint, lookup = []) {
  const key = normalizeMatchText(hint || "");
  if (!key) return [];
  const hit = lookup.find((row) => row.loc && (key.includes(row.loc) || row.loc.includes(key)));
  return hit ? hit.travels : [];
}
function travelForCurrentLocation(lookup = []) {
  const hit = lookup.find((row) => /我的位置|当前位置|位置|我/.test(row.role));
  return hit ? hit.travels : [];
}

async function resolveRestaurantMeetupContext(coords, searchPlan, choice) {
  const hints = restaurantParticipantLocationHints(searchPlan, choice);
  const currentPlusFriendMeetup = shouldUseCurrentLocationForMeetup(choice, hints);
  if (hints.length < 2 && !currentPlusFriendMeetup) return null;
  const travelLookup = meetupTravelLookup(choice);
  const participants = [];
  const expectedLabels = uniqueRestaurantMiddlePointLabels(hints.map(restaurantMiddlePointDisplayLabel));
  if (currentPlusFriendMeetup && coords) {
    const userPoint = normalizeCoord(coords);
    if (userPoint) {
      const sourceLabel = restaurantShortPlaceLabel(userPoint.addressMeta || userPoint.label) || "当前位置";
      participants.push({ label: "位置", placeLabel: "位置", sourceLabel, isCurrentLocation: true, travels: travelForCurrentLocation(travelLookup), location: { ...userPoint, amap: true, label: sourceLabel } });
    }
  }
  for (const hint of hints.slice(0, 4)) {
    const point = await geocodeRestaurantLocationHint(hint, coords);
    if (point && !participants.some((item) => sameRestaurantCoords(item.location, point))) {
      const placeLabel = restaurantParticipantDisplayLabel(hint, point);
      participants.push({ label: placeLabel, placeLabel, travels: travelForHint(hint, travelLookup), location: point });
    }
  }
  if (participants.length < 2) return null;
  const participantLabels = uniqueRestaurantMiddlePointLabels([
    ...(currentPlusFriendMeetup ? participants.slice(0, 1).map((item) => item.placeLabel || item.label) : []),
    ...expectedLabels,
    ...participants.map((item) => item.placeLabel || item.label)
  ].map(restaurantMiddlePointDisplayLabel));
  const displayLabel = (participantLabels.length >= 2 ? participantLabels : participants.map((item) => item.label)).join(" / ");
  const searchCoords = midpointRestaurantCoords(participants.map((item) => item.location));
  const spread = maxRestaurantPairDistance(participants.map((item) => item.location));
  const radiusMeters = restaurantMeetupRadiusForPoints(participants.map((item) => item.location));
  return {
    strategy: "midpoint",
    label: displayLabel,
    participantLabels,
    participants,
    searchCoords: { ...searchCoords, amap: true, label: `${displayLabel}折中点` },
    radiusMeters,
    spreadMeters: spread
  };
}

// 反查中间点所在商圈/街道名,用于「中间点 · 东大桥」标签
async function restaurantGeocodeAreaLabel(coords) {
  if (!restaurantValidCoords(coords)) return "";
  try {
    const data = await amapRequest("https://restapi.amap.com/v3/geocode/regeo", {
      key: AMAP_WEB_SERVICE_KEY,
      location: amapLngLat(coords),
      extensions: "all",
      output: "json"
    });
    const regeocode = data.regeocode || {};
    const component = regeocode.addressComponent || {};
    const businessAreas = Array.isArray(component.businessAreas) ? component.businessAreas : [];
    const business = businessAreas.map((item) => item && amapAddressText(item.name)).filter(Boolean)[0];
    if (business) return restaurantShortPlaceLabel(business) || business;
    const township = amapAddressText(component.township);
    if (township) return restaurantShortPlaceLabel(township) || township;
    return restaurantShortPlaceLabel(regeocode.formatted_address || "");
  } catch (error) {
    return "";
  }
}

// 组局房间结果态:每人位置→坐标→中间点→逐人到中间点的到达榜(收集完当场展示)
function meetupBoardRangeRadius(participants = []) {
  return restaurantMeetupRadiusForPoints(participants.map((item) => item && item.location));
}

function meetupLongDashPolylines(start, end, color) {
  const dashSlots = 9;
  const dashFill = 0.72;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lines = [];
  for (let slot = 0; slot < dashSlots; slot += 2) {
    const t0 = slot / dashSlots;
    const t1 = Math.min(1, (slot + dashFill) / dashSlots);
    lines.push({
      points: [
        {
          latitude: lerp(start.latitude, end.latitude, t0),
          longitude: lerp(start.longitude, end.longitude, t0)
        },
        {
          latitude: lerp(start.latitude, end.latitude, t1),
          longitude: lerp(start.longitude, end.longitude, t1)
        }
      ],
      color,
      width: 5,
      dottedLine: false,
      arrowLine: false
    });
  }
  const last = lines[lines.length - 1];
  if (last) last.points[1] = { latitude: end.latitude, longitude: end.longitude };
  return lines;
}

function meetupBoardMapGeometry(participants = [], middle = null, rangeRadius = 0, middleLabel = "") {
  if (!restaurantValidCoords(middle)) return { markers: [], polylines: [], circles: [], includePoints: [] };
  const validParticipants = (participants || []).filter((item) => restaurantValidCoords(item && item.location));
  const memberIcons = ["/assets/map/member-blue.png", "/assets/map/member-green.png", "/assets/map/member-coral.png"];
  const markers = validParticipants.map((item, index) => ({
    id: index + 1,
    latitude: item.location.lat,
    longitude: item.location.lng,
    iconPath: memberIcons[index % memberIcons.length],
    width: 34,
    height: 42,
    anchor: { x: 0.5, y: 1 },
    callout: { content: item.short || item.label || "成员", color: "#1a1714", display: "ALWAYS", fontSize: 11, padding: 4, borderRadius: 6, bgColor: "#fffdf6", borderColor: "#1a1714", borderWidth: 1 }
  }));
  markers.push({
    id: 900,
    latitude: middle.lat,
    longitude: middle.lng,
    iconPath: "/assets/map/midpoint-coral.png",
    width: 42,
    height: 50,
    anchor: { x: 0.5, y: 1 },
    callout: { content: middleLabel ? `中间点 · ${middleLabel}` : "中间点", color: "#ffffff", display: "ALWAYS", fontSize: 11, padding: 5, borderRadius: 8, bgColor: "#ff4d6d", borderColor: "#1a1714", borderWidth: 1 }
  });
  const polylines = validParticipants.flatMap((item, index) => meetupLongDashPolylines(
    { latitude: item.location.lat, longitude: item.location.lng },
    { latitude: middle.lat, longitude: middle.lng },
    index % 2 ? "#2e9f5bcc" : "#ff4d6dcc"
  ));
  const rawRadius = Number(rangeRadius);
  const radius = rawRadius > 0 ? clampRestaurantMeetupRadius(rawRadius) : 0;
  const circles = radius > 0 ? [{
    latitude: middle.lat,
    longitude: middle.lng,
    radius,
    color: "#f6c518cc",
    fillColor: "#00000000",
    strokeWidth: 4
  }] : [];
  const includePoints = [
    ...validParticipants.map((item) => ({ latitude: item.location.lat, longitude: item.location.lng })),
    { latitude: middle.lat, longitude: middle.lng }
  ];
  return { markers, polylines, circles, includePoints };
}

async function resolveMeetupRoomBoard(rows, coords) {
  const cleanRows = (Array.isArray(rows) ? rows : []).filter(Boolean);
  const participants = [];
  for (const row of cleanRows) {
    if (row.isHost && coords) {
      const userPoint = normalizeCoord(coords);
      if (userPoint && restaurantValidCoords(userPoint)) {
        const rawLabel = restaurantShortPlaceLabel(userPoint.addressMeta || userPoint.label);
        const hostLabel = (rawLabel && rawLabel !== "位置" && rawLabel.length >= 2) ? rawLabel : "我这边";
        participants.push({ label: hostLabel, placeLabel: hostLabel, short: "我", travels: Array.isArray(row.travels) ? row.travels : [], location: { ...userPoint } });
        continue;
      }
    }
    const hint = String(row.location || "").trim();
    if (!hint || isRestaurantCurrentLocationHint(hint)) continue;
    const point = await geocodeRestaurantLocationHint(hint, coords);
    if (point && restaurantValidCoords(point) && !participants.some((item) => sameRestaurantCoords(item.location, point))) {
      const placeLabel = restaurantParticipantDisplayLabel(hint, point);
      participants.push({ label: placeLabel, placeLabel, short: String(row.roleShort || placeLabel || "友").slice(0, 1), travels: Array.isArray(row.travels) ? row.travels : [], location: point });
    }
  }
  if (participants.length < 2) return null;
  const middle = midpointRestaurantCoords(participants.map((item) => item.location));
  if (!restaurantValidCoords(middle)) return null;
  const middlePoi = { location: { lat: middle.lat, lng: middle.lng }, lat: middle.lat, lng: middle.lng };
  const participantRoutes = await fetchRestaurantParticipantRouteMetrics(participants, middlePoi);
  const arrivalBoard = restaurantArrivalBoard({ participantRoutes });
  if (!arrivalBoard) return null;
  // 把每行的头像首字补上(到达榜默认用 label 首字,这里换成成员短名)
  arrivalBoard.rows.forEach((boardRow, index) => {
    if (participants[index] && participants[index].short) boardRow.short = participants[index].short;
  });
  const middleLabel = await restaurantGeocodeAreaLabel(middle);
  const rangeRadius = meetupBoardRangeRadius(participants);
  const mapGeometry = meetupBoardMapGeometry(participants, middle, rangeRadius, middleLabel);
  const farLabel = arrivalBoard.farthestLabel || "";
  const farMin = arrivalBoard.farthestMin || 0;
  let summary = arrivalBoard.summary;
  if (farLabel && farMin) {
    summary = `最远的${farLabel}也只要 ${farMin} 分钟到齐，谁都不亏`;
  }
  return {
    middle,
    middleLabel,
    arrivalBoard,
    markers: mapGeometry.markers,
    polylines: mapGeometry.polylines,
    circles: mapGeometry.circles,
    includePoints: mapGeometry.includePoints,
    rangeRadius,
    participantCount: participants.length,
    summary,
    headline: middleLabel ? `中间点定在${middleLabel}` : "已找到对谁都公平的中间点"
  };
}

function restaurantParticipantLocationHints(searchPlan = {}, choice) {
  const targetHints = extractRestaurantParticipantTargetHints(choice);
  const textHints = targetHints.length >= 2 ? targetHints : extractedRestaurantParticipantLocationNames(choice);
  return uniqueRestaurantLocationHints([
    ...normalizeRestaurantLocationHints(choice ? (choice.multiAreaLocationHints || (choice.multiAreaRows || []).map((row) => row && row.location)) : []),
    ...textHints,
    ...normalizeRestaurantLocationHints(searchPlan.locationHints || searchPlan.locations || searchPlan.participantLocations || searchPlan.meetingLocations),
  ]);
}

function restaurantParticipantDisplayLabel(hint, point) {
  const raw = String(hint || point && point.label || "").trim();
  if (!raw) return "同伴";
  const cleaned = restaurantShortPlaceLabel(raw) || raw.replace(/附近|周边|这边|那边/g, "").trim();
  return cleaned.length <= 5 ? cleaned : cleaned.slice(0, 5);
}

function restaurantShortPlaceLabel(value) {
  const text = String(value || "")
    .replace(/^中国/, "")
    .replace(/附近|周边|这边|那边|折中点|当前位置/g, "")
    .replace(/[，,。.!！?？；;:：]/g, " ")
    .trim();
  if (!text) return "";
  const explicit = text.match(/[\u4e00-\u9fa5A-Za-z0-9·\-]{2,10}(?:街|路|桥|站|宫|园|门|村|里|坊|城|谷|口|营|庄|寺|院|湖|湾|区|镇|乡|CBD)/g);
  const picked = explicit && explicit.length ? explicit[explicit.length - 1] : text.split(/[·\s/]+/).filter(Boolean).pop();
  const cleaned = String(picked || text)
    .replace(/^(?:北京市|上海市|广州市|深圳市|杭州市|成都市|重庆市|天津市|南京市|苏州市|武汉市|西安市)/, "")
    .replace(/^(?:朝阳区|海淀区|东城区|西城区|丰台区|石景山区|昌平区|通州区|大兴区)/, "")
    .trim();
  return cleaned.length <= 8 ? cleaned : cleaned.slice(0, 8);
}

function midpointRestaurantCoords(points) {
  const valid = (points || []).filter((point) => Number.isFinite(Number(point && point.lat)) && Number.isFinite(Number(point && point.lng)));
  const sum = valid.reduce((acc, point) => ({ lat: acc.lat + Number(point.lat), lng: acc.lng + Number(point.lng) }), { lat: 0, lng: 0 });
  return { lat: sum.lat / valid.length, lng: sum.lng / valid.length };
}

function maxRestaurantPairDistance(points) {
  let max = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) max = Math.max(max, restaurantDistanceMeters(points[i], points[j]));
  }
  return max;
}

function clampRestaurantMeetupRadius(radius) {
  const value = Math.round(Number(radius) || RESTAURANT_MEETUP_MIN_RADIUS);
  return Math.max(RESTAURANT_MEETUP_MIN_RADIUS, Math.min(RESTAURANT_MEETUP_MAX_RADIUS, value));
}

function restaurantMeetupRadiusForPoints(points = []) {
  const valid = (points || []).filter(restaurantValidCoords);
  if (valid.length < 2) return RESTAURANT_MEETUP_MIN_RADIUS;
  return clampRestaurantMeetupRadius(maxRestaurantPairDistance(valid) * RESTAURANT_MEETUP_RADIUS_RATIO);
}

async function geocodeRestaurantLocationHint(hint, coords) {
  if (isRestaurantCurrentLocationHint(hint)) return null;
  const cleaned = cleanRestaurantLocationHint(hint);
  if (!cleaned || /^(附近|周边|当前位置|当前城市)$/.test(cleaned) || isRestaurantCurrentLocationHint(cleaned)) return null;
  const city = coords
    ? restaurantCityLabelFromText([coords.city, coords.addressMeta, coords.label].filter(Boolean).join(" "))
    : "";
  const preferCity = city && !/(?:省|市|区|县)$/.test(cleaned);
  const attempts = preferCity ? [city, ""] : ["", city];
  for (const attemptCity of attempts.filter((item, index, arr) => index === arr.indexOf(item))) {
    try {
      const data = await amapRequest("https://restapi.amap.com/v3/geocode/geo", {
        key: AMAP_WEB_SERVICE_KEY,
        address: cleaned,
        city: attemptCity,
        output: "json"
      });
      const location = data.status === "1" && Array.isArray(data.geocodes) ? data.geocodes[0]?.location : "";
      const [lng, lat] = String(location || "").split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const geocode = data.geocodes[0] || {};
        const city = Array.isArray(geocode.city) ? geocode.city[0] : geocode.city;
        const district = Array.isArray(geocode.district) ? geocode.district[0] : geocode.district;
        return { lat, lng, latitude: lat, longitude: lng, amap: true, label: cleaned, city: city || "", addressMeta: [city, district, cleaned].filter(Boolean).join(" ") };
      }
    } catch (error) {
      console.warn("Amap location geocode unavailable", cleaned, attemptCity || "global", error);
    }
  }
  return null;
}

function restaurantCityLabelFromText(value) {
  const text = String(value || "").trim();
  if (!text || /^(当前|附近|周边|GPS|正在)/.test(text)) return "";
  const directCityMap = {
    北京: "北京市",
    上海: "上海市",
    天津: "天津市",
    重庆: "重庆市"
  };
  const directMatch = text.match(/^(北京|上海|天津|重庆)(?:市|城区|市区)?$/u)
    || text.match(/^(北京|上海|天津|重庆)(?=[市区县路街道乡镇村])/u);
  if (directMatch) return directCityMap[directMatch[1]];
  const match = text.match(/([\u4e00-\u9fa5]{2,}(?:市|自治州|地区|盟))/u);
  if (match) return match[1];
  return /(?:市|自治州|地区|盟)$/.test(text) ? text : "";
}

async function resolveRestaurantSearchCoords(coords, searchPlan) {
  const hint = cleanRestaurantLocationHint((searchPlan && searchPlan.locationHint) || "");
  if (!hint || /^(附近|周边|当前位置|当前城市)$/.test(hint) || isRestaurantCurrentLocationHint(hint)) return coords;
  return await geocodeRestaurantLocationHint(hint, coords) || coords;
}

async function buildRestaurantIntentPreview(choice, coords) {
  const center = normalizeCoord(coords);
  const plan = await restaurantSearchPlanForMode("AI 模式", choice, center);
  let destination = null;
  let meetup = null;
  try {
    destination = await resolveRestaurantDestinationContext(center, plan, choice);
    meetup = destination ? null : await resolveRestaurantMeetupContext(center, plan, choice);
  } catch (error) {
    console.warn("Restaurant intent preview location unavailable", error);
  }
  const middleText = restaurantPlanMiddleText(plan, choice, destination, meetup);
  const restaurantText = restaurantPlanRestaurantText(plan, choice);
  return {
    plan,
    details: [
      { label: "意图", value: restaurantPlanSceneText(plan, choice) },
      { label: "中间点", value: middleText, wide: middleText.length > 14 },
      { label: "餐厅类型", value: restaurantText, wide: true },
      { label: "价格", value: restaurantPlanBudgetText(plan) },
      { label: "位置距离", value: restaurantPlanLocationDistanceText(plan, destination, meetup, choice), wide: true }
    ].filter((item) => item.value),
    amapPreview: restaurantPlanAmapPreviewItems(plan, { coords: center, destination, meetup, choice })
  };
}

function restaurantPlanSceneText(plan = {}, choice = {}) {
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")}`;
  if (plan.sceneIntent && (plan.sceneIntent.primaryScenario || plan.sceneIntent.scenario)) return plan.sceneIntent.primaryScenario || plan.sceneIntent.scenario;
  if (/约会|对象|男朋友|女朋友|男友|女友|暧昧/.test(text)) return "约会吃饭";
  if (/朋友|聚餐|同事|同学|客户/.test(text)) return "朋友聚餐";
  if (/一个人|一人食|自己/.test(text)) return "一人食";
  if (/夜宵|宵夜|通宵|深夜/.test(text)) return "夜宵";
  return choice.scenes && choice.scenes[0] || (hasRestaurantMeetupIntent(choice) ? "朋友聚餐" : "吃饭选择");
}

function restaurantPlanMiddleText(plan = {}, choice = {}, destination = null, meetup = null) {
  if (destination) return `不取中间点，直接在${destination.label || plan.locationHint || "目的地"}附近找`;
  const pointLabels = restaurantMiddlePointLabels(plan, choice, meetup);
  if (pointLabels.length >= 2) return `按${pointLabels.join(" / ")}取中间点`;
  if (pointLabels.length === 1) return `不取中间点，直接在${pointLabels[0]}附近找`;
  if (needsRestaurantCompanionLocation(choice, plan)) return "还缺同伴位置，先按当前位置找";
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")}`;
  if (/折中|中间/.test(text)) return "取中间点，照顾多人位置";
  return "不取中间点，按当前位置找";
}

function restaurantMiddlePointLabels(plan = {}, choice = {}, meetup = null) {
  const hintLabels = restaurantParticipantLocationHints(plan, choice).map(restaurantMiddlePointDisplayLabel).filter(Boolean);
  if (plan.includeCurrentLocationInMeetup || shouldUseCurrentLocationForMeetup(choice, hintLabels)) return uniqueRestaurantMiddlePointLabels(["当前位置", ...hintLabels]);
  if (hintLabels.length >= 2) return uniqueRestaurantMiddlePointLabels(hintLabels);
  if (meetup && Array.isArray(meetup.participants) && meetup.participants.length) {
    return uniqueRestaurantMiddlePointLabels(meetup.participants.map((item) => restaurantMiddlePointDisplayLabel(item && (item.placeLabel || item.label))));
  }
  const hints = hintLabels;
  if (hints.length >= 2) return uniqueRestaurantMiddlePointLabels(hints);
  if (plan.locationHint || plan.region) return uniqueRestaurantMiddlePointLabels([restaurantMiddlePointDisplayLabel(plan.locationHint || plan.region)]);
  if (hints.length === 1 && !needsRestaurantCompanionLocation(choice, plan)) return uniqueRestaurantMiddlePointLabels(hints);
  return [];
}

function uniqueRestaurantMiddlePointLabels(labels = []) {
  const seen = new Set();
  return (labels || []).map((label) => String(label || "").trim()).filter(Boolean).filter((label) => {
    const key = normalizeMatchText(label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function restaurantMiddlePointDisplayLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(当前位置|当前定位|你的位置|我的位置|我)$/.test(text)) return "当前位置";
  return restaurantShortPlaceLabel(text) || text.replace(/附近|周边|这边|那边/g, "").trim();
}

function restaurantPlanRestaurantText(plan = {}, choice = {}) {
  const foodTags = (choice.tags || []).filter((tag) => PRIORITY_TAGS.has(tag)).join("、");
  const keywords = (plan.keywords || []).filter((keyword) => keyword && keyword !== RESTAURANT_KEYWORD_FALLBACK).slice(0, 3).join("、");
  const typeText = [plan.restaurantTypeIntent && (plan.restaurantTypeIntent.primaryType || plan.restaurantTypeIntent.type), plan.restaurantTypeIntent && plan.restaurantTypeIntent.keywords].flat().filter(Boolean).join("、");
  return uniqueKeywords([foodTags, typeText, keywords].map((item) => String(item || "").trim()).filter(Boolean)).slice(0, 2).join("；") || "餐厅";
}

function restaurantPlanBudgetText(plan = {}) {
  if (plan.minCost && plan.maxCost) return `人均约${plan.minCost}-${plan.maxCost}元`;
  if (plan.minCost) return `人均约${plan.minCost}元起`;
  return "按普通正餐预算";
}

function restaurantPlanLocationDistanceText(plan = {}, destination = null, meetup = null, choice = {}) {
  if (meetup) {
    const labels = restaurantMiddlePointLabels(plan, choice, meetup);
    const prefix = labels.length >= 2 ? `按${labels.join(" / ")}取中间点` : "";
    const spreadName = labels.length > 2 || (meetup.participants && meetup.participants.length > 2) ? "最远相距" : "两边相距";
    const spread = meetup.spreadMeters ? `${spreadName}约${formatDistance(meetup.spreadMeters)}` : "";
    const radius = meetup.radiusMeters ? `在中间点附近约${formatDistance(meetup.radiusMeters)}内找` : "在中间点附近找";
    return [prefix, radius, spread].filter(Boolean).join("，");
  }
  if (destination) {
    const radius = destination.radiusMeters || plan.radiusMeters || 3500;
    return `在${destination.label || plan.locationHint || "目的地"}附近找，约${formatDistance(radius)}内`;
  }
  if (plan.includeCurrentLocationInMeetup && Array.isArray(plan.locationHints) && plan.locationHints.length) {
    return `按你当前位置和${plan.locationHints.slice(0, 3).join(" / ")}取中间点，约${formatDistance(plan.radiusMeters || 3500)}内`;
  }
  if (Array.isArray(plan.locationHints) && plan.locationHints.length >= 2) {
    return `按${plan.locationHints.slice(0, 4).join(" / ")}取中间点，约${formatDistance(plan.radiusMeters || 3500)}内`;
  }
  if (needsRestaurantCompanionLocationFromPlan(plan)) {
    return `先在你当前位置附近约${formatDistance(plan.radiusMeters || 3500)}内找；补充同伴位置后取中间点`;
  }
  return `在你当前位置附近找，约${formatDistance(plan.radiusMeters || 3500)}内`;
}

function needsRestaurantCompanionLocation(choice = {}, plan = {}) {
  if (plan.locationHint || (plan.locationHints && plan.locationHints.length)) return false;
  if (extractRestaurantDestinationHint(choice)?.name) return false;
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")} ${(choice.scenes || []).join(" ")}`;
  return /(?:朋友聚餐|约会吃饭|朋友|对象|男朋友|女朋友|男友|女友|对方|同事|同学|客户|聚餐|约饭|一起|一块)/.test(text);
}

function needsRestaurantCompanionLocationFromPlan(plan = {}) {
  return Boolean(plan.needsCompanionLocation);
}

function restaurantPlanAmapPreviewItems(plan = {}, { coords = null, destination = null, meetup = null, choice = {} } = {}) {
  const searchCenter = destination?.searchCoords || meetup?.searchCoords || coords;
  const centerLabel = destination?.label
    ? `${destination.label}附近`
    : (meetup?.label ? `${meetup.label}折中点` : (searchCenter?.label || "当前位置"));
  const coordText = searchCenter && Number.isFinite(Number(searchCenter.lat)) && Number.isFinite(Number(searchCenter.lng))
    ? `${centerLabel} ${Number(searchCenter.lat).toFixed(5)}, ${Number(searchCenter.lng).toFixed(5)}`
    : centerLabel;
  return [
    { label: "搜索中心", value: coordText, wide: true },
    { label: "关键词", value: (plan.keywords || []).join("、") || RESTAURANT_KEYWORD_FALLBACK, wide: true },
    { label: "范围", value: restaurantPlanLocationDistanceText(plan, destination, meetup, choice).replace(/^在/, "").replace(/找，/, " · ") },
    { label: "排序", value: normalizeAmapSortRule(plan.sortrule) === "weight" ? "综合推荐，兼看距离" : "距离优先，兼看评分" }
  ];
}

function restaurantSearchToast(keywords, meetup, destination) {
  if (destination && destination.label) return `正在找「${destination.label}」附近的餐厅`;
  if (meetup && meetup.participants && meetup.participants.length >= 2) return `正在找「${meetup.participants.map((item) => item.label).join(" / ")}」之间的折中餐厅`;
  const visible = (keywords || []).filter((keyword) => keyword !== RESTAURANT_KEYWORD_FALLBACK).slice(0, 2);
  return visible.length ? `正在按「${visible.join("、")}」搜索附近餐厅` : "正在获取附近餐厅候选";
}

async function loadRestaurantDetail(card) {
  const basePoi = restaurantPoiFromCard(card);
  let poi = basePoi;
  if (isAmapPoiId(basePoi.id)) {
    try {
      const detail = await fetchAmapPoiDetail(basePoi);
      if (detail) poi = mergeRestaurantPoiDetails(basePoi, detail);
    } catch (error) {
      console.warn("Amap detail unavailable", basePoi.name, error);
    }
  }
  return restaurantDetailCardFromPoi(card, poi);
}

function restaurantPoiFromCard(card = {}) {
  const location = card.location ? {
    lat: Number(card.location.latitude ?? card.location.lat),
    lng: Number(card.location.longitude ?? card.location.lng)
  } : null;
  const fallbackImage = String(card.fallbackImage || "");
  const cardImage = card.image && card.image !== fallbackImage ? card.image : "";
  const venueImage = card.venueImage && card.venueImage !== fallbackImage ? card.venueImage : "";
  const photoItems = realRestaurantPhotoItems([
    ...(card.poi && card.poi.photoItems || []),
    ...(card.carouselImages || []),
    ...(card.photoItems || []),
    ...(card.poi && card.poi.photos || []),
    ...(card.photoGallery || []),
    venueImage,
    cardImage
  ].filter(Boolean), fallbackImage, 8);
  return sanitizeRestaurantPoiNavigationPoint({
    ...(card.poi || {}),
    fallbackImage,
    id: (card.poi && card.poi.id) || card.id || card.name,
    name: (card.poi && card.poi.name) || card.name,
    image: (card.poi && card.poi.image) || venueImage || cardImage,
    photos: photoItems.map((item) => item.url),
    photoItems,
    address: (card.poi && card.poi.address) || card.address || "",
    type: (card.poi && card.poi.type) || card.type || "",
    area: (card.poi && card.poi.area) || card.area || "",
    businessArea: (card.poi && card.poi.businessArea) || card.businessArea || "",
    tag: (card.poi && card.poi.tag) || card.tag || "",
    recommend: (card.poi && card.poi.recommend) || card.recommend || "",
    keytag: (card.poi && card.poi.keytag) || card.keytag || "",
    rectag: (card.poi && card.poi.rectag) || card.rectag || "",
    menuItems: (card.poi && card.poi.menuItems) || card.menuItems || [],
    children: (card.poi && card.poi.children) || card.children || [],
    indoor: (card.poi && card.poi.indoor) || card.indoor || null,
    tel: (card.poi && card.poi.tel) || card.tel || "",
    opentimeToday: (card.poi && card.poi.opentimeToday) || card.opentimeToday || "",
    opentimeWeek: (card.poi && card.poi.opentimeWeek) || card.opentimeWeek || "",
    rating: (card.poi && card.poi.rating) || card.rating || "",
    cost: (card.poi && card.poi.cost) || card.cost || "",
    searchKeyword: (card.poi && card.poi.searchKeyword) || card.searchKeyword || "",
    routeMetrics: (card.poi && card.poi.routeMetrics) || card.routeMetrics || null,
    participantRoutes: (card.poi && card.poi.participantRoutes) || card.participantRoutes || [],
    meetup: (card.poi && card.poi.meetup) || card.meetup || null,
    navLocation: (card.poi && card.poi.navLocation) || card.navLocation || null,
    location: location && Number.isFinite(location.lat) && Number.isFinite(location.lng) ? location : ((card.poi && card.poi.location) || null)
  });
}

async function fetchAmapPoiDetail(poi = {}) {
  const id = String(poi.id || "").trim();
  if (!isAmapPoiId(id)) return null;
  const data = await amapRequest("https://restapi.amap.com/v5/place/detail", {
    key: AMAP_WEB_SERVICE_KEY,
    id,
    show_fields: AMAP_SHOW_FIELDS_DEFAULT,
    output: "json"
  });
  if (data.status !== "1") throw new Error(data.info || "高德详情查询失败");
  const raw = data.poi || (Array.isArray(data.pois) ? data.pois[0] : null);
  return raw ? normalizeAmapPoi({ ...raw, __searchKeyword: poi.searchKeyword || "" }) : null;
}

function isAmapPoiId(id) {
  return /^[A-Z0-9]{8,32}$/i.test(String(id || "").trim());
}

function mergeRestaurantPoiDetails(base = {}, detail = {}) {
  const fallbackImage = String(base.fallbackImage || "");
  const photoItems = realRestaurantPhotoItems([
    ...(detail.photoItems || []),
    ...(detail.photos || []),
    detail.image,
    ...(base.photoItems || []),
    ...(base.photos || []),
    base.image
  ].filter(Boolean), fallbackImage, 8);
  const photos = photoItems.map((item) => item.url);
  return {
    ...base,
    ...detail,
    distance: base.distance || detail.distance,
    searchKeyword: base.searchKeyword || detail.searchKeyword,
    tag: detail.tag || base.tag,
    recommend: detail.recommend || base.recommend,
    keytag: detail.keytag || base.keytag,
    rectag: detail.rectag || base.rectag,
    menuItems: uniqueKeywords([...(detail.menuItems || []), ...(base.menuItems || [])]).slice(0, 24),
    children: (detail.children && detail.children.length) ? detail.children : (base.children || []),
    indoor: detail.indoor || base.indoor || null,
    routeMetrics: base.routeMetrics || detail.routeMetrics,
    participantRoutes: base.participantRoutes || detail.participantRoutes,
    meetup: base.meetup || detail.meetup,
    image: photos[0] || detail.image || base.image,
    photos,
    photoItems
  };
}

function restaurantDetailCardFromPoi(card = {}, poi = {}) {
  const cleanedPoi = sanitizeRestaurantPoiNavigationPoint(poi);
  const fallbackImage = String(card.fallbackImage || "");
  const cardImage = card.image && card.image !== fallbackImage ? card.image : "";
  const photoItems = restaurantCardImages({
    ...cleanedPoi,
    photoItems: [
      ...(cleanedPoi.photoItems || []),
      ...(card.carouselImages || []),
      ...(card.photoItems || []),
      ...(cleanedPoi.photos || []),
      cleanedPoi.image,
      card.venueImage,
      cardImage
    ].filter(Boolean)
  }, fallbackImage);
  const photoGallery = photoItems.map((item) => item.url);
  const detail = restaurantDetailPayloadForPoi(cleanedPoi, { photoItems });
  return {
    ...card,
    poi: cleanedPoi,
    image: photoGallery[0] || cardImage,
    venueImage: cleanedPoi.image || card.venueImage || "",
    photoGallery,
    photoItems,
    carouselImages: photoItems,
    detailPhotos: detail.photos,
    address: cleanedPoi.address || card.address || "",
    type: cleanedPoi.type || card.type || "",
    area: cleanedPoi.area || card.area || "",
    businessArea: cleanedPoi.businessArea || card.businessArea || "",
    tag: cleanedPoi.tag || card.tag || "",
    recommend: cleanedPoi.recommend || card.recommend || "",
    keytag: cleanedPoi.keytag || card.keytag || "",
    rectag: cleanedPoi.rectag || card.rectag || "",
    menuItems: cleanedPoi.menuItems || card.menuItems || [],
    tel: cleanedPoi.tel || card.tel || "",
    opentimeToday: cleanedPoi.opentimeToday || card.opentimeToday || "",
    opentimeWeek: cleanedPoi.opentimeWeek || card.opentimeWeek || "",
    rating: cleanedPoi.rating || card.rating || "",
    cost: cleanedPoi.cost || card.cost || "",
    routeMetrics: cleanedPoi.routeMetrics || card.routeMetrics || null,
    participantRoutes: cleanedPoi.participantRoutes || card.participantRoutes || [],
    meetup: cleanedPoi.meetup || card.meetup || null,
    navLocation: restaurantNavigationPointForPoi(cleanedPoi) || card.navLocation || null,
    ratingText: cleanedPoi.rating ? `${cleanedPoi.rating}分` : card.ratingText || "",
    costText: cleanedPoi.cost ? `${formatCost(cleanedPoi.cost)}元` : card.costText || "",
    openTimeText: detail.openTimeText,
    detailFacts: detail.facts,
    detailFeatures: detail.features,
    detailRoutes: detail.routes,
    detailRows: detail.rows,
    navUrl: amapNavigationUrl(cleanedPoi) || card.navUrl || "",
    orderUrl: amapStoreUrl(cleanedPoi || card)
  };
}

function amapNavigationUrl(p) {
  if (!p) return "";
  const point = restaurantNavigationPointForPoi(p);
  if (!point) return "";
  return `https://uri.amap.com/navigation?to=${point.lng},${point.lat},${encodeURIComponent(p.name)}&mode=walk&policy=1&src=choiceover&coordinate=gaode&callnative=1`;
}

module.exports = {
  buildChoiceContext,
  getCurrentPosition,
  getApproxPosition,
  reverseGeocodeLocation,
  loadRestaurantDeck,
  loadRestaurantDetail,
  buildRestaurantIntentPreview,
  resolveMeetupRoomBoard,
  RESTAURANT_SEARCH_PLAN_ENDPOINT,
  __test: {
    restaurantArrivalBoard,
    resolveMeetupRoomBoard,
    aggregateMeetupTaste,
    aggregateMeetupDiet,
    mergeMeetupDietAvoid,
    applyMeetupTasteKeywords,
    parseDietaryFromText,
    negatedCuisineKeywords,
    applyTextDietaryRules,
    pickPreferredArrivalMode,
    cleanChoiceQuestion,
    extractedRestaurantParticipantLocationNames,
    shouldUseCurrentLocationForMeetup,
    extractRestaurantDestinationHint,
    normalizeRestaurantSearchPlan,
    normalizeChoiceIntentOverrides,
    applyChoiceIntentOverrides,
    localRestaurantSearchPlan,
    ensureRestaurantMeetupPlanForMode,
    inferExplicitRestaurantRadiusMeters,
    restaurantAmapRequests,
    matchIntentRules,
    searchRestaurantsWithFallback,
    restaurantSearchPlanForMode,
    filterRestaurantPois,
    preferredRestaurantPois,
    relaxedRestaurantSearchOptions,
    restaurantSearchOptions,
    restaurantCardReplayKey,
    restaurantCardsForModeAvoiding,
    applyRestaurantCategoryPlan,
    categoryRestaurantCards,
    rankCategoryPois,
    restaurantAllowedCityFromCoords,
    restaurantPoiMatchesAllowedCity,
    filterRestaurantPoisWithinAllowedCity,
    filterRestaurantCardsWithinAllowedCity,
    filterRestaurantPoisWithinSearchRadius,
    filterRestaurantCardsWithinSearchRadius,
    isPreciseRestaurantSearchCenter,
    restaurantPlanMiddleText,
    restaurantPlanLocationDistanceText,
    restaurantMeetupExpectedLabels,
    restaurantMeetupRouteItems,
    detailRouteRowsForPoi,
    meetupBoardMapGeometry,
    meetupBoardRangeRadius,
    restaurantCardImages,
    restaurantDetailPayloadForPoi,
    restaurantDishHintsForPoi
  }
};
