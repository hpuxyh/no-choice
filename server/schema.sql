-- 运营后台数据表(Cloudflare D1 / SQLite)
-- 只存匿名行为:设备ID + 品牌/品类/价位/时段,不含姓名手机号等个人信息。
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   TEXT    NOT NULL,           -- 匿名设备ID(客户端生成)
  ts          INTEGER NOT NULL,           -- 事件发生时间(客户端,毫秒)
  type        TEXT,                       -- pick(拍板) | navigate(去导航) | reroll | skip
  brand       TEXT,                       -- 命中的连锁品牌标准名(可空)
  name        TEXT,                       -- 门店名(截断)
  category    TEXT,                       -- 咖啡奶茶 | 美食外卖 | 正餐
  price_band  TEXT,                       -- 0-20 | 20-40 | 40-80 | 80-150 | 150+
  hour        INTEGER,                    -- 0-23,-1 未知
  city        TEXT,
  created_at  INTEGER NOT NULL            -- 入库时间(服务端,毫秒)
);

CREATE INDEX IF NOT EXISTS idx_events_ts       ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_brand    ON events(brand);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_device   ON events(device_id);

CREATE TABLE IF NOT EXISTS meetup_participants (
  room_id        TEXT    NOT NULL,
  participant_id TEXT   NOT NULL,
  name           TEXT,
  people         INTEGER DEFAULT 1,
  location       TEXT,
  lat            REAL,
  lng            REAL,
  pref           TEXT,
  travels        TEXT,
  avatar_url     TEXT,
  status         TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (room_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_meetup_room_updated ON meetup_participants(room_id, updated_at);
