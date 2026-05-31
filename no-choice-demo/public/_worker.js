const MIN_DINNER_COST = 150;
const POI_PAGE_SIZE = 20;
const POI_SEARCH_PAGES = 6;
const DINNER_PRICE_POOL_SIZE = 30;
const DECIDE_POI_LIMIT = 30;

const poiConfigs = {
  dinner: {
    keyword: "餐厅",
    types: "050000",
    radius: "3500",
    minCost: MIN_DINNER_COST,
  },
  weekend: {
    keyword: "休闲",
    types: "080000|110000|140000|060000",
    radius: "6000",
  },
};

const jsonHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/poi") {
      return handlePoiRequest(url, env);
    }

    if (url.pathname === "/api/decide") {
      return handleDecideRequest(request, env);
    }

    if (url.pathname === "/api/restaurant-search-plan") {
      return handleRestaurantSearchPlanRequest(request, env);
    }

    if (url.pathname === "/api/comic-image") {
      return handleComicImageRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handlePoiRequest(url, env) {
  const key = env.AMAP_WEB_SERVICE_KEY || env.AMAP_KEY || "";
  if (!key) {
    return json(
      {
        ok: false,
        needsKey: true,
        message: "Cloudflare 还没有配置 AMAP_WEB_SERVICE_KEY",
      },
      501,
    );
  }

  const lat = readCoord(url.searchParams.get("lat"));
  const lng = readCoord(url.searchParams.get("lng"));
  const moduleId = url.searchParams.get("module") || "dinner";
  const config = poiConfigs[moduleId] || poiConfigs.dinner;
  const keyword = cleanKeyword(url.searchParams.get("keyword")) || config.keyword;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, message: "缺少有效经纬度" }, 400);
  }

  try {
    const center = await convertToAmap({ lat, lng, key });
    const pois = await fetchAroundPois({ center, key, keyword, config });
    return json({
      ok: true,
      provider: "amap",
      coords: {
        raw: { lat, lng },
        amap: center,
      },
      pois,
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "POI 查询失败" }, 502);
  }
}

async function handleDecideRequest(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, message: "只支持 POST" }, 405);
  }

  const key = env.DEEPSEEK_API_KEY || "";
  if (!key) {
    return json(
      {
        ok: false,
        needsKey: true,
        message: "Cloudflare 还没有配置 DEEPSEEK_API_KEY",
      },
      501,
    );
  }

  let input;
  try {
    input = normalizeDecisionInput(await request.json());
  } catch {
    return json({ ok: false, message: "请求内容不是有效 JSON" }, 400);
  }

  if (!input.question) {
    return json({ ok: false, message: "缺少问题内容" }, 400);
  }

  try {
    const model = env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    const content = await askDeepSeek({ key, model, input });
    const parsed = parseJsonContent(content);
    const cards = normalizeAiCards(parsed.cards, input);

    if (cards.length < Math.min(3, input.outputCount)) {
      throw new Error("模型没有返回足够候选");
    }

    return json({
      ok: true,
      provider: "deepseek",
      model,
      cards,
      usage: parsed.usage || null,
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "AI 推荐暂时不可用" }, 502);
  }
}

async function handleRestaurantSearchPlanRequest(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, message: "只支持 POST" }, 405);
  }

  const key = env.DEEPSEEK_API_KEY || "";
  if (!key) {
    return json(
      {
        ok: false,
        needsKey: true,
        message: "Cloudflare 还没有配置 DEEPSEEK_API_KEY",
      },
      501,
    );
  }

  let input;
  try {
    input = normalizeRestaurantSearchPlanInput(await request.json());
  } catch {
    return json({ ok: false, message: "请求内容不是有效 JSON" }, 400);
  }

  try {
    const model = env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    const content = await askDeepSeekRestaurantSearchPlan({ key, model, input });
    const parsed = parseJsonContent(content);
    const plan = normalizeRestaurantSearchPlan(parsed.plan || parsed.searchPlan || parsed, input);

    if (!plan.keywords.length) {
      throw new Error("模型没有返回有效高德搜索关键词");
    }

    return json({
      ok: true,
      provider: "deepseek",
      model,
      plan,
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "AI 搜索条件解析暂时不可用" }, 502);
  }
}

