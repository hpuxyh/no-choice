const POOL = [
  {
    emoji: "🥩",
    name: "牛排家(北京望京店)",
    art: "#ff5a4d",
    artBg: "#ff5a4d",
    artAccent: "#f6c518",
    image: "/assets/food/steak.jpg",
    photoGallery: ["/assets/food/steak.jpg", "/assets/food/pasta.jpg", "/assets/food/izakaya.jpg"],
    reason: "离你1.1km，步行15分钟，驾车9分钟，评分4.7，人均268。先按真实附近餐厅推进，少一点纠结。",
    meta: ["离你1.1km", "步行15分钟", "驾车9分钟", "4.7分", "人均268"],
    rating: "4.7",
    cost: "268",
    ratingText: "4.7分",
    costText: "268元",
    openTimeText: "11:00-22:00",
    opentimeToday: "11:00-22:00",
    tag: "熟成45天极佳级小战斧 招牌和牛塔塔 美国极佳级牛小排",
    type: "西餐;牛排",
    area: "北京市 朝阳区",
    businessArea: "望京",
    location: { latitude: 39.9966, longitude: 116.4823 },
    routeMetrics: { distanceMeters: 1100, walkingDurationSeconds: 900, drivingDurationSeconds: 540 },
    address: "北京市朝阳区望京附近"
  },
  {
    emoji: "🍲",
    name: "巷口火锅·安静店",
    art: "#28c76f",
    artBg: "#28c76f",
    artAccent: "#f6c518",
    image: "/assets/food/hot-noodles.jpg",
    photoGallery: ["/assets/food/hot-noodles.jpg", "/assets/food/steak.jpg", "/assets/food/sushi.jpg"],
    reason: "离你1.4km，步行18分钟，驾车10分钟，评分4.6，人均156。适合想热闹但不想跑太远。",
    meta: ["离你1.4km", "步行18分钟", "驾车10分钟", "4.6分", "人均156"],
    rating: "4.6",
    cost: "156",
    ratingText: "4.6分",
    costText: "156元",
    openTimeText: "10:30-23:00",
    opentimeToday: "10:30-23:00",
    tag: "牛油锅底 鸭血毛肚 安静包间",
    type: "火锅",
    area: "北京市 朝阳区",
    businessArea: "酒仙桥",
    location: { latitude: 39.9863, longitude: 116.4918 },
    routeMetrics: { distanceMeters: 1400, walkingDurationSeconds: 1080, drivingDurationSeconds: 600 },
    address: "北京市朝阳区酒仙桥附近"
  },
  {
    emoji: "🍣",
    name: "旬味日料小馆",
    art: "#f6c518",
    artBg: "#f6c518",
    artAccent: "#ff5a4d",
    image: "/assets/food/sushi.jpg",
    photoGallery: ["/assets/food/sushi.jpg", "/assets/food/izakaya.jpg", "/assets/food/steak.jpg"],
    reason: "离你900m，步行12分钟，驾车7分钟，评分4.8，人均198。适合约会吃饭和安静好聊。",
    meta: ["离你900m", "步行12分钟", "驾车7分钟", "4.8分", "人均198"],
    rating: "4.8",
    cost: "198",
    ratingText: "4.8分",
    costText: "198元",
    openTimeText: "11:30-21:30",
    opentimeToday: "11:30-21:30",
    tag: "寿司 拼盘 刺身 安静餐厅",
    type: "日本料理;日料",
    area: "北京市 朝阳区",
    businessArea: "798",
    location: { latitude: 39.9841, longitude: 116.4942 },
    routeMetrics: { distanceMeters: 900, walkingDurationSeconds: 720, drivingDurationSeconds: 420 },
    address: "北京市朝阳区798附近"
  },
  {
    emoji: "🍝",
    name: "橄榄西餐 Bistro",
    art: "#6c5ce7",
    artBg: "#6c5ce7",
    artAccent: "#28c76f",
    image: "/assets/food/pasta.jpg",
    photoGallery: ["/assets/food/pasta.jpg", "/assets/food/steak.jpg", "/assets/food/sushi.jpg"],
    reason: "离你1.8km，步行24分钟，驾车12分钟，评分4.5，人均228。仪式感稳定，适合别再继续选。",
    meta: ["离你1.8km", "步行24分钟", "驾车12分钟", "4.5分", "人均228"],
    rating: "4.5",
    cost: "228",
    ratingText: "4.5分",
    costText: "228元",
    openTimeText: "11:00-22:00",
    opentimeToday: "11:00-22:00",
    tag: "意面 牛排 沙拉 约会餐厅",
    type: "西餐",
    area: "北京市 朝阳区",
    businessArea: "望京南",
    location: { latitude: 39.9908, longitude: 116.4776 },
    routeMetrics: { distanceMeters: 1800, walkingDurationSeconds: 1440, drivingDurationSeconds: 720 },
    address: "北京市朝阳区望京南附近"
  },
  {
    emoji: "🍶",
    name: "鸟旬烧鸟酒场",
    art: "#3d6bff",
    artBg: "#3d6bff",
    artAccent: "#ff7ab8",
    image: "/assets/food/izakaya.jpg",
    photoGallery: ["/assets/food/izakaya.jpg", "/assets/food/sushi.jpg", "/assets/food/hot-noodles.jpg"],
    reason: "离你1.2km，步行16分钟，驾车8分钟，评分4.6，人均170。小份多样，适合夜宵或慢慢聊。",
    meta: ["离你1.2km", "步行16分钟", "驾车8分钟", "4.6分", "人均170"],
    rating: "4.6",
    cost: "170",
    ratingText: "4.6分",
    costText: "170元",
    openTimeText: "17:00-01:00",
    opentimeToday: "17:00-01:00",
    tag: "烧鸟 居酒屋 夜宵 小酌",
    type: "日本料理;烧鸟",
    area: "北京市 朝阳区",
    businessArea: "酒仙桥",
    location: { latitude: 39.9828, longitude: 116.4893 },
    routeMetrics: { distanceMeters: 1200, walkingDurationSeconds: 960, drivingDurationSeconds: 480 },
    address: "北京市朝阳区酒仙桥附近"
  }
];

