# 不做选择意图测试集

这套测试集用于回归游戏版吃饭场景里的「语音/文字输入 -> DeepSeek 意图解析 -> 高德搜索计划」链路。

## 运行

默认打线上 Pages：

```bash
npm run test:intent
```

指定本地 Vite/Pages 预览：

```bash
npm run test:intent -- --base http://127.0.0.1:5174
```

只跑某一条：

```bash
npm run test:intent -- --case asr-haibian-jinsong-two-people
```

用于发版前强校验：

```bash
npm run test:intent -- --fail-on-mismatch
```

## 测什么

- 北京语境下的语音纠错，比如「海边」应按「海淀」理解。
- 多人聚餐时的人数、地点数、出发地和当前位置参与逻辑。
- 明确目的地时，目的地优先于多人折中。
- 一人食/附近搜索时，不要误判成多人中间点。
- 用户确认/修改后的解析结果优先于原始输入。

## 注意

脚本打的是 `/api/restaurant-search-plan`，目标环境需要配置 `DEEPSEEK_API_KEY`。如果目标环境没有配置，脚本会显示接口返回的 501/502 信息，这代表环境不可测，不代表业务断言通过或失败。
