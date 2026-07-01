const assert = require("assert");
const engine = require("../utils/restaurantEngine");

const { restaurantCardImages, restaurantDetailPayloadForPoi, restaurantDishHintsForPoi } = engine.__test;

assert.strictEqual(typeof restaurantCardImages, "function");
assert.strictEqual(typeof restaurantDetailPayloadForPoi, "function");
assert.strictEqual(typeof restaurantDishHintsForPoi, "function");

const photoItems = restaurantCardImages({
  name: "测试餐厅",
  photoItems: [
    { url: "https://example.com/food-1.jpg", kind: "food", label: "招牌菜" },
    { url: "https://example.com/store.jpg", kind: "storefront", label: "门头" },
    { url: "https://example.com/inside.jpg", kind: "interior", label: "环境" },
    { url: "https://example.com/drink.jpg", kind: "drink", label: "饮品" },
    { url: "https://example.com/food-2.jpg", kind: "food", label: "菜品" },
    { url: "https://example.com/menu.jpg", kind: "menu", label: "菜单" }
  ]
}, "");

assert.deepStrictEqual(
  photoItems.slice(0, 5).map((item) => item.kind),
  ["storefront", "interior", "food", "drink", "food"],
  "卡面照片应优先门头、环境，再补菜品/饮品"
);

const poi = {
  name: "测试餐厅",
  tag: "北京菜,烤鸭",
  recommend: "招牌烤鸭;宫保鸡丁",
  menuItems: ["炸酱面", "杏仁豆腐"],
  photoItems: [
    { url: "https://example.com/dish.jpg", kind: "food", title: "干炸丸子" }
  ]
};
const dishes = restaurantDishHintsForPoi(poi);
["炸酱面", "杏仁豆腐", "招牌烤鸭"].forEach((dish) => {
  assert(dishes.includes(dish), `应提取菜品线索：${dish}`);
});

const detail = restaurantDetailPayloadForPoi(poi);
assert(detail.features.includes("炸酱面"));
assert(detail.features.includes("烤鸭"));

console.log("restaurant media ok");
