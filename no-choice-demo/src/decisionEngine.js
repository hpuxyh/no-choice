const dinnerImages = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80",
];

const weekendImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
];

const giftImages = [
  "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=80",
];

const generalImages = [
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
];

export const moduleProfiles = {
  dinner: {
    id: "dinner",
    label: "今晚吃什么",
    short: "位置、口味、氛围",
    kicker: "高频本地生活",
    headline: "先定吃法，再定店",
    description: "适合两个人或一群人临时纠结晚饭。先把位置、预算、排队、聊天氛围这些硬条件收住，再给出能执行的吃法方向。",
    accent: "#16a46a",
    soft: "#eef8f3",
    questionLabel: "今晚这顿卡在哪",
    questionPlaceholder: "比如：今晚吃什么？",
    conditionLabel: "位置、口味和氛围",
    customPlaceholder: "补充一句，比如：我在国贸，对方在常营",
    candidateLabel: "备选餐厅/吃法",
    manualPlaceholder: "每行一个餐厅或吃法\n比如：火锅、日料、轻食",
    autoLabel: "按条件推荐",
    manualLabel: "我有备选",
    countLabel: "推荐几种吃法",
    startLabel: "抽今晚 3 张",
    previewBadge: "吃喝决策",
    previewDescription: "优先考虑位置、预算、排队和聊天氛围。接入 POI 后会变成真实店铺推荐。",
    resultPrefix: "今晚就吃",
    resultKicker: "吃喝结论",
    location: {
      enabled: true,
      label: "附近位置",
      poiLabel: "附近可参考的店",
      buttonLabel: "用手机定位",
    },
    typeMeta: {
      label: "吃喝推荐",
      tone: "位置/口味/氛围",
      description: "先用条件筛出吃法方向，再把选择压到一个可执行结论。",
    },
    conditions: [
      { id: "midpoint", label: "找中间点" },
      { id: "nearby", label: "离我更近" },
      { id: "budget", label: "预算别超" },
      { id: "quiet", label: "适合聊天" },
      { id: "fast", label: "少排队" },
      { id: "fresh", label: "有点新鲜" },
      { id: "noStaple", label: "不吃主食" },
      { id: "light", label: "清爽一点" },
      { id: "warm", label: "热乎一点" },
      { id: "bookable", label: "能预约" },
    ],
  },
  weekend: {
    id: "weekend",
    label: "周末去哪",
    short: "时间、天气、同行",
    kicker: "体验消费",
    headline: "把周末切成一段可执行行程",
    description: "适合周五晚上或周六早上临时决定。重点不是列满一天，而是选一个不累、可变更、能带来记忆点的安排。",
    accent: "#3554dc",
    soft: "#eef2ff",
    questionLabel: "这个周末想怎么过",
    questionPlaceholder: "比如：这个周末去哪放松一下？",
    conditionLabel: "时间、天气和同行",
    customPlaceholder: "补充一句，比如：只有半天，想在室内",
    candidateLabel: "备选地点/活动",
    manualPlaceholder: "每行一个地点或活动\n比如：影展、露营、书店、Citywalk",
    autoLabel: "生成行程",
    manualLabel: "我有想法",
    countLabel: "生成几段安排",
    startLabel: "抽周末 3 张",
    previewBadge: "周末安排",
    previewDescription: "按时长、天气、精力和同行关系收口。接入天气和活动票务后会更准。",
    resultPrefix: "周末就去",
    resultKicker: "周末结论",
    location: {
      enabled: true,
      label: "周边位置",
      poiLabel: "附近可参考的点",
      buttonLabel: "用手机定位",
    },
    typeMeta: {
      label: "玩乐行程",
      tone: "时长/天气/同行",
      description: "把周末选项变成可执行安排，优先控制体力和时间成本。",
    },
    conditions: [
      { id: "halfDay", label: "半天内" },
      { id: "lowEnergy", label: "不想太累" },
      { id: "indoor", label: "室内优先" },
      { id: "outdoor", label: "户外透气" },
      { id: "photo", label: "适合拍照" },
      { id: "budget", label: "预算别超" },
      { id: "rainPlan", label: "雨天备用" },
      { id: "bookable", label: "能预约" },
      { id: "talk", label: "适合聊天" },
      { id: "solo", label: "一个人也行" },
    ],
  },
  gift: {
    id: "gift",
    label: "送什么礼物",
    short: "关系、预算、分寸",
    kicker: "强购买意图",
    headline: "先判断关系分寸，再选礼物",
    description: "适合生日、入职、拜访、节日和感谢场景。重点是别踩雷：预算合理、关系得体、对方真的用得上。",
    accent: "#dd669b",
    soft: "#fff1f7",
    questionLabel: "这份礼物送给谁",
    questionPlaceholder: "比如：送给刚入职的朋友什么生日礼物？",
    conditionLabel: "关系、预算和禁忌",
    customPlaceholder: "补充一句，比如：预算 300 元以内，对方刚入职",
    candidateLabel: "备选礼物",
    manualPlaceholder: "每行一个礼物\n比如：咖啡礼盒、钢笔、桌面灯",
    autoLabel: "生成礼物",
    manualLabel: "我有备选",
    countLabel: "生成几份礼物",
    startLabel: "抽礼物 3 张",
    previewBadge: "礼物决策",
    previewDescription: "按关系、预算、使用频率和踩雷风险推荐。接入电商后可直接跳转购买。",
    resultPrefix: "礼物就选",
    resultKicker: "礼物结论",
    typeMeta: {
      label: "礼物推荐",
      tone: "关系/预算/分寸",
      description: "先控制关系分寸和预算，再选一个不会闲置的礼物。",
    },
    conditions: [
      { id: "budget", label: "预算别超" },
      { id: "practical", label: "实用优先" },
      { id: "notBoring", label: "别太普通" },
      { id: "safe", label: "不易踩雷" },
      { id: "ceremony", label: "有仪式感" },
      { id: "workplace", label: "适合职场" },
      { id: "fast", label: "当天能买" },
      { id: "portable", label: "不占空间" },
      { id: "customizable", label: "可定制" },
      { id: "packaging", label: "包装好看" },
    ],
  },
  general: {
    id: "general",
    label: "通用拍板",
    short: "任何低风险选择",
    kicker: "万能兜底",
    headline: "把模糊问题变成下一步",
    description: "适合暂时还没做成垂直模块的选择：买不买、去哪一个、选哪版方案、今天先做什么。它不替你做重大人生决策，只帮你收口下一步。",
    accent: "#f0b734",
    soft: "#fff8e5",
    questionLabel: "你想让它帮你定什么",
    questionPlaceholder: "比如：这三个方案先选哪个？",
    conditionLabel: "判断标准",
    customPlaceholder: "补充一句，比如：预算有限，希望今天能推进",
    candidateLabel: "候选项",
    manualPlaceholder: "每行一个候选\n比如：方案 A、方案 B、先不做",
    autoLabel: "帮我拆选项",
    manualLabel: "我有候选",
    countLabel: "生成几种方向",
    startLabel: "抽答案卡",
    previewBadge: "通用选择",
    previewDescription: "适合低风险、可回退的问题。重大决定会优先建议补信息或小步验证。",
    resultPrefix: "这次就选",
    resultKicker: "通用结论",
    typeMeta: {
      label: "通用决策",
      tone: "风险/成本/下一步",
      description: "用低风险、可执行、可回退的原则，给模糊选择一个出口。",
    },
    conditions: [
      { id: "lowRisk", label: "风险要低" },
      { id: "today", label: "今天能做" },
      { id: "buffer", label: "留后路" },
      { id: "cheap", label: "少花钱" },
      { id: "fast", label: "省时间" },
      { id: "smallStep", label: "先小步试" },
      { id: "longTerm", label: "长期更好" },
      { id: "social", label: "顾及别人" },
      { id: "reversible", label: "可回退" },
      { id: "clearNext", label: "下一步清楚" },
    ],
  },
};

