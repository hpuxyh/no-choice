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

function assertPlanExpectations(testCase, plan, expected, label = "plan") {
  if (expected.locationHints) {
    assert.deepStrictEqual(plan.locationHints || [], expected.locationHints, `${testCase.id}: ${label} location hints mismatch`);
  }
  if ("includeCurrentLocationInMeetup" in expected) {
    assert.strictEqual(Boolean(plan.includeCurrentLocationInMeetup), expected.includeCurrentLocationInMeetup, `${testCase.id}: ${label} current location meetup mismatch`);
  }
  if ("locationHint" in expected) {
    assert.strictEqual(plan.locationHint || "", expected.locationHint, `${testCase.id}: ${label} locationHint mismatch`);
  }
  if ("radiusMeters" in expected) {
    assert.strictEqual(plan.radiusMeters, expected.radiusMeters, `${testCase.id}: ${label} radius mismatch`);
  }
  if ("typeDiversity" in expected) {
    assert.strictEqual(Boolean(plan.restaurantTypeDiversity), expected.typeDiversity, `${testCase.id}: ${label} type diversity mismatch`);
  }
  if (expected.keywords) {
    assert.deepStrictEqual(plan.keywords, expected.keywords, `${testCase.id}: ${label} keywords mismatch`);
  }
  if (expected.keywordsIncludes) {
    assert(plan.keywords.includes(expected.keywordsIncludes), `${testCase.id}: ${label} keywords should include ${expected.keywordsIncludes}, got ${plan.keywords.join(",")}`);
  }
  if (expected.keywordsExclude) {
    assert(!plan.keywords.includes(expected.keywordsExclude), `${testCase.id}: ${label} keywords should NOT include ${expected.keywordsExclude}, got ${plan.keywords.join(",")}`);
  }
  if (expected.keywordsExcludePattern) {
    const re = new RegExp(expected.keywordsExcludePattern);
    assert(!plan.keywords.some((keyword) => re.test(keyword)), `${testCase.id}: ${label} keywords should not match /${expected.keywordsExcludePattern}/, got ${plan.keywords.join(",")}`);
  }
  if (expected.avoidIncludes) {
    assert((plan.avoidKeywords || []).includes(expected.avoidIncludes), `${testCase.id}: ${label} avoidKeywords should include ${expected.avoidIncludes}, got ${(plan.avoidKeywords || []).join(",")}`);
  }
  if (expected.searchRequestKeywords) {
    assert.deepStrictEqual((plan.searchRequests || []).map((request) => request.keyword), expected.searchRequestKeywords, `${testCase.id}: ${label} search request keywords mismatch`);
  }
}

for (const testCase of cases) {
  const choice = buildChoice(testCase);
  const localPlan = engine.__test.localRestaurantSearchPlan(choice);
  const plan = engine.__test.ensureRestaurantMeetupPlanForMode(localPlan, choice);
  // 与真实管线一致:套用自然语言忌口/否定规则(无忌口文本时为空操作)
  engine.__test.applyTextDietaryRules(plan, choice);
  const remotePlan = testCase.remotePlan
    ? engine.__test.ensureRestaurantMeetupPlanForMode(engine.__test.normalizeRestaurantSearchPlan(testCase.remotePlan, choice), choice)
    : null;
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
  assertPlanExpectations(testCase, plan, expected);
  if (remotePlan && expected.remotePlan) {
    assertPlanExpectations(testCase, remotePlan, expected.remotePlan, "remote plan");
  }

  console.log(JSON.stringify({
    id: testCase.id,
    question: choice.question,
    keywords: plan.keywords,
    searchRequestKeywords: (plan.searchRequests || []).map((request) => request.keyword),
    restaurantTypeDiversity: Boolean(plan.restaurantTypeDiversity),
    remoteKeywords: remotePlan ? remotePlan.keywords : [],
    remoteSearchRequestKeywords: remotePlan ? (remotePlan.searchRequests || []).map((request) => request.keyword) : [],
    remoteRestaurantTypeDiversity: remotePlan ? Boolean(remotePlan.restaurantTypeDiversity) : false,
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
