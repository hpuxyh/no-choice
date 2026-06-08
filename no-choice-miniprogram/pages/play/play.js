const {
  POOL,
  SCENE_TAGS,
  NEED_TAGS,
  MORE_TAGS,
  MODE_SETTLE_COPY,
  INFO_THEMES,
  TAG_SEARCH_KEYWORDS,
  randomSlogan
} = require("../../utils/choiceData");

const {
  buildChoiceContext,
  getCurrentPosition,
  getApproxPosition,
  reverseGeocodeLocation,
  loadRestaurantDeck,
  loadRestaurantDetail,
  buildRestaurantIntentPreview
} = require("../../utils/restaurantEngine");

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

function decorateDetailCard(card) {
  if (!card) return null;
  const index = Math.max(0, Number(card.no || 1) - 1);
  const base = decorateCard(card, index);
  const detailPhotos = normalizeCardPhotoItems({
    ...card,
    photoItems: (card.detailPhotos || []).concat(card.photoItems || []).concat(card.carouselImages || [])
  }, 5);
  return {
    ...base,
    detailPhotos,
    image: detailPhotos[0] ? detailPhotos[0].url : base.image
  };
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

function planPeopleText(choice) {
  const partySize = Number(choice.partySize) || 0;
  if (partySize > 0) return partySize === 1 ? "1人" : `共${partySize}人`;
  const text = `${choice.question || ""} ${(choice.tags || []).join(" ")}`;
  if (/一人食|一个人|自己吃/.test(text)) return "1人";
  if (/约会|对象|男朋友|女朋友|男友|女友|暧昧/.test(text)) return "你 + 约会对象，共2人";
  if (/朋友|同事|同学|客户|聚餐|一起/.test(text)) return "你 + 朋友，共2人";
  const count = firstMatch(text, [/(\d+)\s*人/, /([一二两三四五六七八九十]+)个人/]);
  return count ? `约${count}人` : "1-2人";
}

function planMiddleText(choice) {
  const text = choiceText(choice);
  const destination = firstMatch(text, [/(?:在|去|到|想在|想去)([^，。；\s]{2,12})(?:附近|周边|这边|那边)/, /([^，。；\s]{2,12})(?:附近|周边)(?:吃|找|餐厅)/]);
  const meetupHint = /和.+(?:朋友|对象|同事|同学).*(?:在|从|住在)[^，。；\s]{2,12}/.test(text) || /折中|中间/.test(text);
  if (destination) return `不取中间点，直接在${destination}附近找`;
  if (meetupHint) return "取中间点，照顾两边到店成本";
  return "不取中间点，按当前位置找";
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
  "人数": "people",
  "人群": "people",
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
      multiline: Boolean(item && item.wide)
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

Page({
  data: {
    screen: "welcome",
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
    problemPlaceholder: "例如：和朋友吃火锅，人均150以内\n也可以说：下班想在附近吃点清淡的",
    partySize: 2,
    budgetPerPerson: 150,
    choiceHasInput: false,
    choiceNextText: "用标签让 AI 理解",
    showVoiceInsight: false,
    voiceInsightState: "ready",
    voiceInsightQuestion: "",
    voiceIntentDetails: [],
    voiceAmapPreview: [],
    voiceSearchPlan: null,
    confirmedChoiceIntent: null,
    photoThumbs: [],
    useComicImages: false,
    comicImageHint: "关闭后直接用真实照片",
    recording: false,
    voiceTarget: "",
    modeName: "AI 模式",
    modeLabel: "AI INTEL",
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

  onLoad() {
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
  },

  applySystemChrome() {
    try {
      const system = wx.getSystemInfoSync();
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
    this.goGame();
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
    if (changed && startX && changed.clientX - startX > 80) this.goGame();
  },

  goGame() {
    this.startBgm();
    this.setData({ screen: "game" });
    this.primeLocationStatus();
  },

  goBackGame() {
    this.startBgm();
    this.setData({ screen: "game" });
  },

  onProblemInput(e) {
    this.setData({
      problem: e.detail.value,
      showVoiceInsight: false,
      confirmedChoiceIntent: null,
      voiceSearchPlan: null
    }, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
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
    next.confirmedChoiceIntent = null;
    next.voiceSearchPlan = null;
    if (willSelect && toggled.text === "一人食") next.partySize = 1;
    if (willSelect && (toggled.text === "朋友聚餐" || toggled.text === "约会吃饭") && this.data.partySize < 2) next.partySize = 2;
    this.setData(next, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
  },

  onPartySizeChange(e) {
    const value = Math.max(1, Math.min(8, Math.round(Number(e.detail.value) || 2)));
    this.setData({ partySize: value, showVoiceInsight: false, confirmedChoiceIntent: null, voiceSearchPlan: null }, () => this.updateChoiceNextAction());
    this.invalidateRestaurantContext();
  },

  onBudgetChange(e) {
    const numeric = Number(e.detail.value);
    const raw = Math.round((Number.isFinite(numeric) ? numeric : 150) / 10) * 10;
    const value = Math.max(0, Math.min(500, raw));
    this.setData({ budgetPerPerson: value, showVoiceInsight: false, confirmedChoiceIntent: null, voiceSearchPlan: null }, () => this.updateChoiceNextAction());
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
    const choiceHasInput = Boolean(question || tags.length || this.data.partySize || this.data.budgetPerPerson);
    this.setData({
      choiceHasInput,
      choiceNextText: question ? "让 AI 理解一下" : (tags.length ? "用标签和条件理解" : "按人数预算找餐厅")
    });
  },

  async proceedChoiceToMode() {
    const tags = this.getSelectedChoiceTags();
    const question = cleanChoiceQuestion(this.data.problem);
    if (!question && !tags.length && !this.data.partySize && !this.data.budgetPerPerson) {
      this.showToast("先写一句或点几个标签");
      return;
    }
    this.startBgm();
    this.setData({
      showVoiceInsight: true,
      voiceInsightState: "loading",
      voiceInsightQuestion: "AI 正在理解中",
      voiceIntentDetails: [
        { label: "状态", value: "正在理解你的场景、人数和位置", wide: true, editable: false }
      ],
      voiceAmapPreview: [],
      voiceSearchPlan: null,
      confirmedChoiceIntent: null
    });
    const coords = await this.ensureLocation().catch(() => null);
    await this.renderChoiceIntent(coords);
  },

  async renderChoiceIntent(coords) {
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
        { label: "人数", value: planPeopleText(choice) },
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
    this.setData({
      showVoiceInsight: true,
      voiceInsightState: "ready",
      voiceInsightQuestion: "我按下面这样理解，确认一下？",
      voiceIntentDetails: editableVoiceIntentDetails(details),
      voiceAmapPreview: amapPreview,
      voiceSearchPlan: searchPlan,
      confirmedChoiceIntent: null
    });
  },

  onVoiceIntentFieldInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = String(e.detail && e.detail.value || "");
    const details = (this.data.voiceIntentDetails || []).map((item, idx) => (
      idx === index ? { ...item, value } : item
    ));
    this.setData({ voiceIntentDetails: details, confirmedChoiceIntent: null });
    this.invalidateRestaurantContext();
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
      this.showToast("AI 还在理解，等结果出来再确认");
      return;
    }
    const confirmedChoiceIntent = this.buildConfirmedChoiceIntent();
    this.setData({ confirmedChoiceIntent }, () => {
      this.showToast("好，按修改后的理解来");
      this.startAiModeGame();
    });
  },

  reviseChoiceIntent() {
    this.setData({ showVoiceInsight: false, confirmedChoiceIntent: null, voiceSearchPlan: null }, () => this.updateChoiceNextAction());
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
      this.voiceInputBase = this.data.problem.trim();
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
        this.voiceInputBase = this.data.problem.trim();
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

  applyVoiceTextToInput(text) {
    const spoken = String(text || "").trim();
    if (!spoken) return;
    const base = String(this.voiceInputBase || "").trim();
    const problem = base ? `${base} ${spoken}` : spoken;
    this.setData({ problem, showVoiceInsight: false }, () => this.updateChoiceNextAction());
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
    this.startGame("AI 模式", "AI INTEL");
  },

  async startGame(modeName, modeLabel) {
    this.startBgm();
    clearInterval(this.revealTimer);
    this.pendingDeckSignature = "";
    this.setData({
      screen: "deck",
      modeName,
      modeLabel,
      loadingDeck: true,
      loadingTitle: "正在定位附近餐厅",
      loadingText: "读取你的位置，再从高德拿真实餐厅。",
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
    const cards = await this.loadCards(modeName);
    if (!cards.length) return;
    const readyCards = await this.prepareVisualCards(cards);
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
    this.startGame(this.data.modeName || "AI 模式", this.data.modeLabel || "AI INTEL");
  },

  async prepareVisualCards(cards) {
    const total = Math.min(TOTAL, cards.length || TOTAL);
    this.setLoading("正在加载餐厅卡", "确认 5 张真实餐厅卡后直接发牌。", { done: 0, total });
    if (this.data.useComicImages) {
      this.showToast("漫画卡面生成需要后端接口，当前先用真实照片");
    }
    const results = [];
    for (let i = 0; i < cards.length; i += 1) {
      const readyCard = await this.readyDisplayCard(cards[i]);
      results.push(readyCard);
      this.setLoading("正在加载餐厅卡", `第 ${Math.min(i + 1, total)} 张已加载。`, { done: Math.min(i + 1, total), total });
    }
    return results;
  },

  readyDisplayCard(card) {
    return Promise.resolve(card);
  },

  async loadCards(modeName) {
    try {
      this.setLoading("正在读取当前位置", "3 秒内拿不到 GPS，就先按城市定位发牌。");
      const coords = await this.ensureLocation();
      if (!coords) throw new Error("no location");
      this.setLoading("正在定位附近餐厅", "位置已确认，正在从高德拿真实餐厅。");
      const choice = buildChoiceContext(this.data);
      const replaySignature = this.choiceReplaySignature(modeName, coords);
      this.pendingDeckSignature = replaySignature;
      const result = await loadRestaurantDeck({
        modeName,
        choice,
        coords,
        avoidCardKeys: this.replayAvoidKeys(replaySignature),
        setLoading: (title, text, progress) => this.setLoading(title, text, progress),
        toast: (text) => this.showToast(text)
      });
      if (result.cards.length >= TOTAL) return result.cards;
      if (result.cards.length > 0) return result.cards;
      throw new Error("empty pois");
    } catch (error) {
      console.warn("restaurant cards unavailable", error);
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
    const location = coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng))
      ? `${Number(coords.lat).toFixed(4)},${Number(coords.lng).toFixed(4)}`
      : "";
    return JSON.stringify({ modeName, question, tags, partySize, budgetPerPerson, location });
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

  ensureLocation() {
    if (this.data.lastCoords) {
      if (this.data.locationState !== "city" && isGenericLocationLabel(this.data.lastCoords)) this.refreshLocationAddress(this.data.lastCoords);
      return Promise.resolve(this.data.lastCoords);
    }
    if (this.locationPromise) return this.locationPromise;
    const seq = Date.now();
    this.locationSeq = seq;
    this.setData({ locationState: "loading", locationText: "定位：正在获取当前位置…", locationMeta: "" });
    this.locationPromise = getCurrentPosition()
      .then(async (coords) => {
        this.setData({
          lastCoords: coords,
          locationState: "gps",
          locationText: "当前位置：正在解析地址…",
          locationMeta: ""
        });
        this.refreshLocationAddress(coords);
        return coords;
      })
      .catch((error) => {
        this.showToast(error.message || "定位失败，改用城市定位");
        this.setData({
          locationState: "error",
          locationText: "定位：GPS 不可用，改用城市定位",
          locationMeta: ""
        });
        return getApproxPosition().then((coords) => {
          this.setData({
            lastCoords: coords,
            locationState: "city",
            locationText: `城市定位：${coords.label || "当前城市"}`,
            locationMeta: `坐标 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
          });
          return coords;
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
    this.setData({ cardTransform: "", stampPick: 0, stampPass: 0 });
    this.openCardNavigation(this.data.activeCard);
  },

  openActiveCardDetail(event) {
    if (isCardNavigationEvent(event)) return;
    this.openCardDetail(this.data.activeCard);
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
      this.setData({ detailCard: decorateDetailCard(detailCard), detailPhotoIndex: 0 });
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
    this.setData({
      screen: "game",
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