export const presets = [
  {
    id: "dinner",
    label: moduleProfiles.dinner.label,
    question: "今晚吃什么？",
    context: "我在国贸，对方在常营，都不想吃主食，想找一个路程折中的地方。",
    conditionIds: ["midpoint", "noStaple", "quiet"],
    customConditions: ["我在国贸，对方在常营"],
    mode: "auto",
    options: "",
    count: 3,
  },
  {
    id: "weekend",
    label: moduleProfiles.weekend.label,
    question: "这个周末去哪放松一下？",
    context: "只有半天，不想太累，预算别太高，最好下雨也能去。",
    conditionIds: ["halfDay", "lowEnergy", "rainPlan", "budget"],
    customConditions: ["只有半天", "不想太累"],
    mode: "auto",
    options: "",
    count: 3,
  },
  {
    id: "gift",
    label: moduleProfiles.gift.label,
    question: "送给刚入职的朋友什么生日礼物？",
    context: "预算 300 元以内，希望对方真的用得上，也不要太普通。",
    conditionIds: ["budget", "practical", "notBoring", "safe"],
    customConditions: ["预算 300 元以内", "对方刚入职"],
    mode: "auto",
    options: "",
    count: 3,
  },
  {
    id: "general",
    label: moduleProfiles.general.label,
    question: "这三个方案先选哪个？",
    context: "希望今天能推进，风险低一点，后续还能调整。",
    conditionIds: ["today", "lowRisk", "reversible"],
    customConditions: ["希望今天能推进"],
    mode: "manual",
    options: "方案 A：先做最小版本\n方案 B：继续调研一晚\n方案 C：找朋友确认",
    count: 3,
  },
];

