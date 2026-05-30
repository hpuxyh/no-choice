# 不做选择 No Choice

不做选择是一个替选择困难场景直接拍板的决策原型：用户输入问题和偏好条件，系统生成候选卡片，让你短暂滑动比较后给出一个明确、可执行的结论。

它适合“今晚吃什么”“送什么礼物”“要不要辞职”“跟谁约会”这类越想越卡住的问题。产品目标不是替用户做严肃决策，而是把低风险、高摩擦的日常选择快速推进到行动。

## Demo

- 手机优先演示：https://no-choice.pages.dev/
- GitHub Pages 镜像：https://hpuxyh.github.io/no-choice/
- 本地 demo 网站：http://127.0.0.1:5173/

## 核心体验

- 快速建局：预设常见选择困难场景，也支持自己输入问题。
- 条件收集：用标签和补充输入记录偏好、约束和临时想法。
- 自动推荐：根据问题类型和条件生成候选卡片。
- 滑卡拍板：用户可以滑动比较，但滑到底会兜底给出最终选择。
- 直接结论：是否题会直接给出“做/不做”判断和理由。
- 解释口吻：支持不同风格的推荐理由，降低“被算法命令”的生硬感。

## Screenshots

### Web Prototype

![不做选择 Web 原型](screenshots/no-choice-web-home.png)

### iOS Prototype

<p>
  <img src="screenshots/no-choice-mobile-home.png" width="260" alt="不做选择 iOS 首页" />
  <img src="screenshots/no-choice-mobile-fixed-start.png" width="260" alt="不做选择 iOS 开局" />
</p>

## Project Structure

- `no-choice-demo/`：React + Vite 网页版原型
- `NoChoiceMobile/`：SwiftUI 原生 iOS 原型
- `screenshots/`：演示截图
- `.github/workflows/deploy-demo.yml`：GitHub Pages 自动部署流程

## Web Demo

```bash
cd no-choice-demo
npm install
npm run dev
```

构建：

```bash
cd no-choice-demo
npm run build
```

## iOS Demo

```bash
xcodebuild -project NoChoiceMobile/NoChoiceMobile.xcodeproj -scheme NoChoiceMobile -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build
```

## Current Scope

- 大模型推荐暂时用本地规则和候选池模拟。
- 餐厅和地点候选仍是策略/类别示例，尚未接入真实 POI、营业时间和距离。
- 当前重点是验证“少比较、快拍板”的交互节奏。

## API Plan

当前版本可以先不接外部接口，先验证交互是否成立。要做成真正可用的产品，接口优先级建议如下：

1. 位置和 POI：优先级最高。吃饭、约会、周末去哪这类问题需要当前位置、中点、营业时间、距离、评分和价格。前端只在用户点击“使用当前位置”后请求浏览器定位，再由后端调用地图/POI 服务。
2. 大模型：第二优先级。它适合生成候选、解释推荐理由、把用户的自然语言条件转成结构化筛选项。API key 不应该放在前端，需要后端或 Serverless 代理。
3. 图片：低优先级。图片能提升卡片质感，但不应该决定推荐逻辑。真实地点优先用 POI 返回的店铺图；没有真实地点时，用固定素材或图片 API 做氛围图即可。
4. 用户输入兜底：必须保留。位置权限可能被拒绝，POI 也可能无结果，所以始终允许用户手动输入城市、商圈、候选项和限制。
