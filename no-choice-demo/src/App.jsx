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

const dragLimit = 96;
const slideDuration = 320;
const spinStepDelay = 480;
const minSpinSteps = 8;
const spinStepRange = 5;
const emptyGeoState = {
  status: "idle",
  coords: null,
  error: "",
  pois: [],
  poiStatus: "idle",
  poiMessage: "",
};

const getInitialConditions = (preset) => preset.conditionIds ?? [];
const getInitialCustomConditions = (preset) => preset.customConditions ?? (preset.context ? [preset.context] : []);

export default function App() {
  const [activeModuleId, setActiveModuleId] = useState(presets[0].id);
  const [question, setQuestion] = useState(presets[0].question);
  const [selectedConditions, setSelectedConditions] = useState(getInitialConditions(presets[0]));
  const [customConditions, setCustomConditions] = useState(getInitialCustomConditions(presets[0]));
  const [conditionDraft, setConditionDraft] = useState("");
  const [mode, setMode] = useState(presets[0].mode);
  const [manualOptions, setManualOptions] = useState(presets[0].options);
  const [cardCount, setCardCount] = useState(presets[0].count);
  const [phase, setPhase] = useState("setup");
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState({ active: false, x: 0, y: 0 });
  const [fly, setFly] = useState(null);
  const [notice, setNotice] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [geoState, setGeoState] = useState(emptyGeoState);
  const [isDeciding, setIsDeciding] = useState(false);
  const [drawStatus, setDrawStatus] = useState("idle");
  const startPoint = useRef({ x: 0, y: 0 });
  const spinTimer = useRef(null);
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
  const activeCard = session?.cards[session.index] ?? null;
  const previousCard =
    session && session.cards.length > 1 ? session.cards[(session.index - 1 + session.cards.length) % session.cards.length] : null;
  const nextCard = session && session.cards.length > 1 ? session.cards[(session.index + 1) % session.cards.length] : null;
  const progress = session ? `${session.index + 1} / ${session.cards.length}` : "0 / 0";
  const resultModule = result ? getModuleProfile(result.moduleId) : activeModule;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  useEffect(() => {
    if (phase !== "swipe" || !session || session.cards.length < 2) {
      return undefined;
    }

    startAutoDraw();

    return () => {
      stopAutoDraw();
    };
  }, [phase, session?.cards]);

  function applyPreset(preset) {
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
    setPhase("setup");
  }

  function stopAutoDraw() {
    spinRun.current += 1;
    if (spinTimer.current) {
      window.clearTimeout(spinTimer.current);
      spinTimer.current = null;
    }
  }

  function startAutoDraw() {
    if (!session || session.cards.length < 2) return;

    stopAutoDraw();
    const runId = spinRun.current;
    let totalSteps = minSpinSteps + Math.floor(Math.random() * spinStepRange);
    if (totalSteps % session.cards.length === 0) {
      totalSteps += 1;
    }
    let step = 0;

    setDrawStatus("spinning");

    const tick = () => {
      if (spinRun.current !== runId) return;

      const isFinalStep = step >= totalSteps - 1;
      drawNextCard(isFinalStep ? "settle" : "auto");
      step += 1;

      if (isFinalStep) {
        spinTimer.current = window.setTimeout(() => {
          if (spinRun.current === runId) {
            setDrawStatus("stopped");
          }
        }, slideDuration + 90);
        return;
      }

      spinTimer.current = window.setTimeout(tick, spinStepDelay);
    };

    spinTimer.current = window.setTimeout(tick, 260);
  }

  function getSelectedConditionLabels() {
    return conditionOptions.filter((option) => selectedConditions.includes(option.id)).map((option) => option.label);
  }

  function getContextFromGeo(sourceGeoState = geoState) {
    const locationText = buildLocationContext(activeModuleId, sourceGeoState.coords, sourceGeoState.pois);
    return [...getSelectedConditionLabels(), ...customConditions, locationText].filter(Boolean).join("，");
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

      setSession({
        question: question.trim(),
        type: mode === "manual" ? "custom" : detectQuestionType(question, false, activeModuleId),
        persona: "gentle",
        moduleId: activeModuleId,
        cards: aiDecision.cards,
        index: 0,
      });
      setResult(null);
      setPhase("swipe");
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

      setSession({
        question: question.trim(),
        type: next.type,
        persona: next.persona,
        moduleId: next.moduleId,
        cards: next.cards,
        index: 0,
      });
      setPhase("swipe");
    } finally {
      setIsDeciding(false);
    }
  }

  function resetToSetup() {
    stopAutoDraw();
    setPhase("setup");
    setResult(null);
    setSession(null);
    setDrag({ active: false, x: 0, y: 0 });
    setFly(null);
    setNotice("");
    setShareStatus("");
    setIsDeciding(false);
    setDrawStatus("idle");
  }

  function restartSame() {
    const currentQuestion = question;
    resetToSetup();
    setQuestion(currentQuestion);
    window.setTimeout(startDecision, 0);
  }

  function handlePointerDown(event) {
    if (!activeCard || fly || drawStatus === "spinning") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startPoint.current = { x: event.clientX, y: event.clientY };
    setDrag({ active: true, x: 0, y: 0 });
  }

  function handlePointerMove(event) {
    if (!drag.active || fly || drawStatus === "spinning") return;
    const x = event.clientX - startPoint.current.x;
    const y = event.clientY - startPoint.current.y;
    setDrag({ active: true, x, y });
  }

  function handlePointerUp() {
    if (!drag.active || fly || drawStatus === "spinning") return;
    const x = drag.x;
    setDrag({ active: false, x: 0, y: 0 });

    if (x > dragLimit) {
      drawNextCard();
      return;
    }

    if (x < -dragLimit) {
      drawNextCard();
    }
  }

  function drawNextCard(source = "manual") {
    if (!session || fly) return;
    if (source === "manual" && drawStatus === "spinning") return;

    setFly(source === "auto" ? "auto-left" : source === "settle" ? "settle-left" : "left");
    window.setTimeout(() => {
      setSession((current) =>
        current
          ? {
              ...current,
              index: (current.index + 1) % current.cards.length,
            }
          : current,
      );
      setFly(null);
    }, slideDuration);
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
        <button className="brandButton" type="button" onClick={resetToSetup} aria-label="回到开局">
          <span className="brandMark">不</span>
          <span>
            <strong>不做选择</strong>
            <small>把纠结收成一个决定</small>
          </span>
        </button>
        <div className="topActions">
          {phase !== "setup" && (
            <button className="iconButton ghost" type="button" onClick={resetToSetup} aria-label="返回开局">
              <ArrowLeft size={19} />
            </button>
          )}
        </div>
      </header>

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

            <label className="fieldGroup">
              <span>{activeModule.questionLabel}</span>
              <textarea
                className="questionInput"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                placeholder={activeModule.questionPlaceholder}
              />
            </label>

            <div className="conditionPanel">
              <div className="sectionLabel">
                <span>{activeModule.conditionLabel}</span>
                <em>{selectedConditions.length + customConditions.length || "可不填"}</em>
              </div>
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
                  <strong>先抽 3 张答案卡</strong>
                  <span>{activeModule.countLabel}会收口成最容易行动的 3 个选项。</span>
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
        <section className={`drawScreen ${drawStatus === "spinning" ? "spinning" : "settled"}`} aria-label="抽卡">
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

          <div className="drawCarousel" aria-live="polite">
            {previousCard && <DecisionCard card={previousCard} side="left" onPointerDown={() => drawNextCard()} />}

            <DecisionCard
              card={activeCard}
              active
              drag={drag}
              fly={fly}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />

            {nextCard && <DecisionCard card={nextCard} side="right" onPointerDown={() => drawNextCard()} />}
          </div>

          <div className="drawPointer" aria-hidden="true" />

          <div className="goCloud">
            <button
              className="goButton"
              type="button"
              onClick={startAutoDraw}
              disabled={drawStatus === "spinning"}
              aria-label="重新抽取答案卡"
            >
              <span>GO</span>
            </button>
          </div>

          <div className="drawFooter">
            <span>{drawStatus === "spinning" ? "抽取中" : progress}</span>
            <em>{getTypeMeta(session.type, session.moduleId).tone}</em>
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

function DecisionCard({
  card,
  active = false,
  side,
  drag = { x: 0, y: 0 },
  fly,
  stackIndex = 0,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  const rotation = active ? drag.x / 18 : 0;
  const flyTransform =
    fly === "right"
      ? "translate3d(135%, -8%, 0) rotate(18deg)"
      : fly === "left" || fly === "auto-left" || fly === "settle-left"
        ? `translate3d(${fly === "left" ? "-135%" : "-112%"}, -6%, 0) rotate(${fly === "left" ? "-18deg" : "-12deg"})`
        : "";
  const activeTransform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotation}deg)`;
  const stackTransform = `translateY(${stackIndex * 13}px) scale(${1 - stackIndex * 0.045})`;
  const sideTransform =
    side === "left"
      ? "translate3d(-72%, 18px, 0) rotate(-8deg) scale(.9)"
      : side === "right"
        ? "translate3d(72%, 18px, 0) rotate(8deg) scale(.9)"
        : stackTransform;
  const chooseOpacity = Math.min(1, Math.max(0, drag.x / dragLimit));
  const rejectOpacity = Math.min(1, Math.max(0, -drag.x / dragLimit));

  return (
    <article
      className={`decisionCard ${active ? "active" : side ? `side ${side}` : "stacked"}`}
      style={{
        "--accent": card.accent,
        transform: active ? flyTransform || activeTransform : sideTransform,
        transition: active && drag.active && !fly ? "none" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="cardMedia"
        style={{
          backgroundImage: `linear-gradient(150deg, rgba(9, 14, 24, .05), rgba(9, 14, 24, .55)), url(${card.image})`,
        }}
      >
        {active && (
          <>
            <span className="stamp acceptStamp" style={{ opacity: chooseOpacity }}>
              就它了
            </span>
            <span className="stamp rejectStamp" style={{ opacity: rejectOpacity }}>
              先不要
            </span>
          </>
        )}
      </div>
      <div className="cardContent">
        <div className="cardTitleRow">
          <Flame size={18} />
          <h2>{card.title}</h2>
        </div>
        <p>{card.reason}</p>
        <div className="metaRow">
          {card.meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