export const personaMeta = {
  gentle: {
    name: "稳妥派",
    mark: "先保行动空间",
  },
  sharp: {
    name: "直接派",
    mark: "少想一点",
  },
  light: {
    name: "轻松派",
    mark: "给纠结降噪",
  },
};

const sharedTypeMeta = {
  yesno: {
    label: "是/否判断",
    tone: "先保留退路",
    description: "适合可逆、低风险的问题。重大决定只给行动建议，不替你拍死。",
  },
  custom: {
    label: "自定义候选",
    tone: "只做取舍",
    description: "你已经有候选时，只负责比较和收口。",
  },
};

const fallbackLines = [
  "候选已经看完，继续比较收益不大。",
  "信息已经够用了，现在需要一个动作。",
  "没有更完美的选项了，先把今天往前推一步。",
  "再想十分钟也差不多，先收口。",
];

const decisionCardLimit = 3;
const lightSignals = ["一杯冰美式", "左手边第二盏灯", "今天的云", "路口第一个绿灯", "手机电量末位数"];
const quickRules = ["先选能执行的", "先避开不可逆", "先控制成本", "先让下一步变清楚"];

export function getModuleProfile(moduleId) {
  return moduleProfiles[moduleId] ?? moduleProfiles.general;
}

export function getTypeMeta(type, moduleId = "general") {
  return sharedTypeMeta[type] ?? getModuleProfile(moduleId).typeMeta;
}

export function normalizeOptions(value) {
  return value
    .split(/\n|,|，|、|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 8);
}

export function detectQuestionType(question, hasManualOptions, moduleId = "general") {
  const text = question.trim();
  if (hasManualOptions) {
    return "custom";
  }

  if (/(要不要|该不该|应不应该|是否|能不能|可不可以|去不去|做不做|买不买|辞职|表白|分手|离职)/.test(text)) {
    return "yesno";
  }

  if (moduleId === "dinner" || moduleId === "weekend" || moduleId === "gift") {
    return moduleId;
  }

  return "general";
}