async function handleComicImageRequest(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, message: "只支持 POST" }, 405);
  }

  const key = env.DOUBAO_SEEDREAM_API_KEY || env.ARK_API_KEY || env.DOUBAO_API_KEY || "";
  if (!key) {
    return json(
      {
        ok: false,
        needsKey: true,
        message: "Cloudflare 还没有配置 DOUBAO_SEEDREAM_API_KEY",
      },
      501,
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ ok: false, message: "请求内容不是有效 JSON" }, 400);
  }

  const image = cleanUrl(input?.image);
  if (!image) {
    return json({ ok: false, message: "缺少有效图片 URL" }, 400);
  }

  const title = cleanText(input?.title, 80);
  const prompt =
    cleanText(input?.prompt, 500) ||
    [
      "把输入照片改造成高质量漫画风餐厅卡面插画。",
      "保留原图的主体、空间结构、透视和餐厅/食物特征，不要改变成无关场景。",
      "风格：日系生活方式漫画，干净线稿，柔和高饱和色，明亮温暖，细节丰富，适合手机抽卡卡片上半区。",
      "不要添加任何文字、logo、水印、菜单字样或价格牌。",
      title ? `参考对象：${title}。` : "",
    ]
      .filter(Boolean)
      .join(" ");

  try {
    const model = env.DOUBAO_IMAGE_MODEL || env.DOUBAO_SEEDREAM_MODEL || "doubao-seedream-5-0-260128";
    const size = env.DOUBAO_IMAGE_SIZE || "2K";
    const output = await generateComicImage({ key, model, image, prompt, size });
    return json({
      ok: true,
      provider: "doubao-seedream",
      model,
      url: output.url,
      size: output.size || "",
      revisedPrompt: output.revisedPrompt || "",
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "漫画图片生成失败" }, 502);
  }
}

async function generateComicImage({ key, model, image, prompt, size }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let response;
  try {
    response = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        image,
        size,
        output_format: "png",
        response_format: "url",
        watermark: false,
        sequential_image_generation: "disabled",
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "Seedream 请求失败");
  }

  const first = data?.data?.[0];
  const url = cleanUrl(first?.url);
  if (!url) {
    throw new Error("Seedream 没有返回图片 URL");
  }

  return {
    url,
    size: cleanText(first?.size, 24),
    revisedPrompt: cleanText(first?.revised_prompt || first?.revisedPrompt, 300),
  };
}

async function askDeepSeek({ key, model, input }) {
  const outputCount = Math.max(3, Math.min(5, Number(input.outputCount) || 3));
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            `你是不做选择 App 的决策推荐引擎。你必须只返回 JSON object，不要 Markdown。输出 exactly ${outputCount} 张卡，字段为 cards。每张卡必须有 title、reason、tags、sourcePoiId、confidence。reason 用中文，45 字以内。tags 2 到 3 个，每个 8 字以内。若输入里有 pois 且模块是 dinner 或 weekend，必须从 pois 里选择真实地点，title 尽量使用 POI 原名，sourcePoiId 必须填对应 id，不要编造不存在的餐厅或地点。若没有真实 POI，则给可执行方向。礼物模块给具体礼物类型，通用模块给具体下一步动作。`,
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      temperature: 0.35,
      max_tokens: outputCount >= 5 ? 1400 : 900,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || "DeepSeek 请求失败");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 没有返回内容");
  }

  return content;
}

