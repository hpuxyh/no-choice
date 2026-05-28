const foodImages = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80",
];

const openImages = [
  "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
];

const cityImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
];

const manualImages = [
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
];

export const presets = [
  {
    id: "dinner",
    label: "今晚吃什么",
    question: "今晚吃什么？",
    context: "我在国贸，朋友在常营，都不想吃主食，想找中间点。",
    conditionIds: ["midpoint", "noStaple"],
    customConditions: ["我在国贸，朋友在常营"],
    mode: "auto",
    options: "",
    count: 4,
  },
  {
    id: "gift",
    label: "送什么礼物",
    question: "送给刚入职的朋友什么生日礼物？",
    context: "预算 300 元以内，希望实用但不要太无聊。",
    conditionIds: ["budget", "practical", "notBoring"],
    customConditions: ["预算 300 元以内"],
    mode: "auto",
    options: "",
    count: 5,
  },
  {
    id: "quit",
    label: "要不要辞职",
    question: "要不要辞职？",
    context: "最近项目压力大，但还没有拿到新 offer。",
    conditionIds: ["lowRisk", "buffer"],
    customConditions: ["最近项目压力大", "还没有拿到新 offer"],
    mode: "auto",
    options: "",
    count: 3,
  },
  {
    id: "date",
    label: "跟谁约会",
    question: "周末跟谁约会？",
    context: "",
    conditionIds: ["quiet", "fresh"],
    customConditions: [],
    mode: "manual",
    options: "阿树\n小陆\nRicky\n独自看电影",
    count: 4,
  },
];

export const personaMeta = {
  gentle: {
    name: "温柔朋友",
    mark: "陪你站队",
  },
  sharp: {
    name: "损友",
    mark: "替你开口",
  },
  mystic: {
    name: "玄学大师",
    mark: "负责乱准",
  },
};

const typeMeta = {
  info: {
    label: "信息推荐型",
    tone: "模型推荐",
    description: "大卡片会带评分、人均、距离等演示字段。",
  },
  open: {
    label: "开放推荐型",
    tone: "灵感生成",
    description: "根据问题生成候选，再用滑卡逼你承诺。",
  },
  yesno: {
    label: "是否型",
    tone: "一锤定音",
    description: "跳过滑卡，直接给做或不做。",
  },
  custom: {
    label: "纯自定义型",
    tone: "你给候选",
    description: "保留你的选项，只负责拍板。",
  },
};

const fallbackLines = [
  "别滑了，真没有了。",
  "好家伙，选择困难晚期。",
  "系统看不下去了，替你钦定。",
  "再滑就要滑出人生了。",
];

const luckyItems = ["一杯冰美式", "左手边第二盏灯", "今天的云", "路口第一个绿灯", "手机电量末位数"];
const constellations = ["狮子座", "天秤座", "射手座", "双鱼座", "白羊座"];
const tarotCards = ["命运之轮正位", "星币九正位", "恋人牌正位", "权杖骑士正位", "太阳牌正位"];
const almanacActions = ["宜决断，忌反复横跳", "宜爽快，忌打开备忘录再列十条", "宜出门，忌临门一脚退缩"];

export function getTypeMeta(type) {
  return typeMeta[type] ?? typeMeta.open;
}

export function normalizeOptions(value) {
  return value
    .split(/\n|,|，|、|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 8);
}

export function detectQuestionType(question, hasManualOptions) {
  const text = question.trim();
  if (/(要不要|该不该|应不应该|是否|能不能|可不可以|去不去|做不做|买不买|辞职|表白|分手|离职)/.test(text)) {
    return "yesno";
  }

  if (hasManualOptions) {
    return "custom";
  }

  if (/(吃|喝|餐厅|咖啡|火锅|烧烤|去哪|哪里玩|怎么玩|附近|周末|旅行|约会|逛|展|电影|酒吧)/.test(text)) {
    return "info";
  }

  return "open";
}