export function buildDecision({
  moduleId = "general",
  question,
  context,
  mode,
  manualOptions,
  cardCount,
  poiCandidates = [],
}) {
  const cleanQuestion = question.trim();
  const options = normalizeOptions(manualOptions);

  if (!cleanQuestion) {
    return { ok: false, error: "先写一个你卡住的问题。比如：今晚吃什么？" };
  }

  const type = detectQuestionType(cleanQuestion, mode === "manual" && options.length > 0, moduleId);
  const persona = pickRandom(["gentle", "sharp", "light"]);

  if (type === "yesno") {
    const card = makeYesNoCard(cleanQuestion, context, moduleId);
    return {
      ok: true,
      type,
      persona,
      moduleId,
      cards: [card],
      immediateResult: makeResult({
        card,
        question: cleanQuestion,
        persona,
        source: "direct",
        type,
        moduleId,
      }),
    };
  }

  if (mode === "manual" && options.length < 3) {
    return { ok: false, error: "手动候选至少需要 3 个，才有比较和取舍的空间。" };
  }

  const count = mode === "manual" ? Math.min(options.length, decisionCardLimit) : decisionCardLimit;
  const cards =
    mode === "manual"
      ? makeManualCards(options, cleanQuestion, count, moduleId)
      : makeGeneratedCards(cleanQuestion, context, count, moduleId, poiCandidates);

  return {
    ok: true,
    type: mode === "manual" ? "custom" : type,
    persona,
    moduleId,
    cards,
  };
}

export function makeResult({ card, question, persona, source, type, moduleId }) {
  const resultModuleId = moduleId ?? card.moduleId ?? "general";
  const reason = makeReason({ card, question, persona, source, type, moduleId: resultModuleId });

  return {
    card,
    persona,
    source,
    type,
    moduleId: resultModuleId,
    reason,
    createdAt: Date.now(),
    fallbackLine: source === "fallback" ? pickRandom(fallbackLines) : "",
  };
}

export function makeFallbackResult(session) {
  const card = pickRandom(session.cards);
  return makeResult({
    card,
    question: session.question,
    persona: session.persona,
    source: "fallback",
    type: session.type,
    moduleId: session.moduleId,
  });
}

function makeGeneratedCards(question, context, count, moduleId, poiCandidates = []) {
  const pools = {
    dinner: [dinnerPool, dinnerImages],
    weekend: [weekendPool, weekendImages],
    gift: [giftPool, giftImages],
    general: [generalPool, generalImages],
  };
  const [pool, images] = pools[moduleId] ?? pools.general;
  const poiCards = makePoiCards(poiCandidates, question, moduleId);
  const baseCards = take(pool, count).map((card, index) => ({
    ...card,
    id: `${moduleId}-${index}-${card.title}`,
    image: images[index % images.length],
    moduleId,
    question,
    context,
  }));
  return [...poiCards, ...baseCards].slice(0, count);
}

function makePoiCards(pois, question, moduleId) {
  if (!Array.isArray(pois) || (moduleId !== "dinner" && moduleId !== "weekend")) {
    return [];
  }

  const images = moduleId === "dinner" ? dinnerImages : weekendImages;
  return pois.slice(0, 5).map((poi, index) => {
    const distance = formatDistance(poi.distance);
    const type = poi.type || (moduleId === "dinner" ? "餐饮 POI" : "周边 POI");
    const address = poi.address || poi.area || "附近";

    return {
      id: `poi-${moduleId}-${poi.id || index}`,
      title: poi.name,
      reason:
        moduleId === "dinner"
          ? `${poi.name} 是定位附近的真实 POI，${distance ? `距离约 ${distance}，` : ""}适合先把今晚这顿落到可导航的位置。`
          : `${poi.name} 是定位附近的真实 POI，${distance ? `距离约 ${distance}，` : ""}适合作为周末轻量安排的起点。`,
      meta: [distance || "附近", type, address].filter(Boolean).slice(0, 3),
      image: poi.image || images[index % images.length],
      accent: moduleId === "dinner" ? "#17a673" : "#4147d5",
      moduleId,
      question,
      poi,
    };
  });
}

function makeManualCards(options, question, count, moduleId) {
  return options.slice(0, count).map((title, index) => ({
    id: `manual-${index}-${title}`,
    title,
    reason: makeManualReason(title, moduleId),
    meta: ["自定义", `候选 ${index + 1}`, getModuleProfile(moduleId).label],
    image: generalImages[index % generalImages.length],
    accent: manualAccents[index % manualAccents.length],
    moduleId,
    question,
  }));
}

