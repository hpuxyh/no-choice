# 不做选择微信小程序

这是根据线上 `https://hpuxyh.github.io/no-choice/play.html` 重写的原生微信小程序版本，不使用 `web-view`。

## 已实现

- 贴近线上版的街机风首页、玩家配置、模式选择和抽卡页。
- 头像选择、姓名、性别、星座、MBTI、备注。
- 背景音乐开关、纠结输入、快捷标签、AI 理解确认、餐厅详情。
- 语音输入入口：需在小程序后台开通微信同声传译插件后启用。
- 霸总模式、AI 模式、玄学模式。
- 微信定位 `wx.getLocation`。
- 首版发布默认不请求外部 AI 后端，使用本地标签规则生成高德搜索条件。
- 高德附近餐厅搜索 `wx.request`，包含多关键词、多页召回、商户信息和照片字段。
- 位置链路：优先 `wx.getLocation` 获取 GCJ-02 当前位置；失败后用高德 IP 城市定位兜底；支持目的地搜索和多人位置折中。
- 抽卡淘汰、待定回炉、拍板结果。
- 卡片内和结果页 `wx.openLocation` 导航。

## 暂未接入

- AI 模式当前使用“高德 POI + 标签规则”的本地推荐。
- 漫画卡面生成需要接微信云开发云函数或自有后端。

## 导入方式

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择本文件夹：`no-choice-miniprogram`。
4. AppID 先用测试号或替换 `project.config.json` 中的 `appid`。
5. 编译运行。

## 正式发布前需要配置

在微信公众平台后台配置 request 合法域名：

```text
https://restapi.amap.com
https://no-choice.pages.dev
```

`https://no-choice.pages.dev` 用于 DeepSeek 意图解析，以及当前位置地址解析失败时的附近 POI 地址兜底。

如果要显示高德 POI 图片，还需要把高德图片域名加入 downloadFile 合法域名，至少包括：

```text
https://aos-comment.amap.com
https://store.is.autonavi.com
```

如果后续接自己的 AI 后端或国内 Worker 镜像，还需要把后端域名加入 request 合法域名，并打开 `utils/restaurantEngine.js` 里的 `ENABLE_REMOTE_AI_PLAN`。

小程序后台还需要完成：

- 小程序备案。
- 服务类目选择。
- 隐私协议配置。
- 位置权限说明。
- 添加“微信同声传译”插件，并确认 `app.json` 里的 `WechatSI` 插件配置可用。
- 审核素材、图标、简介。

## 密钥建议

当前小程序沿用了 H5 版公开高德 Web Service Key。正式发布前建议：

- 在高德控制台限制 Key 的使用范围。
- 或改成微信云函数代请求高德。
- DeepSeek、火山、OpenAI 等密钥不要放在小程序前端。
