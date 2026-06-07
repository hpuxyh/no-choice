const assert = require("assert");

const engine = require("../utils/restaurantEngine");

const pois = Array.from({ length: 10 }, (_, index) => ({
  id: `poi-${index + 1}`,
  name: `候选餐厅${index + 1}`,
  address: `测试路${index + 1}号`,
  type: "餐厅",
  distance: 500 + index * 100,
  rating: "4.8",
  cost: "120",
  image: ""
}));

const firstDeck = engine.__test.restaurantCardsForModeAvoiding(pois, "AI 模式", {}, []);
assert.strictEqual(firstDeck.length, 5);

const avoidKeys = firstDeck.map(engine.__test.restaurantCardReplayKey);
const secondDeck = engine.__test.restaurantCardsForModeAvoiding(pois, "AI 模式", {}, avoidKeys);
const secondKeys = secondDeck.map(engine.__test.restaurantCardReplayKey);

assert.strictEqual(secondDeck.length, 5);
assert.strictEqual(secondKeys.filter((key) => avoidKeys.includes(key)).length, 0);

console.log(JSON.stringify({
  first: firstDeck.map((card) => card.name),
  second: secondDeck.map((card) => card.name)
}));
console.log("replay dedupe ok");
