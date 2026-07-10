# 运营后台(行为养成数据)部署说明

这套是「零上传行为养成」的**运营侧**:小程序把匿名行为上报到 `/api/track`,
你在 `/admin` 网页看全体用户的品牌/品类/价位/时段聚合。

> ⚠️ 这些文件**不属于小程序包**,要部署到你的 Cloudflare Pages 项目(即 `no-choice.pages.dev` 那个,
> 现在做 DeepSeek/高德代理的同一个项目)。`server/` 已在 `project.config.json` 里被排除出小程序打包。

## 组成
- `functions/api/track.js` —— `POST /api/track`,接收上报写入 D1
- `functions/api/meetup-room.js` —— `GET/POST /api/meetup-room`,按 `roomId + participantId` 收集组局成员自己的位置/偏好
- `functions/api/shared-card.js` —— `GET/POST /api/shared-card`,按随机分享 ID 保存并读取最终选中的餐厅卡片(7 天自动过期)
- `functions/api/admin/summary.js` —— `GET /api/admin/summary`,鉴权后返回聚合
- `functions/admin.js` —— `GET /admin`,运营后台网页
- `schema.sql` —— D1 建表

## 部署步骤(用 Cloudflare Wrangler)
1. 把 `server/functions/` 下的文件合并进你 Pages 项目的 `functions/` 目录(保持同样的子路径)。
2. 建 D1 数据库并绑定:
   ```bash
   wrangler d1 create no-choice-analytics
   ```
   把输出的 database_id 写进 Pages 项目的 `wrangler.toml`(或在 Pages 控制台 → Settings → Functions → D1 database bindings 里),**绑定变量名必须是 `DB`**:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "no-choice-analytics"
   database_id = "xxxxxxxx-...."
   ```
3. 建表(本地 + 线上各执行一次):
   ```bash
   wrangler d1 execute no-choice-analytics --file=server/schema.sql            # 本地
   wrangler d1 execute no-choice-analytics --file=server/schema.sql --remote   # 线上
   ```
4. 设管理 token(后台鉴权用):
   - Pages 控制台 → Settings → Environment variables → 新增 `ADMIN_TOKEN`(随便一串强密码)。
5. 部署 Pages(push 或 `wrangler pages deploy`)。
6. 打开 `https://no-choice.pages.dev/admin`,填 `ADMIN_TOKEN` → 看数据。

## 小程序侧需要做的
- 客户端已经在往 `https://no-choice.pages.dev/api/track` 上报(见 `utils/consumerProfile.js`)。
- 组局房间会请求 `https://no-choice.pages.dev/api/meetup-room`；上线前同样要把该域名加入小程序后台 request 合法域名。
- 正式发布前,把该域名加入小程序后台的 **request 合法域名**(开发时可在开发者工具勾"不校验合法域名")。

## 隐私合规(务必)
- 只上报匿名设备ID + 行为字段(品牌/品类/价位/时段),**不含**姓名、手机号、精确定位。
- 组局房间接口会保存用户主动填写/授权的昵称、出发地、口味和坐标,用于同一个 `roomId` 内聚合中间点；旧记录会按 72 小时清理。
- 分享卡片接口只保存选中餐厅的展示快照；分享 ID 不可覆盖，7 天后自动清理。客户端不会把成员原始坐标或参与者 ID 写进分享快照。
- 上线前在小程序「隐私协议」里声明:为优化推荐会收集匿名使用行为。
- `consumerProfile.setTrackingEnabled(false)` 可让用户关闭上报(后台页可接一个开关)。

## 本地联调(可选)
```bash
wrangler pages dev <你的Pages构建目录> --d1 DB=no-choice-analytics
# 然后 POST 一条测试:
curl -X POST http://localhost:8788/api/track -H 'content-type: application/json' \
  -d '{"deviceId":"d_test","events":[{"ts":1,"type":"pick","brand":"瑞幸咖啡","category":"咖啡奶茶","priceBand":"20-40","hour":9}]}'
curl 'http://localhost:8788/api/admin/summary?token=本地token' -H 'x-admin-token: 本地token'
```
