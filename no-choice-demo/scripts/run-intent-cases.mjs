#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultCasesPath = path.join(repoRoot, "tests", "intent-cases.json");

const usage = `
Usage:
  npm run test:intent
  npm run test:intent -- --base https://no-choice.pages.dev
  npm run test:intent -- --base http://127.0.0.1:5174 --case asr-haibian-jinsong-two-people

Options:
  --base <url>            Target site base URL. Defaults to suite.defaultBaseUrl.
  --cases <path>          Test case JSON path. Defaults to tests/intent-cases.json.
  --case <id[,id]>        Run one or more case ids. Can be repeated.
  --list                  List cases without sending requests.
  --json                  Print machine-readable JSON.
  --fail-on-mismatch      Exit with code 1 when any assertion fails.
  --timeout-ms <number>   Request timeout. Defaults to 90000.
  --help                  Show this help.
`.trim();

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(usage);
  process.exit(0);
}

const suite = await readJson(options.casesPath);
const cases = Array.isArray(suite.cases) ? suite.cases : [];

if (!cases.length) {
  console.error(`No cases found in ${options.casesPath}`);
  process.exit(1);
}

if (options.list) {
  printCaseList(cases);
  process.exit(0);
}

const selectedCases = selectCases(cases, options.caseIds);
const baseUrl = normalizeBaseUrl(
  options.baseUrl || process.env.NO_CHOICE_TEST_BASE_URL || suite.defaultBaseUrl || "https://no-choice.pages.dev",
);
const endpoint = new URL(suite.target || "/api/restaurant-search-plan", baseUrl).toString();

if (!selectedCases.length) {
  console.error("No matching cases. Run with --list to inspect available ids.");
  process.exit(1);
}

if (!options.json) {
  console.log(`No Choice intent test suite v${suite.version || 1}`);
  console.log(`Target: ${endpoint}`);
  console.log(`Cases: ${selectedCases.length}`);
}

const results = [];
for (const testCase of selectedCases) {
  const result = await runCase({ endpoint, suite, testCase, timeoutMs: options.timeoutMs });
  results.push(result);
  if (!options.json) {
    printHumanResult(result);
  }
}

const passed = results.filter((item) => item.passed).length;
const failed = results.length - passed;

if (options.json) {
  console.log(JSON.stringify({ endpoint, passed, failed, results }, null, 2));
} else {
  console.log("");
  console.log(`Summary: ${passed}/${results.length} passed${failed ? `, ${failed} failed` : ""}.`);
}

if (options.failOnMismatch && failed) {
  process.exitCode = 1;
}

async function runCase({ endpoint, suite, testCase, timeoutMs }) {
  const payload = buildPayload(suite, testCase);
  const startedAt = Date.now();
  let httpResult;

  try {
    httpResult = await postJson(endpoint, payload, timeoutMs);
  } catch (error) {
    return {
      id: testCase.id,
      title: testCase.title,
      passed: false,
      durationMs: Date.now() - startedAt,
      error: error.message,
      checks: [
        {
          name: "API request",
          passed: false,
          expected: "reachable JSON response",
          actual: error.message,
        },
      ],
    };
  }

  const data = httpResult.data;
  const plan = data?.plan || null;
  const checks = [];

  checks.push({
    name: "API returned ok",
    passed: Boolean(httpResult.ok && data?.ok && plan),
    expected: "HTTP 2xx with ok=true and plan",
    actual: `HTTP ${httpResult.status}, ok=${String(data?.ok)}, message=${data?.message || ""}`,
  });

  if (plan) {
    checks.push(...evaluatePlan(plan, testCase.expect || {}));
  }

  const passed = checks.every((check) => check.passed);
  const context = plan ? createPlanContext(plan) : null;

  return {
    id: testCase.id,
    title: testCase.title,
    passed,
    durationMs: Date.now() - startedAt,
    status: httpResult.status,
    provider: data?.provider || "",
    model: data?.model || "",
    summary: context
      ? {
          keywords: context.keywords,
          locations: context.locationStrings,
          strategy: context.strategy,
          includeCurrentLocationInMeetup: context.includeCurrentLocationInMeetup,
          companions: context.companions,
          totalParticipantCount: context.totalParticipantCount,
          totalLocationCount: context.totalLocationCount,
          maxCost: context.maxCost,
        }
      : null,
    checks,
  };
}

