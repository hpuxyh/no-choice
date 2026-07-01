// 把人维护的「意图词库-映射表.csv」转成引擎可用的 utils/intentLexicon.js
// 用法:node scripts/sync-intent-lexicon.js
// CSV 是唯一可编辑来源;改完 CSV 跑一次本脚本重新生成 JS,再跑测试。
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "docs", "意图词库-映射表.csv");
const OUT_PATH = path.join(__dirname, "..", "utils", "intentLexicon.js");

// 解析一行 CSV(支持双引号包裹、引号内逗号),返回字段数组
function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// 单元格内用顿号/分号分隔的词 → 数组(去空白去重)
function splitWords(cell) {
  return [...new Set(String(cell || "").split(/[、，;；]/).map((w) => w.trim()).filter(Boolean))];
}

// 标记列:taste:清淡;noSpicy → { taste: "清淡", noSpicy: true }
function parseFlags(cell) {
  const flags = {};
  String(cell || "").split(/[;；]/).map((s) => s.trim()).filter(Boolean).forEach((token) => {
    const m = token.match(/^([a-zA-Z]+)\s*[:：]\s*(.+)$/);
    if (m) flags[m[1]] = m[2].trim();
    else flags[token] = true; // 裸标记:noSpicy / noSeafood
  });
  return flags;
}

function build() {
  const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length);
  lines.shift(); // 去表头
  const rules = lines.map((line) => {
    const [dim, id, intentWords, search, avoid, mark, note] = parseCsvLine(line);
    const flags = parseFlags(mark);
    const rule = {
      id: String(id || "").trim(),
      dim: String(dim || "").trim(),
      match: splitWords(intentWords),
      search: splitWords(search),
      avoid: splitWords(avoid)
    };
    ["taste", "scene", "health", "temp", "budget"].forEach((key) => {
      if (flags[key]) rule[key] = flags[key];
    });
    if (flags.noSpicy) rule.noSpicy = true;
    if (flags.noSeafood) rule.noSeafood = true;
    const noteText = String(note || "").trim();
    if (noteText) rule.note = noteText;
    return rule;
  }).filter((rule) => rule.id && rule.match.length);
  return rules;
}

function serialize(rules) {
  const body = rules.map((rule) => `  ${JSON.stringify(rule)}`).join(",\n");
  return `// 自动生成,请勿手改 —— 来源 docs/意图词库-映射表.csv\n`
    + `// 重新生成:node scripts/sync-intent-lexicon.js\n`
    + `const INTENT_RULES = [\n${body}\n];\n\nmodule.exports = { INTENT_RULES };\n`;
}

const rules = build();
fs.writeFileSync(OUT_PATH, serialize(rules), "utf8");
console.log(`intent lexicon synced: ${rules.length} rules -> ${path.relative(path.join(__dirname, ".."), OUT_PATH)}`);