async function askDeepSeekRestaurantSearchPlan({ key, model, input }) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "你是不做选择 App 的高德餐饮搜索条件解析器。你必须只返回 JSON object，不要 Markdown。",
            "任务：把用户自然语言、标签、位置理解成高德 Web 服务 v5 place/around 可执行的搜索计划。不要推荐餐厅，不要排序餐厅，不要编造 POI。",
            "高德原生可接收字段：keywords、types、location、radius、sortrule、region、city_limit、page_size、page_num、show_fields、output。location/page_size/page_num/output 由前端补，不要输出。",
            "高德不原生筛选但前端会后处理的字段：minCost、maxCost、minRating、mustKeywords、avoidKeywords、preferOpenLate、openAtHour。",
            "必须返回 {\"plan\":{...}}。plan 字段：keywords 中文短关键词数组 2 到 6 个；searchRequests 数组 2 到 8 个，每项包含 keyword、types、radiusMeters、sortrule、region、cityLimit、priority；types 默认 050000，除非你确定高德 6 位 POI 分类码；sortrule 只能 distance 或 weight；radiusMeters 1000 到 10000；region 为商圈/行政区短文本；locationHint 为用户确认的目的地/搜索中心，例如“定在三里屯附近”返回“三里屯”，没有则空字符串；locationHints 为多人出发地数组，最多 4 个，例如“一个人在海淀区，一个在朝阳区”返回 [\"海淀区\",\"朝阳区\"]；如果同时有目的地和出发地，locationHint 优先表达目的地，locationHints 只放出发地；cityLimit boolean；showFields 固定 business,photos；minCost/maxCost/minRating 为数字或 null；preferOpenLate boolean；openAtHour 为 0 到 29 的小时或 null；mustKeywords/avoidKeywords 为短词数组；explanation 中文 40 字以内。",
            "关键词要能直接给高德搜，例如：西餐、火锅、夜宵、烧烤、日料、约会餐厅、安静餐厅、咖啡。不要输出长句作为 keyword。",
            "先判断用户是否已有明确餐厅指向：明确店名、品牌、菜系、菜品、地域口味、商圈位置都算明确。明确时不要随意改写或扩写，keywords 和 searchRequests 的第一项必须保留用户原始核心词，例如“想吃云南菜”保留 云南菜，“想吃牛肉面”保留 牛肉面，“海底捞”保留 海底捞。",
            "只有用户没有明确食物/餐厅指向时，才结合标签拆解成高德可搜关键词。例如“朋友聚餐、安静好聊”可拆成 聚餐、安静餐厅、西餐、咖啡；“不知道吃什么、少排队”可拆成 餐厅、简餐、小吃。不要只输出泛化的“餐厅”，除非输入确实没有明确意图。"
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      temperature: 0.15,
      max_tokens: 800,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || "DeepSeek 请求失败");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 没有返回内容");
  }

  return content;
}

function normalizeDecisionInput(body) {
  const moduleId = cleanToken(body?.moduleId, 24) || "general";
  const outputCount = Math.max(3, Math.min(5, Number(body?.outputCount) || 3));
  const manualCandidates = Array.isArray(body?.manualCandidates)
    ? body.manualCandidates.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 8)
    : [];
  const pois = Array.isArray(body?.pois) ? body.pois.map(normalizeInputPoi).filter(Boolean).slice(0, DECIDE_POI_LIMIT) : [];
  const location = normalizeInputLocation(body?.location);

  return {
    moduleId,
    moduleLabel: cleanText(body?.moduleLabel, 24),
    question: cleanText(body?.question, 160),
    context: cleanText(body?.context, 1400),
    selectedConditions: normalizeStringList(body?.selectedConditions, 16, 24),
    customConditions: normalizeStringList(body?.customConditions, 8, 80),
    mode: cleanToken(body?.mode, 16) || "auto",
    manualCandidates,
    location,
    pois,
    outputCount,
  };
}

function normalizeRestaurantSearchPlanInput(body) {
  const selectedConditions = normalizeStringList(body?.selectedConditions || body?.tags, 16, 24);
  const customConditions = normalizeStringList(body?.customConditions, 8, 80);

  return {
    moduleId: cleanToken(body?.moduleId, 24) || "dinner",
    question: cleanText(body?.question, 220),
    scenes: normalizeStringList(body?.scenes, 8, 24),
    needs: normalizeStringList(body?.needs, 8, 24),
    tags: selectedConditions,
    locationHint: normalizeLocationHint(body?.locationHint || body?.destinationHint || body?.destination),
    locationHints: normalizeLocationHints(body?.locationHints),
    customConditions,
    location: normalizeInputLocation(body?.location),
  };
}