export function buildDecision({ question, context, mode, manualOptions, cardCount }) {
  const cleanQuestion = question.trim();
  const options = normalizeOptions(manualOptions);

  if (!cleanQuestion) {
    return { ok: false, error: "先写一个问题。比如：今晚吃什么？" };
  }

  const type = detectQuestionType(cleanQuestion, mode === "manual" && options.length > 0);
  const persona = pickRandom(["gentle", "sharp", "mystic"]);

  if (type === "yesno") {
    const card = makeYesNoCard(cleanQuestion, context);
    return {
      ok: true,
      type,
      persona,
      cards: [card],
      immediateResult: makeResult({
        card,
        question: cleanQuestion,
        persona,
        source: "direct",
        type,
      }),
    };
  }

  if (mode === "manual" && options.length < 3) {
    return { ok: false, error: "手动候选至少给 3 个，才有被迫取舍的味道。" };
  }

  const count = mode === "manual" ? Math.min(options.length, 8) : clamp(Number(cardCount) || 3, 3, 8);
  const cards =
    mode === "manual"
      ? makeManualCards(options, cleanQuestion, count)
      : makeGeneratedCards(cleanQuestion, context, count, type);

  return {
    ok: true,
    type: mode === "manual" ? "custom" : type,
    persona,
    cards,
  };
}

export function makeResult({ card, question, persona, source, type }) {
  const reason = makeReason({ card, question, persona, source, type });

  return {
    card,
    persona,
    source,
    type,
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
  });
}

function makeGeneratedCards(question, context, count, type) {
  const text = `${question} ${context}`;

  if (type === "info" && /(玩|去哪|哪里玩|周末|旅行|约会|逛|展|电影)/.test(text)) {
    return take(cityPool, count).map((card, index) => ({
      ...card,
      id: `city-${index}-${card.title}`,
      image: cityImages[index % cityImages.length],
    }));
  }

  if (type === "info") {
    return take(foodPool, count).map((card, index) => ({
      ...card,
      id: `food-${index}-${card.title}`,
      image: foodImages[index % foodImages.length],
    }));
  }

  const pool = /(礼物|送)/.test(text) ? giftPool : /(书|读)/.test(text) ? bookPool : openPool;

  return take(pool, count).map((card, index) => ({
    ...card,
    id: `open-${index}-${card.title}`,
    image: openImages[index % openImages.length],
  }));
}

function makeManualCards(options, question, count) {
  return options.slice(0, count).map((title, index) => ({
    id: `manual-${index}-${title}`,
    title,
    reason: `你把「${title}」写进候选里，说明它已经通过了第一轮筛选。`,
    meta: ["自定义", `候选 ${index + 1}`],
    image: manualImages[index % manualImages.length],
    accent: manualAccents[index % manualAccents.length],
    question,
  }));
}

function makeYesNoCard(question, context) {
  const score = stableNumber(`${question}${context}`, 100);
  const positive = score >= 38;
  return {
    id: "yes-no",
    title: positive ? "做" : "先别做",
    reason: positive ? "你已经问出口了，说明它不是一时冲动。" : "现在的不确定不是胆小，是信息还差一点。",
    meta: [positive ? "推进" : "缓一缓", `信号 ${score}`],
    image: openImages[positive ? 2 : 1],
    accent: positive ? "#17a673" : "#ef6f61",
  };
}

function makeReason({ card, question, persona, source, type }) {
  const title = card.title;
  const item = pickRandom(luckyItems);

  if (persona === "gentle") {
    if (source === "fallback") {
      return `你把所有选项都划走，也是一种偏好暴露。那就让「${title}」接住今天的犹豫，先走一步再说。`;
    }
    if (type === "yesno") {
      return `这个决定不需要完美，只需要让你从原地出来。「${title}」是今天比较诚实的答案。`;
    }
    return `你停在「${title}」上面的那一下，身体比脑子诚实。先把这一步交给它。`;
  }

  if (persona === "sharp") {
    if (source === "fallback") {
      return `你都滑到底了还不选，那我替你选「${title}」。别装了，今天就需要一个人拍桌子。`;
    }
    if (type === "yesno") {
      return `你心里早有答案，只是想找人替你说出来。行，我说：${title}。`;
    }
    return `你不是没有标准，是标准太多。「${title}」已经够好了，别再开十个标签页。`;
  }

  const style = pickRandom(["tarot", "stars", "almanac", "quiz"]);
  if (style === "tarot") {
    return `刚翻到${pickRandom(tarotCards)}，牌面指向「${title}」。它不保证完美，但保证你终于不用卡住。`;
  }
  if (style === "stars") {
    return `${pickRandom(constellations)}相关能量正旺，幸运物是${item}。今天的问题「${question}」，答案偏向「${title}」。`;
  }
  if (style === "almanac") {
    return `黄历显示：${pickRandom(almanacActions)}。所以「${title}」今日胜出，犹豫请明天再营业。`;
  }
  return `测测综合指数显示，「${title}」与你今天的行动力匹配度 93%。剩下 7% 是你还想纠结的尊严。`;
}

