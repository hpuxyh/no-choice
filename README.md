# 不做选择

一个面向选择困难场景的初步 demo，包含：

- `no-choice-demo/`：React + Vite 网页版 demo
- `NoChoiceMobile/`：SwiftUI 原生 iOS 模拟器 demo
- `screenshots/`：当前演示截图

## Web Demo

```bash
cd no-choice-demo
npm install
npm run dev
```

## iOS Demo

```bash
xcodebuild -project NoChoiceMobile/NoChoiceMobile.xcodeproj -scheme NoChoiceMobile -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build
```