function normalizeRestaurantSearchPlan(plan, input) {
  const keywords = normalizeSearchKeywords(
    plan?.keywords || plan?.searchKeywords || plan?.amapKeywords || plan?.tags,
  );
  const fallbackKeywords = normalizeSearchKeywords([...input.tags, input.question]);
  const minCost = readMoneyValue(plan?.minCost ?? plan?.min_price ?? plan?.minPrice);
  const maxCost = readMoneyValue(plan?.maxCost ?? plan?.max_price ?? plan?.maxPrice);
  const minRating = readRatingNumber(plan?.minRating ?? plan?.min_rating ?? plan?.ratingMin);
  const openAtHour = readHourNumber(plan?.openAtHour ?? plan?.open_at_hour ?? plan?.openAt);
  const radius = Number(plan?.radiusMeters || plan?.radius || plan?.radius_meters);
  const locationHints = normalizeLocationHints(plan?.locationHints || plan?.locations || plan?.participantLocations || plan?.meetingLocations);
  const locationHint = normalizeLocationHint(plan?.locationHint || plan?.destinationHint || plan?.destination || plan?.area || plan?.landmark);
  const fallbackMinCost = input.tags.includes("人均150+") || /人均\s*150|150\+|150以上/.test(input.question)
    ? MIN_DINNER_COST
    : null;
  const resolvedMinCost = Number.isFinite(minCost) ? minCost : fallbackMinCost;
  const resolvedPlan = {
    keywords: (keywords.length ? keywords : fallbackKeywords).slice(0, 6),
    types: normalizeAmapTypes(plan?.types || plan?.typeCodes || plan?.amapTypes),
    sortrule: normalizeAmapSortRule(plan?.sortrule || plan?.sortRule),
    region: cleanText(plan?.region || plan?.city, 40),
    cityLimit: Boolean(plan?.cityLimit || plan?.city_limit),
    showFields: normalizeAmapShowFields(plan?.showFields || plan?.show_fields),
    minCost: resolvedMinCost,
    maxCost: Number.isFinite(maxCost) && (!resolvedMinCost || maxCost >= resolvedMinCost) ? maxCost : null,
    minRating: Number.isFinite(minRating) ? minRating : null,
    radiusMeters: Number.isFinite(radius) ? Math.max(1000, Math.min(10000, Math.round(radius))) : 3500,
    preferOpenLate: Boolean(plan?.preferOpenLate || plan?.openLate || plan?.lateNight || input.tags.includes("通宵熬夜")),
    openAtHour: Number.isFinite(openAtHour) ? openAtHour : null,
    mustKeywords: normalizeSearchKeywords(plan?.mustKeywords || plan?.includeKeywords || plan?.requiredKeywords, 8),
    avoidKeywords: normalizeSearchKeywords(plan?.avoidKeywords || plan?.excludeKeywords || plan?.negativeKeywords, 8),
    locationHint: locationHint || input.locationHint,
    locationHints: uniqueStrings([...locationHints, ...input.locationHints], 4, 40),
    explanation: cleanText(plan?.explanation || plan?.reason, 80),
  };

  return {
    ...resolvedPlan,
    searchRequests: normalizeSearchRequests(plan?.searchRequests || plan?.queries || plan?.queryIntents, resolvedPlan),
  };
}

function normalizeSearchKeywords(value, limit = 6) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[、,，;；/|\s]+/);
  const seen = new Set();
  return list
    .map((item) => cleanKeyword(item))
    .filter((keyword) => keyword && !/^(人均.*|离我近|少排队)$/.test(keyword))
    .filter((keyword) => {
      if (seen.has(keyword)) {
        return false;
      }
      seen.add(keyword);
      return true;
    })
    .slice(0, limit);
}

function readMoneyValue(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.round(direct);
  }
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Math.round(Number(match[0])) : Number.NaN;
}

function readRatingNumber(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.max(0, Math.min(5, Number(direct.toFixed(1))));
  }
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  if (!match) {
    return Number.NaN;
  }
  const rating = Number(match[0]);
  return Number.isFinite(rating) ? Math.max(0, Math.min(5, Number(rating.toFixed(1)))) : Number.NaN;
}

function readHourNumber(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 0) {
    return Math.max(0, Math.min(29, Math.round(direct)));
  }
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  if (!match) {
    return Number.NaN;
  }
  const hour = Number(match[0]);
  return Number.isFinite(hour) ? Math.max(0, Math.min(29, Math.round(hour))) : Number.NaN;
}