function evaluatePlan(plan, expect) {
  const checks = [];
  const context = createPlanContext(plan);

  if (Array.isArray(expect.keywordsAny) && expect.keywordsAny.length) {
    checks.push({
      name: "keywordsAny",
      passed: containsAny(context.keywordText, expect.keywordsAny),
      expected: expect.keywordsAny.join(" / "),
      actual: context.keywords.join(" / "),
    });
  }

  if (Array.isArray(expect.locationsInclude)) {
    for (const token of expect.locationsInclude) {
      checks.push({
        name: `locationsInclude:${token}`,
        passed: containsLoose(context.locationText, token),
        expected: token,
        actual: context.locationStrings.join(" / "),
      });
    }
  }

  if (Array.isArray(expect.locationsExclude)) {
    for (const token of expect.locationsExclude) {
      checks.push({
        name: `locationsExclude:${token}`,
        passed: !containsLoose(context.locationText, token),
        expected: `not ${token}`,
        actual: context.locationStrings.join(" / "),
      });
    }
  }

  if (Array.isArray(expect.locationHintsInclude)) {
    for (const token of expect.locationHintsInclude) {
      checks.push({
        name: `locationHintsInclude:${token}`,
        passed: containsLoose(context.locationHints.join(" "), token),
        expected: token,
        actual: context.locationHints.join(" / "),
      });
    }
  }

  if (Array.isArray(expect.locationHintIncludes)) {
    for (const token of expect.locationHintIncludes) {
      checks.push({
        name: `locationHintIncludes:${token}`,
        passed: containsLoose(context.locationHintText, token),
        expected: token,
        actual: context.locationHintText,
      });
    }
  }

  if (Number.isInteger(expect.locationHintsLength)) {
    checks.push({
      name: "locationHintsLength",
      passed: context.locationHints.length === expect.locationHintsLength,
      expected: expect.locationHintsLength,
      actual: context.locationHints.length,
    });
  }

  if (typeof expect.includeCurrentLocationInMeetup === "boolean") {
    checks.push({
      name: "includeCurrentLocationInMeetup",
      passed: context.includeCurrentLocationInMeetup === expect.includeCurrentLocationInMeetup,
      expected: expect.includeCurrentLocationInMeetup,
      actual: context.includeCurrentLocationInMeetup,
    });
  }

  if (expect.strategy) {
    checks.push({
      name: "strategy",
      passed: context.strategy === expect.strategy,
      expected: expect.strategy,
      actual: context.strategy || "(empty)",
    });
  }

  for (const field of ["textParticipantCount", "textLocationCount", "totalParticipantCount", "totalLocationCount"]) {
    if (Number.isInteger(expect[field])) {
      checks.push({
        name: field,
        passed: context[field] === expect[field],
        expected: expect[field],
        actual: Number.isFinite(context[field]) ? context[field] : "(not numeric)",
      });
    }
  }

  if (Array.isArray(expect.participantSourcesInclude)) {
    for (const source of expect.participantSourcesInclude) {
      checks.push({
        name: `participantSourcesInclude:${source}`,
        passed: context.participantSources.includes(source),
        expected: source,
        actual: context.participantSources.join(" / "),
      });
    }
  }

  if (Array.isArray(expect.companionsMatchesAny) && expect.companionsMatchesAny.length) {
    checks.push({
      name: "companionsMatchesAny",
      passed: containsAny(context.companions, expect.companionsMatchesAny),
      expected: expect.companionsMatchesAny.join(" / "),
      actual: context.companions,
    });
  }

  if (Array.isArray(expect.companionsExclude)) {
    for (const token of expect.companionsExclude) {
      checks.push({
        name: `companionsExclude:${token}`,
        passed: !containsLoose(context.companions, token),
        expected: `not ${token}`,
        actual: context.companions,
      });
    }
  }

  if (Array.isArray(expect.maxCostBetween) && expect.maxCostBetween.length === 2) {
    const [min, max] = expect.maxCostBetween.map(Number);
    checks.push({
      name: "maxCostBetween",
      passed: Number.isFinite(context.maxCost) && context.maxCost >= min && context.maxCost <= max,
      expected: `${min}-${max}`,
      actual: Number.isFinite(context.maxCost) ? context.maxCost : "(not numeric)",
    });
  }

  return checks;
}

function createPlanContext(plan) {
  const locationIntent = objectOrEmpty(plan.locationIntent);
  const priceIntent = objectOrEmpty(plan.priceIntent);
  const sceneIntent = objectOrEmpty(plan.sceneIntent);
  const participantAudit = Array.isArray(locationIntent.participantAudit) ? locationIntent.participantAudit : [];
  const locationHints = stringList(plan.locationHints);
  const participantLocations = stringList(locationIntent.participantLocations);
  const includeCurrentLocationInMeetup = Boolean(plan.includeCurrentLocationInMeetup);
  const locationStrings = uniqueStrings([
    plan.locationHint,
    plan.region,
    locationIntent.destination,
    locationIntent.region,
    locationIntent.street,
    includeCurrentLocationInMeetup ? locationIntent.currentLocation : "",
    ...locationHints,
    ...participantLocations,
    ...participantAudit.map((item) => item?.location),
  ]);

  return {
    keywords: stringList(plan.keywords),
    keywordText: normalizeLoose(stringList(plan.keywords).join(" ")),
    locationHints,
    locationStrings,
    locationText: normalizeLoose(locationStrings.join(" ")),
    locationHintText: normalizeLoose([plan.locationHint, locationIntent.destination].filter(Boolean).join(" ")),
    participantSources: uniqueStrings(participantAudit.map((item) => item?.source)),
    includeCurrentLocationInMeetup,
    strategy: String(locationIntent.strategy || ""),
    companions: normalizeLoose(String(sceneIntent.companions || "")),
    textParticipantCount: readCount(locationIntent.textParticipantCount),
    textLocationCount: readCount(locationIntent.textLocationCount),
    totalParticipantCount: readCount(locationIntent.totalParticipantCount),
    totalLocationCount: readCount(locationIntent.totalLocationCount),
    maxCost: readNumber(plan.maxCost ?? priceIntent.maxCost),
  };
}

