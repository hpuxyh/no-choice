// 连锁品牌名单 + 新品清单(人工/半自动维护)。
// —— 这是「咖啡奶茶 / 美食外卖」两个快捷分支的数据源 ——
// 实时抓取平台新品不可行(无开放 API、小程序不能爬站、大模型会编造),
// 所以新品改为维护一份清单:CATEGORY_PRESETS 决定搜什么,CHAIN_BRANDS 决定谁排前面,
// BRAND_NEWS 决定卡面标注「最近上新 XX」。每期上新只需改 BRAND_NEWS 即可。
// 若日后在 Worker 上开 /api/brand-news,可用 mergeRemoteBrandNews() 做 OTA 覆盖,免重新发布。

// 分支搜索预设:点了按钮后用什么关键词/范围找附近店
const CATEGORY_PRESETS = {
  coffee: {
    label: "咖啡",
    keywords: ["咖啡", "coffee", "拿铁"],
    types: "050000", // 高德餐饮服务大类,靠关键词区分咖啡
    radiusMeters: 5000 // 近似「配送范围」:咖啡默认 5km(覆盖外卖可送的大牌)
  },
  milktea: {
    label: "奶茶",
    keywords: ["奶茶", "茶饮", "饮品", "果茶"],
    types: "050000", // 同上,靠关键词区分奶茶/茶饮
    radiusMeters: 5000 // 奶茶默认 5km
  },
  food: {
    label: "美食外卖",
    keywords: ["快餐", "简餐", "小吃", "面馆", "汉堡", "盖饭"],
    types: "050000",
    radiusMeters: 5000 // 外卖默认 5km
  }
};

// 连锁品牌:name 为标准名(用于查新品),aliases 为门店名里可能出现的写法
const CHAIN_BRANDS = [
  // —— 咖啡 ——
  { name: "瑞幸咖啡", category: "coffee", aliases: ["瑞幸", "luckin"] },
  { name: "星巴克", category: "coffee", aliases: ["星巴克", "starbucks"] },
  { name: "库迪咖啡", category: "coffee", aliases: ["库迪", "cotti"] },
  { name: "Manner", category: "coffee", aliases: ["manner"] },
  { name: "M Stand", category: "coffee", aliases: ["mstand", "m stand"] },
  { name: "Peet's皮爷咖啡", category: "coffee", aliases: ["peet", "皮爷"] },
  { name: "Grid Coffee", category: "coffee", aliases: ["gridcoffee", "grid coffee"] },
  { name: "LAVAZZA", category: "coffee", aliases: ["lavazza", "拉瓦萨"] },
  { name: "% Arabica", category: "coffee", aliases: ["arabica", "阿拉比卡"] },
  { name: "Tims天好咖啡", category: "coffee", aliases: ["tims", "天好咖啡"] },
  { name: "Costa", category: "coffee", aliases: ["costa", "咖世家"] },
  { name: "太平洋咖啡", category: "coffee", aliases: ["太平洋咖啡"] },
  { name: "Seesaw", category: "coffee", aliases: ["seesaw"] },
  { name: "幸运咖", category: "coffee", aliases: ["幸运咖"] },
  // —— 奶茶 / 茶饮 ——
  { name: "喜茶", category: "milktea", aliases: ["喜茶", "heytea"] },
  { name: "奈雪的茶", category: "milktea", aliases: ["奈雪"] },
  { name: "霸王茶姬", category: "milktea", aliases: ["霸王茶姬", "chagee"] },
  { name: "蜜雪冰城", category: "milktea", aliases: ["蜜雪冰城", "蜜雪"] },
  { name: "茶百道", category: "milktea", aliases: ["茶百道"] },
  { name: "古茗", category: "milktea", aliases: ["古茗"] },
  { name: "沪上阿姨", category: "milktea", aliases: ["沪上阿姨"] },
  { name: "书亦烧仙草", category: "milktea", aliases: ["书亦"] },
  { name: "茶颜悦色", category: "milktea", aliases: ["茶颜悦色", "茶颜"] },
  { name: "CoCo都可", category: "milktea", aliases: ["coco都可", "coco"] },
  { name: "一点点", category: "milktea", aliases: ["一点点"] },
  { name: "益禾堂", category: "milktea", aliases: ["益禾堂"] },
  // —— 美食外卖 ——
  { name: "麦当劳", category: "food", aliases: ["麦当劳", "mcdonald", "金拱门"] },
  { name: "肯德基", category: "food", aliases: ["肯德基", "kfc"] },
  { name: "汉堡王", category: "food", aliases: ["汉堡王", "burger king"] },
  { name: "塔斯汀", category: "food", aliases: ["塔斯汀"] },
  { name: "华莱士", category: "food", aliases: ["华莱士"] },
  { name: "必胜客", category: "food", aliases: ["必胜客", "pizza hut"] },
  { name: "老乡鸡", category: "food", aliases: ["老乡鸡"] },
  { name: "乡村基", category: "food", aliases: ["乡村基"] },
  { name: "真功夫", category: "food", aliases: ["真功夫"] },
  { name: "永和大王", category: "food", aliases: ["永和大王", "永和"] },
  { name: "和府捞面", category: "food", aliases: ["和府捞面", "和府"] },
  { name: "杨国福麻辣烫", category: "food", aliases: ["杨国福"] },
  { name: "张亮麻辣烫", category: "food", aliases: ["张亮麻辣烫", "张亮"] },
  { name: "萨莉亚", category: "food", aliases: ["萨莉亚"] },
  { name: "吉野家", category: "food", aliases: ["吉野家"] },
  { name: "南城香", category: "food", aliases: ["南城香"] }
];

