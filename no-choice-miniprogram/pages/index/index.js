Page({
  onLoad() {
    wx.redirectTo({
      url: "/pages/play/play",
      fail: () => {
        wx.reLaunch({ url: "/pages/play/play" });
      }
    });
  }
});