const SCENE_TAGS = ["朋友聚餐", "约会吃饭", "一人食", "夜宵", "家庭聚会", "同事小聚", "商务请客", "生日庆祝", "下班随便吃", "周末探店"];
const NEED_TAGS = ["离我近", "少排队", "安静好聊", "人均150+", "评分高", "有包间", "适合拍照", "停车方便", "不辣", "营业到很晚"];
const MORE_TAGS = ["火锅", "西餐", "日料", "烧烤", "烤肉", "中餐", "韩餐", "粤菜", "咖啡甜品", "小酒馆"];
const GENDERS = ["♀ 女", "♂ 男", "🤖 不说"];
const ZODIACS = ["未选", "白羊", "金牛", "双子", "巨蟹", "狮子", "处女", "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼"];
const MBTIS = ["未选", "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];

const MODES = [
  {
    name: "霸总模式",
    label: "霸总",
    emoji: "🎲",
    desc: "不要你觉得，我要我觉得。",
    tagline: "[ 霸总 ] 纯随机 · 一秒通关",
    className: "boss"
  },
  {
    name: "AI 模式",
    label: "智选",
    emoji: "🤖",
    desc: "结合此刻信息，深度契合。",
    tagline: "[ 智选 ] 懂你此刻 · 极智解忧",
    className: "ai"
  },
  {
    name: "玄学模式",
    label: "玄学",
    emoji: "🔮",
    desc: "“来自今日星盘的天命抉择。”",
    tagline: "[ 玄学 ] 运势流 · 命中注定",
    className: "myst"
  }
];

const MODE_SETTLE_COPY = {
  "霸总模式": "别选了，就他了！",
  "AI 模式": "别翻了，真的没有了！",
  "智能模式": "别翻了，真的没有了！",
  "玄学模式": "别寻了，灵感到了！",
  "灵感模式": "别寻了，灵感到了！"
};

const CARD_SLOGANS = [
  "纠结不用保底，一发直出人生答案",
  "告别反复脑补，抉择池单抽出奇迹",
  "不用垫刀赌运气，转盘直接锁定最优解",
  "脑内十连全歪？来这一发搞定选择题",
  "犹豫一直在掉快乐？一键清掉纠结状态",
  "选择困难主线卡关，系统一键速通副本",
  "放弃单人苦思，召唤选择助手帮你过任务",
  "左右横跳原地刷怪，不如直接结算选项",
  "系统警告：长时间纠结，快乐值持续衰减",
  "叮！选择系统已自动帮你完成抉择任务",
  "检测到玩家重度选择困难，开启自动判定模式",
  "无需手动思考，托管模式直接敲定选择",
  "抽个选项，结束内耗",
  "抉择开盲盒，万事不纠结",
  "托管人生，轻松通关",
  "别在脑海无限循环复盘，打开小程序抽一发，直接通关选择副本",
  "与其卡在人生分叉路口反复纠结，不如交给系统一键判定",
  "对抗选择困难这款怪，不用自己磨血，选择转盘一招秒杀"
];

const INFO_THEMES = [
  { bg: "#ff554f", fg: "#fffaf2", muted: "#ffe6dc", tagBg: "#fffaf2", tagFg: "#1a1714" },
  { bg: "#6d58e8", fg: "#fffaf2", muted: "#e3ddff", tagBg: "#fffaf2", tagFg: "#1a1714" },
  { bg: "#ffcf24", fg: "#1a1714", muted: "#4a4226", tagBg: "#1a1714", tagFg: "#fffaf2" },
  { bg: "#22c96b", fg: "#0f2116", muted: "#0d3a20", tagBg: "#fffaf2", tagFg: "#1a1714" },
  { bg: "#ff7ab8", fg: "#1a1714", muted: "#4a2436", tagBg: "#1a1714", tagFg: "#fffaf2" }
];

const TAG_SEARCH_KEYWORDS = {
  "今晚约饭": ["餐厅"],
  "朋友聚餐": ["聚餐", "餐厅"],
  "约会吃饭": ["约会餐厅", "西餐", "日料"],
  "一人食": ["一人食", "简餐"],
  "夜宵": ["夜宵", "烧烤", "火锅"],
  "家庭聚会": ["家庭聚餐", "中餐"],
  "同事小聚": ["聚餐", "餐厅"],
  "商务请客": ["商务宴请", "中餐"],
  "生日庆祝": ["生日聚餐", "餐厅"],
  "下班随便吃": ["简餐", "餐厅"],
  "周末探店": ["网红餐厅", "餐厅"],
  "人均150+": ["餐厅"],
  "离我近": ["餐厅"],
  "少排队": ["餐厅"],
  "安静好聊": ["安静餐厅", "咖啡", "西餐"],
  "评分高": ["高分餐厅", "餐厅"],
  "有包间": ["包间餐厅", "中餐"],
  "适合拍照": ["网红餐厅", "西餐", "咖啡"],
  "停车方便": ["停车方便餐厅", "餐厅"],
  "不辣": ["清淡餐厅", "粤菜", "日料"],
  "营业到很晚": ["夜宵", "深夜食堂", "烧烤"],
  "西餐": ["西餐"],
  "火锅": ["火锅"],
  "日料": ["日料", "寿司"],
  "烧烤": ["烧烤", "烤肉"],
  "烤肉": ["烤肉"],
  "中餐": ["中餐"],
  "韩餐": ["韩餐", "韩国料理"],
  "粤菜": ["粤菜"],
  "咖啡甜品": ["咖啡", "甜品"],
  "小酒馆": ["小酒馆", "酒吧"],
  "通宵熬夜": ["夜宵", "烧烤", "火锅"]
};

function randomSlogan() {
  return CARD_SLOGANS[Math.floor(Math.random() * CARD_SLOGANS.length)];
}

module.exports = {
  POOL,
  SCENE_TAGS,
  NEED_TAGS,
  MORE_TAGS,
  GENDERS,
  ZODIACS,
  MBTIS,
  MODES,
  MODE_SETTLE_COPY,
  INFO_THEMES,
  TAG_SEARCH_KEYWORDS,
  randomSlogan
};