// 新品清单(按期维护;月份用于将来做时效过滤)。
// 这里的条目即「卡面有没有新品」的依据:命中则标注「最近上新 · item」。
const BRAND_NEWS = {
  "瑞幸咖啡": { item: "生椰拿铁夏季款", month: "2026-06" },
  "星巴克": { item: "夏日西瓜星冰乐", month: "2026-06" },
  "库迪咖啡": { item: "茉莉轻乳茶", month: "2026-06" },
  "Manner": { item: "西西里美式", month: "2026-06" },
  "M Stand": { item: "杨梅荔枝系列", month: "2026-06" },
  "LAVAZZA": { item: "KAFA森林瑰夏", month: "2026-06" },
  "喜茶": { item: "多肉葡萄·新版", month: "2026-06" },
  "霸王茶姬": { item: "伯牙绝弦·夏季限定", month: "2026-06" },
  "蜜雪冰城": { item: "鲜萃柠檬水新装", month: "2026-06" },
  "茶百道": { item: "杨枝甘露新品", month: "2026-06" },
  "麦当劳": { item: "夏日小龙虾堡", month: "2026-06" },
  "肯德基": { item: "藤椒鸡腿堡", month: "2026-06" }
};

// 「去下单」跳转目标 appId。规则:≤1km 跳品牌自营点单小程序(自取);>1km 跳美团(外卖)。
// ⚠️ 必须填真实 appId 才会真正跳转,且要同步加进 app.json 的 navigateToMiniProgramAppIdList(≤10个);
// 为空 / 跳转失败时,代码会自动回退为「复制店名 + 引导去美团搜」,所以现在留空也能用。
const ORDER_TARGETS = {
  meituan: "", // 美团小程序 appId(>1km 外卖)。例:"wx____________"
  brands: {
    // "瑞幸咖啡": "wx____________",
    // "星巴克": "wx____________",
    // "喜茶": "wx____________",
  }
};

// 取某品牌自营点单小程序 appId(无则空串)
function orderAppIdForBrand(brandName) {
  return (brandName && ORDER_TARGETS.brands && ORDER_TARGETS.brands[brandName]) || "";
}

// 运行期可被远端覆盖的新品表(默认等于本地清单)
let activeBrandNews = { ...BRAND_NEWS };

function normalizeBrandText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s()（）·\-—]/g, "")
    .trim();
}

// 用门店名匹配连锁品牌;命中返回 { name, category },否则 null
function matchChainBrand(poiName) {
  const text = normalizeBrandText(poiName);
  if (!text) return null;
  for (const brand of CHAIN_BRANDS) {
    const hit = brand.aliases.some((alias) => text.includes(normalizeBrandText(alias)));
    if (hit) return { name: brand.name, category: brand.category };
  }
  return null;
}

// 查某品牌当前主推新品(标准名);无则返回 ""
function brandNewDrop(brandName) {
  const entry = activeBrandNews[brandName];
  return entry && entry.item ? String(entry.item) : "";
}

// OTA:把远端拿到的新品表合并进运行期表(远端优先)
function mergeRemoteBrandNews(remote) {
  if (!remote || typeof remote !== "object") return;
  activeBrandNews = { ...BRAND_NEWS, ...remote };
}

module.exports = {
  CATEGORY_PRESETS,
  CHAIN_BRANDS,
  BRAND_NEWS,
  ORDER_TARGETS,
  matchChainBrand,
  brandNewDrop,
  orderAppIdForBrand,
  mergeRemoteBrandNews
};
