import http from "node:http";

const key = process.env.DOUBAO_SEEDREAM_API_KEY || process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || "";
const model = process.env.DOUBAO_IMAGE_MODEL || "doubao-seedream-5-0-260128";
const port = Number(process.env.SEEDREAM_PROXY_PORT || 8788);

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS,GET",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    return json(response, 204, {});
  }

  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, { ok: true, model });
  }

  if (request.method !== "POST" || request.url !== "/api/comic-image") {
    return json(response, 404, { ok: false, message: "not found" });
  }

  if (!key) {
    return json(response, 501, { ok: false, message: "缺少 DOUBAO_SEEDREAM_API_KEY" });
  }

  let raw = "";
  request.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 20000) {
      request.destroy();
    }
  });

  request.on("end", async () => {
    try {
      const input = JSON.parse(raw || "{}");
      const image = cleanUrl(input.image);
      if (!image) {
        return json(response, 400, { ok: false, message: "缺少有效图片 URL" });
      }

      const title = cleanText(input.title, 80);
      const prompt =
        cleanText(input.prompt, 500) ||
        [
          "把输入照片改造成高质量漫画风餐厅卡面插画。",
          "保留原图主体、空间结构、透视和餐厅/食物特征，不要改成无关场景。",
          "日系生活方式漫画，干净线稿，柔和高饱和色，明亮温暖，细节丰富，适合手机抽卡卡片上半区。",
          "不要添加任何文字、logo、水印、菜单字样或价格牌。",
          title ? `参考对象：${title}。` : "",
        ]
          .filter(Boolean)
          .join(" ");

      const output = await generateComicImage({ image, prompt });
      return json(response, 200, {
        ok: true,
        provider: "doubao-seedream",
        model,
        url: output.url,
      });
    } catch (error) {
      return json(response, 502, { ok: false, message: error.message || "漫画图片生成失败" });
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Seedream local proxy listening on http://127.0.0.1:${port}`);
});

async function generateComicImage({ image, prompt }) {
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
        size: process.env.DOUBAO_IMAGE_SIZE || "2K",
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

  const url = cleanUrl(data?.data?.[0]?.url);
  if (!url) {
    throw new Error("Seedream 没有返回图片 URL");
  }

  return { url };
}

function json(response, status, body) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function cleanText(value, limit) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanUrl(value) {
  const text = cleanText(value, 800);
  return /^https?:\/\//.test(text) ? text : "";
}
