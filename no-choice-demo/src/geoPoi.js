const defaultPoiEndpoint = "/api/poi";
const minDinnerCost = 150;

export function canUseLocation(moduleId) {
  return moduleId === "dinner" || moduleId === "weekend";
}

export function getPoiKeyword(moduleId, question) {
  const text = question || "";
  const dinnerKeywords = ["火锅", "烧烤", "烤肉", "日料", "寿司", "咖啡", "轻食", "粤菜", "川菜", "甜品", "茶"];
  const weekendKeywords = ["展览", "公园", "书店", "咖啡", "剧场", "电影", "露营", "市集", "博物馆"];
  const list = moduleId === "dinner" ? dinnerKeywords : weekendKeywords;
  const matched = list.find((keyword) => text.includes(keyword));
  if (matched) {
    return matched;
  }
  return moduleId === "dinner" ? "餐厅" : "休闲";
}

export function getCurrentPosition() {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("当前浏览器不支持定位"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy || 0),
          capturedAt: Date.now(),
        });
      },
      (error) => reject(new Error(getLocationErrorMessage(error))),
      {
        enableHighAccuracy: true,
        maximumAge: 1000 * 60 * 3,
        timeout: 12000,
      },
    );
  });
}

export async function searchNearbyPois({ coords, moduleId, keyword }) {
  if (!coords || !canUseLocation(moduleId)) {
    return { ok: false, pois: [], message: "" };
  }

  const endpoint = import.meta.env?.VITE_POI_ENDPOINT || defaultPoiEndpoint;
  const params = new URLSearchParams({
    lat: String(coords.lat),
    lng: String(coords.lng),
    module: moduleId,
    keyword: keyword || getPoiKeyword(moduleId, ""),
  });

  let data;
  try {
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return {
        ok: false,
        needsKey: true,
        pois: [],
        message: "真实 POI 接口未配置",
      };
    }

    data = await response.json();
  } catch {
    return {
      ok: false,
      needsKey: true,
      pois: [],
      message: "真实 POI 接口未配置",
    };
  }

  if (!data.ok) {
    return {
      ok: false,
      needsKey: Boolean(data.needsKey),
      pois: [],
      message: data.message || "真实 POI 暂不可用",
    };
  }

  const pois = normalizePois(data.pois, moduleId);

  return {
    ok: true,
    pois,
    message: pois.length ? `已找到 ${pois.length} 个附近参考点` : "附近暂时没有合适结果",
  };
}

export function buildLocationContext(moduleId, coords, pois) {
  if (!canUseLocation(moduleId) || !coords) {
    return "";
  }

  const poiNames = pois
    .slice(0, 4)
    .map((poi) => `${poi.name}${formatDistance(poi.distance) ? `（${formatDistance(poi.distance)}）` : ""}`)
    .join("、");

  if (poiNames) {
    return `已授权当前位置，附近参考点：${poiNames}`;
  }

  return `已授权当前位置，坐标 ${formatCoords(coords)}，精度约 ${formatAccuracy(coords.accuracy)}`;
}

export function formatCoords(coords) {
  if (!coords) {
    return "";
  }
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}

export function formatAccuracy(value) {
  const accuracy = Number(value);
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    return "未知";
  }
  return accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)}km` : `${Math.round(accuracy)}m`;
}

export function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) {
    return "";
  }
  return distance >= 1000 ? `${(distance / 1000).toFixed(distance >= 3000 ? 0 : 1)}km` : `${Math.round(distance)}m`;
}

export function getLocationStatusLabel(state) {
  if (state.status === "locating") {
    return "定位中";
  }
  if (state.status === "located") {
    return state.pois.length ? `${state.pois.length} 个点` : "已定位";
  }
  if (state.status === "error") {
    return "未授权";
  }
  return "可选";
}

function normalizePois(pois = [], moduleId) {
  return pois
    .filter((poi) => poi && poi.name && isTargetPoi(poi, moduleId))
    .map((poi) => ({
      id: String(poi.id || poi.name),
      name: String(poi.name),
      address: poi.address ? String(poi.address) : "",
      area: poi.area ? String(poi.area) : "",
      type: poi.type ? String(poi.type) : "",
      distance: Number(poi.distance) || 0,
      rating: poi.rating ? String(poi.rating) : "",
      cost: poi.cost ? String(poi.cost) : "",
      image: poi.image ? String(poi.image) : "",
      location: poi.location || null,
    }))
    .slice(0, 8);
}

function isTargetPoi(poi, moduleId) {
  if (moduleId !== "dinner") {
    return true;
  }
  const cost = readCostValue(poi.cost);
  return Number.isFinite(cost) && cost >= minDinnerCost;
}

function readCostValue(value) {
  const direct = Number(value);
  if (Number.isFinite(direct)) {
    return direct;
  }
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function getLocationErrorMessage(error) {
  if (error?.code === 1) {
    return "你拒绝了定位权限，可以在浏览器设置里重新允许。";
  }
  if (error?.code === 2) {
    return "手机暂时拿不到当前位置，换到室外或打开系统定位再试。";
  }
  if (error?.code === 3) {
    return "定位超时了，稍后再点一次。";
  }
  return "定位失败，稍后再试。";
}
