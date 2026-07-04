const {
  POOL,
  SCENE_TAGS,
  NEED_TAGS,
  MORE_TAGS,
  MODE_SETTLE_COPY,
  INFO_THEMES,
  TAG_SEARCH_KEYWORDS,
  MEETUP_TRAVEL_OPTIONS,
  randomSlogan
} = require("../../utils/choiceData");

const {
  buildChoiceContext,
  getCurrentPosition,
  getApproxPosition,
  reverseGeocodeLocation,
  loadRestaurantDeck,
  loadRestaurantDetail,
  buildRestaurantIntentPreview,
  resolveMeetupRoomBoard
} = require("../../utils/restaurantEngine");

const consumerProfile = require("../../utils/consumerProfile");
const { ORDER_TARGETS, orderAppIdForBrand } = require("../../utils/brandData");

// 「去下单」距离阈值:≤1km 视为顺路自取(跳品牌点单小程序),>1km 走外卖(跳美团)
const ORDER_NEAR_METERS = 1000;

function loadSpeechPlugin() {
  if (typeof requirePlugin !== "function") return null;
  try {
    return requirePlugin("WechatSI");
  } catch (error) {
    console.warn("WechatSI plugin unavailable", error);
    return null;
  }
}

const speechPlugin = loadSpeechPlugin();
const BGM_SRC = "/assets/audio/choice-loop.mp3";
const MAP_NAV_LOCATION_MAX_DRIFT_METERS = 2000;
const MEETUP_ROOM_ENDPOINT = "https://no-choice-meetup-room.pages.dev/api/meetup-room";
const MEETUP_SELF_STORAGE_KEY = "choiceMeetupSelfProfile";
const MEETUP_ROOM_POLL_MS = 7000;