const foodPool = [
  {
    title: "东四小馆",
    reason: "菜品轻、选择多，适合两个人都不想被主食拖住的晚上。",
    meta: ["评分 4.7", "人均 ¥96", "距中点 1.2km"],
    accent: "#17a673",
  },
  {
    title: "花椒树下火锅",
    reason: "锅底可以半份，氛围热闹，适合把纠结交给蘸料。",
    meta: ["评分 4.6", "人均 ¥132", "距中点 1.8km"],
    accent: "#ef6f61",
  },
  {
    title: "午后越南粉",
    reason: "清爽、出餐快，对不想吃主食的人也有春卷和沙拉。",
    meta: ["评分 4.5", "人均 ¥78", "距中点 900m"],
    accent: "#f3b63f",
  },
  {
    title: "巷口烧鸟",
    reason: "小份多样，点单压力低，聊天空间比正式餐厅更松。",
    meta: ["评分 4.8", "人均 ¥148", "距中点 2.1km"],
    accent: "#4147d5",
  },
  {
    title: "不太甜甜品室",
    reason: "如果晚餐只是借口，甜品和茶更容易把气氛托住。",
    meta: ["评分 4.6", "人均 ¥64", "距中点 1.5km"],
    accent: "#dd669b",
  },
  {
    title: "半山精酿",
    reason: "轻食、无酒精选项都有，适合临时把晚饭变成小聚。",
    meta: ["评分 4.4", "人均 ¥118", "距中点 2.4km"],
    accent: "#2a83c5",
  },
  {
    title: "云吞计划",
    reason: "低负担、低客单，适合今天只想快速解决但不想随便。",
    meta: ["评分 4.5", "人均 ¥52", "距中点 700m"],
    accent: "#d87a28",
  },
  {
    title: "晚风 Bistro",
    reason: "灯光和座位都更适合慢慢聊，选择少反而省心。",
    meta: ["评分 4.7", "人均 ¥168", "距中点 2.6km"],
    accent: "#7957d5",
  },
];

const cityPool = [
  {
    title: "小型影展",
    reason: "时长可控，结束后还可以顺手吃饭，不会把周末排满。",
    meta: ["室内", "2 小时", "适合聊天"],
    accent: "#4147d5",
  },
  {
    title: "河边 Citywalk",
    reason: "路线松，预算低，走累了随时切咖啡店。",
    meta: ["户外", "低预算", "轻运动"],
    accent: "#17a673",
  },
  {
    title: "中古小店地图",
    reason: "每家店都是小目标，逛起来有节奏，不容易散。",
    meta: ["可拍照", "3-4 站", "惊喜感"],
    accent: "#ef6f61",
  },
  {
    title: "日落露台",
    reason: "只需要卡住一个时间点，其他都可以随缘。",
    meta: ["傍晚", "预约更稳", "氛围好"],
    accent: "#f3b63f",
  },
  {
    title: "陶艺体验",
    reason: "手上有事，嘴上不尴尬，很适合刚认识或久未见。",
    meta: ["预约制", "2.5 小时", "可带走"],
    accent: "#dd669b",
  },
  {
    title: "深夜书店",
    reason: "不赶场，也不需要高能社交，适合慢热局。",
    meta: ["安静", "雨天友好", "低压力"],
    accent: "#2a83c5",
  },
  {
    title: "即兴喜剧",
    reason: "笑点替你破冰，结束后自然有话题。",
    meta: ["90 分钟", "轻松", "需购票"],
    accent: "#7957d5",
  },
  {
    title: "早午餐漫游",
    reason: "把一天打开，但不给一天上锁。",
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
    accent: "#d87a28",
  },
  {
    title: "城市散步券",
    reason: "把礼物变成一次见面，适合关系还想继续升温的人。",
    meta: ["有心意", "可约", "不落灰"],
    accent: "#ef6f61",
  },
  {
    title: "人体工学脚踏",
    reason: "听起来朴素，但办公室幸福感会每天涨一点。",
    meta: ["实用派", "办公室", "低调"],
    accent: "#4147d5",
  },
  {
    title: "香气洗护套装",
    reason: "比香水更安全，体面、好消耗，也不太会踩雷。",
    meta: ["体面", "消耗品", "好包装"],
    accent: "#dd669b",
  },
  {
    title: "迷你拍立得相纸",
    reason: "如果对方爱记录，补充耗材比送机器更聪明。",
    meta: ["兴趣相关", "不重复", "小惊喜"],
    accent: "#7957d5",
  },
];

