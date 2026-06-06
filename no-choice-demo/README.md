# 不做选择 Web：游戏版

这个仓库是 `no-choice` 主项目，线上只保留游戏版：

| 版本 | 文件入口 | 线上地址 | 说明 |
| --- | --- | --- | --- |
| 游戏版 | `public/play.html` | https://no-choice.pages.dev/play.html | 像素/抽卡/模式卡片风格，对应“霸总模式 / AI 模式 / 玄学模式”。用户说“游戏版”时，默认改这里。 |

不要把这个仓库和 `no-choice-lite` 混淆；`no-choice-lite` 是独立的“简洁版”项目。

## 功能

- 场景模块：吃饭、周末、礼物、通用四套文案、条件和候选池。
- 条件标签：按模块记录位置、预算、天气、关系分寸、风险等偏好。
- 手机定位：吃饭和周末模块可点击获取当前位置；Cloudflare Pages 版的吃饭模块会读取附近真实餐厅 POI。
- AI 推荐与手动候选：把问题、条件、候选、位置和 POI 发给 DeepSeek 生成 3 张候选卡；也可以自己添加候选。
- 抽卡决策：每局先收口成 3 张答案卡，自动轮播几轮后停在一张，点 GO 重新抽取。
- 结果分享：支持复制或系统分享最终结论。

## Demo 网站

- 游戏版：https://no-choice.pages.dev/play.html
- 主域名：https://no-choice.pages.dev/ 会跳转到游戏版
- 简洁版独立项目：https://no-choice-lite.pages.dev/play.html
- GitHub Pages 镜像：https://hpuxyh.github.io/no-choice/
- 本地预览：http://127.0.0.1:5173/
- 扫码体验图：`public/no-choice-play-qr.png`
- 扫码展示页：`public/qr.html`

## 运行

```bash
npm install
npm run dev
```

当前本地预览地址：

```text
http://127.0.0.1:5173/
```

## 发布扫码版

二维码指向 Cloudflare Pages 的手机体验页：

```text
https://no-choice.pages.dev/play.html
```

这就是“游戏版”，不是“简洁版”。

发布最新版本前先登录 Wrangler，然后部署 `dist` 到 Cloudflare Pages：

```bash
npx wrangler login
npm run deploy:pages
```

## POI 配置

Cloudflare Pages 版会把 `/api/poi` 交给 `public/_worker.js` 处理。真实 POI 需要在 Cloudflare Pages 环境变量里设置：

```text
AMAP_WEB_SERVICE_KEY=你的高德 Web 服务 API Key
```

前端可选配置：

```text
VITE_POI_ENDPOINT=/api/poi
VITE_DECIDE_ENDPOINT=/api/decide
```

DeepSeek 推荐走同一个 Worker 的 `/api/decide`，需要在 Cloudflare Pages Secret 设置：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

不要把真实地图 Key 或 DeepSeek Key 写进前端 `.env`，否则会被打包进浏览器代码。

## Demo 边界

- DeepSeek 接口不可用时会自动回退到本地规则和候选池。
- 推荐理由优先来自 DeepSeek；接口不可用时使用本地模板库。
- 未配置地图 Key 时，餐厅和地点候选仍是策略/类别示例；配置后吃饭模块会优先使用附近 POI、距离、评分、地址和店铺图。
- 礼物候选已由 AI 生成，但未接商品搜索、库存、配送和价格。
- 图片默认使用固定远程素材；真实餐厅优先使用高德 POI 返回的店铺图，礼物后续应优先使用商品数据源返回的图片。