function normalizeMapPoint(point) {
  if (!point) return null;
  if (typeof point === "string") {
    const [lng, lat] = point.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  }
  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function mapPointDistanceMeters(a, b) {
  const lat1 = Number(a && a.latitude);
  const lng1 = Number(a && a.longitude);
  const lat2 = Number(b && b.latitude);
  const lng2 = Number(b && b.longitude);
  if ([lat1, lng1, lat2, lng2].some((value) => !Number.isFinite(value))) return Infinity;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function cardNavigationPoint(card) {
  if (!card) return null;
  const location = normalizeMapPoint(card.location)
    || normalizeMapPoint(card.poi && card.poi.location);
  const navLocation = normalizeMapPoint(card.navLocation)
    || normalizeMapPoint(card.poi && card.poi.navLocation);
  if (location && navLocation) {
    const drift = mapPointDistanceMeters(location, navLocation);
    if (!Number.isFinite(drift) || drift > MAP_NAV_LOCATION_MAX_DRIFT_METERS) return location;
  }
  return navLocation || location;
}

function isCardNavigationEvent(event) {
  const dataset = event && event.target && event.target.dataset || {};
  const currentDataset = event && event.currentTarget && event.currentTarget.dataset || {};
  return dataset.cardAction === "navigation" || currentDataset.cardAction === "navigation";
}

const TOTAL = POOL.length;
const DEFAULT_ART_THEMES = [
  { bg: "#ff5a4d", accent: "#f6c518" },
  { bg: "#28c76f", accent: "#f6c518" },
  { bg: "#f6c518", accent: "#ff5a4d" },
  { bg: "#6c5ce7", accent: "#28c76f" },
  { bg: "#3d6bff", accent: "#ff7ab8" }
];

function makeTags(items) {
  return items.map((text) => ({ text, selected: false }));
}

function shuffleCards(cards) {
  const next = cards.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}

function themeFor(index) {
  return INFO_THEMES[index % INFO_THEMES.length];
}

function normalizeImageUrl(value) {
  if (typeof value === "string") return value.trim();
  return String((value && value.url) || "").trim();
}

function normalizePhotoLabel(item, index) {
  if (item && typeof item === "object" && item.label) return String(item.label).trim();
  if (item && typeof item === "object" && item.kind) {
    const kind = String(item.kind).toLowerCase();
    if (kind === "menu") return "菜单";
    if (kind === "food") return "菜品";
    if (kind === "drink") return "饮品";
    if (kind === "interior") return "环境";
    if (kind === "storefront") return "门头";
  }
  return index === 0 ? "菜品" : "图片";
}

function normalizeCardPhotoItems(card, limit = 6) {
  const fallbackUrl = normalizeImageUrl(card && card.fallbackImage);
  const sources = []
    .concat((card && card.carouselImages) || [])
    .concat((card && card.photoItems) || [])
    .concat((card && card.detailPhotos) || [])
    .concat((card && card.photoGallery) || [])
    .concat((card && card.image) || []);
  const seen = new Set();
  const items = [];
  sources.forEach((item) => {
    const url = normalizeImageUrl(item);
    if (!url || url === fallbackUrl || seen.has(url)) return;
    if (item && typeof item === "object" && (item.kind === "fallback" || item.source === "fallback")) return;
    seen.add(url);
    items.push({
      url,
      label: normalizePhotoLabel(item, items.length)
    });
  });
  return items.slice(0, limit);
}

function stripDuplicateCardReason(reason) {
  const text = String(reason || "").trim();
  if (!text) return "";
  const parts = text.match(/[^。！？!?]+[。！？!?]?/g) || [text];
  const kept = parts.filter((part, index) => {
    if (index > 1) return true;
    const value = String(part || "").trim();
    if (!value) return false;
    const hasMetric = /(?:离你|步行\d|驾车\d|地铁\d|距地铁|平均\d|最远|评分\s*\d|人均\s*\d|[0-9.]+\s*(?:km|公里|m|米))/i.test(value);
    const hasRouteVerb = /(?:步行|驾车|地铁|距离|离你|评分|人均)/.test(value);
    return !(hasMetric && hasRouteVerb);
  }).join("").trim();
  return kept || "";
}

function decorateCard(card, index) {
  const theme = themeFor(index);
  const artTheme = DEFAULT_ART_THEMES[index % DEFAULT_ART_THEMES.length];
  const photoSlides = normalizeCardPhotoItems(card, 6);
  const photoGallery = photoSlides.map((item) => item.url);
  const fallbackUrl = normalizeImageUrl(card.fallbackImage);
  const image = normalizeImageUrl(card.image);
  const visibleImage = image && image !== fallbackUrl ? image : (photoGallery[0] || "");
  return {
    ...card,
    no: index + 1,
    image: visibleImage,
    photoGallery,
    photoSlides,
    reason: stripDuplicateCardReason(card.reason),
    slogan: card.slogan || randomSlogan(),
    artBg: card.artBg || card.art || artTheme.bg,
    artAccent: card.artAccent || artTheme.accent,
    infoBg: theme.bg,
    infoFg: theme.fg,
    infoMuted: theme.muted,
    tagBg: theme.tagBg,
    tagFg: theme.tagFg
  };
}

function withSelectedMeetupRoute(card, routeIndex) {
  if (!card || !card.meetupPanel || !Array.isArray(card.meetupPanel.routes)) return card;
  const routes = card.meetupPanel.routes;
  if (!routes.length) return card;
  const selectedIndex = Math.max(0, Math.min(routes.length - 1, Number(routeIndex) || 0));
  return {
    ...card,
    meetupPanel: {
      ...card.meetupPanel,
      selectedIndex,
      activeRoute: routes[selectedIndex]
    }
  };
}

function withSelectedDetailRoute(card, routeIndex) {
  if (!card) return card;
  const routes = Array.isArray(card.detailRoutes) ? card.detailRoutes : [];
  if (!routes.length) return { ...card, detailRouteIndex: 0, activeDetailRoute: null };
  const selectedIndex = Math.max(0, Math.min(routes.length - 1, Number(routeIndex) || 0));
  return {
    ...card,
    detailRouteIndex: selectedIndex,
    activeDetailRoute: routes[selectedIndex]
  };
}

function sameCardIdentity(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id) return left.id === right.id;
  return left.name === right.name;
}

function decorateDetailCard(card) {
  if (!card) return null;
  const index = Math.max(0, Number(card.no || 1) - 1);
  const base = decorateCard(card, index);
  const detailPhotos = normalizeCardPhotoItems({
    ...card,
    photoItems: (card.detailPhotos || []).concat(card.photoItems || []).concat(card.carouselImages || [])
  }, 5);
  return withSelectedDetailRoute({
    ...base,
    detailPhotos,
    image: detailPhotos[0] ? detailPhotos[0].url : base.image
  }, card.detailRouteIndex || 0);
}

function selectedTagTexts(groups) {
  return groups
    .reduce((acc, group) => acc.concat(group), [])
    .filter((item) => item.selected)
    .map((item) => item.text);
}

function withTagLine(problem, tags) {
  const base = cleanChoiceQuestion(problem);
  const tagLine = tags.length ? `标签：${tags.join("、")}` : "";
  return [base, tagLine].filter(Boolean).join("\n");
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

function uniq(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeReplayKeyText(value) {
  return String(value || "").toLowerCase().replace(/[\s·・.,，。'"“”‘’()（）\-_/&＋+|]/g, "");
}

function replayCardKey(card = {}) {
  const source = card.poi && typeof card.poi === "object" ? card.poi : card;
  const id = String(source.id || card.id || "").trim();
  if (id) return `id:${id}`;
  const text = [source.name || card.name, source.address || card.address, source.area || card.area, source.businessArea || card.businessArea]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("|");
  return text ? `text:${normalizeReplayKeyText(text)}` : "";
}

function replayDeckKeys(cards = []) {
  return (cards || []).map(replayCardKey).filter(Boolean);
}

function sameReplayOrder(left = [], right = []) {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function rotateReplayCards(cards = []) {
  if (!cards || cards.length <= 1) return cards;
  return cards.slice(1).concat(cards[0]);
}

function choiceText(data) {
  const tags = Array.isArray(data.tags) ? data.tags : selectedTagTexts([data.sceneTags || [], data.needTags || [], data.moreTags || []]);
  const question = data.question || data.problem || "";
  return [cleanChoiceQuestion(question), tags.join(" ")].filter(Boolean).join(" ");
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message || "timeout")), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function normalizeLocationDetail(detail) {
  const title = typeof detail === "string" ? detail.trim() : String((detail && detail.title) || "").trim();
  const meta = typeof detail === "string" ? "" : String((detail && detail.meta) || "").trim();
  return title ? { title, meta } : null;
}

function locationDisplayLabel(coords) {
  const label = String((coords && coords.label) || "").trim();
  if (!label || /^(?:当前|当前位置|GPS|附近|周边|已获取)/u.test(label)) return "";
  return label;
}

function stableLocationFallbackTitle(coords, fallback = "北京") {
  return locationDisplayLabel(coords) || fallback;
}

function shortLocationError(error) {
  const message = String(error && (error.message || error.errMsg) || "").trim();
  if (!message) return "详细地址未返回";
  if (/url not in domain list|domain|合法域名|request:fail/i.test(message)) return "详细地址未返回：检查 request 合法域名";
  if (/timeout|超时/i.test(message)) return "详细地址未返回：请求超时";
  return `详细地址未返回：${message.slice(0, 28)}`;
}

function isGenericLocationLabel(coords) {
  const label = String((coords && coords.label) || "").trim();
  if (!label) return true;
  if (/^(?:当前|当前位置|当前城市|GPS|已获取|正在|定位|北京|北京市)$/u.test(label)) return true;
  if (/^[\u4e00-\u9fa5]{2,5}(?:市)?$/u.test(label) && !/(?:区|县|街道|街|路|桥|社区|小区|村|里|园|校|大学|大厦|商圈|CBD)/u.test(label)) return true;
  return false;
}

function isCoarseLocationLabel(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (/^(?:当前|当前位置|当前城市|GPS|已获取|正在|定位|北京|北京市|上海|上海市|天津|天津市|重庆|重庆市)$/u.test(text)) return true;
  if (/^[\u4e00-\u9fa5]{2,8}(?:市|省|自治区|特别行政区)$/u.test(text)) return true;
  return false;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match && match[1]) return String(match[1]).trim();
  }
  return "";
}

function planSceneText(choice) {
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")}`;
  if (/约会|对象|男朋友|女朋友|男友|女友|暧昧/.test(text)) return "约会吃饭";
  if (/朋友|聚餐|同事|同学|客户/.test(text)) return "朋友聚餐";
  if (/一个人|一人食|自己/.test(text)) return "一人食";
  if (/夜宵|宵夜|通宵|深夜/.test(text)) return "夜宵";
  return choice.scenes && choice.scenes[0] || "吃饭选择";
}

function planMiddleText(choice) {
  const text = choiceText(choice);
  const destination = firstMatch(text, [/(?:在|去|到|想在|想去)([^，。；\s]{2,12})(?:附近|周边|这边|那边)/, /([^，。；\s]{2,12})(?:附近|周边)(?:吃|找|餐厅)/]);
  if (destination) return `不取中间点，直接在${destination}附近找`;
  const pointLabels = planMiddlePointLabels(choice);
  if (pointLabels.length >= 2) return `按${pointLabels.join(" / ")}取中间点`;
  if (pointLabels.length === 1) return `不取中间点，直接在${pointLabels[0]}附近找`;
  const meetupHint = /和.+(?:朋友|对象|同事|同学).*(?:在|从|住在)[^，。；\s]{2,12}/.test(text) || /折中|中间/.test(text);
  if (meetupHint) return "取中间点，照顾两边到店时间";
  return "不取中间点，按当前位置找";
}

function planMiddlePointLabels(choice) {
  if (Array.isArray(choice.multiAreaLocationHints) && choice.multiAreaLocationHints.length) {
    return uniq(choice.multiAreaLocationHints).slice(0, 4);
  }
  const text = choiceText(choice);
  const labels = [];
  const locationPattern = /(?:^|[，,。；;\s])(?:我|一个人|一个|另一个|另外一个|朋友|对象|同事|同学|客户|他|她)?(?:在|住在|从|出发(?:地)?(?:是|在)?)([^，,。；;\s]{2,16}?)(?=(?:一个|另一个|另外一个|朋友|对象|同事|同学|客户|我|他|她)?(?:在|住在|从|出发)|[，,。；;\s]|$)/g;
  let match;
  while ((match = locationPattern.exec(text))) {
    const label = cleanMiddlePointLabel(match[1]);
    if (label) labels.push(label);
  }
  if (labels.length === 1 && /(?:朋友|对象|男朋友|女朋友|男友|女友|同事|同学|客户|聚餐|约饭|一起|一块)/.test(text)) {
    labels.unshift("当前位置");
  }
  return uniq(labels).slice(0, 4);
}

function cleanMiddlePointLabel(value) {
  const text = String(value || "")
    .replace(/(?:附近|周边|这边|那边|吃饭|聚餐|约饭|餐厅|饭店).*$/u, "")
    .replace(/^(?:北京市|上海市|广州市|深圳市|杭州市|成都市|重庆市|天津市|南京市|苏州市|武汉市|西安市)/u, "")
    .trim();
  if (!text || /^(当前位置|当前定位|我|你|自己|朋友|对象|同事|同学|客户)$/u.test(text)) return "";
  return text.length <= 8 ? text : text.slice(0, 8);
}

function planRestaurantText(choice) {
  const tags = choice.tags || [];
  const text = `${choice.question || ""} ${tags.join(" ")}`;
  const values = [];
  if (/约会|对象|男朋友|女朋友|男友|女友/.test(text) || tags.includes("约会吃饭")) values.push("约会餐厅", "西餐", "日料");
  if (/朋友|聚餐/.test(text) || tags.includes("朋友聚餐")) values.push("聚餐餐厅");
  MORE_TAGS.forEach((tag) => { if (tags.includes(tag) || text.includes(tag)) values.push(tag); });
  tags.forEach((tag) => {
    (TAG_SEARCH_KEYWORDS[tag] || []).forEach((keyword) => {
      if (keyword !== "餐厅") values.push(keyword);
    });
  });
  if (/安静|好聊/.test(text) || tags.includes("安静好聊")) values.push("安静餐厅");
  if (/夜宵|宵夜/.test(text) || tags.includes("夜宵")) values.push("夜宵", "烧烤");
  return uniq(values).slice(0, 6).join("、") || "餐厅";
}

function planBudgetText(choice) {
  const text = choiceText(choice);
  const within = text.match(/人均\s*(\d+)\s*(?:以内|以下|内|左右)?/);
  if (within && /以内|以下|内/.test(text)) return `人均约0-${within[1]}元`;
  const above = text.match(/人均\s*(\d+)\s*(?:以上|\+|起)/);
  if (above || (choice.tags || []).includes("人均150+")) return "人均约150-350元";
  const around = text.match(/人均\s*(\d+)/);
  if (around) return `人均约${around[1]}元左右`;
  return "按普通正餐预算";
}

function planLocationText(choice) {
  const text = choiceText(choice);
  const destination = firstMatch(text, [/(?:在|去|到|想在|想去)([^，。；\s]{2,12})(?:附近|周边|这边|那边)/, /([^，。；\s]{2,12})(?:附近|周边)(?:吃|找|餐厅)/]);
  if (destination) return `在${destination}附近找，约4km内`;
  if (/折中|中间/.test(text)) return "在中间点附近找，约5km内";
  return "在你当前位置附近找，约4km内";
}

const VOICE_INTENT_DETAIL_KEYS = {
  "意图": "scene",
  "中间点": "middle",
  "餐厅类型": "restaurantTypes",
  "价格": "budget",
  "预算": "budget",
  "位置距离": "locationDistance"
};

function editableVoiceIntentDetails(details = []) {
  return (details || []).map((item, index) => {
    const label = String(item && item.label || "").trim();
    return {
      ...item,
      label,
      key: VOICE_INTENT_DETAIL_KEYS[label] || `field${index}`,
      value: String(item && item.value || "").trim(),
      editable: label !== "状态",
      multiline: Boolean(item && item.wide),
      summary: index < 4
    };
  });
}

function voiceIntentFieldsFromDetails(details = []) {
  return (details || []).reduce((fields, item) => {
    const key = item && item.key;
    if (!key || /^field\d+$/.test(key)) return fields;
    fields[key] = String(item.value || "").trim();
    return fields;
  }, {});
}

const MAX_MULTI_AREA_ROWS = 6;
const DEFAULT_MEETUP_MAP = { lat: 39.904179, lng: 116.407387 };

function createMeetupRoomId() {
  return `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function meetupRoomStorageKey(roomId) {
  return `choiceMeetupRoom:${roomId}`;
}

function createMeetupParticipantId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMeetupSelfProfile(profile = {}) {
  const id = String(profile.id || profile.openid || profile.unionid || "").trim() || createMeetupParticipantId();
  const name = String(profile.name || profile.nickName || "").trim().slice(0, 24);
  return { id, name };
}

function selfMultiAreaRow(profile = {}) {
  const normalized = normalizeMeetupSelfProfile(profile);
  return {
    id: normalized.id,
    role: normalized.name || "我",
    people: 1,
    location: "",
    isHost: true,
    isSelf: true,
    joined: false
  };
}

function meetupSharePath(roomId) {
  const id = String(roomId || "").trim();
  return id ? `/pages/play/play?roomId=${encodeURIComponent(id)}` : "/pages/play/play";
}

function wxRequestJson(options = {}) {
  if (typeof wx === "undefined" || typeof wx.request !== "function") {
    return Promise.reject(new Error("wx.request unavailable"));
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method || "GET",
      data: options.data,
      header: {
        "content-type": "application/json",
        ...(options.header || {})
      },
      success: (res) => {
        const status = Number(res && res.statusCode) || 0;
        const data = res && res.data;
        if (status >= 200 && status < 300 && (!data || data.ok !== false)) {
          resolve(data || {});
          return;
        }
        reject(new Error((data && data.message) || `request failed ${status}`));
      },
      fail: reject
    });
  });
}

function defaultMultiAreaRole(index) {
  if (index === 0) return "我的位置";
  return `朋友${String.fromCharCode(64 + Math.min(26, index))}`;
}

function shortMultiAreaRole(role, index) {
  const text = String(role || "").trim();
  if (!text || text === "我的位置" || text === "当前位置" || text === "位置") return index === 0 ? "我" : String(index + 1);
  const letter = text.match(/[A-Z]$/i);
  if (letter) return letter[0].toUpperCase();
  return text.slice(0, 1);
}

function clampMultiAreaPeople(value) {
  const numeric = Math.round(Number(value) || 1);
  return Math.max(1, Math.min(20, numeric));
}

function createDefaultMultiAreaRows() {
  return [
    { id: "host", role: "我的位置", people: 1, location: "", isHost: true, joined: false },
    { id: "friend-a", role: "朋友A", people: 1, location: "", isHost: false, joined: false },
    { id: "friend-b", role: "朋友B", people: 1, location: "", isHost: false, joined: false }
  ];
}

// 把出行方式统一成多选数组(兼容旧的单选 travel 字段)
function normalizeTravels(row) {
  const valid = (key) => MEETUP_TRAVEL_OPTIONS.some((opt) => opt.key === key);
  let list = [];
  if (Array.isArray(row && row.travels)) list = row.travels.filter(valid);
  else if (valid(row && row.travel)) list = [row.travel];
  return [...new Set(list)];
}

function normalizeMultiAreaRows(rows = []) {
  const source = Array.isArray(rows) && rows.length ? rows : createDefaultMultiAreaRows();
  return source.slice(0, MAX_MULTI_AREA_ROWS).map((row, index) => {
    const latitude = Number(row && (row.latitude ?? row.lat));
    const longitude = Number(row && (row.longitude ?? row.lng));
    const hasCoord = Number.isFinite(latitude) && Number.isFinite(longitude);
    const role = String(row && row.role || defaultMultiAreaRole(index)).trim();
    const location = String(row && row.location || "").trim();
    const hasExplicitHost = Boolean(row && Object.prototype.hasOwnProperty.call(row, "isHost"));
    const isHost = Boolean(hasExplicitHost ? row.isHost : index === 0);
    const isSelf = Boolean(row && row.isSelf);
    const pref = String(row && row.pref || "").trim();
    const travels = normalizeTravels(row);
    const travelMap = {};
    travels.forEach((key) => { travelMap[key] = true; });
    return {
      id: row && row.id ? row.id : `area-${index + 1}`,
      index,
      role,
      roleShort: shortMultiAreaRole(role, index),
      people: clampMultiAreaPeople(row && row.people),
      location,
      latitude: hasCoord ? latitude : null,
      longitude: hasCoord ? longitude : null,
      isHost,
      isSelf,
      joined: Boolean((row && row.joined) || location || isHost),
      statusText: String(row && row.statusText || (location ? "已定位" : (isHost || isSelf ? "等你填写" : "待加入"))),
      placeholder: String(row && row.placeholder || (isHost || isSelf ? "填你自己的出发地" : "苏州街 / 北京大学 / 国贸")),
      pref,
      travels,
      travelMap,
      updatedAt: row && row.updatedAt ? row.updatedAt : 0
    };
  });
}

function validMultiAreaRows(rows = []) {
  return normalizeMultiAreaRows(rows).filter((row) => row.location);
}

function multiAreaPeopleTotal(rows = []) {
  return validMultiAreaRows(rows).reduce((sum, row) => sum + clampMultiAreaPeople(row.people), 0);
}

function multiAreaSummary(rows = []) {
  const validRows = validMultiAreaRows(rows);
  if (!validRows.length) return "等待收集多个出发位置";
  const total = validRows.reduce((sum, row) => sum + clampMultiAreaPeople(row.people), 0);
  const compact = validRows.map((row) => `${row.role || "位置"}：${row.location}`).join(" / ");
  return `${validRows.length}个出发地 / 共${total}人 · ${compact}`;
}

function meetupRoomMapCenter(rows = [], coords = null) {
  const middle = meetupRoomMiddlePoint(rows);
  if (middle) return { lat: middle.latitude, lng: middle.longitude };
  const rowWithCoord = meetupRoomCoordRows(rows)[0];
  if (rowWithCoord) return { lat: rowWithCoord.latitude, lng: rowWithCoord.longitude };
  if (coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng))) {
    return { lat: Number(coords.lat), lng: Number(coords.lng) };
  }
  return DEFAULT_MEETUP_MAP;
}

function meetupRoomCoordRows(rows = []) {
  return normalizeMultiAreaRows(rows)
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

function meetupRoomMiddlePoint(rows = []) {
  const points = meetupRoomCoordRows(rows);
  if (points.length < 2) return null;
  const sum = points.reduce((acc, row) => ({
    latitude: acc.latitude + Number(row.latitude),
    longitude: acc.longitude + Number(row.longitude)
  }), { latitude: 0, longitude: 0 });
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length
  };
}

function meetupRoomMarkers(rows = []) {
  const memberIcons = ["/assets/map/member-blue.png", "/assets/map/member-green.png", "/assets/map/member-coral.png"];
  const markers = meetupRoomCoordRows(rows).map((row, index) => ({
    id: index + 1,
    latitude: row.latitude,
    longitude: row.longitude,
    title: row.role || "位置",
    iconPath: memberIcons[index % memberIcons.length],
    width: 34,
    height: 42,
    anchor: { x: 0.5, y: 1 },
    callout: {
      content: row.role || "位置",
      color: "#1a1714",
      fontSize: 12,
      borderRadius: 8,
      bgColor: "#fffdf6",
      padding: 6,
      display: "ALWAYS"
    }
  }));
  const middle = meetupRoomMiddlePoint(rows);
  if (middle) {
    markers.push({
      id: 900,
      latitude: middle.latitude,
      longitude: middle.longitude,
      title: "中点",
      iconPath: "/assets/map/midpoint-coral.png",
      width: 42,
      height: 50,
      anchor: { x: 0.5, y: 1 },
      callout: {
        content: "中点",
        color: "#ffffff",
        fontSize: 12,
        borderRadius: 8,
        bgColor: "#ff4d6d",
        padding: 6,
        display: "ALWAYS"
      }
    });
  }
  return markers;
}

function meetupRoomLongDashPolylines(start, end, color) {
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

function meetupRoomPolylines(rows = []) {
  const middle = meetupRoomMiddlePoint(rows);
  if (!middle) return [];
  return meetupRoomCoordRows(rows).flatMap((row, index) => meetupRoomLongDashPolylines(
    { latitude: row.latitude, longitude: row.longitude },
    { latitude: middle.latitude, longitude: middle.longitude },
    index % 2 ? "#2e9f5bcc" : "#ff4d6dcc"
  ));
}

function meetupRoomIncludePoints(rows = []) {
  const points = meetupRoomCoordRows(rows).map((row) => ({
    latitude: row.latitude,
    longitude: row.longitude
  }));
  const middle = meetupRoomMiddlePoint(rows);
  if (middle) points.push(middle);
  return points;
}

function meetupRoomStatus(rows = []) {
  const normalized = normalizeMultiAreaRows(rows);
  const valid = validMultiAreaRows(normalized);
  const total = valid.reduce((sum, row) => sum + clampMultiAreaPeople(row.people), 0);
  if (!valid.length) return "等待添加出发位置";
  if (valid.length === 1) return `已定位 1 个出发地 · 还差 1 个`;
  return `已收集 ${valid.length} 个出发地 · 共 ${total} 人`;
}

// 把冗长逆地理地址精简成「区 · 街道 · 门牌」可读短串,避免输入框里被截断
function meetupRowsFromParticipants(participants = []) {
  return (participants || []).map((item, index) => ({
    id: String(item && item.id || `member-${index + 1}`),
    role: String(item && item.name || `成员${index + 1}`),
    people: clampMultiAreaPeople(item && item.people),
    location: String(item && item.location || "").trim(),
    latitude: Number.isFinite(Number(item && (item.lat ?? item.latitude))) ? Number(item.lat ?? item.latitude) : null,
    longitude: Number.isFinite(Number(item && (item.lng ?? item.longitude))) ? Number(item.lng ?? item.longitude) : null,
    pref: String(item && item.pref || "").trim(),
    travels: Array.isArray(item && item.travels) ? item.travels : [],
    updatedAt: Number(item && item.updatedAt) || 0,
    isHost: false,
    isSelf: false,
    joined: Boolean(item && item.location)
  }));
}

function participantFromMeetupRow(row, profile = {}) {
  const normalized = normalizeMeetupSelfProfile(profile);
  const source = row || selfMultiAreaRow(normalized);
  return {
    id: normalized.id,
    name: normalized.name || source.role || "我",
    people: clampMultiAreaPeople(source.people),
    location: String(source.location || "").trim(),
    lat: Number.isFinite(Number(source.latitude)) ? Number(source.latitude) : null,
    lng: Number.isFinite(Number(source.longitude)) ? Number(source.longitude) : null,
    pref: String(source.pref || "").trim(),
    travels: Array.isArray(source.travels) ? source.travels : []
  };
}

function decorateSharedMeetupRows(rows = [], profile = {}) {
  const normalizedProfile = normalizeMeetupSelfProfile(profile);
  const selfId = normalizedProfile.id;
  const prepared = normalizeMultiAreaRows(rows).map((row) => {
    const isSelf = String(row.id) === selfId || row.isSelf;
    const role = isSelf ? (normalizedProfile.name || row.role || "我") : (row.role || "成员");
    return {
      ...row,
      role,
      roleShort: isSelf ? "我" : shortMultiAreaRole(role, row.index),
      isHost: isSelf,
      isSelf,
      statusText: row.location ? (isSelf ? "已提交你的位置" : "已提交位置") : (isSelf ? "等你填写自己的位置" : "等待对方填写"),
      placeholder: isSelf ? "只填你自己的出发地" : row.placeholder
    };
  });
  if (!prepared.some((row) => row.isSelf)) prepared.unshift(selfMultiAreaRow(normalizedProfile));
  return normalizeMultiAreaRows(prepared).map((row, index) => {
    const isSelf = String(row.id) === selfId;
    return {
      ...row,
      index,
      isSelf,
      isHost: isSelf,
      role: isSelf ? (normalizedProfile.name || row.role || "我") : row.role,
      roleShort: isSelf ? "我" : shortMultiAreaRole(row.role, index),
      statusText: row.location ? (isSelf ? "已提交你的位置" : "已提交位置") : (isSelf ? "等你填写自己的位置" : "等待对方填写"),
      placeholder: isSelf ? "只填你自己的出发地" : row.placeholder
    };
  });
}

function meetupSelfRows(rows = []) {
  return normalizeMultiAreaRows(rows).filter((row) => row.isSelf).map((row, index) => ({ ...row, index: row.index ?? index }));
}

function meetupRosterRows(rows = []) {
  return normalizeMultiAreaRows(rows).map((row, index) => ({
    ...row,
    index,
    role: row.isSelf ? `${row.role || "我"}（我）` : row.role,
    rosterStatus: row.location ? row.location : "还没填位置"
  }));
}

function mergeMeetupRemoteRows(localRows = [], remoteRows = [], profile = {}) {
  const normalizedProfile = normalizeMeetupSelfProfile(profile);
  const byId = new Map();
  normalizeMultiAreaRows(remoteRows).forEach((row) => {
    if (row.id) byId.set(String(row.id), row);
  });
  const localSelf = normalizeMultiAreaRows(localRows).find((row) => String(row.id) === normalizedProfile.id || row.isSelf);
  if (localSelf) {
    const remoteSelf = byId.get(normalizedProfile.id);
    const localHasLocation = Boolean(localSelf.location);
    const remoteHasLocation = Boolean(remoteSelf && remoteSelf.location);
    if (!remoteSelf || localHasLocation || !remoteHasLocation) {
      byId.set(normalizedProfile.id, { ...remoteSelf, ...localSelf, id: normalizedProfile.id });
    }
  }
  if (!byId.has(normalizedProfile.id)) byId.set(normalizedProfile.id, selfMultiAreaRow(normalizedProfile));
  return decorateSharedMeetupRows([...byId.values()], normalizedProfile);
}

function compactAddressLabel(text) {
  const raw = String(text || "").replace(/^中国/, "").trim();
  if (!raw) return "";
  const parts = raw.split(/[·\s,，]+/).map((item) => item.trim()).filter(Boolean);
  const seen = [];
  for (const part of parts) {
    if (seen.some((kept) => kept === part || kept.includes(part) || part.includes(kept))) continue;
    seen.push(part);
  }
  const dropCity = seen.filter((part) => !/(省|自治区)$/.test(part) && !/^(北京市|上海市|天津市|重庆市)$/.test(part));
  const pick = dropCity.length ? dropCity : seen;
  return pick.slice(-3).join(" · ");
}

function readableCurrentLocation(coords) {
  if (coords && coords.locationSource === "city") return "";
  const text = String((coords && (coords.addressMeta || coords.label)) || "").trim();
  if (isCoarseLocationLabel(text)) return "";
  return compactAddressLabel(text);
}

function collectCardCommuteTexts(card) {
  const texts = [];
  ((card && card.summaryPills) || []).forEach((pill) => texts.push(String((pill && pill.text) || pill || "")));
  ((card && card.meta) || []).forEach((item) => texts.push(String(item || "")));
  return texts;
}

function extractMinutesByLabel(texts, label) {
  for (const text of texts) {
    if (!text.includes(label)) continue;
    const match = text.match(/(\d+)\s*分钟/);
    if (match) return Number(match[1]);
  }
  return 0;
}

function formatClockTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// 拍板后的出发建议:把“多远”翻译成“几点出发、几点到店”
function buildDepartureAdvice(card) {
  const texts = collectCardCommuteTexts(card);
  const walk = extractMinutesByLabel(texts, "步行");
  const drive = extractMinutesByLabel(texts, "驾车");
  const subway = extractMinutesByLabel(texts, "地铁");
  const lines = [];
  const now = new Date();
  let mode = "";
  let minutes = 0;
  if (walk > 0 && walk <= 30) {
    mode = "步行";
    minutes = walk;
  } else if (drive > 0 && (subway <= 0 || drive <= subway)) {
    mode = "驾车";
    minutes = drive;
  } else if (subway > 0) {
    mode = "地铁";
    minutes = subway;
  } else if (walk > 0) {
    mode = "步行";
    minutes = walk;
  }
  if (minutes > 0) {
    const arrive = new Date(now.getTime() + (minutes + 3) * 60000);
    lines.push(`现在 ${formatClockTime(now)} 出发，${mode}约 ${minutes} 分钟`);
    lines.push(`预计 ${formatClockTime(arrive)} 前后到店`);
  }
  const poi = (card && card.poi) || {};
  const openTime = String((card && card.openTimeText) || poi.opentimeToday || poi.opentimeWeek || "").trim();
  if (openTime) lines.push(`营业时间 ${openTime}`);
  const hour = now.getHours();
  if ((hour >= 11 && hour < 13) || (hour >= 18 && hour < 20)) {
    lines.push("饭点高峰，到店建议先取号再等人");
  }
  return lines;
}

Page({
  data: {
    screen: "game",
    categoryMode: "",
    pageTop: 14,
    soundTop: 10,
    menuRightPad: 96,
    bgmLabel: "🔊",
    bgmMuted: false,
    bgmLoading: true,
    bgmPlaying: false,
    homeCoverIndex: 0,
    sceneTags: makeTags(SCENE_TAGS),
    needTags: makeTags(NEED_TAGS),
    moreTags: makeTags(MORE_TAGS),
    problem: "",
    problemPlaceholder: "比如：刚下班有点累，想吃热乎的，朋友在苏州街",
    composerFocused: false,
    areaStep: "input",
    areaMode: "single",
    multiAreaRows: createDefaultMultiAreaRows(),
    multiAreaSummary: "等待收集多个出发位置",
    multiAreaReady: false,
    travelOptions: MEETUP_TRAVEL_OPTIONS,
    meetupRoomId: "",
    meetupSharedMode: false,
    meetupSelfId: "",
    meetupSelfName: "",
    meetupSelfRows: [],
    meetupRosterRows: [],
    meetupRoomSharePath: "",
    meetupRoomSyncing: false,
    meetupRoomSyncText: "",
    meetupRoomStatus: "等待添加出发位置",
    meetupRoomMapLat: DEFAULT_MEETUP_MAP.lat,
    meetupRoomMapLng: DEFAULT_MEETUP_MAP.lng,
    meetupRoomMarkers: [],
    meetupRoomPolylines: [],
    meetupRoomCircles: [],
    meetupRoomIncludePoints: [],
    meetupRoomHint: "先把每个人的出发地收齐，会自动算出对谁都公平的中间点。",
    partySize: 2,
    budgetPerPerson: 150,
    choiceHasInput: false,
    choiceNextText: "开局，抽餐厅卡",
    showInspiration: false,
    departureAdvice: [],
    meetupBoard: null,
    meetupBoardLoading: false,
    showVoiceInsight: false,
    voiceInsightState: "ready",
    voiceInsightQuestion: "",
    voiceIntentDetails: [],
    editingVoiceIntentIndex: -1,
    voiceAmapPreview: [],
    voiceSearchPlan: null,
    confirmedChoiceIntent: null,
    photoThumbs: [],
    useComicImages: false,
    comicImageHint: "关闭后直接用真实照片",
    recording: false,
    voiceTarget: "",
    modeName: "AI 模式",
    modeLabel: "智选",
    locationState: "loading",
    locationText: "定位：正在获取当前城市…",
    locationMeta: "",
    lastCoords: null,
    loadingDeck: false,
    loadingTitle: "",
    loadingText: "",
    loadingProgressVisible: false,
    loadingDone: 0,
    loadingTotal: TOTAL,
    loadingPercent: 0,
    loadingError: false,
    loadingActionText: "重新定位搜索",
    ready: false,
    totalCards: TOTAL,
    deck: [],
    pending: [],
    activePool: [],
    activeCard: null,
    deckLayers: [],
    leftN: TOTAL,
    pips: Array.from({ length: TOTAL }, () => ({ spent: false })),
    roundSlogan: "",
    cardTransform: "",
    cardMotionClass: "",
    stampPick: 0,
    stampPass: 0,
    toastText: "",
    showWin: false,
    winner: null,
    settleText: "",
    showPoiDetail: false,
    detailCard: null,
    detailPhotoIndex: 0,
    confettiPieces: []
  },

  onLoad(options = {}) {
    this.replayDeckHistory = new Map();
    this.bgmAttemptId = 0;
    this.bgmRecoveryTimer = null;
    this.applySystemChrome();
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        mixWithOther: true
      });
    }
    this.createBgmAudio();
    this.voiceManager = null;
    this.setupVoiceRecognizer();
    this.startBgm();
    this.updateChoiceNextAction();
    this.primeLocationStatus();
    const sharedRoomId = options && options.roomId ? decodeURIComponent(String(options.roomId)) : "";
    if (sharedRoomId) this.enterMeetupRoom(sharedRoomId, null, { fromShare: true });
  },

  onHide() {
    consumerProfile.flushUpload(); // 退到后台时把待上报事件发出去
    if (this.data.meetupSharedMode) this.publishMeetupSelfRow(this.data.multiAreaRows, { silent: true });
    this.stopMeetupRoomPolling();
    this.bgmResumeOnShow = !this.data.bgmMuted;
    this.bgmAttemptId = (this.bgmAttemptId || 0) + 1;
    clearTimeout(this.bgmRecoveryTimer);
    if (this.audio) {
      try {
        this.audio.pause();
      } catch (error) {
        console.warn("BGM pause on hide failed", error);
      }
    }
  },

  onShow() {
    if (this.data.meetupSharedMode) {
      this.startMeetupRoomPolling();
      this.pullMeetupRoom({ silent: true });
    }
    if (!this.bgmResumeOnShow) return;
    this.bgmResumeOnShow = false;
    if (!this.data.bgmMuted && !this.data.bgmPlaying) this.playBgm();
  },

  onShareAppMessage() {
    if (this.data.meetupSharedMode || this.data.areaMode === "multi") {
      const roomId = this.ensureMeetupRoomId();
      this.publishMeetupSelfRow(this.data.multiAreaRows, { silent: true });
      return {
        title: "来填你的位置，一起找中间点吃饭",
        path: meetupSharePath(roomId)
      };
    }
    return {
      title: "不做选择：写一句吃饭需求，直接抽餐厅卡",
      path: "/pages/play/play"
    };
  },

  onShareTimeline() {
    if (this.data.meetupSharedMode || this.data.areaMode === "multi") {
      const roomId = this.ensureMeetupRoomId();
      return {
        title: "来填你的位置，一起找中间点吃饭",
        query: roomId ? `roomId=${encodeURIComponent(roomId)}` : ""
      };
    }
    return {
      title: "不做选择：写一句吃饭需求，直接抽餐厅卡",
      query: ""
    };
  },

  applySystemChrome() {
    try {
      const system = typeof wx.getWindowInfo === "function" ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusTop = Number(system.statusBarHeight) || 0;
      let menuRightPad = 96;
      if (wx.getMenuButtonBoundingClientRect) {
        const menu = wx.getMenuButtonBoundingClientRect();
        const windowWidth = Number(system.windowWidth) || 0;
        if (menu && Number(menu.left) && windowWidth) {
          menuRightPad = Math.max(88, Math.ceil(windowWidth - Number(menu.left) + 10));
        }
      }
      this.setData({
        pageTop: Math.max(18, statusTop + 8),
        soundTop: Math.max(10, statusTop + 8),
        menuRightPad
      });
    } catch (error) {
      this.setData({ pageTop: 18, soundTop: 10, menuRightPad: 96 });
    }
  },

  onUnload() {
    this.stopVoiceRecognizer();
    this.destroyBgmAudio();
    this.stopMeetupRoomPolling();
    clearTimeout(this.meetupRoomPublishTimer);
    clearTimeout(this.bgmRecoveryTimer);
    clearInterval(this.revealTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.modeTimer);
    clearTimeout(this.motionTimer);
  },

  createBgmAudio() {
    if (typeof wx.createInnerAudioContext !== "function") return null;
    const audio = wx.createInnerAudioContext();
    audio.src = BGM_SRC;
    audio.loop = true;
    audio.autoplay = false;
    audio.volume = 0.72;
    audio.obeyMuteSwitch = false;
    audio.onPlay(() => {
      if (this.data.bgmMuted) {
        audio.pause();
        return;
      }
      this.setData({ bgmPlaying: true, bgmLoading: false, bgmLabel: "🔊" });
    });
    audio.onPause(() => {
      this.setData({ bgmPlaying: false, bgmLoading: false, bgmLabel: this.data.bgmMuted ? "🔇" : "🔊" });
    });
    audio.onStop(() => {
      this.setData({ bgmPlaying: false, bgmLoading: false, bgmLabel: this.data.bgmMuted ? "🔇" : "🔊" });
    });
    audio.onError((error) => {
      console.warn("BGM unavailable", error);
      this.setData({ bgmPlaying: false, bgmLoading: false, bgmLabel: this.data.bgmMuted ? "🔇" : "🔊" });
    });
    this.audio = audio;
    return audio;
  },

  destroyBgmAudio() {
    if (!this.audio) return;
    try {
      this.audio.stop();
      this.audio.destroy();
    } catch (error) {
      console.warn("BGM cleanup failed", error);
    }
    this.audio = null;
  },

  rebuildBgmAudio() {
    this.destroyBgmAudio();
    return this.createBgmAudio();
  },

  playBgm({ recover = true } = {}) {
    if (this.data.bgmMuted) return;
    if (!this.audio) this.createBgmAudio();
    if (!this.audio) return;
    const attemptId = (this.bgmAttemptId || 0) + 1;
    this.bgmAttemptId = attemptId;
    clearTimeout(this.bgmRecoveryTimer);
    this.setData({ bgmMuted: false, bgmLoading: true, bgmLabel: "…" });
    try {
      this.audio.volume = 0.72;
      this.audio.play();
    } catch (error) {
      console.warn("BGM play failed", error);
    }
    if (!recover) return;
    this.bgmRecoveryTimer = setTimeout(() => {
      if (this.bgmAttemptId !== attemptId || this.data.bgmMuted || this.data.bgmPlaying) return;
      const audio = this.rebuildBgmAudio();
      if (!audio) return;
      try {
        audio.play();
      } catch (error) {
        console.warn("BGM recovery failed", error);
        this.setData({ bgmPlaying: false, bgmLoading: false, bgmLabel: "🔊" });
      }
    }, 600);
  },

  toggleBgm() {
    if (this.data.bgmPlaying && !this.data.bgmMuted) {
      this.bgmAttemptId = (this.bgmAttemptId || 0) + 1;
      clearTimeout(this.bgmRecoveryTimer);
      this.setData({ bgmMuted: true, bgmLoading: false, bgmPlaying: false, bgmLabel: "🔇" });
      if (this.audio) this.audio.pause();
      return;
    }
    this.setData({ bgmMuted: false, bgmLoading: true, bgmLabel: "…" });
    this.playBgm();
  },

  startBgm() {
    if (this.data.bgmPlaying || this.data.bgmMuted) return;
    this.playBgm();
  },

  onHomeCoverChange(event) {
    const current = Number(event && event.detail && event.detail.current);
    if (Number.isFinite(current)) this.setData({ homeCoverIndex: current });
  },

  onHomeCoverTap(event) {
    const index = Number(event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.index);
    const current = Number.isFinite(index) ? index : Number(this.data.homeCoverIndex) || 0;
    if (current === 0) {
      this.setData({ homeCoverIndex: 1 });
      return;
    }
  },

  onHomeCoverTouchStart(event) {
    const touch = event && event.touches && event.touches[0];
    this.homeCoverStartX = touch ? touch.clientX : 0;
  },

  onHomeGroupCoverTouchEnd(event) {
    const changed = event && event.changedTouches && event.changedTouches[0];
    const startX = Number(this.homeCoverStartX) || 0;
    this.homeCoverStartX = 0;
    if (Number(this.data.homeCoverIndex) !== 1) return;
  },

  goGame() {
    this.startBgm();
    this.intentPreviewId = (this.intentPreviewId || 0) + 1;
    this.setData({
      screen: "game",
      areaStep: "input",
      areaMode: "single",
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    }, () => this.updateChoiceNextAction());
    this.primeLocationStatus();
  },

  goGroupGame() {
    this.startBgm();
    this.enterMeetupRoom();
  },

  goBackGame() {
    this.startBgm();
    this.setData({ screen: "game" });
  },

  // 主页快捷分支:咖啡 / 奶茶 / 美食外卖。点了直接按位置发牌,文字需求(如价格)仍可先写在输入框
  enterCategory(e) {
    const category = String(e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.category || "");
    if (category !== "coffee" && category !== "milktea" && category !== "food") return;
    this.startBgm();
    this.setData({
      categoryMode: category,
      areaMode: "single",
      areaStep: "input",
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1
    });
    this.startAiModeGame();
  },

  toggleInspiration() {
    this.setData({ showInspiration: !this.data.showInspiration });
  },

  selectAreaMode(e) {
    const mode = String(e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.mode || "");
    if (mode === "single") {
      this.stopMeetupRoomPolling();
      clearTimeout(this.meetupRoomPublishTimer);
      // 回单人:清掉组局的中间点结果,单人就按"我的位置"附近找,不再残留两人居中
      this.setData({
        areaMode: "single",
        areaStep: "input",
        meetupSharedMode: false,
        meetupRoomSyncing: false,
        meetupRoomSyncText: "",
        meetupBoard: null,
        meetupBoardLoading: false,
        partySize: 1,
        showVoiceInsight: false,
        editingVoiceIntentIndex: -1,
        confirmedChoiceIntent: null,
        voiceSearchPlan: null
      }, () => this.updateChoiceNextAction());
      this.invalidateRestaurantContext();
      return;
    }
    if (mode === "multi") {
      this.enterMeetupRoom();
    }
  },

  // The standalone mode-choice screen was removed (2026-06-11);
  // any legacy caller now lands back on the single-area input.
  goAreaModeChoice() {
    this.setData({
      areaStep: "input",
      areaMode: "single",
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    }, () => this.updateChoiceNextAction());
  },

  ensureMeetupRoomId() {
    const roomId = String(this.data.meetupRoomId || "").trim() || createMeetupRoomId();
    const sharePath = meetupSharePath(roomId);
    if (roomId !== this.data.meetupRoomId || sharePath !== this.data.meetupRoomSharePath) {
      this.setData({ meetupRoomId: roomId, meetupRoomSharePath: sharePath });
    }
    return roomId;
  },

  ensureMeetupSelfProfile() {
    let profile = null;
    if (typeof wx !== "undefined" && typeof wx.getStorageSync === "function") {
      try {
        profile = wx.getStorageSync(MEETUP_SELF_STORAGE_KEY);
      } catch (error) {
        console.warn("Load meetup self profile failed", error);
      }
    }
    profile = normalizeMeetupSelfProfile(profile || {
      id: this.data.meetupSelfId,
      name: this.data.meetupSelfName
    });
    if (typeof wx !== "undefined" && typeof wx.setStorageSync === "function") {
      try {
        wx.setStorageSync(MEETUP_SELF_STORAGE_KEY, profile);
      } catch (error) {
        console.warn("Save meetup self profile failed", error);
      }
    }
    if (profile.id !== this.data.meetupSelfId || profile.name !== this.data.meetupSelfName) {
      this.setData({ meetupSelfId: profile.id, meetupSelfName: profile.name });
    }
    return profile;
  },

  saveMeetupSelfProfile(profile) {
    const normalized = normalizeMeetupSelfProfile(profile);
    if (typeof wx !== "undefined" && typeof wx.setStorageSync === "function") {
      try {
        wx.setStorageSync(MEETUP_SELF_STORAGE_KEY, normalized);
      } catch (error) {
        console.warn("Save meetup self profile failed", error);
      }
    }
    this.setData({ meetupSelfId: normalized.id, meetupSelfName: normalized.name });
    return normalized;
  },

  loadMeetupRoomDraft(roomId) {
    if (!roomId || !wx.getStorageSync) return null;
    try {
      const draft = wx.getStorageSync(meetupRoomStorageKey(roomId));
      if (!draft || !Array.isArray(draft.rows)) return null;
      return draft;
    } catch (error) {
      console.warn("Load meetup room draft failed", error);
      return null;
    }
  },

  saveMeetupRoomDraft(rows = null) {
    const roomId = String(this.data.meetupRoomId || "").trim();
    if (!roomId || !wx.setStorageSync) return;
    try {
      wx.setStorageSync(meetupRoomStorageKey(roomId), {
        roomId,
        rows: normalizeMultiAreaRows(rows || this.data.multiAreaRows),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.warn("Save meetup room draft failed", error);
    }
  },

  scheduleMeetupRoomPublish(rows = null) {
    if (!this.data.meetupSharedMode || typeof wx === "undefined" || typeof wx.request !== "function") return;
    clearTimeout(this.meetupRoomPublishTimer);
    const snapshot = normalizeMultiAreaRows(rows || this.data.multiAreaRows);
    this.meetupRoomPublishTimer = setTimeout(() => {
      this.publishMeetupSelfRow(snapshot, { silent: true });
    }, 450);
  },

  publishMeetupSelfRow(rows = null, options = {}) {
    if (!this.data.meetupSharedMode || typeof wx === "undefined" || typeof wx.request !== "function") {
      return Promise.resolve(false);
    }
    const roomId = this.ensureMeetupRoomId();
    const profile = this.ensureMeetupSelfProfile();
    const normalized = normalizeMultiAreaRows(rows || this.data.multiAreaRows);
    const selfRow = normalized.find((row) => String(row.id) === profile.id || row.isSelf) || selfMultiAreaRow(profile);
    if (!options.silent) this.setData({ meetupRoomSyncing: true, meetupRoomSyncText: "正在同步你的位置" });
    return wxRequestJson({
      url: MEETUP_ROOM_ENDPOINT,
      method: "POST",
      data: {
        roomId,
        participant: participantFromMeetupRow(selfRow, profile)
      }
    }).then(() => {
      this.setData({ meetupRoomSyncing: false, meetupRoomSyncText: "已同步，朋友打开链接就能看到" });
      return true;
    }).catch((error) => {
      console.warn("Publish meetup room failed", error);
      this.setData({ meetupRoomSyncing: false, meetupRoomSyncText: "本地已保存，网络恢复后再同步" });
      return false;
    });
  },

  pullMeetupRoom(options = {}) {
    if (!this.data.meetupSharedMode || typeof wx === "undefined" || typeof wx.request !== "function") {
      return Promise.resolve(null);
    }
    const roomId = this.ensureMeetupRoomId();
    const profile = this.ensureMeetupSelfProfile();
    const seq = (this.meetupRoomPullSeq || 0) + 1;
    this.meetupRoomPullSeq = seq;
    if (!options.silent) this.setData({ meetupRoomSyncing: true, meetupRoomSyncText: "正在刷新成员位置" });
    return wxRequestJson({
      url: `${MEETUP_ROOM_ENDPOINT}?roomId=${encodeURIComponent(roomId)}`
    }).then((data) => {
      if (seq !== this.meetupRoomPullSeq) return data;
      const remoteRows = meetupRowsFromParticipants(data && data.participants);
      const rows = mergeMeetupRemoteRows(this.data.multiAreaRows, remoteRows, profile);
      this.refreshMeetupRoomState(rows, { skipPublish: true });
      const readyCount = validMultiAreaRows(rows).length;
      this.setData({ meetupRoomSyncing: false, meetupRoomSyncText: readyCount ? `已刷新 ${readyCount} 个出发地` : "等大家填写自己的位置" });
      return data;
    }).catch((error) => {
      console.warn("Pull meetup room failed", error);
      if (!options.silent) this.showToast("房间暂时没刷新，稍后再试");
      this.setData({ meetupRoomSyncing: false, meetupRoomSyncText: "本地草稿可用，稍后自动刷新" });
      return null;
    });
  },

  refreshSharedMeetupRoom() {
    this.pullMeetupRoom({ silent: false });
  },

  startMeetupRoomPolling() {
    if (!this.data.meetupSharedMode || typeof wx === "undefined" || typeof wx.request !== "function") return;
    this.stopMeetupRoomPolling();
    this.meetupRoomPoller = setInterval(() => {
      this.pullMeetupRoom({ silent: true });
    }, MEETUP_ROOM_POLL_MS);
  },

  stopMeetupRoomPolling() {
    if (this.meetupRoomPoller) clearInterval(this.meetupRoomPoller);
    this.meetupRoomPoller = null;
  },

  refreshMeetupRoomState(rows, options = {}) {
    const profile = {
      id: this.data.meetupSelfId,
      name: this.data.meetupSelfName
    };
    const normalized = this.data.meetupSharedMode
      ? decorateSharedMeetupRows(rows, profile)
      : normalizeMultiAreaRows(rows);
    const center = meetupRoomMapCenter(normalized, options.coords || this.data.lastCoords);
    this.setData({
      multiAreaRows: normalized,
      meetupSelfRows: meetupSelfRows(normalized),
      meetupRosterRows: meetupRosterRows(normalized),
      multiAreaSummary: multiAreaSummary(normalized),
      multiAreaReady: validMultiAreaRows(normalized).length >= 2,
      meetupRoomStatus: meetupRoomStatus(normalized),
      meetupRoomMapLat: center.lat,
      meetupRoomMapLng: center.lng,
      meetupRoomMarkers: meetupRoomMarkers(normalized),
      meetupRoomPolylines: meetupRoomPolylines(normalized),
      meetupRoomCircles: [],
      meetupRoomIncludePoints: meetupRoomIncludePoints(normalized),
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    }, () => this.updateChoiceNextAction());
    this.saveMeetupRoomDraft(normalized);
    if (this.data.meetupSharedMode && !options.skipPublish) this.scheduleMeetupRoomPublish(normalized);
    this.invalidateRestaurantContext();
  },

  syncMeetupCurrentLocation(coords) {
    const readable = readableCurrentLocation(coords);
    if (!readable) return false;
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    const profile = this.data.meetupSharedMode ? this.ensureMeetupSelfProfile() : null;
    let targetIndex = profile ? rows.findIndex((row) => String(row.id) === profile.id || row.isSelf) : -1;
    if (targetIndex < 0) targetIndex = rows.findIndex((row) => row.isHost);
    if (targetIndex < 0) targetIndex = 0;
    const target = rows[targetIndex] || (profile ? selfMultiAreaRow(profile) : normalizeMultiAreaRows(createDefaultMultiAreaRows())[0]);
    const role = profile ? (profile.name || target.role || "我") : "我的位置";
    rows[targetIndex] = {
      ...target,
      id: profile ? profile.id : target.id,
      isSelf: Boolean(profile),
      isHost: Boolean(profile) || target.isHost,
      role,
      roleShort: shortMultiAreaRole(role, targetIndex),
      location: readable,
      latitude: Number(coords.lat),
      longitude: Number(coords.lng),
      joined: true,
      statusText: "已定位"
    };
    this.refreshMeetupRoomState(rows, { coords });
    return true;
  },

  async refreshMeetupRoomLocation(options = {}) {
    try {
      const coords = await this.ensureLocation({ forceGps: true });
      const detailed = await this.refreshLocationAddress(coords).catch(() => coords);
      const updated = this.syncMeetupCurrentLocation(detailed || coords);
      if (!updated && !options.silent) this.showToast("只拿到城市定位，可手填具体出发地");
    } catch (error) {
      console.warn("Refresh meetup location failed", error);
      if (!options.silent) this.showToast("当前位置暂时没拿到，可手填出发地");
    }
  },

  enterMeetupRoom(roomId = "", rowsOverride = null) {
    const nextRoomId = String(roomId || this.ensureMeetupRoomId()).trim() || createMeetupRoomId();
    const profile = this.ensureMeetupSelfProfile();
    const draft = this.loadMeetupRoomDraft(nextRoomId);
    const seedRows = rowsOverride || (draft && draft.rows) || [selfMultiAreaRow(profile)];
    const rows = decorateSharedMeetupRows(seedRows, profile);
    this.setData({
      screen: "game",
      areaMode: "multi",
      areaStep: "multi",
      meetupRoomId: nextRoomId,
      meetupSharedMode: true,
      meetupSelfId: profile.id,
      meetupSelfName: profile.name,
      meetupRoomSharePath: meetupSharePath(nextRoomId),
      meetupRoomSyncText: "分享给朋友后，每个人只填自己的位置",
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    }, () => {
      this.refreshMeetupRoomState(rows, { skipPublish: false });
      this.pullMeetupRoom({ silent: true });
      this.startMeetupRoomPolling();
      this.refreshMeetupRoomLocation({ silent: true });
    });
  },

  goMultiAreaSetup() {
    this.enterMeetupRoom(this.data.meetupRoomId);
  },

  onMeetupNameInput(e) {
    const name = String(e.detail && e.detail.value || "").trim().slice(0, 24);
    const profile = this.saveMeetupSelfProfile({
      id: this.data.meetupSelfId || createMeetupParticipantId(),
      name
    });
    const rows = decorateSharedMeetupRows(this.data.multiAreaRows, profile);
    this.refreshMeetupRoomState(rows);
  },

  authorizeMeetupProfile() {
    if (typeof wx === "undefined" || typeof wx.getUserProfile !== "function") {
      this.showToast("点昵称输入框，可使用微信昵称");
      return;
    }
    wx.getUserProfile({
      desc: "用于在组局房间显示你的昵称",
      success: (res) => {
        const name = String(res && res.userInfo && res.userInfo.nickName || "").trim();
        if (!name) {
          this.showToast("没有拿到昵称，可以手动填");
          return;
        }
        const profile = this.saveMeetupSelfProfile({
          id: this.data.meetupSelfId || createMeetupParticipantId(),
          name
        });
        const rows = decorateSharedMeetupRows(this.data.multiAreaRows, profile);
        this.refreshMeetupRoomState(rows);
      },
      fail: () => this.showToast("可以手动填昵称")
    });
  },

  setMultiAreaRows(rows) {
    this.refreshMeetupRoomState(rows);
  },

  onMultiAreaLocationInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = String(e.detail && e.detail.value || "");
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (!rows[index]) return;
    rows[index] = { ...rows[index], location: value.trim(), latitude: null, longitude: null };
    this.setMultiAreaRows(rows);
  },

  chooseMultiAreaLocation(e) {
    const index = Number(e.currentTarget.dataset.index);
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (!rows[index]) return;
    if (typeof wx === "undefined" || typeof wx.chooseLocation !== "function") {
      this.showToast("当前微信版本不支持地图选点，可手动输入");
      return;
    }
    wx.chooseLocation({
      success: (res) => {
        const latitude = Number(res && res.latitude);
        const longitude = Number(res && res.longitude);
        const name = String(res && res.name || "").trim();
        const address = String(res && res.address || "").trim();
        const location = name || address || rows[index].location;
        const nextRows = normalizeMultiAreaRows(this.data.multiAreaRows);
        if (!nextRows[index] || !location) return;
        nextRows[index] = {
          ...nextRows[index],
          location,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          joined: true,
          statusText: nextRows[index].isSelf ? "已提交你的位置" : "已定位"
        };
        this.setMultiAreaRows(nextRows);
      },
      fail: (error) => {
        const message = String(error && error.errMsg || "");
        if (/cancel/i.test(message)) return;
        console.warn("Choose meetup location failed", error);
        this.showToast("地图选点暂时不可用，可手动输入");
      }
    });
  },

  onMultiAreaPeopleInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = e.detail && e.detail.value;
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (!rows[index]) return;
    rows[index] = { ...rows[index], people: clampMultiAreaPeople(value) };
    this.setMultiAreaRows(rows);
  },

  adjustMultiAreaPeople(e) {
    const index = Number(e.currentTarget.dataset.index);
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (!rows[index]) return;
    rows[index] = { ...rows[index], people: clampMultiAreaPeople(rows[index].people + delta) };
    this.setMultiAreaRows(rows);
  },

  addMultiAreaRow() {
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (rows.length >= MAX_MULTI_AREA_ROWS) {
      this.showToast("最多先填 6 个区域");
      return;
    }
    rows.push({ id: `friend-${Date.now()}`, role: defaultMultiAreaRole(rows.length), people: 1, location: "", joined: false });
    this.setMultiAreaRows(rows);
  },

  removeMultiAreaRow(e) {
    const index = Number(e.currentTarget.dataset.index);
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (rows.length <= 2 || rows[index] && rows[index].isHost) {
      this.showToast(rows[index] && rows[index].isHost ? "我的位置不能删" : "至少保留两个出发地");
      return;
    }
    rows.splice(index, 1);
    this.setMultiAreaRows(rows);
  },

  // 某人的口味/忌口自由输入(文字)
  onMultiAreaPrefInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = String(e.detail && e.detail.value || "");
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (!rows[index]) return;
    rows[index] = { ...rows[index], pref: value };
    this.setMultiAreaRows(rows);
  },

  // 某人的口味/忌口语音输入(复用主语音通道,目标=pref:index)
  startMultiAreaPrefVoice(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.toggleVoiceInput(`pref:${index}`);
  },

  // 出行方式多选切换
  toggleMultiAreaTravel(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = String(e.currentTarget.dataset.value || "");
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (!rows[index] || !value) return;
    const set = new Set(rows[index].travels || []);
    if (set.has(value)) { set.delete(value); } else { set.add(value); }
    rows[index] = { ...rows[index], travels: [...set] };
    this.setMultiAreaRows(rows);
  },

  // 收集完出发地→当场算中间点+逐人到达榜(结果态)
  async showMeetupRoomBoard() {
    if (this.data.meetupSharedMode) await this.pullMeetupRoom({ silent: true });
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    if (validMultiAreaRows(rows).length < 2) {
      this.showToast("先收齐至少两个出发地");
      return;
    }
    if (this.data.meetupBoardLoading) return;
    this.setData({ meetupBoardLoading: true });
    const coords = await this.ensureLocation().catch(() => null);
    let board = null;
    try {
      board = await resolveMeetupRoomBoard(rows, coords);
    } catch (error) {
      console.warn("meetup room board failed", error);
    }
    if (!board) {
      this.setData({ meetupBoardLoading: false });
      this.showToast("有出发地还认不出来，检查下再试");
      return;
    }
    this.setData({ meetupBoard: board, meetupBoardLoading: false, areaStep: "board" });
  },

  toggleMeetupBoardRow(event) {
    const board = this.data.meetupBoard;
    if (!board || !board.arrivalBoard || !Array.isArray(board.arrivalBoard.rows)) return;
    const rowIndex = Number(event.currentTarget.dataset.index);
    const nextIndex = board.arrivalBoard.expandedIndex === rowIndex ? -1 : rowIndex;
    this.setData({
      meetupBoard: {
        ...board,
        arrivalBoard: {
          ...board.arrivalBoard,
          expandedIndex: nextIndex,
          rows: board.arrivalBoard.rows.map((row, index) => ({ ...row, expanded: index === nextIndex }))
        }
      }
    });
  },

  backToMeetupCollect() {
    this.setData({ areaStep: "multi" });
  },

  confirmMultiAreaSetup() {
    const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
    const validRows = validMultiAreaRows(rows);
    if (validRows.length < 2) {
      this.showToast("至少填两个出发区域");
      return;
    }
    const partySize = Math.max(2, multiAreaPeopleTotal(rows));
    // 每人喜好/出行已收齐 → 直接开局,不再经过"再输入一句话"的共享文字环节
    this.setData({
      areaMode: "multi",
      multiAreaRows: rows,
      multiAreaSummary: multiAreaSummary(rows),
      multiAreaReady: true,
      partySize,
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    });
    this.invalidateRestaurantContext();
    this.startAiModeGame();
  },

  onProblemInput(e) {
    this.intentPreviewId = (this.intentPreviewId || 0) + 1;
    this.setData({
      problem: e.detail.value,
      showVoiceInsight: false,
      editingVoiceIntentIndex: -1,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    }, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
  },

  onComposerFocus() {
    if (!this.data.composerFocused) this.setData({ composerFocused: true });
  },

  onComposerBlur() {
    if (this.data.composerFocused) this.setData({ composerFocused: false });
  },

  toggleTag(e) {
    const group = e.currentTarget.dataset.group;
    const index = Number(e.currentTarget.dataset.index);
    const toggled = this.data[group][index] || {};
    const willSelect = !toggled.selected;
    const tags = this.data[group].map((item, idx) => idx === index ? { ...item, selected: !item.selected } : item);
    const next = { [group]: tags };
    const selected = selectedTagTexts([
      group === "sceneTags" ? tags : this.data.sceneTags,
      group === "needTags" ? tags : this.data.needTags,
      group === "moreTags" ? tags : this.data.moreTags
    ]);
    next.problem = withTagLine(this.data.problem, selected);
    next.showVoiceInsight = false;
    next.editingVoiceIntentIndex = -1;
    next.confirmedChoiceIntent = null;
    next.voiceSearchPlan = null;
    if (willSelect && toggled.text === "一人食") next.partySize = 1;
    if (willSelect && (toggled.text === "朋友聚餐" || toggled.text === "约会吃饭") && this.data.partySize < 2) next.partySize = 2;
    this.setData(next, () => this.updateChoiceNextAction());
    this.intentPreviewId = (this.intentPreviewId || 0) + 1;
    this.invalidateRestaurantContext();
  },

  onPartySizeChange(e) {
    const value = Math.max(1, Math.min(8, Math.round(Number(e.detail.value) || 2)));
    this.setData({ partySize: value, showVoiceInsight: false, editingVoiceIntentIndex: -1, confirmedChoiceIntent: null, voiceSearchPlan: null }, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
  },

  onBudgetChange(e) {
    const numeric = Number(e.detail.value);
    const raw = Math.round((Number.isFinite(numeric) ? numeric : 150) / 10) * 10;
    const value = Math.max(0, Math.min(500, raw));
    this.setData({ budgetPerPerson: value, showVoiceInsight: false, editingVoiceIntentIndex: -1, confirmedChoiceIntent: null, voiceSearchPlan: null }, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
  },

  invalidateRestaurantContext() {
    this.restaurantSearchKey = "";
  },

  getSelectedChoiceTags() {
    return selectedTagTexts([this.data.sceneTags, this.data.needTags, this.data.moreTags]);
  },

  updateChoiceNextAction() {
    const tags = this.getSelectedChoiceTags();
    const question = cleanChoiceQuestion(this.data.problem);
    const hasMultiArea = this.data.areaMode === "multi" && validMultiAreaRows(this.data.multiAreaRows).length >= 2;
    const choiceHasInput = Boolean(question || tags.length || hasMultiArea || this.data.partySize || this.data.budgetPerPerson);
    this.setData({
      choiceHasInput,
      choiceNextText: question ? "开局，抽餐厅卡" : (tags.length ? "按这些线索开局" : (hasMultiArea ? "按区域和预算开局" : "按人数预算开局"))
    });
  },

  async proceedChoiceToMode() {
    if (this.data.areaStep === "choice") {
      this.showToast("先选单区域或多区域");
      return;
    }
    if (this.data.areaMode === "multi" && validMultiAreaRows(this.data.multiAreaRows).length < 2) {
      this.setData({ areaStep: "multi" });
      this.showToast("先补齐至少两个区域");
      return;
    }
    const tags = this.getSelectedChoiceTags();
    const question = cleanChoiceQuestion(this.data.problem);
    if (!question && !tags.length && !this.data.partySize && !this.data.budgetPerPerson) {
      this.showToast("先写一句或点几个标签");
      return;
    }
    this.startBgm();
    this.setData({ showVoiceInsight: false, editingVoiceIntentIndex: -1, categoryMode: "" });
    this.startAiModeGame();
  },

  // 修正入口后置:从抽卡页回来打开“理解明细”编辑面板,改完直接重新发牌
  async openIntentEditor() {
    this.startBgm();
    const intentPreviewId = (this.intentPreviewId || 0) + 1;
    this.intentPreviewId = intentPreviewId;
    this.setData({
      screen: "game",
      areaStep: "input",
      showVoiceInsight: true,
      voiceInsightState: "loading",
      voiceInsightQuestion: "正在整理这局用的条件",
      voiceIntentDetails: [
        { label: "状态", key: "status", value: "马上列出这局的搜索条件，点卡片可改", wide: true, editable: false }
      ],
      editingVoiceIntentIndex: -1,
      voiceAmapPreview: [],
      voiceSearchPlan: null,
      confirmedChoiceIntent: null
    });
    const coords = await this.ensureLocation().catch(() => null);
    await this.renderChoiceIntent(coords, intentPreviewId);
  },

  async renderChoiceIntent(coords, intentPreviewId = this.intentPreviewId) {
    const choice = buildChoiceContext(this.data);
    let details = [];
    let amapPreview = [];
    let searchPlan = null;
    try {
      const preview = await buildRestaurantIntentPreview(choice, coords);
      details = preview.details || [];
      amapPreview = preview.amapPreview || [];
      searchPlan = preview.plan || null;
    } catch (error) {
      console.warn("restaurant intent preview fallback", error);
      const tags = choice.tags;
      const foodTags = tags.filter((tag) => MORE_TAGS.includes(tag));
      const keywords = uniq([
        ...foodTags,
        tags.includes("夜宵") ? "夜宵" : "",
        tags.includes("约会吃饭") ? "约会餐厅" : "",
        tags.includes("安静好聊") ? "安静餐厅" : "",
        choice.question ? "餐厅" : "",
        !foodTags.length && !tags.includes("夜宵") ? "餐厅" : ""
      ]);
      const coordText = coords
        ? `${coords.label || "定位点"} ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
        : (this.data.locationMeta || this.data.locationText || "等待定位");
      details = [
        { label: "意图", value: planSceneText(choice) },
        { label: "中间点", value: planMiddleText(choice), wide: true },
        { label: "餐厅类型", value: planRestaurantText(choice), wide: true },
        { label: "价格", value: planBudgetText(choice) },
        { label: "位置距离", value: planLocationText(choice), wide: true }
      ];
      amapPreview = [
        { label: "搜索中心", value: coordText, wide: true },
        { label: "关键词", value: keywords.join("、") || "餐厅", wide: true },
        { label: "范围", value: planLocationText(choice).replace(/^在/, "").replace(/找，/, " · ") },
        { label: "排序", value: tags.includes("人均150+") ? "距离优先，保留高人均店" : "距离优先，兼看评分" }
      ];
    }
    if (intentPreviewId !== this.intentPreviewId || !this.data.showVoiceInsight) return;
    this.setData({
      showVoiceInsight: true,
      voiceInsightState: "ready",
      voiceInsightQuestion: "这局按这些条件找，点卡片可改",
      voiceIntentDetails: editableVoiceIntentDetails(details),
      editingVoiceIntentIndex: -1,
      voiceAmapPreview: amapPreview,
      voiceSearchPlan: searchPlan,
      confirmedChoiceIntent: null
    });
  },

  onVoiceIntentFieldInput(e) {
    this.intentPreviewId = (this.intentPreviewId || 0) + 1;
    const index = Number(e.currentTarget.dataset.index);
    const value = String(e.detail && e.detail.value || "");
    const details = (this.data.voiceIntentDetails || []).map((item, idx) => (
      idx === index ? { ...item, value } : item
    ));
    this.setData({ voiceIntentDetails: details, confirmedChoiceIntent: null });
    this.invalidateRestaurantContext();
  },

  onVoiceIntentItemTap(e) {
    if (this.data.voiceInsightState === "loading") return;
    const index = Number(e.currentTarget.dataset.index);
    const item = (this.data.voiceIntentDetails || [])[index];
    if (!item || !item.editable) return;
    this.setData({ editingVoiceIntentIndex: index });
  },

  buildConfirmedChoiceIntent() {
    const fields = voiceIntentFieldsFromDetails(this.data.voiceIntentDetails);
    return {
      fields,
      basePlan: this.data.voiceSearchPlan || null,
      confirmedAt: Date.now()
    };
  },

  confirmChoiceIntent() {
    if (this.data.voiceInsightState === "loading") {
      this.showToast("条件还在整理，马上就好");
      return;
    }
    const confirmedChoiceIntent = this.buildConfirmedChoiceIntent();
    this.setData({ confirmedChoiceIntent }, () => {
      this.showToast("好，按修改后的理解来");
      this.startAiModeGame();
    });
  },

  reviseChoiceIntent() {
    this.intentPreviewId = (this.intentPreviewId || 0) + 1;
    this.setData({ showVoiceInsight: false, editingVoiceIntentIndex: -1, confirmedChoiceIntent: null, voiceSearchPlan: null }, () => this.updateChoiceNextAction());
    this.showToast("继续补充一句，我会重新理解");
  },

  setupVoiceRecognizer() {
    if (!speechPlugin || !speechPlugin.getRecordRecognitionManager) {
      this.voiceManager = null;
      return;
    }
    const manager = speechPlugin.getRecordRecognitionManager();
    this.voiceManager = manager;
    manager.onStart = () => {
      this.voiceStartedAt = Date.now();
      this.voiceInputBase = this.voiceBaseForTarget(this.data.voiceTarget);
      this.voiceLastResult = "";
      this.setData({ recording: true });
      this.showToast("正在听，再点一次结束");
    };
    manager.onRecognize = (res) => {
      const text = String(res && res.result || "").trim();
      if (text) {
        this.voiceLastResult = text;
        this.applyVoiceTextToInput(text);
      }
    };
    manager.onStop = (res) => {
      console.warn("Voice recognition stopped", res);
      const text = String(res && res.result || this.voiceLastResult || "").trim();
      this.voiceLastResult = "";
      this.finishVoiceText(text, res);
    };
    manager.onError = (err) => {
      console.warn("Voice recognition error", err);
      this.voiceInputBase = "";
      this.setData({ recording: false, voiceTarget: "" });
      this.showToast(this.voiceErrorText(err));
    };
  },

  stopVoiceRecognizer() {
    if (this.voiceManager && this.data.recording) {
      try {
        this.setData({ recording: false, voiceTarget: "" });
        this.voiceManager.stop();
      } catch (error) {
        console.warn("Stop voice recognizer failed", error);
        this.voiceInputBase = "";
        this.voiceLastResult = "";
        this.showToast("语音已结束");
      }
    }
  },

  startChoiceVoice() {
    this.toggleVoiceInput("problem");
  },

  toggleVoiceInput(target) {
    if (this.data.recording) {
      this.stopVoiceRecognizer();
      return;
    }
    if (!this.voiceManager) this.setupVoiceRecognizer();
    if (!this.voiceManager) {
      this.showToast("语音插件未生效，请确认后台已添加同声传译");
      return;
    }
    this.ensureRecordPermission()
      .then(() => {
        this.voiceStartedAt = Date.now();
        this.voiceInputBase = this.voiceBaseForTarget(target);
        this.voiceLastResult = "";
        this.setData({ voiceTarget: target, recording: true });
        this.showToast("正在听，再点一次结束");
        try {
          this.voiceManager.start({ duration: 30000, lang: "zh_CN" });
        } catch (err) {
          this.voiceInputBase = "";
          this.voiceLastResult = "";
          this.setData({ recording: false, voiceTarget: "" });
          this.showToast(this.voiceErrorText(err));
        }
      })
      .catch((err) => {
        console.warn("Record permission unavailable", err);
        this.showToast("请允许麦克风权限后再试");
      });
  },

  ensureRecordPermission() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (settings) => {
          const auth = settings.authSetting || {};
          if (auth["scope.record"]) {
            resolve();
            return;
          }
          if (auth["scope.record"] === false) {
            wx.openSetting({
              success: (next) => next.authSetting && next.authSetting["scope.record"] ? resolve() : reject(new Error("record denied")),
              fail: reject
            });
            return;
          }
          wx.authorize({
            scope: "scope.record",
            success: resolve,
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  finishVoiceText(text, meta) {
    this.setData({ recording: false, voiceTarget: "" });
    if (!text) {
      this.voiceInputBase = "";
      this.showToast(this.emptyVoiceText(meta));
      return;
    }
    this.applyVoiceTextToInput(text);
    this.voiceInputBase = "";
  },

  // 语音目标的当前文本基线:pref:N 为某成员的口味/忌口输入,否则为主输入框
  voiceBaseForTarget(target) {
    if (typeof target === "string" && target.indexOf("pref:") === 0) {
      const index = Number(target.slice(5));
      const rows = this.data.multiAreaRows || [];
      return rows[index] ? String(rows[index].pref || "").trim() : "";
    }
    return String(this.data.problem || "").trim();
  },

  applyVoiceTextToInput(text) {
    const spoken = String(text || "").trim();
    if (!spoken) return;
    const base = String(this.voiceInputBase || "").trim();
    const combined = base ? `${base} ${spoken}` : spoken;
    const target = this.data.voiceTarget;
    if (typeof target === "string" && target.indexOf("pref:") === 0) {
      const index = Number(target.slice(5));
      const rows = normalizeMultiAreaRows(this.data.multiAreaRows);
      if (rows[index]) {
        rows[index] = { ...rows[index], pref: combined };
        this.setMultiAreaRows(rows);
      }
      return;
    }
    this.setData({ problem: combined, showVoiceInsight: false }, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
  },

  voiceErrorText(err) {
    const message = String(err && (err.errMsg || err.message) || "");
    if (/auth|permission|authorize|denied|record/i.test(message)) {
      return "请允许麦克风权限后再试";
    }
    if (/network|timeout|connect|request/i.test(message)) {
      return "语音识别网络不稳，再试一次";
    }
    if (/plugin|requirePlugin|WechatSI/i.test(message)) {
      return "语音插件未生效，请重新打开小程序";
    }
    if (/microphone|mic|audio|busy|system/i.test(message)) {
      return "麦克风暂时不可用，稍后再试";
    }
    return "语音识别失败，再试一次";
  },

  emptyVoiceText(meta) {
    const elapsed = Date.now() - (this.voiceStartedAt || Date.now());
    const errMsg = String(meta && meta.errMsg || "");
    if (elapsed < 1200) return "时间太短了，说完一句再点结束";
    if (/fail|error/i.test(errMsg)) return "语音服务没返回文字，再试一次";
    return "没有识别到文字，靠近麦克风再说一次";
  },

  chooseChoicePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sizeType: ["compressed"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        const path = file && file.tempFilePath;
        if (!path) return;
        this.setData({ photoThumbs: this.data.photoThumbs.concat(path) });
        this.showToast("已添加图片，会一起作为选择依据");
      }
    });
  },

  onCardImageError(event) {
    const current = this.data.activeCard;
    if (!current) return;
    const failed = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.url || current.image;
    if (!failed) return;
    const cleanCard = (card) => {
      if (!card || card.name !== current.name) return card;
      const photoSlides = (card.photoSlides || []).filter((item) => item.url !== failed);
      const photoGallery = photoSlides.map((item) => item.url);
      return { ...card, image: photoGallery[0] || "", photoSlides, photoGallery };
    };
    this.setData({
      activeCard: cleanCard(current),
      deck: this.data.deck.map(cleanCard),
      activePool: this.data.activePool.map(cleanCard)
    });
  },

  onWinnerImageError() {
    const winner = this.data.winner;
    if (!winner || !winner.image) return;
    this.setData({ winner: { ...winner, image: "" } });
  },

  toggleComicImages() {
    const useComicImages = !this.data.useComicImages;
    this.setData({
      useComicImages,
      comicImageHint: useComicImages ? "开启后等 5 张漫画图生成" : "关闭后直接用真实照片"
    });
    this.showToast(useComicImages ? "已开启漫画卡面，会多等一会儿" : "已关闭漫画卡面，直接用真实照片");
  },

  startAiModeGame() {
    this.modeStarting = false;
    clearTimeout(this.modeTimer);
    this.startGame("AI 模式", "智选");
  },

  isActiveSearchRun(searchRunId) {
    return !searchRunId || this.searchRunId === searchRunId;
  },

  async startGame(modeName, modeLabel, options = {}) {
    this.startBgm();
    clearInterval(this.revealTimer);
    this.pendingDeckSignature = "";
    const searchRunId = (this.searchRunId || 0) + 1;
    this.searchRunId = searchRunId;
    this.setData({
      screen: "deck",
      modeName,
      modeLabel,
      loadingDeck: true,
      loadingTitle: "发牌中…",
      loadingText: "正在按你这句话找真实餐厅，先发 5 张。",
      loadingProgressVisible: false,
      loadingDone: 0,
      loadingTotal: TOTAL,
      loadingPercent: 0,
      loadingError: false,
      loadingActionText: "重新定位搜索",
      ready: false,
      showWin: false,
      deck: [],
      pending: [],
      activePool: [],
      activeCard: null,
      deckLayers: [],
      roundSlogan: "",
      cardTransform: "",
      cardMotionClass: "",
      stampPick: 0,
      stampPass: 0
    });
    const cards = await this.loadCards(modeName, { forceLocationRefresh: Boolean(options.forceLocationRefresh), searchRunId });
    if (!this.isActiveSearchRun(searchRunId) || !cards.length) return;
    const readyCards = await this.prepareVisualCards(cards, searchRunId);
    if (!this.isActiveSearchRun(searchRunId)) return;
    if (!readyCards.length) {
      this.showDeckError("没有拿到真实餐厅", "这次高德没有返回可用餐厅，点下面重新定位再试。");
      return;
    }
    const deckCards = this.arrangeReplayCards(readyCards, this.pendingDeckSignature);
    this.resetDeck(deckCards, { shuffle: false });
    this.rememberReplayDeck(this.pendingDeckSignature, deckCards);
  },

  resetDeck(cards, options = {}) {
    const activePool = (cards || []).map((card, index) => decorateCard(card, index));
    const deck = options.shuffle ? shuffleCards(activePool) : activePool.slice();
    if (!deck.length) {
      this.showDeckError("没有拿到真实餐厅", "这次高德没有返回可用餐厅，点下面重新定位再试。");
      return;
    }
    this.setData({
      loadingDeck: false,
      loadingProgressVisible: false,
      loadingError: false,
      ready: false,
      totalCards: activePool.length,
      activePool,
      deck,
      pending: [],
      activeCard: deck[0] || null,
      deckLayers: this.deckLayers(deck.length),
      leftN: deck.length,
      pips: this.pipsFor(deck.length, activePool.length),
      roundSlogan: deck[0] ? deck[0].slogan : "",
      cardTransform: "",
      cardMotionClass: "",
      stampPick: 0,
      stampPass: 0
    });
    this.dealRound();
  },

  deckLayers(length) {
    return Array.from({ length: Math.min(2, Math.max(0, length - 1)) }, (_, i) => ({ level: i + 1 }));
  },

  pipsFor(left, total = TOTAL) {
    return Array.from({ length: Math.max(1, total) }, (_, index) => ({ spent: index >= left }));
  },

  dealRound() {
    clearInterval(this.revealTimer);
    const deck = this.data.deck;
    if (!deck.length) return;
    this.setData({
      ready: false,
      cardTransform: "",
      cardMotionClass: "",
      stampPick: 0,
      stampPass: 0
    });
    let k = 0;
    const total = 5 + Math.floor(Math.random() * 3);
    const pool = this.data.activePool.length ? this.data.activePool : deck;
    this.revealTimer = setInterval(() => {
      const next = pool[k % pool.length];
      k += 1;
      if (k >= total) {
        clearInterval(this.revealTimer);
        this.setData({
          activeCard: deck[0],
          roundSlogan: deck[0].slogan || "",
          ready: true
        });
        return;
      }
      this.setData({
        activeCard: next,
        roundSlogan: next.slogan || ""
      });
    }, 70);
  },

  tapDecision(e) {
    const dir = e.currentTarget.dataset.dir;
    if (!this.data.ready || !this.data.activeCard) {
      this.showToast("等卡牌亮完再选");
      return;
    }
    this.decideByDir(dir);
  },

  onCardTouchStart(e) {
    if (!this.data.ready || !e.touches || !e.touches.length) return;
    const touch = e.touches[0];
    this.drag = { sx: touch.clientX, sy: touch.clientY, x: 0, y: 0 };
  },

  onCardTouchMove(e) {
    if (!this.drag || !e.touches || !e.touches.length) return;
    const touch = e.touches[0];
    const x = touch.clientX - this.drag.sx;
    const y = touch.clientY - this.drag.sy;
    this.drag.x = x;
    this.drag.y = y;
    const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) rotate(${(x / 16).toFixed(2)}deg)`;
    this.setData({
      cardTransform: transform,
      stampPick: Math.max(0, Math.min(1, x / 85)),
      stampPass: Math.max(0, Math.min(1, -x / 85))
    });
  },

  onCardTouchEnd() {
    if (!this.drag) return;
    const { x } = this.drag;
    this.drag = null;
    const threshold = 82;
    if (x > threshold) {
      this.decideByDir("right");
      return;
    }
    if (x < -threshold) {
      this.decideByDir("left");
      return;
    }
    this.setData({ cardTransform: "", stampPick: 0, stampPass: 0 });
  },

  decideByDir(dir) {
    if (!this.data.deck.length) return;
    if (dir !== "right" && dir !== "left") return;
    const current = this.data.deck[0];
    const rest = this.data.deck.slice(1);
    const pending = this.data.pending.slice();
    this.setData({ ready: false, cardTransform: "", stampPick: 0, stampPass: 0 });

    if (dir === "right") {
      this.setData({ cardMotionClass: "flyR" });
      this.motionTimer = setTimeout(() => this.showWinner(current, false), 250);
      return;
    }

    if (dir === "left") {
      this.setData({ cardMotionClass: "flyL" });
      this.motionTimer = setTimeout(() => {
        pending.push(current);
        this.afterRemove(rest, pending, "Pass · 待定 +1");
      }, 280);
      return;
    }
  },

  afterRemove(deck, pending, msg) {
    this.showToast(msg);
    if (!deck.length) {
      this.setData({ deck, pending, leftN: 0, pips: this.pipsFor(0) });
      this.settleByFate(pending);
      return;
    }
    this.setData({
      deck,
      pending,
      activeCard: deck[0],
      deckLayers: this.deckLayers(deck.length),
      leftN: deck.length,
      pips: this.pipsFor(deck.length),
      roundSlogan: deck[0].slogan || "",
      cardMotionClass: "",
      cardTransform: "",
      stampPick: 0,
      stampPass: 0
    });
    this.dealRound();
  },

  settleByFate(pending) {
    const candidates = pending.length ? pending : this.data.activePool;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.showWinner(pick, true);
  },

  showWinner(card, byFate) {
    consumerProfile.recordEvent("pick", card); // 行为养成:拍板=一次正向选择
    const settleText = byFate ? (MODE_SETTLE_COPY[this.data.modeName] || "就它了！") : "就它了！";
    const winner = {
      ...card,
      winReason: `${card.slogan ? `${card.slogan}。 ` : ""}${card.reason || ""}`
    };
    this.setData({
      ready: false,
      showWin: true,
      winner,
      settleText,
      departureAdvice: buildDepartureAdvice(card),
      confettiPieces: this.makeConfetti()
    });
  },

  makeConfetti() {
    const colors = ["#ff5a4d", "#6c5ce7", "#f6c518", "#28c76f", "#3d6bff", "#1a1714"];
    return Array.from({ length: 90 }, (_, index) => ({
      left: Math.round(Math.random() * 100),
      color: colors[index % colors.length],
      delay: Math.round(Math.random() * 500),
      duration: Math.round(1600 + Math.random() * 1600)
    }));
  },

  setLoading(title, text, progress) {
    const total = Math.max(1, Number(progress && progress.total) || TOTAL);
    const done = Math.max(0, Math.min(total, Number(progress && progress.done) || 0));
    this.setData({
      loadingDeck: true,
      loadingTitle: title,
      loadingText: text,
      loadingProgressVisible: Boolean(progress),
      loadingDone: done,
      loadingTotal: total,
      loadingPercent: Math.round((done / total) * 100),
      loadingError: false,
      loadingActionText: "重新定位搜索"
    });
  },

  showDeckError(title, text) {
    clearInterval(this.revealTimer);
    this.setData({
      loadingDeck: true,
      loadingTitle: title,
      loadingText: text,
      loadingProgressVisible: false,
      loadingDone: 0,
      loadingTotal: TOTAL,
      loadingPercent: 0,
      loadingError: true,
      loadingActionText: "重新定位搜索",
      ready: false,
      activePool: [],
      deck: [],
      pending: [],
      activeCard: null,
      deckLayers: [],
      leftN: 0,
      pips: this.pipsFor(0, TOTAL),
      roundSlogan: "",
      cardTransform: "",
      cardMotionClass: "",
      stampPick: 0,
      stampPass: 0
    });
  },

  retryDeckSearch() {
    this.startGame(this.data.modeName || "AI 模式", this.data.modeLabel || "智选", { forceLocationRefresh: true });
  },

  async prepareVisualCards(cards, searchRunId = this.searchRunId) {
    const total = Math.min(TOTAL, cards.length || TOTAL);
    this.setLoading("正在加载餐厅卡", "确认 5 张真实餐厅卡后直接发牌。", { done: 0, total });
    if (this.data.useComicImages) {
      this.showToast("漫画卡面生成需要后端接口，当前先用真实照片");
    }
    const results = [];
    for (let i = 0; i < cards.length; i += 1) {
      const readyCard = await this.readyDisplayCard(cards[i]);
      if (!this.isActiveSearchRun(searchRunId)) return [];
      results.push(readyCard);
      this.setLoading("正在加载餐厅卡", `第 ${Math.min(i + 1, total)} 张已加载。`, { done: Math.min(i + 1, total), total });
    }
    return results;
  },

  readyDisplayCard(card) {
    return Promise.resolve(card);
  },

  async loadCards(modeName, options = {}) {
    const searchRunId = options.searchRunId || this.searchRunId;
    const guardedSetLoading = (title, text, progress) => {
      if (this.isActiveSearchRun(searchRunId)) this.setLoading(title, text, progress);
    };
    const guardedToast = (text) => {
      if (this.isActiveSearchRun(searchRunId)) this.showToast(text);
    };
    try {
      guardedSetLoading("正在读取当前位置", "3 秒内拿不到精准定位，就先按城市定位发牌。");
      const coords = await this.ensureLocation({ forceGps: Boolean(options.forceLocationRefresh) });
      if (!this.isActiveSearchRun(searchRunId)) return [];
      if (!coords) throw new Error("no location");
      guardedSetLoading("正在定位附近餐厅", "位置已确认，正在从高德拿真实餐厅。");
      const choice = buildChoiceContext(this.data);
      choice.preferredBrands = consumerProfile.getPreferredBrands(); // 画像:优先用户常点品牌
      const replaySignature = this.choiceReplaySignature(modeName, coords);
      this.pendingDeckSignature = replaySignature;
      const result = await loadRestaurantDeck({
        modeName,
        choice,
        coords,
        avoidCardKeys: this.replayAvoidKeys(replaySignature),
        setLoading: guardedSetLoading,
        toast: guardedToast
      });
      if (!this.isActiveSearchRun(searchRunId)) return [];
      if (result.cards.length >= TOTAL) return result.cards;
      if (result.cards.length > 0) return result.cards;
      throw new Error("empty pois");
    } catch (error) {
      console.warn("restaurant cards unavailable", error);
      if (!this.isActiveSearchRun(searchRunId)) return [];
      this.showToast("没有拿到真实餐厅，请重试");
      this.showDeckError("没有拿到真实餐厅", "这次高德没有返回可用餐厅，点下面重新定位再试。");
      return [];
    }
  },

  choiceReplaySignature(modeName, coords) {
    const tags = this.getSelectedChoiceTags().slice().sort();
    const question = cleanChoiceQuestion(this.data.problem);
    const partySize = Number(this.data.partySize) || 0;
    const budgetPerPerson = Number(this.data.budgetPerPerson) || 0;
    const multiAreas = validMultiAreaRows(this.data.multiAreaRows).map((row) => ({
      people: clampMultiAreaPeople(row.people),
      location: row.location
    }));
    const location = coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng))
      ? `${Number(coords.lat).toFixed(4)},${Number(coords.lng).toFixed(4)}`
      : "";
    return JSON.stringify({ modeName, question, tags, partySize, budgetPerPerson, areaMode: this.data.areaMode || "single", category: this.data.categoryMode || "", multiAreas, location });
  },

  replayAvoidKeys(signature) {
    if (!signature) return [];
    const entry = this.replayDeckHistory && this.replayDeckHistory.get(signature);
    return entry && Array.isArray(entry.seenKeys) ? entry.seenKeys : [];
  },

  arrangeReplayCards(cards, signature) {
    const list = (cards || []).filter(Boolean);
    if (!signature || list.length <= 1) return list;
    const entry = this.replayDeckHistory && this.replayDeckHistory.get(signature);
    const keys = replayDeckKeys(list);
    if (entry && sameReplayOrder(keys, entry.lastKeys || [])) return rotateReplayCards(list);
    return list;
  },

  rememberReplayDeck(signature, cards) {
    if (!signature || !cards || !cards.length) return;
    if (!this.replayDeckHistory) this.replayDeckHistory = new Map();
    const keys = replayDeckKeys(cards);
    if (!keys.length) return;
    const previous = this.replayDeckHistory.get(signature) || { seenKeys: [] };
    this.replayDeckHistory.delete(signature);
    this.replayDeckHistory.set(signature, {
      seenKeys: uniq([...(previous.seenKeys || []), ...keys]),
      lastKeys: keys
    });
    const maxEntries = 12;
    while (this.replayDeckHistory.size > maxEntries) {
      const oldest = this.replayDeckHistory.keys().next().value;
      this.replayDeckHistory.delete(oldest);
    }
  },

  primeLocationStatus() {
    if (this.data.lastCoords) {
      if (this.data.locationState !== "city" && isGenericLocationLabel(this.data.lastCoords)) this.refreshLocationAddress(this.data.lastCoords);
      return;
    }
    if (this.locationPromise) return;
    this.setData({ locationState: "loading", locationText: "定位：正在获取当前位置…", locationMeta: "" });
    this.ensureLocation().catch(() => null);
  },

  applyLocationDetail(coords, detail, seq) {
    if (seq && this.locationSeq !== seq) return null;
    const normalized = normalizeLocationDetail(detail);
    if (!normalized) return null;
    const updatedCoords = {
      ...coords,
      label: normalized.title,
      addressMeta: normalized.meta || normalized.title
    };
    this.setData({
      lastCoords: updatedCoords,
      locationState: "gps",
      locationText: `当前位置：${normalized.title}`,
      locationMeta: ""
    });
    return updatedCoords;
  },

  refreshLocationAddress(coords) {
    if (!coords || this.locationAddressPromise) return this.locationAddressPromise || Promise.resolve(coords);
    const seq = this.locationSeq || Date.now();
    this.locationSeq = seq;
    if (isGenericLocationLabel(coords)) {
      this.setData({
        locationState: "gps",
        locationText: "当前位置：正在解析地址…",
        locationMeta: ""
      });
    }
    this.locationAddressPromise = withTimeout(reverseGeocodeLocation(coords), 4000, "地址解析超时")
      .then((detail) => this.applyLocationDetail(coords, detail, seq) || coords)
      .catch((error) => {
        console.warn("Location address refresh unavailable", error);
        if (this.locationSeq === seq) {
          const fallbackTitle = stableLocationFallbackTitle(coords);
          const fallbackCoords = { ...coords, label: fallbackTitle, addressMeta: fallbackTitle };
          this.setData({
            lastCoords: fallbackCoords,
            locationState: "gps",
            locationText: `当前位置：${fallbackTitle}`,
            locationMeta: shortLocationError(error)
          });
          return fallbackCoords;
        }
        return coords;
      })
      .finally(() => {
        this.locationAddressPromise = null;
      });
    return this.locationAddressPromise;
  },

  ensureLocation(options = {}) {
    const forceGps = Boolean(options.forceGps);
    if (this.data.lastCoords && !forceGps) {
      if (this.data.locationState !== "city" && isGenericLocationLabel(this.data.lastCoords)) this.refreshLocationAddress(this.data.lastCoords);
      return Promise.resolve(this.data.lastCoords);
    }
    if (this.locationPromise) return this.locationPromise;
    const seq = Date.now();
    this.locationSeq = seq;
    this.setData({ locationState: "loading", locationText: "定位：正在获取当前位置…", locationMeta: "" });
    this.locationPromise = getCurrentPosition()
      .then(async (coords) => {
        const gpsCoords = { ...coords, locationSource: "gps" };
        this.setData({
          lastCoords: gpsCoords,
          locationState: "gps",
          locationText: "当前位置：正在解析地址…",
          locationMeta: ""
        });
        this.refreshLocationAddress(gpsCoords);
        return gpsCoords;
      })
      .catch((error) => {
        this.showToast(error.message || "定位失败，改用城市定位");
        this.setData({
          locationState: "error",
          locationText: "定位：精准定位不可用，改用城市定位",
          locationMeta: ""
        });
        return getApproxPosition().then((coords) => {
          const cityCoords = { ...coords, locationSource: "city" };
          this.setData({
            lastCoords: cityCoords,
            locationState: "city",
            locationText: `城市定位：${coords.label || "当前城市"}`,
            locationMeta: `坐标 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
          });
          return cityCoords;
        });
      })
      .finally(() => {
        this.locationPromise = null;
      });
    return this.locationPromise;
  },

  openWinnerNavigation() {
    const card = this.data.winner;
    this.openCardNavigation(card);
  },

  openActiveCardNavigation(event) {
    this.drag = null;
    consumerProfile.recordEvent("navigate", this.data.activeCard); // 去导航=强正向信号
    this.setData({ cardTransform: "", stampPick: 0, stampPass: 0 });
    this.openCardNavigation(this.data.activeCard);
  },

  openActiveCardDetail(event) {
    if (isCardNavigationEvent(event)) return;
    this.openCardDetail(this.data.activeCard);
  },

  // 卡面「去下单」(咖啡/奶茶/外卖):≤1km 跳品牌点单小程序自取,>1km 跳美团外卖
  orderActiveCard(event) {
    this.drag = null;
    this.setData({ cardTransform: "", stampPick: 0, stampPass: 0 });
    this.goOrderForCard(this.data.activeCard);
  },

  // 拍板结果页「去下单」
  orderWinner() {
    this.goOrderForCard(this.data.winner);
  },

  goOrderForCard(card) {
    if (!card) return;
    const name = String(card.name || "");
    const distance = Number(card.poi && card.poi.distance);
    const near = Number.isFinite(distance) && distance > 0 && distance <= ORDER_NEAR_METERS;
    const brand = card.brand || "";
    consumerProfile.recordEvent("order", card); // 去下单=强正向信号
    if (wx.setClipboardData) {
      wx.setClipboardData({ data: name, success() {}, fail() {} });
    }
    // ≤1km 优先品牌自营点单小程序;否则(>1km 或无品牌 appId)走美团
    const targetAppId = (near && orderAppIdForBrand(brand)) || ORDER_TARGETS.meituan || "";
    if (targetAppId) {
      wx.navigateToMiniProgram({
        appId: targetAppId,
        fail: () => this.orderFallbackHint(near, name, brand)
      });
      return;
    }
    this.orderFallbackHint(near, name, brand);
  },

  orderFallbackHint(near, name, brand) {
    const where = near ? (brand ? `${brand}小程序` : "门店/美团到店自取") : "美团/饿了么";
    wx.showToast({ title: `已复制店名，去${where}搜「${name}」`, icon: "none", duration: 2600 });
  },

  selectActiveMeetupRoute(event) {
    const routeIndex = Number(event.currentTarget.dataset.index) || 0;
    const activeCard = withSelectedMeetupRoute(this.data.activeCard, routeIndex);
    const updateCard = (card) => sameCardIdentity(card, activeCard) ? activeCard : card;
    this.setData({
      activeCard,
      deck: this.data.deck.map(updateCard),
      activePool: this.data.activePool.map(updateCard)
    });
  },

  selectDetailRoute(event) {
    const routeIndex = Number(event.currentTarget.dataset.index) || 0;
    this.setData({ detailCard: withSelectedDetailRoute(this.data.detailCard, routeIndex) });
  },

  toggleArrivalRow(event) {
    const card = this.data.activeCard;
    if (!card || !card.arrivalBoard || !Array.isArray(card.arrivalBoard.rows)) return;
    const rowIndex = Number(event.currentTarget.dataset.index);
    const nextIndex = card.arrivalBoard.expandedIndex === rowIndex ? -1 : rowIndex;
    const arrivalBoard = {
      ...card.arrivalBoard,
      expandedIndex: nextIndex,
      rows: card.arrivalBoard.rows.map((row, index) => ({ ...row, expanded: index === nextIndex }))
    };
    const activeCard = { ...card, arrivalBoard };
    const updateCard = (item) => sameCardIdentity(item, activeCard) ? activeCard : item;
    this.setData({
      activeCard,
      deck: this.data.deck.map(updateCard),
      activePool: this.data.activePool.map(updateCard)
    });
  },

  openWinnerDetail() {
    this.openCardDetail(this.data.winner);
  },

  openCardDetail(card) {
    if (!card) return;
    const seq = (this.detailSeq || 0) + 1;
    this.detailSeq = seq;
    this.setData({ showPoiDetail: true, detailCard: decorateDetailCard(card), detailPhotoIndex: 0 });
    loadRestaurantDetail(card).then((detailCard) => {
      if (this.detailSeq !== seq || !this.data.showPoiDetail) return;
      this.setData({ detailCard: decorateDetailCard({ ...detailCard, detailRouteIndex: this.data.detailCard && this.data.detailCard.detailRouteIndex }), detailPhotoIndex: 0 });
    }).catch((error) => {
      console.warn("Restaurant detail load failed", error);
    });
  },

  closePoiDetail() {
    this.detailSeq = (this.detailSeq || 0) + 1;
    this.setData({ showPoiDetail: false, detailCard: null, detailPhotoIndex: 0 });
  },

  selectDetailPhoto(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const url = event.currentTarget.dataset.url || "";
    if (!url || !this.data.detailCard) return;
    this.setData({
      detailPhotoIndex: index,
      detailCard: { ...this.data.detailCard, image: url }
    });
  },

  previewDetailHeroPhoto() {
    const current = normalizeImageUrl(this.data.detailCard && this.data.detailCard.image);
    this.previewDetailImage(current);
  },

  previewDetailPhoto(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const url = event.currentTarget.dataset.url || "";
    if (!url || !this.data.detailCard) return;
    this.setData({
      detailPhotoIndex: index,
      detailCard: { ...this.data.detailCard, image: url }
    });
    this.previewDetailImage(url);
  },

  previewDetailImage(currentUrl = "") {
    const detailCard = this.data.detailCard;
    const current = normalizeImageUrl(currentUrl || (detailCard && detailCard.image));
    const seen = new Set();
    const urls = []
      .concat((detailCard && detailCard.detailPhotos) || [])
      .concat((detailCard && detailCard.photoSlides) || [])
      .concat((detailCard && detailCard.photoGallery) || [])
      .concat((detailCard && detailCard.image) || [])
      .map(normalizeImageUrl)
      .filter((url) => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });
    if (!current || !urls.length) return;
    if (!seen.has(current)) urls.unshift(current);
    wx.previewImage({
      current,
      urls,
      fail: () => {
        wx.showToast({ title: "图片暂时打不开", icon: "none" });
      }
    });
  },

  onDetailImageError(event) {
    const failed = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.url || "";
    const detailCard = this.data.detailCard;
    if (!failed || !detailCard) return;
    const detailPhotos = (detailCard.detailPhotos || []).filter((item) => item.url !== failed);
    const photoSlides = (detailCard.photoSlides || []).filter((item) => item.url !== failed);
    const photoGallery = detailPhotos.map((item) => item.url);
    this.setData({
      detailPhotoIndex: 0,
      detailCard: {
        ...detailCard,
        detailPhotos,
        photoSlides,
        photoGallery,
        image: detailPhotos[0] ? detailPhotos[0].url : (photoSlides[0] ? photoSlides[0].url : "")
      }
    });
  },

  openDetailNavigation() {
    this.openCardNavigation(this.data.detailCard);
  },

  openDetailAmapLink() {
    this.openCardNavigation(this.data.detailCard);
  },

  openCardNavigation(card) {
    const point = cardNavigationPoint(card);
    const latitude = Number(point && point.latitude);
    const longitude = Number(point && point.longitude);
    if (!card || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      wx.showToast({ title: "暂无导航地址", icon: "none" });
      return;
    }
    const address = [card.address, card.area, card.type].filter(Boolean).join(" ").slice(0, 180);
    wx.openLocation({
      latitude,
      longitude,
      scale: 18,
      name: card.name || "餐厅位置",
      address,
      fail: (error) => {
        console.warn("Open map navigation unavailable", error);
        const fallbackText = card.navUrl || address || `${card.name || "餐厅位置"} ${longitude},${latitude}`;
        if (fallbackText && wx.setClipboardData) {
          wx.setClipboardData({
            data: fallbackText,
            success: () => wx.showToast({ title: "地图打不开，已复制地址", icon: "none" }),
            fail: () => wx.showToast({ title: "地图暂时打不开", icon: "none" })
          });
          return;
        }
        wx.showToast({ title: "地图暂时打不开", icon: "none" });
      }
    });
  },

  resetAll() {
    clearInterval(this.revealTimer);
    this.intentPreviewId = (this.intentPreviewId || 0) + 1;
    this.setData({
      screen: "game",
      categoryMode: "",
      areaStep: "input",
      areaMode: "single",
      meetupBoard: null,
      meetupBoardLoading: false,
      showVoiceInsight: false,
      voiceInsightState: "ready",
      voiceInsightQuestion: "",
      voiceIntentDetails: [],
      editingVoiceIntentIndex: -1,
      voiceAmapPreview: [],
      voiceSearchPlan: null,
      confirmedChoiceIntent: null,
      showWin: false,
      winner: null,
      showPoiDetail: false,
      detailCard: null,
      detailPhotoIndex: 0,
      settleText: "",
      ready: false,
      deck: [],
      pending: [],
      activeCard: null,
      cardMotionClass: "",
      cardTransform: "",
      stampPick: 0,
      stampPass: 0,
      confettiPieces: []
    });
  },

  showToast(text) {
    this.setData({ toastText: text });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.setData({ toastText: "" });
    }, 1200);
  }
});