const bookPool = [
  {
    title: "《始于极限》",
    reason: "聊天密度高，适合想看一点真实关系和自我审视的人。",
    meta: ["对谈", "女性视角", "好读"],
    accent: "#ef6f61",
  },
  {
    title: "《纳瓦尔宝典》",
    reason: "短段落、观点密集，适合碎片时间读。",
    meta: ["效率", "思考", "可摘抄"],
    accent: "#17a673",
  },
  {
    title: "《悉达多》",
    reason: "轻薄但后劲大，适合在转折期读。",
    meta: ["经典", "短篇", "心境"],
    accent: "#2a83c5",
  },
  {
    title: "《可能性的艺术》",
    reason: "不鸡血，但会把人从卡住的框架里松出来。",
    meta: ["心理", "创造力", "温和"],
    accent: "#f3b63f",
  },
  {
    title: "《置身事内》",
    reason: "现实感强，适合想理解城市和经济运行的人。",
    meta: ["社科", "清晰", "信息量"],
    accent: "#4147d5",
  },
  {
    title: "《夜晚的潜水艇》",
    reason: "想象力足，适合给脑子换一个频道。",
    meta: ["小说", "短篇", "奇妙"],
    accent: "#7957d5",
  },
  {
    title: "《蛤蟆先生去看心理医生》",
    reason: "友好、不吓人，适合刚开始关照自己的人。",
    meta: ["心理", "入门", "顺滑"],
    accent: "#dd669b",
  },
  {
    title: "《被讨厌的勇气》",
    reason: "不一定全同意，但很适合拿来和自己辩论。",
    meta: ["观点", "关系", "行动"],
    accent: "#d87a28",
  },
];

const openPool = [
  {
    title: "最省心的那个",
    reason: "你现在需要的不是惊艳，而是能马上推进的选项。",
    meta: ["低阻力", "立刻开始", "少返工"],
    accent: "#17a673",
  },
  {
    title: "最像你的那个",
    reason: "它不一定最优，但和你当下的节奏最合拍。",
    meta: ["匹配感", "自然", "低内耗"],
    accent: "#dd669b",
  },
  {
    title: "最有故事的那个",
    reason: "以后回头看，至少不会觉得今天完全无聊。",
    meta: ["记忆点", "可分享", "新鲜"],
    accent: "#ef6f61",
  },
  {
    title: "最稳的那个",
    reason: "风险最低，反馈最快，适合先把局面推起来。",
    meta: ["稳妥", "可控", "反馈快"],
    accent: "#2a83c5",
  },
  {
    title: "最反常的那个",
    reason: "如果你一直没结果，可能正需要一个不按旧规则来的答案。",
    meta: ["打破惯性", "新鲜", "有火花"],
    accent: "#f3b63f",
  },
  {
    title: "最便宜的那个",
    reason: "预算不是丢脸的限制，是帮你做决定的边界。",
    meta: ["省钱", "轻负担", "可重复"],
    accent: "#d87a28",
  },
  {
    title: "最方便的那个",
    reason: "距离和时间已经替你投票了，别假装没听见。",
    meta: ["近", "快", "不折腾"],
    accent: "#4147d5",
  },
  {
    title: "最让你笑的那个",
    reason: "认真生活也需要一点不讲道理的愉快。",
    meta: ["轻松", "情绪价值", "回血"],
    accent: "#7957d5",
  },
];

const manualAccents = ["#17a673", "#ef6f61", "#4147d5", "#f3b63f", "#dd669b", "#2a83c5", "#d87a28", "#7957d5"];

function take(pool, count) {
  const start = Math.floor(Math.random() * pool.length);
  return Array.from({ length: count }, (_, index) => pool[(start + index) % pool.length]);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function stableNumber(text, modulo) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % modulo;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
