import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  Dices,
  Flame,
  Heart,
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
  getTypeMeta,
  makeFallbackResult,
  makeResult,
  normalizeOptions,
  personaMeta,
  presets,
} from "./decisionEngine";

const dragLimit = 96;

const conditionOptions = [
  { id: "midpoint", label: "找中间点" },
  { id: "nearby", label: "离我更近" },
  { id: "budget", label: "预算别超" },
  { id: "quiet", label: "适合聊天" },
  { id: "fast", label: "今天能定" },
  { id: "fresh", label: "有点新鲜" },
  { id: "noStaple", label: "不吃主食" },
  { id: "practical", label: "实用优先" },
  { id: "notBoring", label: "别太普通" },
  { id: "lowRisk", label: "风险要低" },
  { id: "buffer", label: "留后路" },
  { id: "today", label: "现在能做" },
];

const getInitialConditions = (preset) => preset.conditionIds ?? [];
const getInitialCustomConditions = (preset) => preset.customConditions ?? (preset.context ? [preset.context] : []);

export default function App() {
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
  const startPoint = useRef({ x: 0, y: 0 });

  const manualList = useMemo(() => normalizeOptions(manualOptions), [manualOptions]);
  const context = useMemo(() => {
    const selectedLabels = conditionOptions
      .filter((option) => selectedConditions.includes(option.id))
      .map((option) => option.label);

    return [...selectedLabels, ...customConditions].join("，");
  }, [customConditions, selectedConditions]);
  const inferredType = useMemo(() => {
    const preview = buildDecision({
      question,
      context,
      mode,
      manualOptions,
      cardCount,
    });
    return preview.ok ? preview.type : "open";
  }, [cardCount, context, manualOptions, mode, question]);
  const typeInfo = getTypeMeta(inferredType);
  const activeCard = session?.cards[session.index] ?? null;
  const progress = session ? `${session.index + 1} / ${session.cards.length}` : "0 / 0";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  function applyPreset(preset) {
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
    setPhase("setup");
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

  function startDecision() {
    const next = buildDecision({ question, context, mode, manualOptions, cardCount });
    setError("");
    setNotice("");
    setShareStatus("");

    if (!next.ok) {
      setError(next.error);
      return;
    }

    if (next.immediateResult) {
      setResult(next.immediateResult);
      setSession({
        question: question.trim(),
        type: next.type,
        persona: next.persona,
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
      cards: next.cards,
      index: 0,
    });
    setPhase("swipe");
  }

  function resetToSetup() {
    setPhase("setup");
    setResult(null);
    setSession(null);
    setDrag({ active: false, x: 0, y: 0 });
    setFly(null);
    setNotice("");
    setShareStatus("");
  }

  function restartSame() {
    const currentQuestion = question;
    resetToSetup();
    setQuestion(currentQuestion);
    window.setTimeout(startDecision, 0);
  }

  function handlePointerDown(event) {
    if (!activeCard || fly) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startPoint.current = { x: event.clientX, y: event.clientY };
    setDrag({ active: true, x: 0, y: 0 });
  }

  function handlePointerMove(event) {
    if (!drag.active || fly) return;
    const x = event.clientX - startPoint.current.x;
    const y = event.clientY - startPoint.current.y;
    setDrag({ active: true, x, y });
  }

  function handlePointerUp() {
    if (!drag.active || fly) return;
    const x = drag.x;
    setDrag({ active: false, x: 0, y: 0 });

    if (x > dragLimit) {
      commitSwipe("right");
      return;
    }

    if (x < -dragLimit) {
      commitSwipe("left");
    }
  }

  function commitSwipe(direction) {
    if (!session || !activeCard || fly) return;

    setFly(direction);
    window.setTimeout(() => {
      if (direction === "right") {
        setResult(
          makeResult({
            card: activeCard,
            question: session.question,
            persona: session.persona,
            source: "locked",
            type: session.type,
          }),
        );
        setPhase("result");
      } else if (session.index < session.cards.length - 1) {
        setSession((current) => ({ ...current, index: current.index + 1 }));
      } else {
        const fallback = makeFallbackResult(session);
        setNotice(fallback.fallbackLine);
        window.setTimeout(() => {
          setResult(fallback);
          setPhase("result");
          setNotice("");
        }, 560);
      }

      setFly(null);
    }, 260);
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
    <main className={`appShell phase-${phase}`}>
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
              {presets.map((preset) => (
                <button key={preset.id} className="presetButton" type="button" onClick={() => applyPreset(preset)}>
                  {preset.label}
                </button>
              ))}
            </div>

            <label className="fieldGroup">
              <span>你卡住的问题</span>
              <textarea
                className="questionInput"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                placeholder="比如：今晚吃什么？"
              />
            </label>

            <div className="conditionPanel">
              <div className="sectionLabel">
                <span>偏好和限制</span>
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
                  placeholder="补充一句，比如：对方在常营"
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

            <div className="segmented" role="tablist" aria-label="候选来源">
              <button className={mode === "auto" ? "active" : ""} type="button" onClick={() => setMode("auto")}>
                <Wand2 size={17} />
                帮我生成
              </button>
              <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => setMode("manual")}>
                <Dices size={17} />
                我有候选
              </button>
            </div>

            {mode === "manual" ? (
              <label className="fieldGroup candidateEditor">
                <span>候选项</span>
                <textarea
                  value={manualOptions}
                  onChange={(event) => setManualOptions(event.target.value)}
                  rows={5}
                  placeholder={"每行一个候选\n至少 3 个，最多 8 个"}
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
              <div className="sliderBox">
                <label htmlFor="cardCount">生成几张</label>
                <input
                  id="cardCount"
                  type="range"
                  min="3"
                  max="8"
                  value={cardCount}
                  onChange={(event) => setCardCount(Number(event.target.value))}
                />
                <output>{cardCount}</output>
              </div>
            )}

            <div className="decisionStrip">
              <span>{typeInfo.label}</span>
              <strong>{typeInfo.tone}</strong>
              {mode === "manual" && <em>{manualList.length} 项</em>}
            </div>

            {error && <p className="errorText">{error}</p>}

            <button className="primaryButton" type="button" onClick={startDecision}>
              <SendHorizontal size={19} />
              开始拍板
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
                <span>{typeInfo.label}</span>
                <strong>{question || "今晚吃什么？"}</strong>
                <p>{typeInfo.description}</p>
              </div>
            </div>
          </aside>
        </section>
      )}

      {phase === "swipe" && session && activeCard && (
        <section className="swipeScreen" aria-label="滑卡">
          <div className="swipeHeader">
            <div>
              <span>{getTypeMeta(session.type).label}</span>
              <strong>{progress}</strong>
            </div>
            <div className="personaPill">
              <Sparkles size={16} />
              {personaMeta[session.persona].name}
            </div>
            <div className="progressTrack" aria-hidden="true">
              <span style={{ width: `${((session.index + 1) / session.cards.length) * 100}%` }} />
            </div>
          </div>

          <div className="deck" aria-live="polite">
            {session.cards
              .slice(session.index + 1, session.index + 3)
              .reverse()
              .map((card, stackIndex) => (
                <DecisionCard key={card.id} card={card} stackIndex={stackIndex + 1} />
              ))}

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
          </div>

          <div className="swipeActions" aria-label="滑卡操作">
            <button className="roundAction reject" type="button" onClick={() => commitSwipe("left")} aria-label="划走">
              <X size={30} />
            </button>
            <button className="roundAction accept" type="button" onClick={() => commitSwipe("right")} aria-label="就它了">
              <Heart size={30} />
            </button>
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
                {personaMeta[result.persona].name}
              </div>
              {result.source === "fallback" && <p className="fallbackLine">{result.fallbackLine}</p>}
              <h1>就它了 — {result.card.title}</h1>
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
      : fly === "left"
        ? "translate3d(-135%, -8%, 0) rotate(-18deg)"
        : "";
  const activeTransform = `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${rotation}deg)`;
  const stackTransform = `translateY(${stackIndex * 13}px) scale(${1 - stackIndex * 0.045})`;
  const chooseOpacity = Math.min(1, Math.max(0, drag.x / dragLimit));
  const rejectOpacity = Math.min(1, Math.max(0, -drag.x / dragLimit));

  return (
    <article
      className={`decisionCard ${active ? "active" : "stacked"}`}
      style={{
        "--accent": card.accent,
        transform: active ? flyTransform || activeTransform : stackTransform,
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
