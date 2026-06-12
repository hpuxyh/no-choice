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

function makePage(overrides = {}) {
  const page = {
    ...pageDefinition,
    ...overrides,
    data: { ...clone(pageDefinition.data), ...(overrides.data || {}) },
    setData(update, callback) {
      this.data = { ...this.data, ...update };
      if (callback) callback.call(this);
    }
  };
  return page;
}

function defer() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

(async () => {
  const genericSharePage = makePage();
  const genericShare = genericSharePage.onShareAppMessage();
  assert.strictEqual(genericShare.path, "/pages/play/play");
  assert.strictEqual(genericSharePage.data.meetupRoomId, "");

  const staleRoomSharePage = makePage({
    data: {
      meetupRoomId: "room-old",
      areaMode: "single",
      areaStep: "input"
    }
  });
  assert.strictEqual(staleRoomSharePage.onShareAppMessage().path, "/pages/play/play");

  const existingSelfPage = makePage({
    data: {
      meetupOpenedFromShare: true,
      meetupRoomId: "room-test",
      multiAreaRows: [
        { id: "host", role: "我的位置", people: 1, location: "北京大学", isHost: true, joined: true },
        { id: "friend-self-1", role: "我", people: 1, location: "苏州街", isHost: false, joined: true },
        { id: "friend-b", role: "朋友B", people: 1, location: "", isHost: false, joined: false }
      ]
    }
  });
  assert.strictEqual(existingSelfPage.syncMeetupCurrentLocation({ label: "徐家汇", addressMeta: "徐家汇", lat: 31.19, lng: 121.43, locationSource: "gps" }), true);
  assert.strictEqual(existingSelfPage.data.multiAreaRows.length, 3);
  assert.strictEqual(existingSelfPage.data.multiAreaRows.filter((row) => row.role === "我").length, 1);
  assert.strictEqual(existingSelfPage.data.multiAreaRows[1].location, "徐家汇");

  const fullSharedPage = makePage({
    data: {
      meetupOpenedFromShare: true,
      meetupRoomId: "room-full",
      multiAreaRows: [
        { id: "host", role: "我的位置", people: 1, location: "北京大学", isHost: true, joined: true },
        { id: "friend-a", role: "朋友A", people: 1, location: "苏州街", isHost: false, joined: true },
        { id: "friend-b", role: "朋友B", people: 1, location: "国贸", isHost: false, joined: true },
        { id: "friend-c", role: "朋友C", people: 1, location: "劲松", isHost: false, joined: true },
        { id: "friend-d", role: "朋友D", people: 1, location: "五道口", isHost: false, joined: true },
        { id: "friend-e", role: "朋友E", people: 1, location: "望京", isHost: false, joined: true }
      ]
    }
  });
  assert.strictEqual(fullSharedPage.syncMeetupCurrentLocation({ label: "徐家汇", addressMeta: "徐家汇", lat: 31.19, lng: 121.43, locationSource: "gps" }), false);
  assert.strictEqual(fullSharedPage.data.multiAreaRows[0].location, "北京大学");
  assert.strictEqual(fullSharedPage.data.multiAreaRows.length, 6);

  const coarsePage = makePage({
    data: {
      meetupRoomId: "room-city",
      multiAreaRows: [
        { id: "host", role: "我的位置", people: 1, location: "", isHost: true, joined: false },
        { id: "friend-a", role: "朋友A", people: 1, location: "", isHost: false, joined: false }
      ]
    }
  });
  assert.strictEqual(coarsePage.syncMeetupCurrentLocation({ label: "上海市", addressMeta: "上海市", lat: 31.23, lng: 121.47, locationSource: "city" }), false);
  assert.strictEqual(coarsePage.data.multiAreaRows[0].location, "");

  const resetPage = makePage({
    data: {
      screen: "deck",
      showVoiceInsight: true,
      voiceInsightDetails: [{ label: "意图", value: "旧" }],
      confirmedChoiceIntent: { fields: { scene: "旧" } },
      showWin: true,
      winner: { name: "旧餐厅" }
    }
  });
  resetPage.resetAll();
  assert.strictEqual(resetPage.data.screen, "game");
  assert.strictEqual(resetPage.data.showVoiceInsight, false);
  assert.deepStrictEqual(resetPage.data.voiceIntentDetails, []);
  assert.strictEqual(resetPage.data.confirmedChoiceIntent, null);

  const oldRun = defer();
  const newRun = defer();
  const resetDeckCalls = [];
  const searchPage = makePage({
    startBgm() {},
    setLoading() {},
    loadCards(modeName, options) {
      return options.searchRunId === 1 ? oldRun.promise : newRun.promise;
    },
    prepareVisualCards(cards) {
      return Promise.resolve(cards);
    },
    resetDeck(cards) {
      resetDeckCalls.push(cards[0]);
    },
    rememberReplayDeck() {}
  });
  const first = searchPage.startGame("AI 模式", "AI INTEL");
  const second = searchPage.startGame("AI 模式", "AI INTEL");
  newRun.resolve(["new"]);
  await second;
  oldRun.resolve(["old"]);
  await first;
  assert.deepStrictEqual(resetDeckCalls, ["new"]);

  console.log(JSON.stringify({ resetDeckCalls }));
  console.log("page state ok");
})();
