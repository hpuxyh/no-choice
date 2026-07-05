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

  const resetRoomPage = makePage({
    refreshMeetupRoomLocation() {},
    pullMeetupRoom() { return Promise.resolve(null); },
    startMeetupRoomPolling() {},
    startBgm() {},
    data: {
      meetupRoomId: "room-old",
      meetupRoomSharePath: "/pages/play/play?roomId=room-old&count=2",
      meetupSharedMode: true,
      meetupRoomReady: true,
      meetupProgressBadgeText: "2/2",
      meetupProgressButtonText: "已填齐，开始",
      partySize: 2,
      multiAreaRows: [
        { id: "self-old", role: "Alice", people: 1, location: "A", isHost: true, isSelf: true, joined: true },
        { id: "friend-old", role: "Bob", people: 1, location: "B", isHost: false, isSelf: false, joined: true }
      ],
      meetupSelfRows: [
        { id: "self-old", role: "Alice", people: 1, location: "A", isHost: true, isSelf: true, joined: true }
      ],
      meetupRosterRows: [
        { id: "friend-old", role: "Bob", people: 1, location: "B", isHost: false, isSelf: false, joined: true }
      ],
      meetupBoard: { middle: { latitude: 1, longitude: 2 } }
    }
  });
  resetRoomPage.selectAreaMode({ currentTarget: { dataset: { mode: "single" } } });
  assert.strictEqual(resetRoomPage.data.meetupRoomId, "");
  assert.strictEqual(resetRoomPage.data.meetupRoomSharePath, "");
  assert.strictEqual(resetRoomPage.data.meetupSharedMode, false);
  assert.strictEqual(resetRoomPage.data.meetupRoomReady, false);
  assert.deepStrictEqual(resetRoomPage.data.meetupSelfRows, []);
  assert.deepStrictEqual(resetRoomPage.data.meetupRosterRows, []);
  assert.strictEqual(resetRoomPage.onShareAppMessage().path, "/pages/play/play");
  resetRoomPage.goGroupGame();
  assert.notStrictEqual(resetRoomPage.data.meetupRoomId, "room-old");
  assert.match(resetRoomPage.data.meetupRoomId, /^room-/);
  assert.strictEqual(resetRoomPage.data.meetupSharedMode, true);
  assert.strictEqual(resetRoomPage.data.meetupRoomSharePath, `/pages/play/play?roomId=${resetRoomPage.data.meetupRoomId}&count=2`);

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
  assert.strictEqual(sharedRoomPage.data.meetupRosterRows.length, 0);
  assert.strictEqual(sharedRoomPage.data.meetupProgressBadgeText, "0/2");
  assert.strictEqual(sharedRoomPage.data.meetupProgressButtonText, "0/2 等朋友填完");
  const sharedRoomShare = sharedRoomPage.onShareAppMessage();
  assert.strictEqual(sharedRoomShare.path, "/pages/play/play?roomId=room-shared&count=2");

  const nicknamePage = makePage({
    data: {
      meetupSharedMode: true,
      meetupRoomId: "room-nick",
      meetupSelfId: "self-nick",
      meetupSelfName: "",
      multiAreaRows: [
        { id: "self-nick", role: "我", people: 1, location: "A", isHost: true, isSelf: true, joined: true },
        { id: "friend-nick", role: "Bob", people: 1, location: "B", isHost: false, isSelf: false, joined: true }
      ]
    }
  });
  nicknamePage.onMeetupNicknameInput({ detail: { value: "Alice" } });
  assert.strictEqual(nicknamePage.data.meetupSelfName, "Alice");
  assert.strictEqual(nicknamePage.data.multiAreaRows[0].role, "Alice");
  assert.strictEqual(nicknamePage.data.meetupSelfRows[0].role, "Alice");

  let requestCount = 0;
  const previousRequest = global.wx.request;
  global.wx.request = () => { requestCount += 1; };
  const stalePublishPage = makePage({
    data: {
      meetupRoomId: "room-new",
      meetupSharedMode: true,
      meetupSelfId: "self-stale",
      meetupSelfName: "Alice",
      multiAreaRows: [
        { id: "self-stale", role: "Alice", people: 1, location: "A", isHost: true, isSelf: true, joined: true }
      ]
    }
  });
  assert.strictEqual(await stalePublishPage.publishMeetupSelfRow(stalePublishPage.data.multiAreaRows, { silent: true, roomId: "room-old" }), false);
  assert.strictEqual(requestCount, 0, "旧房间延迟发布不应打到当前房间");
  global.wx.request = previousRequest;

  global.wx.request = ({ success }) => success({
    statusCode: 200,
    data: {
      ok: true,
      roomId: "room-other",
      participants: [
        { id: "friend-other", name: "Other", location: "Should Not Merge", lat: 1, lng: 2 }
      ]
    }
  });
  const mismatchPullPage = makePage({
    data: {
      meetupRoomId: "room-current",
      meetupSharedMode: true,
      meetupSelfId: "self-current",
      meetupSelfName: "Alice",
      multiAreaRows: [
        { id: "self-current", role: "Alice", people: 1, location: "Self Place", isHost: true, isSelf: true, joined: true }
      ]
    }
  });
  await mismatchPullPage.pullMeetupRoom({ silent: false });
  assert.strictEqual(mismatchPullPage.data.multiAreaRows.length, 1);
  assert.strictEqual(mismatchPullPage.data.multiAreaRows[0].location, "Self Place");
  assert.strictEqual(mismatchPullPage.data.meetupRoomSyncText, "房间号不一致，已忽略");
  global.wx.request = previousRequest;

  const progressPage = makePage({
    data: {
      meetupRoomId: "room-progress",
      meetupSharedMode: true,
      meetupSelfId: "self-progress",
      meetupSelfName: "Alice",
      multiAreaRows: [
        { id: "self-progress", role: "Alice", people: 1, location: "A", isHost: true, isSelf: true, joined: true },
        { id: "friend-progress", role: "Bob", people: 1, location: "B", isHost: false, isSelf: false, joined: true }
      ]
    }
  });
  progressPage.refreshMeetupRoomState(progressPage.data.multiAreaRows, { skipPublish: true });
  assert.strictEqual(progressPage.data.meetupRoomReady, true);
  assert.strictEqual(progressPage.data.meetupProgressBadgeText, "2/2");
  assert.strictEqual(progressPage.data.meetupProgressButtonText, "已填齐，开始");

  global.wx.request = ({ success }) => success({
    statusCode: 200,
    data: {
      ok: true,
      roomId: "room-overflow",
      participants: [
        { id: "friend-old", name: "Old", location: "Old Place", lat: 1, lng: 2, updatedAt: 10 },
        { id: "friend-new", name: "New", location: "New Place", lat: 3, lng: 4, updatedAt: 20 }
      ]
    }
  });
  const overflowPullPage = makePage({
    data: {
      meetupRoomId: "room-overflow",
      meetupSharedMode: true,
      meetupSelfId: "self-overflow",
      meetupSelfName: "Alice",
      partySize: 2,
      multiAreaRows: [
        { id: "self-overflow", role: "Alice", people: 1, location: "Self Place", isHost: true, isSelf: true, joined: true }
      ]
    }
  });
  await overflowPullPage.pullMeetupRoom({ silent: true });
  assert.strictEqual(overflowPullPage.data.multiAreaRows.length, 2);
  assert.deepStrictEqual(overflowPullPage.data.multiAreaRows.map((row) => row.id), ["self-overflow", "friend-new"]);
  assert.strictEqual(overflowPullPage.data.meetupProgressBadgeText, "2/2");
  global.wx.request = previousRequest;

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
  assert.strictEqual(sharedUpdatePage.data.multiAreaRows.find((row) => row.id === "friend-1").location, "Suzhoujie");
  assert.strictEqual(sharedUpdatePage.data.multiAreaRows.find((row) => row.id === "self-1").location, "Xujiahui");
  assert.strictEqual(sharedUpdatePage.data.meetupSelfRows[0].id, "self-1");
  assert.strictEqual(sharedUpdatePage.data.meetupProgressBadgeText, "2/2");
  assert.strictEqual(sharedUpdatePage.data.meetupProgressButtonText, "已填齐，开始");

  const previousChooseLocation = global.wx.chooseLocation;
  global.wx.chooseLocation = ({ success }) => success({
    name: "People Square",
    address: "Shanghai People Square",
    latitude: 31.2304,
    longitude: 121.4737
  });
  const chooseLocationPage = makePage({
    data: {
      meetupRoomId: "room-pick",
      meetupSharedMode: true,
      meetupSelfId: "self-pick",
      meetupSelfName: "Alice",
      multiAreaRows: [
        { id: "self-pick", role: "Alice", people: 1, location: "", isHost: true, isSelf: true, joined: false }
      ]
    }
  });
  chooseLocationPage.chooseMultiAreaLocation({ currentTarget: { dataset: { index: 0 } } });
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].location, "People Square");
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].latitude, 31.2304);
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].longitude, 121.4737);
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].locationSource, "picked");
  chooseLocationPage.onMultiAreaLocationInput({ currentTarget: { dataset: { index: 0 } }, detail: { value: "Manual Address" } });
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].location, "Manual Address");
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].latitude, null);
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].longitude, null);
  assert.strictEqual(chooseLocationPage.data.multiAreaRows[0].locationSource, "manual");
  global.wx.chooseLocation = previousChooseLocation;

  const manualLockPage = makePage({
    data: {
      meetupRoomId: "room-lock",
      meetupSharedMode: true,
      meetupSelfId: "self-lock",
      meetupSelfName: "Alice",
      multiAreaRows: [
        { id: "self-lock", role: "Alice", people: 1, location: "北京西站", latitude: 39.89491, longitude: 116.32206, locationSource: "picked", isHost: true, isSelf: true, joined: true }
      ]
    }
  });
  assert.strictEqual(manualLockPage.syncMeetupCurrentLocation({ label: "劲松七区", addressMeta: "劲松七区", lat: 39.88, lng: 116.46, locationSource: "gps" }), false);
  assert.strictEqual(manualLockPage.data.multiAreaRows[0].location, "北京西站");
  assert.strictEqual(manualLockPage.data.multiAreaRows[0].latitude, 39.89491);
  assert.strictEqual(manualLockPage.syncMeetupCurrentLocation({ label: "劲松七区", addressMeta: "劲松七区", lat: 39.88, lng: 116.46, locationSource: "gps" }, { force: true }), true);
  assert.strictEqual(manualLockPage.data.multiAreaRows[0].location, "劲松七区");
  assert.strictEqual(manualLockPage.data.multiAreaRows[0].locationSource, "gps");

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