function normalizeAmapTypes(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[、,，;；/|]+/);
  const seen = new Set();
  const codes = list
    .map((item) => String(item || "").trim())
    .filter((item) => /^\d{6}$/.test(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    })
    .slice(0, 8);
  return codes.length ? codes.join("|") : "050000";
}

function normalizeAmapSortRule(value) {
  const rule = String(value || "").toLowerCase();
  if (rule === "weight" || /综合|推荐|权重/.test(rule)) {
    return "weight";
  }
  return "distance";
}

function normalizeAmapShowFields(value) {
  const allowed = new Set(["children", "business", "indoor", "navi", "photos"]);
  const seen = new Set();
  const fields = String(value || "business,photos")
    .split(/[、,，;；/|]+/)
    .map((item) => item.trim())
    .filter((item) => allowed.has(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    })
    .slice(0, 5);
  return fields.length ? fields.join(",") : "business,photos";
}

function normalizeSearchRequests(value, defaults) {
  const items = Array.isArray(value) ? value : [];
  const requests = items
    .map((item, index) => {
      const keyword = cleanKeyword(item?.keyword || item?.keywords || item?.query || item?.searchKeyword || item);
      if (!keyword) {
        return null;
      }
      const radius = Number(item?.radiusMeters || item?.radius || defaults.radiusMeters);
      return {
        keyword,
        types: normalizeAmapTypes(item?.types || item?.typeCodes || defaults.types),
        radiusMeters: Number.isFinite(radius) ? Math.max(1000, Math.min(10000, Math.round(radius))) : defaults.radiusMeters,
        sortrule: normalizeAmapSortRule(item?.sortrule || item?.sortRule || defaults.sortrule),
        region: cleanText(item?.region || defaults.region, 40),
        cityLimit: Boolean(item?.cityLimit ?? item?.city_limit ?? defaults.cityLimit),
        showFields: normalizeAmapShowFields(item?.showFields || item?.show_fields || defaults.showFields),
        priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 8);

  if (requests.length) {
    return requests;
  }

  return normalizeSearchKeywords(defaults.keywords, 6).map((keyword, index) => ({
    keyword,
    types: normalizeAmapTypes(defaults.types),
    radiusMeters: defaults.radiusMeters,
    sortrule: normalizeAmapSortRule(defaults.sortrule),
    region: cleanText(defaults.region, 40),
    cityLimit: Boolean(defaults.cityLimit),
    showFields: normalizeAmapShowFields(defaults.showFields),
    priority: index + 1,
  }));
}

function normalizeInputPoi(poi) {
  if (!poi?.name) {
    return null;
  }

  return {
    id: cleanText(poi.id, 80) || cleanText(poi.name, 80),
    name: cleanText(poi.name, 80),
    address: cleanText(poi.address, 120),
    area: cleanText(poi.area, 80),
    type: cleanText(poi.type, 60),
    distance: Number(poi.distance) || 0,
    rating: cleanText(poi.rating, 12),
    cost: cleanText(poi.cost, 20),
    image: cleanUrl(poi.image),
    location: normalizeInputLocation(poi.location),
  };
}

function normalizeInputLocation(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accuracy: Number(location?.accuracy) || 0,
  };
}

function parseJsonContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("DeepSeek 返回格式不可解析");
  }
}

function normalizeAiCards(cards, input) {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards
    .map((card, index) => {
      const title = cleanText(card?.title, 60);
      const matchedPoi = findMatchedPoi(card, input.pois);
      if (!title && !matchedPoi) {
        return null;
      }

      const tags = normalizeStringList(card?.tags || card?.meta, 3, 14);
      const poiTags = matchedPoi
        ? [formatDistance(matchedPoi.distance), matchedPoi.rating ? `${matchedPoi.rating}分` : "", matchedPoi.type]
            .filter(Boolean)
            .slice(0, 3)
        : [];

      return {
        id: `ai-${input.moduleId}-${matchedPoi?.id || index}-${title || matchedPoi.name}`,
        title: title || matchedPoi.name,
        reason: cleanText(card?.reason, 90) || "这张卡最贴合当前限制，先按它推进。",
        meta: (tags.length ? tags : poiTags).slice(0, 3),
        image: cleanUrl(card?.image) || matchedPoi?.image || "",
        accent: accentForModule(input.moduleId, index),
        confidence: Number(card?.confidence) || 0,
        sourcePoiId: matchedPoi?.id || cleanText(card?.sourcePoiId, 80),
      };
    })
    .filter(Boolean)
    .slice(0, Math.max(3, Math.min(5, Number(input.outputCount) || 3)));
}

