import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  Dices,
  Flame,
  LocateFixed,
  Plus,
  RefreshCcw,
  SendHorizontal,
  Share2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import {
  buildDecision,
  detectQuestionType,
  getModuleProfile,
  getTypeMeta,
  normalizeOptions,
  personaMeta,
  presets,
} from "./decisionEngine";
import { requestAiDecision } from "./aiDecide";
import {
  buildLocationContext,
  canUseLocation,
  formatAccuracy,
  formatCoords,
  getCurrentPosition,
  getLocationStatusLabel,
  getPoiKeyword,
  searchNearbyPois,
} from "./geoPoi";

const slotAccelerationMs = 300;
const slotCruiseMs = 1500;
const slotDecelerationMs = 1300;
const slotSettleMs = 400;
const slotLoopCount = 3;
const slotWindowRadius = 4;
const slotGapPx = 14;
const slotOvershootPx = 12;
const emptyGeoState = {
  status: "idle",
  coords: null,
  error: "",
  pois: [],
  poiStatus: "idle",
  poiMessage: "",
};

const entryVisuals = {
  dinner: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
  weekend: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  gift: "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=900&q=80",
  general: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
};

const getInitialConditions = (preset) => preset.conditionIds ?? [];
const getInitialCustomConditions = (preset) => preset.customConditions ?? (preset.context ? [preset.context] : []);

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function easeInCubic(value) {
  const t = clamp01(value);
  return t * t * t;
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuint(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 5);
}

function easeOutBack(value, intensity = 0.62) {
  const t = clamp01(value);
  const c3 = intensity + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + intensity * Math.pow(t - 1, 2);
}

function positiveModulo(value, length) {
  if (!length) return 0;
  return ((value % length) + length) % length;
}

function normalizeTargetIndex(targetIndex, cards) {
  if (!cards?.length) return 0;
  const numericTarget = Number.isFinite(Number(targetIndex)) ? Math.trunc(Number(targetIndex)) : 0;
  return positiveModulo(numericTarget, cards.length);
}

function pickTargetIndex(cards) {
  if (!cards?.length) return 0;
  return Math.floor(Math.random() * cards.length);
}

function buildDrawSession(payload) {
  const cards = payload.cards ?? [];
  return {
    ...payload,
    cards,
    index: normalizeTargetIndex(payload.index ?? 0, cards),
    targetIndex:
      payload.targetIndex === undefined ? pickTargetIndex(cards) : normalizeTargetIndex(payload.targetIndex, cards),
  };
}

function buildSlotWindow(cards, offset) {
  if (!cards?.length) return [];

  const center = Math.round(offset);
  const windowSize = slotWindowRadius * 2 + 1;

  return Array.from({ length: windowSize }, (_, index) => {
    const absoluteIndex = center + index - slotWindowRadius;
    const cardIndex = positiveModulo(absoluteIndex, cards.length);
    const distance = absoluteIndex - offset;
    const absDistance = Math.abs(distance);
    const closeness = Math.max(0, 1 - Math.min(absDistance, 2.7) / 2.7);

    return {
      absoluteIndex,
      cardIndex,
      card: cards[cardIndex],
      distance,
      shift: `calc(${(distance * 100).toFixed(4)}% + ${(distance * slotGapPx).toFixed(2)}px)`,
      scale: (0.74 + closeness * 0.36).toFixed(4),
      opacity: (0.28 + closeness * 0.72).toFixed(4),
      brightness: (0.58 + closeness * 0.45).toFixed(4),
      zIndex: Math.round((1 - Math.min(absDistance, slotWindowRadius) / slotWindowRadius) * 40) + 1,
    };
  });
}

