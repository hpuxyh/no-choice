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

  const sharedRoomPage = makePage({
    refreshMeetupRoomLocation() {},
    pullMeetupRoom() { return Promise.resolve(null); },
    startMeetupRoomPolling() {}
  });
  sharedRoomPage.enterMeetupRoom("room-shared");
  assert.strictEqual(sharedRoomPage.data.meetupSharedMode, true);
  assert.strictEqual(sharedRoomPage.data.meetupRoomId, "room-shared");
  assert.strictEqual(sharedRoomPage.data.multiAreaRows.length, 1);
  assert.strictEqual(sharedRoomPage.data.meetupSelfRows.length, 1);
  assert.strictEqual(sharedRoomPage.data.meetupRosterRows.length, 1);
  const sharedRoomShare = sharedRoomPage.onShareAppMessage();
  assert.strictEqual(sharedRoomShare.path, "/pages/play/play?roomId=room-shared");

  const sharedUpdatePage = makePage({
    data: {
      meetupRoomId: "room-shared",
      meetupSharedMode: true,
      meetupSelfId: "self-1",
      meetupSelfName: "Alice",
      multiAreaRows: [
        { id: "friend-1", role: "Bob", people: 1, location: "Suzhoujie", isHost: false, isSelf: false, joined: true },
        { id: "self-1", role: "Alice", people: 1, location: "", isHost: true, isSelf: true, joined: false }
      ]
    }
  });
  assert.strictEqual(sharedUpdatePage.syncMeetupCurrentLocation({ label: "Xujiahui", addressMeta: "Xujiahui", lat: 31.19, lng: 121.43, locationSource: "gps" }), true);
  assert.strictEqual(sharedUpdatePage.data.multiAreaRows[0].location, "Suzhoujie");
  assert.strictEqual(sharedUpdatePage.data.multiAreaRows[1].id, "self-1");
  assert.strictEqual(sharedUpdatePage.data.multiAreaRows[1].location, "Xujiahui");
  assert.strictEqual(sharedUpdatePage.data.meetupSelfRows[0].id, "self-1");

  // 单设备多人组局:更新我的位置 → 始终写进 host 行(已无主客/分享区别)
  const hostUpdatePage = makePage({
    data: {
      meetupRoomId: "room-test",
      multiAreaRows: [
        { id: "host", role: "我的位置", people: 1, location: "", isHost: true, joined: false },
        { id: "friend-a", role: "朋友A", people: 1, location: "苏州街", isHost: false, joined: true },
        { id: "friend-b", role: "朋友B", people: 1, location: "", isHost: false, joined: false }
      ]
    }
  });
  assert.strictEqual(hostUpdatePage.syncMeetupCurrentLocation({ label: "徐家汇", addressMeta: "徐家汇", lat: 31.19, lng: 121.43, locationSource: "gps" }), true);
  assert.strictEqual(hostUpdatePage.data.multiAreaRows.length, 3);
  assert.strictEqual(hostUpdatePage.data.multiAreaRows[0].location, "徐家汇");
  assert.strictEqual(hostUpdatePage.data.multiAreaRows[0].role, "我的位置");
  assert.strictEqual(hostUpdatePage.data.multiAreaRows[1].location, "苏州街");

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