function findMatchedPoi(card, pois) {
  if (!Array.isArray(pois) || !pois.length) {
    return null;
  }

  const sourcePoiId = cleanText(card?.sourcePoiId, 80);
  if (sourcePoiId) {
    const byId = pois.find((poi) => poi.id === sourcePoiId);
    if (byId) {
      return byId;
    }
  }

  const title = cleanText(card?.title, 80);
  if (!title) {
    return null;
  }

  return pois.find((poi) => title.includes(poi.name) || poi.name.includes(title)) || null;
}

function normalizeStringList(list, limit, itemLength) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item) => cleanText(item, itemLength)).filter(Boolean).slice(0, limit);
}

function normalizeLocationHints(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[、,，;；/|]+/);
  return uniqueStrings(list.map((item) => cleanText(typeof item === "string" ? item : (item?.name || item?.label || item?.location || item?.area), 40)), 4, 40)
    .filter((item) => item && !/^(附近|周边|当前位置|当前城市|中间|中间点|折中)$/.test(item));
}

function normalizeLocationHint(value) {
  const hint = cleanText(value, 40)
    .replace(/(?:附近|周边|这边|那边)(?:吃饭|吃|找|搜|搜索|安排|看看|餐厅|饭店)?.*$/u, "")
    .replace(/^(附近|周边|当前位置|当前城市|中间|中间点|折中)$/u, "")
    .trim();
  return hint;
}

function uniqueStrings(list, limit, itemLength) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((item) => cleanText(item, itemLength))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function accentForModule(moduleId, index) {
  const accents = {
    dinner: ["#16a46a", "#dd669b", "#d87a28"],
    weekend: ["#3554dc", "#16a46a", "#7957d5"],
    gift: ["#dd669b", "#d87a28", "#3554dc"],
    general: ["#f0b734", "#16a46a", "#3554dc"],
  };
  const list = accents[moduleId] || accents.general;
  return list[index % list.length];
}

async function convertToAmap({ lat, lng, key }) {
  const url = new URL("https://restapi.amap.com/v3/assistant/coordinate/convert");
  url.searchParams.set("key", key);
  url.searchParams.set("locations", `${lng.toFixed(6)},${lat.toFixed(6)}`);
  url.searchParams.set("coordsys", "gps");
  url.searchParams.set("output", "json");

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status === "1" && data.locations) {
    const [amapLng, amapLat] = data.locations.split(";")[0].split(",").map(Number);
    if (Number.isFinite(amapLat) && Number.isFinite(amapLng)) {
      return { lat: amapLat, lng: amapLng };
    }
  }

  return { lat, lng };
}

async function fetchAroundPois({ center, key, keyword, config }) {
  const pages = config.minCost ? POI_SEARCH_PAGES : 1;
  const pageSize = config.minCost ? POI_PAGE_SIZE : 8;
  const pois = [];
  const hasEnoughDinnerCandidates = () =>
    config.minCost &&
    diverseRestaurantPois(
      pois.map(normalizeAmapPoi).filter((poi) => isTargetPoi(poi, config)),
      DINNER_PRICE_POOL_SIZE,
    ).length >= DINNER_PRICE_POOL_SIZE;

  for (let page = 1; page <= pages; page += 1) {
    const url = new URL("https://restapi.amap.com/v5/place/around");
    url.searchParams.set("key", key);
    url.searchParams.set("location", `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`);
    url.searchParams.set("radius", config.radius);
    url.searchParams.set("types", config.types);
    url.searchParams.set("keywords", keyword);
    url.searchParams.set("sortrule", "distance");
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("page_num", String(page));
    url.searchParams.set("show_fields", "business,photos");
    url.searchParams.set("output", "json");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "1") {
      throw new Error(data.info || "高德 POI 返回异常");
    }

    const pagePois = data.pois || [];
    pois.push(...pagePois);
    if (hasEnoughDinnerCandidates()) {
      break;
    }
    if (pagePois.length < pageSize) {
      break;
    }
  }

  const normalized = pois.map(normalizeAmapPoi).filter((poi) => isTargetPoi(poi, config));
  if (!config.minCost) {
    return uniquePois(normalized).slice(0, DECIDE_POI_LIMIT);
  }
  return diverseRestaurantPois(normalized, DINNER_PRICE_POOL_SIZE);
}

