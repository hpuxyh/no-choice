const assert = require("assert");

global.wx = {
  request({ url, success, fail }) {
    if (url.includes("/api/poi")) {
      success({
        statusCode: 200,
        data: {
          ok: true,
          pois: [
            {
              name: "示例餐厅",
              area: "北京市 朝阳区",
              address: "北京市朝阳区劲松街道方丹小街劲松西社区1号楼"
            }
          ]
        }
      });
      return;
    }
    fail({ errMsg: "mock 高德直连失败" });
  }
};

const { reverseGeocodeLocation } = require("../utils/restaurantEngine");

reverseGeocodeLocation({ lat: 39.884, lng: 116.461, label: "北京" })
  .then((detail) => {
    assert.strictEqual(detail.title, "北京市朝阳区劲松街道方丹小街劲松西社区附近");
    console.log(JSON.stringify(detail));
    console.log("location fallback ok");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