function buildPayload(suite, testCase) {
  const location = { ...(suite.defaultLocation || {}), ...(testCase.currentLocation || {}) };
  const payload = {
    moduleId: "dinner",
    question: testCase.question,
    scenes: stringList(testCase.scenes),
    needs: stringList(testCase.needs),
    tags: stringList(testCase.tags),
    customConditions: stringList(testCase.customConditions),
    currentLocationLabel: location.label || "",
    currentLocationDetail: location.addressMeta || location.detail || "",
    location: {
      lat: Number(location.lat),
      lng: Number(location.lng),
      accuracy: Number(location.accuracy) || 0,
      label: location.label || "",
      addressMeta: location.addressMeta || location.detail || "",
    },
  };

  return deepMerge(payload, objectOrEmpty(testCase.requestOverrides));
}

async function postJson(endpoint, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, message: text.slice(0, 300) };
    }
    return { status: response.status, ok: response.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  const parsed = {
    baseUrl: "",
    casesPath: defaultCasesPath,
    caseIds: [],
    list: false,
    json: false,
    failOnMismatch: false,
    timeoutMs: 90000,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base") {
      parsed.baseUrl = requireValue(argv, ++index, "--base");
    } else if (arg === "--cases") {
      parsed.casesPath = path.resolve(requireValue(argv, ++index, "--cases"));
    } else if (arg === "--case") {
      parsed.caseIds.push(...requireValue(argv, ++index, "--case").split(",").map((item) => item.trim()).filter(Boolean));
    } else if (arg === "--list") {
      parsed.list = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--fail-on-mismatch") {
      parsed.failOnMismatch = true;
    } else if (arg === "--timeout-ms") {
      parsed.timeoutMs = Math.max(1000, Number(requireValue(argv, ++index, "--timeout-ms")) || 90000);
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}\n${usage}`);
    }
  }

  return parsed;
}

function printCaseList(cases) {
  for (const testCase of cases) {
    console.log(`${testCase.id}\t${testCase.title || ""}`);
  }
}

function printHumanResult(result) {
  const label = result.passed ? "PASS" : "FAIL";
  console.log("");
  console.log(`[${label}] ${result.id} - ${result.title || ""} (${result.durationMs}ms)`);

  if (result.error) {
    console.log(`  error: ${result.error}`);
  }

  if (result.provider || result.model) {
    console.log(`  model: ${[result.provider, result.model].filter(Boolean).join(" / ")}`);
  }

  if (result.summary) {
    console.log(`  keywords: ${result.summary.keywords.join(" / ") || "(empty)"}`);
    console.log(`  locations: ${result.summary.locations.join(" / ") || "(empty)"}`);
    console.log(
      `  meetup: strategy=${result.summary.strategy || "(empty)"}, current=${result.summary.includeCurrentLocationInMeetup}, people=${displayValue(result.summary.totalParticipantCount)}, locations=${displayValue(result.summary.totalLocationCount)}`,
    );
    console.log(`  companions: ${result.summary.companions || "(empty)"}`);
  }

  const failedChecks = result.checks.filter((check) => !check.passed);
  for (const check of failedChecks) {
    console.log(`  - ${check.name}: expected ${displayValue(check.expected)}, actual ${displayValue(check.actual)}`);
  }
}

function selectCases(cases, caseIds) {
  if (!caseIds.length) {
    return cases;
  }
  const wanted = new Set(caseIds);
  return cases.filter((testCase) => wanted.has(testCase.id));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function requireValue(argv, index, flag) {
  if (!argv[index]) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index];
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function uniqueStrings(value) {
  const seen = new Set();
  const list = [];
  for (const item of value.map((entry) => String(entry || "").trim()).filter(Boolean)) {
    if (!seen.has(item)) {
      seen.add(item);
      list.push(item);
    }
  }
  return list;
}

function containsAny(text, candidates) {
  return candidates.some((candidate) => containsLoose(text, candidate));
}

function containsLoose(text, token) {
  const normalizedText = normalizeLoose(text);
  const normalizedToken = normalizeLoose(token);
  return normalizedToken ? normalizedText.includes(normalizedToken) : false;
}

function normalizeLoose(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function readNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function readCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = String(value || "");
  const totalMatch = text.match(/共\s*(\d+)/);
  if (totalMatch) {
    return Number(totalMatch[1]);
  }
  const personMatch = text.match(/(\d+)\s*(?:人|位|个)/);
  if (personMatch) {
    return Number(personMatch[1]);
  }
  return readNumber(value);
}

function deepMerge(base, extra) {
  const output = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function displayValue(value) {
  if (typeof value === "number" && Number.isNaN(value)) {
    return "(not numeric)";
  }
  if (Array.isArray(value)) {
    return value.join(" / ");
  }
  return String(value);
}
