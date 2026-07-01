// GET /admin —— 运营后台网页(纯静态 HTML,前端用 token 调 /api/admin/summary)。
// token 不写死在页面里:打开后手填,存 sessionStorage,随请求带上。

const PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>不做选择 · 运营后台</title>
<style>
  body { font-family: -apple-system, "PingFang SC", system-ui, sans-serif; margin: 0; background: #f3ecdd; color: #1a1714; }
  header { padding: 18px 24px; background: #1a1714; color: #f6c518; font-weight: 800; }
  main { max-width: 880px; margin: 0 auto; padding: 20px 16px 60px; }
  .bar { display: flex; gap: 10px; align-items: center; margin: 14px 0; flex-wrap: wrap; }
  input, select, button { font-size: 14px; padding: 8px 12px; border: 2px solid #1a1714; border-radius: 10px; background: #fff; }
  button { background: #f6c518; font-weight: 800; cursor: pointer; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
  .stat { flex: 1 1 140px; background: #fff; border: 2px solid #1a1714; border-radius: 14px; padding: 14px; }
  .stat .n { font-size: 30px; font-weight: 900; }
  .stat .l { font-size: 13px; opacity: .7; }
  section { background: #fff; border: 2px solid #1a1714; border-radius: 14px; padding: 14px 16px; margin: 14px 0; }
  h2 { font-size: 16px; margin: 0 0 10px; }
  .row { display: grid; grid-template-columns: 160px 1fr 56px; align-items: center; gap: 8px; margin: 6px 0; font-size: 14px; }
  .track { background: #e7ddc8; border-radius: 8px; height: 16px; overflow: hidden; }
  .fill { height: 100%; background: #6c5ce7; }
  .muted { opacity: .6; }
  .err { color: #c0392b; font-weight: 700; }
</style>
</head>
<body>
<header>不做选择 · 运营后台 — 全体用户消费行为</header>
<main>
  <div class="bar">
    <input id="token" type="password" placeholder="管理 token" style="flex:1 1 240px" />
    <select id="since">
      <option value="0">全部时间</option>
      <option value="7">近 7 天</option>
      <option value="30" selected>近 30 天</option>
      <option value="90">近 90 天</option>
    </select>
    <button id="load">加载</button>
    <span id="msg" class="muted"></span>
  </div>
  <div class="cards" id="stats"></div>
  <div id="content"></div>
</main>
<script>
  var $ = function (id) { return document.getElementById(id); };
  var tokenEl = $("token");
  tokenEl.value = sessionStorage.getItem("admin_token") || "";

  function bars(title, rows, labelKey, valueKey) {
    if (!rows || !rows.length) return "<section><h2>" + title + "</h2><div class='muted'>暂无数据</div></section>";
    var max = rows.reduce(function (m, r) { return Math.max(m, Number(r[valueKey]) || 0); }, 0) || 1;
    var html = "<section><h2>" + title + "</h2>";
    rows.forEach(function (r) {
      var label = (r[labelKey] === "" || r[labelKey] == null) ? "(空)" : r[labelKey];
      var val = Number(r[valueKey]) || 0;
      var pct = Math.round((val / max) * 100);
      html += "<div class='row'><div>" + label + "</div><div class='track'><div class='fill' style='width:" + pct + "%'></div></div><div>" + val + "</div></div>";
    });
    return html + "</section>";
  }

  function render(d) {
    var t = d.totals || {};
    $("stats").innerHTML =
      "<div class='stat'><div class='n'>" + (t.users || 0) + "</div><div class='l'>设备数(用户)</div></div>" +
      "<div class='stat'><div class='n'>" + (t.events || 0) + "</div><div class='l'>行为事件</div></div>";
    var hourRows = (d.hours || []).map(function (h) { return { hour: h.hour + " 点", c: h.c }; });
    $("content").innerHTML =
      bars("最常被选品牌 Top20", d.brands, "brand", "c") +
      bars("品类分布", d.categories, "category", "c") +
      bars("价位分布", d.priceBands, "band", "c") +
      bars("时段分布", hourRows, "hour", "c") +
      bars("动作类型", d.types, "type", "c");
  }

  function load() {
    var token = tokenEl.value.trim();
    if (!token) { $("msg").innerHTML = "<span class='err'>请先填 token</span>"; return; }
    sessionStorage.setItem("admin_token", token);
    $("msg").textContent = "加载中…";
    var since = $("since").value;
    fetch("/api/admin/summary?sinceDays=" + since, { headers: { "x-admin-token": token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { $("msg").innerHTML = "<span class='err'>" + (d.message || "失败") + "</span>"; return; }
        $("msg").textContent = "";
        render(d);
      })
      .catch(function (e) { $("msg").innerHTML = "<span class='err'>" + e + "</span>"; });
  }
  $("load").addEventListener("click", load);
  if (tokenEl.value) load();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(PAGE, {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}