function normalizeAmapPoi(poi) {
  if (!poi?.name) {
    return null;
  }

  const [lng, lat] = String(poi.location || "")
    .split(",")
    .map(Number);
  const image = selectAmapPoiPhotoUrl(poi.photos);
  const typeParts = String(poi.type || "").split(";");

  return {
    id: poi.id,
    name: poi.name,
    address: Array.isArray(poi.address) ? poi.address.join("") : poi.address || "",
    area: [poi.cityname, poi.adname].filter(Boolean).join(" "),
    type: typeParts[typeParts.length - 1] || typeParts[0] || "",
    distance: Number(poi.distance) || 0,
    rating: poi.business?.rating || "",
    cost: poi.business?.cost || "",
    image,
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
  };
}

const AMAP_PHOTO_CATEGORY_SCORE = {
  food: 400,
  drink: 400,
  interior: 300,
  storefront: 200,
  unknown: 100,
};

function selectAmapPoiPhotoUrl(photos) {
  return (Array.isArray(photos) ? photos : [])
    .map((photo, index) => {
      const url = normalizeAmapPhotoUrl(photo?.url);
      if (!url) {
        return null;
      }
      const category = inferAmapPhotoCategory(photo, url);
      const sourceBonus = url.includes("aos-comment.amap.com") ? 30 : 0;
      return {
        url,
        score: (AMAP_PHOTO_CATEGORY_SCORE[category] || AMAP_PHOTO_CATEGORY_SCORE.unknown) + sourceBonus - index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0]?.url || "";
}

function normalizeAmapPhotoUrl(url) {
  return String(url || "").replace(/^http:\/\//i, "https://");
}

function inferAmapPhotoCategory(photo, url) {
  const text = normalizeAmapPhotoText([
    photo?.category,
    photo?.type,
    photo?.imageCategory,
    photo?.tag,
    photo?.title,
  ].filter(Boolean).join(" "));

  if (/(饮品|饮料|咖啡|茶|酒|果汁|奶茶|饮|drink|beverage|coffee|tea|wine|cocktail|beer)/i.test(text)) {
    return "drink";
  }
  if (/(菜品|菜|餐|饭|面|粉|粥|锅|肉|鱼|虾|蟹|小吃|甜品|蛋糕|点心|烧烤|火锅|寿司|刺身|food|dish|meal|dessert|snack|hotpot|sushi|noodle|rice|bbq|grill|cake)/i.test(text)) {
    return "food";
  }
  if (/(环境|室内|店内|装修|包厢|座位|大厅|餐桌|吧台|露台|interior|inside|indoor|dining|seat|table|bar)/i.test(text)) {
    return "interior";
  }
  if (/(门头|招牌|门面|外观|入口|店门|门店|店铺|档口|柜台|storefront|facade|entrance|signboard|shopfront|counter)/i.test(text)) {
    return "storefront";
  }

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("aos-comment.amap.com")) {
    return "food";
  }
  if (lowerUrl.includes("store.is.autonavi.com")) {
    return "storefront";
  }
  return "unknown";
}

function normalizeAmapPhotoText(value) {
  return String(value || "").toLowerCase();
}

function isTargetPoi(poi, config) {
  if (!poi) {
    return false;
  }
  if (!config?.minCost) {
    return true;
  }
  const cost = readCostValue(poi.cost);
  return Number.isFinite(cost) && cost >= config.minCost;
}

function readCostValue(value) {
  const direct = Number(value);
  if (Number.isFinite(direct)) {
    return direct;
  }
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function topPricePois(pois) {
  return diverseRestaurantPois(pois, DINNER_PRICE_POOL_SIZE);
}

function uniquePois(pois) {
  const seen = new Set();
  return (pois || []).filter((poi) => {
    const key = String(poi?.id || poi?.name || "");
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function comparePoiCostDesc(a, b) {
  const costDiff = readCostValue(b?.cost) - readCostValue(a?.cost);
  if (Number.isFinite(costDiff) && costDiff !== 0) {
    return costDiff;
  }
  return (Number(a?.distance) || Infinity) - (Number(b?.distance) || Infinity);
}

function diverseRestaurantPois(pois, limit = DINNER_PRICE_POOL_SIZE) {
  const sorted = uniquePois(pois).filter(Boolean).sort(compareRestaurantCandidate);
  const buckets = new Map();

  sorted.forEach((poi) => {
    const bucket = restaurantDiversityBucket(poi);
    if (!buckets.has(bucket)) {
      buckets.set(bucket, []);
    }
    buckets.get(bucket).push(poi);
  });

  const bucketEntries = Array.from(buckets.entries()).sort(
    (a, b) => restaurantCandidateScore(b[1][0]) - restaurantCandidateScore(a[1][0]),
  );
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
          if (!id || usedIds.has(id)) {
            return false;
          }
          const nameKey = restaurantBrandKey(poi.name);
          return pass > 0 || !nameKey || !usedNames.has(nameKey);
        });
        if (!next) {
          continue;
        }
        selected.push(next);
        usedIds.add(String(next.id || next.name));
        const nameKey = restaurantBrandKey(next.name);
        if (nameKey) {
          usedNames.add(nameKey);
        }
        took = true;
        if (selected.length >= limit) {
          break;
        }
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
  const text = `${poi?.name || ""} ${poi?.type || ""}`.toLowerCase();
  if (/火锅|川|湘|辣|麻辣|串串|烤鱼/.test(text)) return "辣味";
  if (/日料|日本|寿司|烧鸟|居酒屋|刺身|拉面/.test(text)) return "日料";
  if (/西餐|牛排|bistro|法餐|意面|披萨|brunch|早午餐/i.test(text)) return "西餐";
  if (/粤|港|茶餐|点心|本帮|江浙|中餐|私房/.test(text)) return "中餐";
  if (/韩餐|韩国|烤肉/.test(text)) return "韩餐";
  if (/泰|东南亚|越南/.test(text)) return "东南亚";
  if (/海鲜|鱼|蟹|虾/.test(text)) return "海鲜";
  if (/咖啡|甜品|蛋糕|酒吧|小酒馆/.test(text)) return "轻食酒咖";
  return String(poi?.type || "餐厅");
}

function restaurantBrandKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, "")
    .replace(/·.*$/g, "")
    .replace(/[\s.,，。'"“”‘’()（）\-_/&＋+|]/g, "")
    .slice(0, 12);
}

function compareRestaurantCandidate(a, b) {
  const scoreDiff = restaurantCandidateScore(b) - restaurantCandidateScore(a);
  if (Math.abs(scoreDiff) > 0.01) {
    return scoreDiff;
  }
  return comparePoiCostDesc(a, b);
}

function restaurantCandidateScore(poi) {
  const rating = Number(poi?.rating) || 0;
  const cost = readCostValue(poi?.cost);
  const distance = Number(poi?.distance) || 99999;
  const costScore = Number.isFinite(cost) ? Math.min(cost, 500) / 35 : 0;
  const distancePenalty = Math.min(distance, 8000) / 1200;
  return rating * 8 + costScore - distancePenalty;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function readCoord(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function cleanKeyword(value) {
  return String(value || "")
    .replace(/[?？。！!,，、]/g, "")
    .trim()
    .slice(0, 40);
}

function cleanText(value, limit) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanToken(value, limit) {
  return cleanText(value, limit).replace(/[^\w-]/g, "");
}

function cleanUrl(value) {
  const text = cleanText(value, 500);
  return /^https?:\/\//.test(text) ? text : "";
}

function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) {
    return "";
  }
  return distance >= 1000 ? `${(distance / 1000).toFixed(distance >= 3000 ? 0 : 1)}km` : `${Math.round(distance)}m`;
}