export default function App() {
  const [activeModuleId, setActiveModuleId] = useState(presets[0].id);
  const [question, setQuestion] = useState(presets[0].question);
  const [selectedConditions, setSelectedConditions] = useState(getInitialConditions(presets[0]));
  const [customConditions, setCustomConditions] = useState(getInitialCustomConditions(presets[0]));
  const [conditionDraft, setConditionDraft] = useState("");
  const [mode, setMode] = useState(presets[0].mode);
  const [manualOptions, setManualOptions] = useState(presets[0].options);
  const [cardCount, setCardCount] = useState(presets[0].count);
  const [phase, setPhase] = useState("entry");
  const [entryIndex, setEntryIndex] = useState(0);
  const [introMode, setIntroMode] = useState(false);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [geoState, setGeoState] = useState(emptyGeoState);
  const [isDeciding, setIsDeciding] = useState(false);
  const [drawStatus, setDrawStatus] = useState("idle");
  const [drawStage, setDrawStage] = useState("idle");
  const [slotOffset, setSlotOffset] = useState(0);
  const [slotNudge, setSlotNudge] = useState(0);
  const slotFrame = useRef(0);
  const slotOffsetRef = useRef(0);
  const spinRun = useRef(0);

  const activeModule = getModuleProfile(activeModuleId);
  const conditionOptions = activeModule.conditions;
  const locationEnabled = canUseLocation(activeModuleId);
  const manualList = useMemo(() => normalizeOptions(manualOptions), [manualOptions]);
  const context = useMemo(
    () => getContextFromGeo(geoState),
    [activeModuleId, conditionOptions, customConditions, geoState, selectedConditions],
  );
  const inferredType = useMemo(() => {
    const preview = buildDecision({
      moduleId: activeModuleId,
      question,
      context,
      mode,
      manualOptions,
      cardCount,
      poiCandidates: locationEnabled ? geoState.pois : [],
    });
    return preview.ok ? preview.type : "open";
  }, [activeModuleId, cardCount, context, geoState.pois, locationEnabled, manualOptions, mode, question]);
  const typeInfo = getTypeMeta(inferredType, activeModuleId);
  const activeCard = session?.cards.length ? session.cards[positiveModulo(session.index, session.cards.length)] : null;
  const slotCards = useMemo(() => buildSlotWindow(session?.cards ?? [], slotOffset), [session?.cards, slotOffset]);
  const progress = session ? `${session.index + 1} / ${session.cards.length}` : "0 / 0";
  const resultModule = result ? getModuleProfile(result.moduleId) : activeModule;
  const activeConditionCount = selectedConditions.length + customConditions.length;
  const questionExamples = activeModule.questionExamples ?? [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  useEffect(() => {
    if (phase !== "entry" || isDeciding) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setEntryIndex((current) => (current + 1) % presets.length);
    }, 2600);

    return () => {
      window.clearInterval(timer);
    };
  }, [isDeciding, phase]);

  useEffect(() => {
    if (phase !== "swipe" || !session || session.cards.length < 2) {
      return undefined;
    }

    startAutoDraw();

    return () => {
      stopAutoDraw();
    };
  }, [phase, session?.cards]);

  function applyPresetValues(preset, nextPhase = "setup") {
    setActiveModuleId(preset.id);
    setQuestion(preset.question);
    setSelectedConditions(getInitialConditions(preset));
    setCustomConditions(getInitialCustomConditions(preset));
    setConditionDraft("");
    setMode(preset.mode);
    setManualOptions(preset.options);
    setCardCount(preset.count);
    setError("");
    setNotice("");
    setShareStatus("");
    setGeoState((current) =>
      canUseLocation(preset.id)
        ? { ...current, error: "", pois: [], poiStatus: "idle", poiMessage: "" }
        : emptyGeoState,
    );
    if (nextPhase) {
      setPhase(nextPhase);
    }
  }

  function applyPreset(preset) {
    stopAutoDraw();
    setIntroMode(false);
    applyPresetValues(preset);
  }

  function goToEntry() {
    stopAutoDraw();
    setPhase("entry");
    setIntroMode(false);
    setResult(null);
    setSession(null);
    setNotice("");
    setShareStatus("");
    setIsDeciding(false);
    setDrawStatus("idle");
    resetSlotView(0);
  }

  function resetSlotView(index = 0) {
    slotOffsetRef.current = index;
    setSlotOffset(index);
    setSlotNudge(0);
    setDrawStage("idle");
  }

  function openDrawSession(payload) {
    const nextSession = buildDrawSession(payload);
    resetSlotView(nextSession.index);
    setSession(nextSession);
    setResult(null);
    setDrawStatus("idle");
    setPhase("swipe");
  }

  function stopAutoDraw() {
    spinRun.current += 1;
    if (slotFrame.current) {
      window.cancelAnimationFrame(slotFrame.current);
      slotFrame.current = 0;
    }
    setSlotNudge(0);
  }

  function handleSlotSettle(targetIndex) {
    setSession((current) =>
      current
        ? {
            ...current,
            index: targetIndex,
            targetIndex,
          }
        : current,
    );
  }

  function restartAutoDraw() {
    if (!session?.cards?.length) return;
    startAutoDraw(pickTargetIndex(session.cards));
  }

  function startAutoDraw(targetIndex = session?.targetIndex ?? 0) {
    if (!session || session.cards.length < 2) return;

    stopAutoDraw();
    const runId = spinRun.current;
    const cards = session.cards;
    const normalizedTarget = normalizeTargetIndex(targetIndex, cards);
    const from = Math.round(slotOffsetRef.current);
    const currentIndex = positiveModulo(from, cards.length);
    let targetDelta = normalizedTarget - currentIndex;

    if (targetDelta <= 0) {
      targetDelta += cards.length;
    }

    const travel = targetDelta + slotLoopCount * cards.length;
    const to = from + travel;
    const accelerationDistance = travel * 0.14;
    const cruiseDistance = travel * 0.56;
    const decelerationDistance = travel - accelerationDistance - cruiseDistance;
    const decelerationStart = from + accelerationDistance + cruiseDistance;
    const totalMs = slotAccelerationMs + slotCruiseMs + slotDecelerationMs + slotSettleMs;
    const startedAt = performance.now();

    setDrawStatus("spinning");
    setDrawStage("accelerating");
    setSession((current) => (current ? { ...current, targetIndex: normalizedTarget } : current));

    const updateFrame = (now) => {
      if (spinRun.current !== runId) return;

      const elapsed = now - startedAt;
      let nextOffset = to;
      let nextNudge = 0;
      let nextStage = "settling";

      if (elapsed < slotAccelerationMs) {
        const progress = elapsed / slotAccelerationMs;
        nextStage = "accelerating";
        nextOffset = from + accelerationDistance * easeInCubic(progress);
      } else if (elapsed < slotAccelerationMs + slotCruiseMs) {
        const progress = (elapsed - slotAccelerationMs) / slotCruiseMs;
        nextStage = "cruising";
        nextOffset = from + accelerationDistance + cruiseDistance * clamp01(progress);
      } else if (elapsed < slotAccelerationMs + slotCruiseMs + slotDecelerationMs) {
        const progress = (elapsed - slotAccelerationMs - slotCruiseMs) / slotDecelerationMs;
        nextStage = "decelerating";
        nextOffset = decelerationStart + decelerationDistance * easeOutQuint(progress);
      } else if (elapsed < totalMs) {
        const progress = (elapsed - slotAccelerationMs - slotCruiseMs - slotDecelerationMs) / slotSettleMs;
        nextStage = "settling";
        nextOffset = to;

        if (progress < 0.32) {
          nextNudge = -slotOvershootPx * easeOutCubic(progress / 0.32);
        } else {
          nextNudge = -slotOvershootPx * (1 - easeOutBack((progress - 0.32) / 0.68));
        }
      }

      slotOffsetRef.current = nextOffset;
      setSlotOffset(nextOffset);
      setSlotNudge(nextNudge);
      setDrawStage(nextStage);

      if (elapsed >= totalMs) {
        slotOffsetRef.current = to;
        setSlotOffset(to);
        setSlotNudge(0);
        setDrawStage("settled");
        setDrawStatus("stopped");
        slotFrame.current = 0;
        handleSlotSettle(normalizedTarget);
        return;
      }

      slotFrame.current = window.requestAnimationFrame(updateFrame);
    };

    slotFrame.current = window.requestAnimationFrame(updateFrame);
  }

  function getConditionLabelsFor(moduleId, conditionIds) {
    return getModuleProfile(moduleId)
      .conditions.filter((option) => conditionIds.includes(option.id))
      .map((option) => option.label);
  }

  function buildDecisionContext(moduleId, conditionIds, extraConditions, sourceGeoState = emptyGeoState) {
    const locationText = buildLocationContext(moduleId, sourceGeoState.coords, sourceGeoState.pois);
    return [...getConditionLabelsFor(moduleId, conditionIds), ...extraConditions, locationText].filter(Boolean).join("，");
  }

  function getSelectedConditionLabels() {
    return getConditionLabelsFor(activeModuleId, selectedConditions);
  }

  function getContextFromGeo(sourceGeoState = geoState) {
    return buildDecisionContext(activeModuleId, selectedConditions, customConditions, sourceGeoState);
  }

  function toggleCondition(id) {
    setSelectedConditions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function addCustomCondition() {
    const clean = conditionDraft.trim();
    if (!clean) return;
    setCustomConditions((current) => (current.includes(clean) ? current : [...current, clean].slice(0, 5)));
    setConditionDraft("");
  }

  function removeCustomCondition(value) {
    setCustomConditions((current) => current.filter((item) => item !== value));
  }

  function chooseQuestionExample(example) {
    setQuestion(example);
    setError("");
  }

  async function useCurrentLocation() {
    if (!locationEnabled) return;
    await fetchLocationState();
  }

  async function fetchLocationState() {
    setError("");
    setGeoState((current) => ({
      ...current,
      status: "locating",
      error: "",
      pois: [],
      poiStatus: "idle",
      poiMessage: "",
    }));

    try {
      const coords = await getCurrentPosition();
      const locatingState = {
        ...geoState,
        status: "located",
        coords,
        error: "",
        pois: [],
        poiStatus: "loading",
        poiMessage: "正在查附近点位",
      };

      setGeoState(locatingState);

      const poiResult = await searchNearbyPois({
        coords,
        moduleId: activeModuleId,
        keyword: getPoiKeyword(activeModuleId, question),
      });

      const nextState = {
        ...locatingState,
        status: "located",
        coords,
        pois: poiResult.pois || [],
        poiStatus: poiResult.ok ? "ready" : poiResult.needsKey ? "needsKey" : "empty",
        poiMessage: poiResult.message,
      };

      setGeoState(nextState);
      return nextState;
    } catch (locationError) {
      const nextState = {
        ...geoState,
        status: geoState.coords ? "located" : "error",
        error: locationError.message,
        poiStatus: "idle",
        poiMessage: "",
      };
      setGeoState(nextState);
      return nextState;
    }
  }

  async function startDecision() {
    if (isDeciding) return;

    setIntroMode(false);
    setError("");
    setNotice("");
    setShareStatus("");
    setIsDeciding(true);

    if (!question.trim()) {
      setError("先写一个你卡住的问题。比如：今晚吃什么？");
      setIsDeciding(false);
      return;
    }

    let effectiveGeoState = geoState;

    try {
      if (locationEnabled && !geoState.coords) {
        effectiveGeoState = await fetchLocationState();
      }

      const decisionContext = getContextFromGeo(effectiveGeoState);
      const poiCandidates = locationEnabled ? effectiveGeoState.pois : [];
      const aiDecision = await requestAiDecision({
        moduleId: activeModuleId,
        moduleLabel: activeModule.label,
        question: question.trim(),
        context: decisionContext,
        selectedConditions: getSelectedConditionLabels(),
        customConditions,
        mode,
        manualCandidates: normalizeOptions(manualOptions),
        location: locationEnabled && effectiveGeoState.coords ? effectiveGeoState.coords : null,
        pois: poiCandidates,
        outputCount: 3,
      });

      openDrawSession({
        question: question.trim(),
        type: mode === "manual" ? "custom" : detectQuestionType(question, false, activeModuleId),
        persona: "gentle",
        moduleId: activeModuleId,
        cards: aiDecision.cards,
        index: 0,
      });
      return;
    } catch {
      const decisionContext = getContextFromGeo(effectiveGeoState);
      const next = buildDecision({
        moduleId: activeModuleId,
        question,
        context: decisionContext,
        mode,
        manualOptions,
        cardCount,
        poiCandidates: locationEnabled ? effectiveGeoState.pois : [],
      });

      if (!next.ok) {
        setError(next.error);
        return;
      }

      setNotice("AI 推荐暂时不可用，先用本地规则抽卡。");

      if (next.immediateResult) {
        setResult(next.immediateResult);
        setSession({
          question: question.trim(),
          type: next.type,
          persona: next.persona,
          moduleId: next.moduleId,
          cards: next.cards,
          index: 0,
        });
        setPhase("result");
        return;
      }

      openDrawSession({
        question: question.trim(),
        type: next.type,
        persona: next.persona,
        moduleId: next.moduleId,
        cards: next.cards,
        index: 0,
      });
    } finally {
      setIsDeciding(false);
    }
  }

  async function startPresetDemo(preset) {
    if (isDeciding) return;

    const presetProfile = getModuleProfile(preset.id);
    const presetConditions = getInitialConditions(preset);
    const presetCustomConditions = getInitialCustomConditions(preset);
    const presetContext = buildDecisionContext(preset.id, presetConditions, presetCustomConditions, emptyGeoState);

    stopAutoDraw();
    setIntroMode(true);
    applyPresetValues(preset, null);
    setResult(null);
    setSession(null);
    setDrawStatus("idle");
    resetSlotView(0);
    setIsDeciding(true);

    try {
      const aiDecision = await requestAiDecision({
        moduleId: preset.id,
        moduleLabel: presetProfile.label,
        question: preset.question.trim(),
        context: presetContext,
        selectedConditions: getConditionLabelsFor(preset.id, presetConditions),
        customConditions: presetCustomConditions,
        mode: preset.mode,
        manualCandidates: normalizeOptions(preset.options),
        location: null,
        pois: [],
        outputCount: 3,
      });

      if (!aiDecision.cards || aiDecision.cards.length < 2) {
        throw new Error("AI 推荐结果不足");
      }

      openDrawSession({
        question: preset.question.trim(),
        type: preset.mode === "manual" ? "custom" : detectQuestionType(preset.question, false, preset.id),
        persona: "gentle",
        moduleId: preset.id,
        cards: aiDecision.cards,
        index: 0,
      });
    } catch {
      const next = buildDecision({
        moduleId: preset.id,
        question: preset.question,
        context: presetContext,
        mode: preset.mode,
        manualOptions: preset.options,
        cardCount: preset.count,
        poiCandidates: [],
      });

      if (!next.ok) {
        setError(next.error);
        setIntroMode(false);
        setPhase("setup");
        return;
      }

      openDrawSession({
        question: preset.question.trim(),
        type: next.type,
        persona: next.persona,
        moduleId: next.moduleId,
        cards: next.cards,
        index: 0,
      });
    } finally {
      setIsDeciding(false);
    }
  }

  function resetToSetup() {
    stopAutoDraw();
    setPhase("setup");
    setIntroMode(false);
    setResult(null);
    setSession(null);
    setNotice("");
    setShareStatus("");
    setIsDeciding(false);
    setDrawStatus("idle");
    resetSlotView(0);
  }

  function enterSetupFromDemo() {
    resetToSetup();
  }

  function restartSame() {
    const currentQuestion = question;
    resetToSetup();
    setQuestion(currentQuestion);
    window.setTimeout(startDecision, 0);
  }

  function getEntryCardPosition(index) {
    const offset = (index - entryIndex + presets.length) % presets.length;
    if (offset === 0) return "active";
    if (offset === 1) return "next";
    if (offset === presets.length - 1) return "prev";
    return "far";
  }

  async function shareResult() {
    if (!result) return;
    const text = `不做选择给出的结论：${result.card.title}\n${result.reason}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "不做选择", text });
        setShareStatus("已打开分享");
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus("结果已复制");
      }
    } catch {
      setShareStatus("分享已取消");
    }
  }

  return (
    <main
      className={`appShell phase-${phase}`}
      style={{ "--module-accent": activeModule.accent, "--module-soft": activeModule.soft }}
    >
      <header className="topBar">
        <button className="brandButton" type="button" onClick={goToEntry} aria-label="回到入口">
          <span className="brandMark">不</span>
          <span>
            <strong>不做选择</strong>
            <small>把纠结收成一个决定</small>
          </span>
        </button>
        <div className="topActions">
          {phase !== "setup" && phase !== "entry" && (
            <button
              className="iconButton ghost"
              type="button"
              onClick={introMode ? goToEntry : resetToSetup}
              aria-label="返回开局"
            >
              <ArrowLeft size={19} />
            </button>
          )}
        </div>
      </header>

      {isDeciding && (
        <div className="decideOverlay" role="status" aria-live="polite">
          <div className="decideCard">
            <div className="decideSpinner" aria-hidden="true" />
            <span className="decideKicker">{activeModule.label}</span>
            <strong>正在为你收口…</strong>
            <p>让 AI 根据你的条件抽出 3 张答案卡，马上就好。</p>
          </div>
        </div>
      )}

      {phase === "entry" && (
        <section className="entryScreen" aria-label="入口">
          <div className="entryIntro">
            <span>先体验一轮</span>
            <h1>把今天的纠结抽成 3 张卡</h1>
            <p>选一个场景，先看完整抽取过程；停住后再进入选择页改条件。</p>
          </div>

          <div className="entryCarousel" aria-live="polite">
            {presets.map((preset, index) => {
              const presetProfile = getModuleProfile(preset.id);
              const position = getEntryCardPosition(index);
              return (
                <button
                  key={preset.id}
                  className={`entryModuleCard ${position} ${isDeciding && activeModuleId === preset.id ? "loading" : ""}`}
                  type="button"
                  style={{
                    "--entry-accent": presetProfile.accent,
                    "--entry-soft": presetProfile.soft,
                  }}
                  onClick={() => startPresetDemo(preset)}
                  disabled={isDeciding}
                  aria-label={`体验${preset.label}`}
                >
                  <span
                    className="entryCardImage"
                    style={{
                      backgroundImage: `linear-gradient(150deg, rgba(12,16,24,.02), rgba(12,16,24,.48)), url(${entryVisuals[preset.id]})`,
                    }}
                  />
                  <span className="entryCardBody">
                    <small>{presetProfile.kicker}</small>
                    <strong>{preset.label}</strong>
                    <em>{presetProfile.short}</em>
                    <span className="entryCardChips">
                      {presetProfile.typeMeta.tone.split("/").map((item) => (
                        <b key={item}>{item}</b>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="entryDots" aria-label="场景轮播">
            {presets.map((preset, index) => (
              <button
                key={preset.id}
                className={index === entryIndex ? "active" : ""}
                type="button"
                onClick={() => setEntryIndex(index)}
                aria-label={`查看${preset.label}`}
              />
            ))}
          </div>
        </section>
      )}

      {phase === "setup" && (
        <section className="setupGrid" aria-label="开局">
          <div className="controlPanel">
            <div className="presetRow" aria-label="预设场景">
              {presets.map((preset) => {
                const presetProfile = getModuleProfile(preset.id);
                return (
                  <button
                    key={preset.id}
                    className={`presetButton ${activeModuleId === preset.id ? "active" : ""}`}
                    type="button"
                    style={{ "--preset-accent": presetProfile.accent, "--preset-soft": presetProfile.soft }}
                    onClick={() => applyPreset(preset)}
                  >
                    <strong>{preset.label}</strong>
                    <small>{presetProfile.short}</small>
                  </button>
                );
              })}
            </div>

            <div className="moduleBrief">
              <span>{activeModule.kicker}</span>
              <h1>{activeModule.headline}</h1>
              <p>{activeModule.description}</p>
            </div>

            <div className="setupFlow" aria-label="填写流程">
              <span>写一句问题</span>
              <span>选关键条件</span>
              <span>抽 3 张卡</span>
            </div>

            <div className="fieldGroup questionBlock">
              <div className="questionLabelRow">
                <span>{activeModule.questionLabel}</span>
                <em>一句话就够</em>
              </div>
              <textarea
                className="questionInput"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                placeholder={activeModule.questionPlaceholder}
                aria-label={activeModule.questionLabel}
              />
              <p className="fieldHint">{activeModule.questionHelp}</p>
              {questionExamples.length > 0 && (
                <div className="exampleRow" aria-label="问题示例">
                  {questionExamples.map((example) => (
                    <button key={example} type="button" onClick={() => chooseQuestionExample(example)}>
                      {example}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="conditionPanel">
              <div className="sectionLabel">
                <span>{activeModule.conditionLabel}</span>
                <em>{activeConditionCount ? `${activeConditionCount} 条` : "可跳过"}</em>
              </div>
              <p className="panelHint">{activeModule.conditionHelp}</p>
              <div className="conditionGrid" aria-label="条件选择">
                {conditionOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`conditionChip ${selectedConditions.includes(option.id) ? "active" : ""}`}
                    type="button"
                    onClick={() => toggleCondition(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="customConditionRow">
                <input
                  value={conditionDraft}
                  onChange={(event) => setConditionDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomCondition();
                    }
                  }}
                  placeholder={activeModule.customPlaceholder}
                />
                <button className="miniIconButton" type="button" onClick={addCustomCondition} aria-label="添加条件">
                  <Plus size={18} />
                </button>
              </div>
              {customConditions.length > 0 && (
                <div className="selectedConditionRow">
                  {customConditions.map((item) => (
                    <button key={item} type="button" onClick={() => removeCustomCondition(item)}>
                      <span>{item}</span>
                      <X size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {locationEnabled && (
              <div className="locationPanel">
                <div className="sectionLabel">
                  <span>{activeModule.location.label}</span>
                  <em>{getLocationStatusLabel(geoState)}</em>
                </div>
                <div className="locationActionRow">
                  <button
                    className="locationButton"
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={geoState.status === "locating"}
                  >
                    <LocateFixed size={18} />
                    {geoState.status === "locating"
                      ? "定位中"
                      : geoState.coords
                        ? "重新定位"
                        : activeModule.location.buttonLabel}
                  </button>
                  {geoState.coords && (
                    <div className="locationReadout">
                      <strong>{formatCoords(geoState.coords)}</strong>
                      <small>精度约 {formatAccuracy(geoState.coords.accuracy)}</small>
                    </div>
                  )}
                </div>
                {geoState.error && <p className="locationNotice error">{geoState.error}</p>}
                {geoState.poiMessage && (
                  <p className={`locationNotice ${geoState.poiStatus === "needsKey" ? "pending" : ""}`}>
                    {geoState.poiMessage}
                  </p>
                )}
              </div>
            )}

            <div className="segmented" role="tablist" aria-label="候选来源">
              <button className={mode === "auto" ? "active" : ""} type="button" onClick={() => setMode("auto")}>
                <Wand2 size={17} />
                {activeModule.autoLabel}
              </button>
              <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => setMode("manual")}>
                <Dices size={17} />
                {activeModule.manualLabel}
              </button>
            </div>

            {mode === "manual" ? (
              <label className="fieldGroup candidateEditor">
                <span>{activeModule.candidateLabel}</span>
                <small className="fieldHint">至少写 3 个，每行一个；系统只负责从里面取舍。</small>
                <textarea
                  value={manualOptions}
                  onChange={(event) => setManualOptions(event.target.value)}
                  rows={5}
                  placeholder={activeModule.manualPlaceholder}
                />
                {manualList.length > 0 && (
                  <div className="candidatePreview">
                    {manualList.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                )}
              </label>
            ) : (
              <div className="drawCountBox">
                <Sparkles size={18} />
                <div>
                  <strong>{activeModule.drawSummaryTitle}</strong>
                  <span>{activeModule.drawSummary}</span>
                </div>
                <output>{Math.min(cardCount, 3)}</output>
              </div>
            )}

            <div className="decisionStrip">
              <span>{typeInfo.label}</span>
              <strong>{typeInfo.tone}</strong>
              {mode === "manual" && <em>{manualList.length} 项</em>}
            </div>

            {error && <p className="errorText">{error}</p>}

            <button className="primaryButton" type="button" onClick={startDecision} disabled={isDeciding}>
              {isDeciding ? <Sparkles size={19} /> : <SendHorizontal size={19} />}
              {isDeciding ? "正在抽卡" : activeModule.startLabel}
            </button>
          </div>

          <aside className="demoPreview" aria-label="当前牌面">
            <div className="previewStage">
              <div className="previewCard back" />
              <div className="previewCard mid" />
              <div className="previewCard front">
                <div className="previewArt">
                  <Sparkles size={24} />
                </div>
                <span>{activeModule.previewBadge}</span>
                <strong>{question || activeModule.questionPlaceholder}</strong>
                <p>{activeModule.previewDescription}</p>
              </div>
            </div>
          </aside>
        </section>
      )}

      {phase === "swipe" && session && activeCard && (
        <section
          className={`drawScreen ${drawStatus === "spinning" ? "spinning" : "settled"} stage-${drawStage}`}
          aria-label="抽卡"
        >
          <div className="drawHeader">
            <div className="miniDeck" aria-hidden="true">
              {session.cards.slice(0, 3).map((card, index) => (
                <span
                  key={card.id}
                  style={{
                    "--tilt": `${(index - 1) * 8}deg`,
                    "--lift": `${Math.abs(index - 1) * 8}px`,
                    backgroundImage: `linear-gradient(150deg, rgba(255,255,255,.12), rgba(0,0,0,.12)), url(${card.image})`,
                  }}
                />
              ))}
            </div>
            <h1>
              抽取今日选择卡，
              <span>{getModuleProfile(session.moduleId).label}</span>
            </h1>
            <p>{session.question}</p>
          </div>

          <div
            className={`drawSlotMachine stage-${drawStage} ${drawStatus === "stopped" ? "hasSettled" : ""}`}
            style={{ "--slot-nudge": `${slotNudge}px` }}
            aria-live="polite"
          >
            <div className="slotTrack">
              {slotCards.map((item) => (
                <SlotDecisionCard
                  key={`${item.card.id}-${item.absoluteIndex}`}
                  item={item}
                  settled={drawStatus === "stopped" || drawStage === "settled"}
                />
              ))}
            </div>
            <div className="slotFocusFrame" aria-hidden="true" />
          </div>

          <div className="drawPointer" aria-hidden="true" />

          <div className="goCloud">
            <button
              className="goButton"
              type="button"
              onClick={restartAutoDraw}
              disabled={drawStatus === "spinning"}
              aria-label="重新抽取答案卡"
            >
              <span>GO</span>
            </button>
          </div>

          <div className="drawFooter">
            <span>{drawStatus === "spinning" ? "抽取中" : introMode ? "体验完成" : progress}</span>
            <em>{getTypeMeta(session.type, session.moduleId).tone}</em>
            {introMode && drawStatus === "stopped" && (
              <button className="enterSetupButton" type="button" onClick={enterSetupFromDemo}>
                进入选择页
              </button>
            )}
          </div>

          {notice && <div className="toast">{notice}</div>}
        </section>
      )}

      {phase === "result" && result && (
        <section className="resultScreen" aria-label="结果">
          <div className="resultHero">
            <div
              className="resultImage"
              style={{
                "--accent": result.card.accent,
                backgroundImage: `linear-gradient(150deg, rgba(12, 16, 24, .18), rgba(12, 16, 24, .55)), url(${result.card.image})`,
              }}
            />
            <div className="resultBody">
              <div className="resultKicker">
                <BadgeCheck size={18} />
                {resultModule.resultKicker} · {personaMeta[result.persona].name}
              </div>
              {result.source === "fallback" && <p className="fallbackLine">{result.fallbackLine}</p>}
              <h1>{resultModule.resultPrefix} — {result.card.title}</h1>
              <p>{result.reason}</p>
              <div className="metaRow">
                {result.card.meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="resultActions">
                <button className="secondaryButton" type="button" onClick={restartSame}>
                  <RefreshCcw size={18} />
                  重新判断
                </button>
                <button className="primaryButton compact" type="button" onClick={shareResult}>
                  {navigator.share ? <Share2 size={18} /> : <Copy size={18} />}
                  分享结果
                </button>
              </div>
              {shareStatus && <span className="shareStatus">{shareStatus}</span>}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function SlotDecisionCard({ item, settled }) {
  const { card, distance } = item;
  const isFocus = settled && Math.abs(distance) < 0.04;

  return (
    <article
      className={`slotCard ${isFocus ? "focus" : ""}`}
      style={{
        "--accent": card.accent,
        "--slot-shift": item.shift,
        "--slot-scale": item.scale,
        "--slot-opacity": item.opacity,
        "--slot-brightness": item.brightness,
        zIndex: item.zIndex,
      }}
      aria-hidden={!isFocus}
    >
      <div
        className="slotCardMedia"
        style={{
          backgroundImage: `linear-gradient(150deg, rgba(9, 14, 24, .05), rgba(9, 14, 24, .55)), url(${card.image})`,
        }}
      />
      <div className="slotCardContent">
        <div className="slotCardTitleRow">
          <Flame size={15} />
          <h2>{card.title}</h2>
        </div>
        <p>{card.reason}</p>
        <div className="slotMetaRow">
          {card.meta.slice(0, 2).map((meta) => (
            <span key={meta}>{meta}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