function makeManualReason(title, moduleId) {
  if (moduleId === "dinner") {
    return `「${title}」已经是可执行的吃法候选，接下来只需要确认距离、排队和预算。`;
  }
  if (moduleId === "weekend") {
    return `「${title}」适合作为周末候选，关键是确认时长、天气和同行状态。`;
  }
  if (moduleId === "gift") {
    return `「${title}」进入候选池，说明它至少满足预算或关系分寸，再看是否真的用得上。`;
  }
  return `「${title}」已经进入候选池，说明它至少满足了基本条件。`;
}

function makeYesNoCard(question, context, moduleId) {
  const score = stableNumber(`${question}${context}${moduleId}`, 100);
  const text = `${question}${context}`;
  const negativeSignals = /(没有.*offer|没.*offer|裸辞|风险|留后路|缓一缓|不确定|先别|还没准备|成本高|不可逆)/.test(text);
  const positiveSignals = /(可逆|低成本|今天能做|现在能做|试试|先推进|已经准备|确定|有备选|有 offer|拿到 offer)/.test(text);
  const positive = positiveSignals || (!negativeSignals && score >= 45);
  return {
    id: "yes-no",
    title: positive ? "先做一个小版本" : "先别直接做",
    reason: positive
      ? "当前信号足够支持你先迈一小步，不必等到完全确定。"
      : "现在更适合补信息或留备选，别把自己推到不可逆的位置。",
    meta: [positive ? "可推进" : "先缓冲", positive ? "先小步验证" : "补足信息", `信号 ${score}`],
    image: generalImages[positive ? 2 : 1],
    accent: positive ? "#17a673" : "#ef6f61",
    moduleId,
  };
}

function makeReason({ card, question, persona, source, type, moduleId }) {
  const title = card.title;
  const profile = getModuleProfile(moduleId);

  if (source === "fallback") {
    return `你已经把候选看完了，继续比较只会增加成本。按「${title}」走，先让${profile.label}这件事落地。`;
  }

  if (type === "yesno") {
    if (title.startsWith("先别")) {
      return `当前信息还不够支撑直接做。「${title}」不是放弃，是先保留退路、补齐关键条件。`;
    }
    return `这个决定适合先做小版本。「${title}」的重点不是冲动，而是低成本验证。`;
  }

  if (persona === "gentle") {
    return moduleGentleReason(title, moduleId);
  }

  if (persona === "sharp") {
    return moduleSharpReason(title, moduleId);
  }

  return `按「${pickRandom(quickRules)}」这个小原则看，「${title}」最适合现在先试。${pickRandom(lightSignals)}也站它这边。`;
}

function moduleGentleReason(title, moduleId) {
  if (moduleId === "dinner") {
    return `「${title}」同时照顾了执行成本和吃饭体验，不用把今晚变成一次大型调研。`;
  }
  if (moduleId === "weekend") {
    return `「${title}」不会把周末排得太满，也保留了临时调整的空间。`;
  }
  if (moduleId === "gift") {
    return `「${title}」在关系分寸和实用性之间比较稳，不会显得太随意，也不容易给对方负担。`;
  }
  return `「${title}」和你给出的标准更匹配，也不会把后续选择锁死。先按这个走。`;
}

function moduleSharpReason(title, moduleId) {
  if (moduleId === "dinner") {
    return `晚饭不是论文选题。「${title}」已经够符合条件，先订/先去，别再来回问三轮。`;
  }
  if (moduleId === "weekend") {
    return `周末最怕从计划变成躺平。「${title}」够明确，时间成本也可控，就它。`;
  }
  if (moduleId === "gift") {
    return `送礼不是证明你多懂宇宙，重点是不踩雷。「${title}」够体面，也够实用。`;
  }
  return `你不是没有标准，是标准太多。「${title}」已经满足主条件，先别继续加题。`;
}

