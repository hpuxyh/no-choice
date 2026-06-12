const assert = require("assert");

let pageDefinition = null;
global.Page = (definition) => {
  pageDefinition = definition;
};
global.wx = {
  setStorageSync() {},
  getStorageSync() { return null; },
  setInnerAudioOption() {},
  createInnerAudioContext() { return null; },
  getSystemInfoSync() { return { statusBarHeight: 20, windowWidth: 390 }; },
  getMenuButtonBoundingClientRect() { return { left: 320 }; }
};

require("../pages/play/play.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

(async () => {
  assert.strictEqual(pageDefinition.data.screen, "game", "落地页应直接是输入页");
  assert.strictEqual(pageDefinition.data.showInspiration, false, "灵感线索默认收起");
  assert.strictEqual(pageDefinition.data.choiceNextText, "开局，抽餐厅卡");

  const calls = [];
  const page = {
    ...pageDefinition,
    data: { ...clone(pageDefinition.data), problem: "想吃热乎的" },
    setData(update, callback) {
      this.data = { ...this.data, ...update };
      if (callback) callback.call(this);
    },
    startBgm() {},
    startAiModeGame() { calls.push("deal"); },
    showToast(text) { calls.push(`toast:${text}`); },
    updateChoiceNextAction() {}
  };

  await page.proceedChoiceToMode();
  assert.deepStrictEqual(calls, ["deal"], "有输入时应直接发牌，不出确认页");
  assert.strictEqual(page.data.showVoiceInsight, false);

  const emptyCalls = [];
  const emptyPage = {
    ...pageDefinition,
    data: { ...clone(pageDefinition.data), problem: "", partySize: 0, budgetPerPerson: 0 },
    setData(update, callback) {
      this.data = { ...this.data, ...update };
      if (callback) callback.call(this);
    },
    startBgm() {},
    startAiModeGame() { emptyCalls.push("deal"); },
    showToast(text) { emptyCalls.push("toast"); },
    updateChoiceNextAction() {}
  };
  await emptyPage.proceedChoiceToMode();
  assert.deepStrictEqual(emptyCalls, ["toast"], "空输入应提示，不发牌");

  const winPage = {
    ...pageDefinition,
    data: { ...clone(pageDefinition.data), modeName: "AI 模式" },
    setData(update) { this.data = { ...this.data, ...update }; }
  };
  winPage.showWinner({
    name: "测试餐厅",
    summaryPills: [{ text: "步行841m / 11分钟" }, { text: "人均127" }],
    meta: [],
    poi: { opentimeToday: "11:00-22:00" }
  }, false);
  const advice = winPage.data.departureAdvice;
  assert.ok(Array.isArray(advice) && advice.length >= 3, "拍板页应生成出发建议");
  assert.ok(advice[0].includes("步行约 11 分钟"), "应优先步行并写明分钟数");
  assert.ok(advice.some((line) => line.includes("11:00-22:00")), "应包含营业时间");
  assert.strictEqual(typeof pageDefinition.openIntentEditor, "function", "应有后置修正入口");
  assert.strictEqual(typeof pageDefinition.toggleInspiration, "function");

  console.log(JSON.stringify({ advice }));
  console.log("flow v3 ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
