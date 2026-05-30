# 不做选择 No Choice

一个替选择困难场景直接拍板的产品原型。当前包含：

- `no-choice-demo/`：React + Vite 网页版原型
- `NoChoiceMobile/`：SwiftUI 原生 iOS 原型
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