const dinnerPool = [
  {
    title: "中点附近轻食店",
    reason: "先把路程拉平，再选低负担菜品，比较符合两个人都不想吃主食的条件。",
    meta: ["位置优先", "低负担", "需接 POI"],
    accent: "#17a673",
  },
  {
    title: "小份火锅或串串",
    reason: "菜品可以少量多样，适合没想好吃什么但又想有点热闹的晚上。",
    meta: ["选择弹性", "适合聊天", "预算中等"],
    accent: "#ef6f61",
  },
  {
    title: "越南粉/沙拉轻餐",
    reason: "出餐快、负担轻，主食压力也比较小，适合工作日晚上收尾。",
    meta: ["出餐快", "清爽", "低压力"],
    accent: "#f3b63f",
  },
  {
    title: "小份烧鸟",
    reason: "小份点单能降低试错成本，聊天也比正式餐厅更放松。",
    meta: ["小份多样", "可续摊", "氛围轻松"],
    accent: "#4147d5",
  },
  {
    title: "甜品和茶",
    reason: "如果吃饭只是见面的载体，甜品茶饮更轻，不会把晚上变得太正式。",
    meta: ["轻量见面", "预算可控", "不赶场"],
    accent: "#dd669b",
  },
  {
    title: "轻食精酿",
    reason: "有吃有喝，氛围比纯餐厅松，适合把晚饭变成小聚。",
    meta: ["可聊天", "可控时长", "需确认营业"],
    accent: "#2a83c5",
  },
  {
    title: "云吞/汤粉小店",
    reason: "低客单、低负担，适合今天只想快速解决但不想随便。",
    meta: ["省时间", "低预算", "不折腾"],
    accent: "#d87a28",
  },
  {
    title: "安静 Bistro",
    reason: "如果重点是聊天，座位、灯光和噪音比菜品数量更重要。",
    meta: ["聊天优先", "氛围好", "建议预约"],
    accent: "#7957d5",
  },
];

const weekendPool = [
  {
    title: "半日影展 + 咖啡",
    reason: "时长可控，室内稳定，结束后还能自然续一杯咖啡。",
    meta: ["室内", "半天", "低体力"],
    accent: "#4147d5",
  },
  {
    title: "河边 Citywalk",
    reason: "路线松，预算低，走累了随时切咖啡店，不会把周末排满。",
    meta: ["户外", "低预算", "可中断"],
    accent: "#17a673",
  },
  {
    title: "中古小店地图",
    reason: "每家店都是小目标，逛起来有节奏，也容易制造聊天话题。",
    meta: ["可拍照", "3-4 站", "惊喜感"],
    accent: "#ef6f61",
  },
  {
    title: "日落露台",
    reason: "只需要卡住一个时间点，其他都可以随缘，适合不想做复杂计划。",
    meta: ["傍晚", "预约更稳", "氛围好"],
    accent: "#f3b63f",
  },
  {
    title: "陶艺体验",
    reason: "手上有事，嘴上不尴尬，很适合刚认识或久未见的人一起去。",
    meta: ["预约制", "2.5 小时", "可带走"],
    accent: "#dd669b",
  },
  {
    title: "深夜书店",
    reason: "不赶场，也不需要高能社交，适合慢热、雨天或一个人放空。",
    meta: ["安静", "雨天友好", "低压力"],
    accent: "#2a83c5",
  },
  {
    title: "即兴喜剧",
    reason: "笑点替你破冰，结束后自然有话题，适合想轻松一点的周末。",
    meta: ["90 分钟", "轻松", "需购票"],
    accent: "#7957d5",
  },
  {
    title: "早午餐漫游",
    reason: "把一天打开，但不给一天上锁，适合想出门又不想太累。",
    meta: ["白天", "低风险", "可续摊"],
    accent: "#d87a28",
  },
];

