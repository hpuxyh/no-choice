const MIN_DINNER_COST = 150;
const POI_PAGE_SIZE = 25;
const POI_SEARCH_PAGES = 3;
const DINNER_PRICE_POOL_SIZE = 12;

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

    if (url.pathname === "/api/rank-restaurants") {
      return handleRankRestaurantsRequest(request, env);
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

async function handleRankRestaurantsRequest(request, env) {
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
    input = normalizeRestaurantRankingInput(await request.json());
  } catch {
    return json({ ok: false, message: "请求内容不是有效 JSON" }, 400);
  }

  if (input.pois.length < 2) {
    return json({ ok: false, message: "候选餐厅不足" }, 400);
  }

  try {
    const model = env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    const content = await askDeepSeekRestaurantRanking({ key, model, input });
    const parsed = parseJsonContent(content);
    const rankings = normalizeRestaurantRankings(parsed.rankings || parsed.restaurants || parsed.ranking, input);

    return json({
      ok: true,
      provider: "deepseek",
      model,
      rankings,
      fallback: rankings.length ? null : "amap_order",
      message: rankings.length ? "" : "模型没有返回有效排序，前端可使用高德原始顺序",
      usage: parsed.usage || null,
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "AI 排序暂时不可用" }, 502);
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

async function askDeepSeekRestaurantRanking({ key, model, input }) {
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
            "你是不做选择 App 的餐厅匹配排序引擎。你必须只返回 JSON object，不要 Markdown。任务：根据用户输入、场景标签、需求标签、当前位置和真实高德餐厅列表，对餐厅做匹配度排序。只能使用输入列表里的餐厅，不能编造。返回字段 rankings，数组元素必须有 id、reason、tags、score。id 必须等于输入餐厅 id；reason 中文 36 字以内，说明为什么更符合；tags 2 到 3 个，每个 6 字以内；score 为 0 到 1。优先考虑标签和输入，其次考虑距离、评分、人均、类型和地址。",
        },
        {
          role: "user",
          content: JSON.stringify({
            question: input.question,
            scenes: input.scenes,
            needs: input.needs,
            tags: input.tags,
            location: input.location,
            restaurants: input.pois.map((poi) => ({
              id: poi.id,
              name: poi.name,
              address: poi.address,
              type: poi.type,
              distance: poi.distance,
              rating: poi.rating,
              cost: poi.cost,
              location: poi.location,
            })),
          }),
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      temperature: 0.25,
      max_tokens: 1600,
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
  const manualCandidates = Array.isArray(body?.manualCandidates)
    ? body.manualCandidates.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 8)
    : [];
  const pois = Array.isArray(body?.pois) ? body.pois.map(normalizeInputPoi).filter(Boolean).slice(0, 8) : [];
  const location = normalizeInputLocation(body?.location);

  return {
    moduleId,
    moduleLabel: cleanText(body?.moduleLabel, 24),
    question: cleanText(body?.question, 160),
    context: cleanText(body?.context, 600),
    selectedConditions: normalizeStringList(body?.selectedConditions, 16, 24),
    customConditions: normalizeStringList(body?.customConditions, 8, 80),
    mode: cleanToken(body?.mode, 16) || "auto",
    manualCandidates,
    location,
    pois,
    outputCount: 3,
  };
}

function normalizeRestaurantRankingInput(body) {
  const pois = Array.isArray(body?.pois) ? body.pois.map(normalizeInputPoi).filter(Boolean).slice(0, 25) : [];

  return {
    question: cleanText(body?.question, 240),
    scenes: normalizeStringList(body?.scenes, 8, 24),
    needs: normalizeStringList(body?.needs, 8, 24),
    tags: normalizeStringList(body?.tags, 16, 24),
    location: normalizeInputLocation(body?.location),
    pois,
  };
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

function normalizeRestaurantRankings(rankings, input) {
  if (!Array.isArray(rankings)) {
    return [];
  }

  const validIds = new Set(input.pois.map((poi) => poi.id));
  const used = new Set();
  return rankings
    .map((item) => {
      const id = cleanText(item?.id || item?.poiId || item?.sourcePoiId, 80);
      if (!id || !validIds.has(id) || used.has(id)) {
        return null;
      }
      used.add(id);
      return {
        id,
        reason: cleanText(item?.reason, 70) || "更贴合这次吃饭需求。",
        tags: normalizeStringList(item?.tags || item?.meta, 3, 8),
        score: clampScore(item?.score),
      };
    })
    .filter(Boolean)
    .slice(0, 25);
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(1, score));
}

function normalizeStringList(list, limit, itemLength) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item) => cleanText(item, itemLength)).filter(Boolean).slice(0, limit);
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
    if (pagePois.length < pageSize) {
      break;
    }
  }

  const normalized = pois.map(normalizeAmapPoi).filter((poi) => isTargetPoi(poi, config));
  if (!config.minCost) {
    return normalized.slice(0, 8);
  }
  return topPricePois(normalized).slice(0, DINNER_PRICE_POOL_SIZE);
}

function normalizeAmapPoi(poi) {
  if (!poi?.name) {
    return null;
  }

  const [lng, lat] = String(poi.location || "")
    .split(",")
    .map(Number);
  const image = Array.isArray(poi.photos) && poi.photos[0]?.url ? poi.photos[0].url : "";
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
  return uniquePois(pois).sort(comparePoiCostDesc);
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
