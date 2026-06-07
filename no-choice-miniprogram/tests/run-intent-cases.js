const fs = require("fs");
const path = require("path");
const assert = require("assert");

const engine = require("../utils/restaurantEngine");
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "intent-cases.json"), "utf8"));

function buildChoice(testCase) {
  const question = engine.__test.cleanChoiceQuestion(testCase.input);
  const tags = testCase.tags || [];
  return {
    question,
    scenes: tags.filter((tag) => ["朋友聚餐", "约会吃饭", "一人食", "夜宵"].includes(tag)),
    needs: tags.filter((tag) => !["朋友聚餐", "约会吃饭", "一人食", "夜宵"].includes(tag)),
    tags
  };
}

for (const testCase of cases) {
  const choice = buildChoice(testCase);
  const localPlan = engine.__test.localRestaurantSearchPlan(choice);
  const plan = engine.__test.ensureRestaurantMeetupPlanForMode(localPlan, choice);
  const locationHints = engine.__test.extractedRestaurantParticipantLocationNames(choice);
  const currentPlusFriendMeetup = engine.__test.shouldUseCurrentLocationForMeetup(choice, locationHints);
  const destination = engine.__test.extractRestaurantDestinationHint(choice);
  const middle = engine.__test.restaurantPlanMiddleText(plan, choice, null, null);
  const distance = engine.__test.restaurantPlanLocationDistanceText(plan, null, null);
  const expected = testCase.expected || {};

  if (expected.questionIncludes) {
    assert(choice.question.includes(expected.questionIncludes), `${testCase.id}: question should include ${expected.questionIncludes}, got ${choice.question}`);
  }
  if (expected.locationHints) {
    assert.deepStrictEqual(locationHints, expected.locationHints, `${testCase.id}: location hints mismatch`);
    assert.deepStrictEqual(plan.locationHints, expected.locationHints, `${testCase.id}: plan location hints mismatch`);
  }
  if ("currentPlusFriendMeetup" in expected) {
    assert.strictEqual(currentPlusFriendMeetup, expected.currentPlusFriendMeetup, `${testCase.id}: current meetup mismatch`);
  }
  if ("locationHint" in expected) {
    assert.strictEqual(plan.locationHint || "", expected.locationHint, `${testCase.id}: locationHint mismatch`);
    assert.strictEqual((destination && destination.name) || "", expected.locationHint, `${testCase.id}: destination mismatch`);
  }
  if ("needsCompanionLocation" in expected) {
    assert.strictEqual(Boolean(plan.needsCompanionLocation), expected.needsCompanionLocation, `${testCase.id}: needs companion location mismatch`);
  }
  if ("radiusMeters" in expected) {
    assert.strictEqual(plan.radiusMeters, expected.radiusMeters, `${testCase.id}: radius mismatch`);
  }
  if (expected.middleIncludes) {
    assert(middle.includes(expected.middleIncludes), `${testCase.id}: middle text should include ${expected.middleIncludes}, got ${middle}`);
  }
  if (expected.distanceIncludes) {
    assert(distance.includes(expected.distanceIncludes), `${testCase.id}: distance text should include ${expected.distanceIncludes}, got ${distance}`);
  }

  console.log(JSON.stringify({
    id: testCase.id,
    question: choice.question,
    locationHints,
    currentPlusFriendMeetup,
    locationHint: plan.locationHint || "",
    needsCompanionLocation: Boolean(plan.needsCompanionLocation),
    radiusMeters: plan.radiusMeters,
    middle,
    distance
  }));
}

console.log(`intent cases ok: ${cases.length}`);