const giftPool = [
  {
    title: "桌面氛围灯",
    reason: "不挑尺码，不像摆件那么空，刚入职的人真的用得到。",
    meta: ["预算友好", "实用", "不冒犯"],
    accent: "#f3b63f",
  },
  {
    title: "好写的钢笔",
    reason: "有一点仪式感，但不会贵到让对方有负担。",
    meta: ["质感", "职场", "可刻字"],
    accent: "#2a83c5",
  },
  {
    title: "降噪耳塞套装",
    reason: "比耳机轻，也比香薰更不挑人，适合通勤和办公室。",
    meta: ["轻量", "通勤", "高频使用"],
    accent: "#17a673",
  },
  {
    title: "精品咖啡礼盒",
    reason: "消耗品永远安全，喝完就结束，不占对方生活空间。",
    meta: ["低压力", "可分享", "有质感"],
    accent: "#7957d5",
  },
  {
    title: "通勤随行杯",
    reason: "日常使用频率高，价格带清楚，也不需要知道太多私密偏好。",
    meta: ["高频", "职场", "不闲置"],
    accent: "#d87a28",
  },
  {
    title: "高级便签和笔记本",
    reason: "适合新工作、新阶段，表达祝福也不会越界。",
    meta: ["入职", "体面", "可搭配"],
    accent: "#4147d5",
  },
  {
    title: "香氛护手霜礼盒",
    reason: "小而完整，包装通常好看，适合关系还没到很亲密的礼物。",
    meta: ["包装好", "轻量", "需避香味雷"],
    accent: "#dd669b",
  },
  {
    title: "电子书会员",
    reason: "如果对方有阅读习惯，会员类礼物没有收纳压力，也容易立刻用起来。",
    meta: ["数字礼物", "不占空间", "需确认习惯"],
    accent: "#17a673",
  },
];

const generalPool = [
  {
    title: "先做最小版本",
    reason: "把选择压成一个今天能完成的小动作，先验证方向，再决定是否加码。",
    meta: ["今天能做", "低风险", "可回退"],
    accent: "#17a673",
  },
  {
    title: "选成本最低的那个",
    reason: "当收益差不多时，先选试错成本低的，可以少消耗情绪和时间。",
    meta: ["省成本", "低负担", "快推进"],
    accent: "#f3b63f",
  },
  {
    title: "先排除最不可逆的选项",
    reason: "纠结时不要先找最完美的答案，先把后悔成本高的拿掉。",
    meta: ["保退路", "避风险", "稳一点"],
    accent: "#ef6f61",
  },
  {
    title: "选能让下一步变清楚的",
    reason: "它不一定是最终答案，但能让下一轮信息更明确。",
    meta: ["清晰下一步", "适合探索", "可迭代"],
    accent: "#4147d5",
  },
  {
    title: "先问一个关键人",
    reason: "如果这个决定会影响别人，先补一条真实反馈，比自己空想更有效。",
    meta: ["顾及关系", "补信息", "少误判"],
    accent: "#dd669b",
  },
  {
    title: "今晚先不升级问题",
    reason: "如果你已经累了，就先做一个低风险动作，不把小选择扩大成大命题。",
    meta: ["降噪", "保精力", "不加戏"],
    accent: "#2a83c5",
  },
  {
    title: "给它一个 24 小时窗口",
    reason: "设一个明确复盘点，可以避免无限拖延，也避免当下冲动。",
    meta: ["有期限", "可复盘", "留余地"],
    accent: "#7957d5",
  },
  {
    title: "选最容易开始的",
    reason: "开始本身会带来信息。卡住太久时，启动成本比理论最优更重要。",
    meta: ["启动快", "不内耗", "适合低风险"],
    accent: "#d87a28",
  },
];

const manualAccents = ["#17a673", "#4147d5", "#f3b63f", "#dd669b", "#ef6f61", "#2a83c5", "#7957d5", "#d87a28"];

function take(list, count) {
  const offset = stableNumber(`${list.length}-${count}-${Date.now().toString().slice(-4)}`, list.length);
  const rotated = [...list.slice(offset), ...list.slice(0, offset)];
  return rotated.slice(0, count);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function stableNumber(value, modulo) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash) % modulo;
}

function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) {
    return "";
  }
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(distance >= 3000 ? 0 : 1)}km`;
  }
  return `${Math.round(distance)}m`;
}
