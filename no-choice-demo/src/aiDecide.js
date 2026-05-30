import { getModuleProfile } from "./decisionEngine";
import { formatDistance } from "./geoPoi";

const defaultDecideEndpoint = "/api/decide";

const fallbackImages = {
  dinner: [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  ],
  weekend: [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80",
  ],
  gift: [
    "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=80",
  ],
  general: [
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  ],
};

export async function requestAiDecision(payload) {
  const endpoint = import.meta.env?.VITE_DECIDE_ENDPOINT || defaultDecideEndpoint;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "AI 推荐暂时不可用");
  }

  return {
    ...data,
    cards: normalizeAiCards(data.cards, payload),
  };
}

function normalizeAiCards(cards, payload) {
  const moduleId = payload.moduleId || "general";
  const profile = getModuleProfile(moduleId);
  const images = fallbackImages[moduleId] || fallbackImages.general;

  return (cards || [])
    .map((card, index) => {
      const matchedPoi = findMatchedPoi(card, payload.pois);
      const poiMeta = matchedPoi
        ? [formatDistance(matchedPoi.distance), matchedPoi.rating ? `${matchedPoi.rating}分` : "", matchedPoi.type]
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const meta = normalizeList(card.meta || card.tags);

      return {
        id: String(card.id || `ai-${moduleId}-${index}-${card.title}`),
        title: String(card.title || matchedPoi?.name || "先按这张走"),
        reason: String(card.reason || "这张卡最贴合当前输入，先把选择推进到行动。"),
        meta: (meta.length ? meta : poiMeta).slice(0, 3),
        image: card.image || matchedPoi?.image || images[index % images.length],
        accent: card.accent || profile.accent,
        moduleId,
        question: payload.question,
        source: "deepseek",
        sourcePoiId: card.sourcePoiId || matchedPoi?.id || "",
      };
    })
    .filter((card) => card.title)
    .slice(0, 3);
}

function findMatchedPoi(card, pois = []) {
  if (!Array.isArray(pois) || !pois.length) {
    return null;
  }

  const sourcePoiId = String(card?.sourcePoiId || "");
  if (sourcePoiId) {
    const byId = pois.find((poi) => String(poi.id) === sourcePoiId);
    if (byId) {
      return byId;
    }
  }

  const title = String(card?.title || "");
  return pois.find((poi) => title.includes(poi.name) || String(poi.name).includes(title)) || null;
}

function normalizeList(value) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
}
