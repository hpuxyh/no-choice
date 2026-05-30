# 不做选择 No Choice

不做选择是一个替选择困难场景直接拍板的决策原型：用户输入问题和偏好条件，系统生成候选卡片，让你短暂滑动比较后给出一个明确、可执行的结论。

它适合“今晚吃什么”“送什么礼物”“要不要辞职”“跟谁约会”这类越想越卡住的问题。产品目标不是替用户做严肃决策，而是把低风险、高摩擦的日常选择快速推进到行动。

## Demo

- 在线演示：https://hpuxyh.github.io/no-choice/
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
- 餐厅评分、人均、距离等数据是演示字段，尚未接入真实 POI。
- 当前重点是验证“少比较、快拍板”的交互节奏。
