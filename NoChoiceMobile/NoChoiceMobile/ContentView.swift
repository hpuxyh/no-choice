import SwiftUI

private enum Phase {
    case setup
    case swipe
    case result
}

private enum ChoiceMode: String, CaseIterable {
    case auto = "自动推荐"
    case manual = "手动候选"
}

private enum Persona: String, CaseIterable {
    case gentle = "温柔朋友"
    case sharp = "损友"
    case mystic = "玄学大师"
}

private struct Preset: Identifiable {
    let id: String
    let label: String
    let question: String
    let conditions: [String]
    let custom: [String]
    let mode: ChoiceMode
    let options: String
    let count: Int
}

private struct DecisionCard: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let reason: String
    let meta: [String]
    let tint: Color
    let symbol: String
}

private struct DecisionResult {
    let card: DecisionCard
    let persona: Persona
    let reason: String
    let fallbackLine: String?
}

private let presets: [Preset] = [
    .init(
        id: "dinner",
        label: "今晚吃什么",
        question: "今晚吃什么？",
        conditions: ["找中间点", "不吃主食"],
        custom: ["我在国贸，朋友在常营"],
        mode: .auto,
        options: "",
        count: 4
    ),
    .init(
        id: "gift",
        label: "送什么礼物",
        question: "送给刚入职的朋友什么生日礼物？",
        conditions: ["别太贵", "实用一点", "不要太无聊"],
        custom: ["预算 300 元以内"],
        mode: .auto,
        options: "",
        count: 5
    ),
    .init(
        id: "quit",
        label: "要不要辞职",
        question: "要不要辞职？",
        conditions: ["低风险", "留后路"],
        custom: ["最近项目压力大", "还没有拿到新 offer"],
        mode: .auto,
        options: "",
        count: 3
    ),
    .init(
        id: "date",
        label: "跟谁约会",
        question: "周末跟谁约会？",
        conditions: ["适合聊天", "新鲜一点"],
        custom: [],
        mode: .manual,
        options: "阿树\n小陆\nRicky\n独自看电影",
        count: 4
    )
]

private let conditionChoices = [
    "找中间点", "离我近一点", "别太贵", "适合聊天",
    "快一点", "新鲜一点", "不吃主食", "实用一点",
    "不要太无聊", "低风险", "留后路", "今天就能做"
]

struct ContentView: View {
    @State private var phase: Phase = .setup
    @State private var question = presets[0].question
    @State private var selectedConditions = Set(presets[0].conditions)
    @State private var customConditions = presets[0].custom
    @State private var conditionDraft = ""
    @State private var mode = presets[0].mode
    @State private var manualOptions = presets[0].options
    @State private var cardCount = presets[0].count
    @State private var cards: [DecisionCard] = []
    @State private var activeIndex = 0
    @State private var persona = Persona.allCases.randomElement() ?? .gentle
    @State private var result: DecisionResult?
    @State private var dragOffset: CGSize = .zero
    @State private var notice: String?

    var body: some View {
        ZStack {
            BackgroundView()

            switch phase {
            case .setup:
                SetupView(
                    question: $question,
                    selectedConditions: $selectedConditions,
                    customConditions: $customConditions,
                    conditionDraft: $conditionDraft,
                    mode: $mode,
                    manualOptions: $manualOptions,
                    cardCount: $cardCount,
                    start: startDecision,
                    applyPreset: applyPreset
                )
                .transition(.opacity)
            case .swipe:
                SwipeView(
                    cards: cards,
                    activeIndex: activeIndex,
                    persona: persona,
                    dragOffset: $dragOffset,
                    notice: notice,
                    onBack: reset,
                    onSwipe: swipe
                )
                .transition(.move(edge: .trailing).combined(with: .opacity))
            case .result:
                if let result {
                    ResultView(result: result, onAgain: restartSame, onBack: reset)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.88), value: phase)
    }

    private func applyPreset(_ preset: Preset) {
        question = preset.question
        selectedConditions = Set(preset.conditions)
        customConditions = preset.custom
        conditionDraft = ""
        mode = preset.mode
        manualOptions = preset.options
        cardCount = preset.count
    }

    private func startDecision() {
        let cleanQuestion = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanQuestion.isEmpty else { return }

        persona = Persona.allCases.randomElement() ?? .gentle
        dragOffset = .zero
        notice = nil

        if isYesNoQuestion(cleanQuestion) {
            let directCard = yesNoCard(for: cleanQuestion)
            result = makeResult(card: directCard, fallback: nil)
            phase = .result
            return
        }

        if mode == .manual {
            cards = manualCards()
        } else {
            cards = generatedCards(for: cleanQuestion)
        }

        if cards.isEmpty {
            cards = generatedCards(for: cleanQuestion)
        }

        activeIndex = 0
        phase = .swipe
    }

    private func reset() {
        phase = .setup
        result = nil
        cards = []
        activeIndex = 0
        dragOffset = .zero
        notice = nil
    }

    private func restartSame() {
        result = nil
        startDecision()
    }

    private func swipe(_ direction: SwipeDirection) {
        guard cards.indices.contains(activeIndex) else { return }

        if direction == .right {
            result = makeResult(card: cards[activeIndex], fallback: nil)
            phase = .result
            return
        }

        if activeIndex < cards.count - 1 {
            activeIndex += 1
            dragOffset = .zero
        } else {
            let fallbackLines = ["别滑了，真没有了。", "好家伙，选择困难晚期。", "系统看不下去了，替你钦定。"]
            let fallback = fallbackLines.randomElement() ?? "系统看不下去了，替你钦定。"
            notice = fallback
            let picked = cards.randomElement() ?? cards[activeIndex]
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
                result = makeResult(card: picked, fallback: fallback)
                phase = .result
            }
        }
    }

    private func makeResult(card: DecisionCard, fallback: String?) -> DecisionResult {
        let reason: String
        switch persona {
        case .gentle:
            reason = fallback == nil
                ? "你停在「\(card.title)」上面的那一下，身体比脑子诚实。先把这一步交给它。"
                : "你把所有选项都划走，也是一种偏好暴露。那就让「\(card.title)」接住今天的犹豫。"
        case .sharp:
            reason = fallback == nil
                ? "你不是没有标准，是标准太多。「\(card.title)」已经够好了，别再开十个标签页。"
                : "你都滑到底了还不选，那我替你选「\(card.title)」。今天就需要一个人拍桌子。"
        case .mystic:
            reason = "黄历显示：宜决断，忌反复横跳。所以「\(card.title)」今日胜出，犹豫请明天再营业。"
        }

        return DecisionResult(card: card, persona: persona, reason: reason, fallbackLine: fallback)
    }

    private func isYesNoQuestion(_ text: String) -> Bool {
        ["要不要", "该不该", "应不应该", "去不去", "做不做", "买不买", "辞职", "表白", "分手", "离职"]
            .contains { text.contains($0) }
    }

    private func yesNoCard(for question: String) -> DecisionCard {
        let positive = abs(question.hashValue) % 100 >= 38
        return DecisionCard(
            title: positive ? "做" : "先别做",
            reason: positive ? "你已经问出口了，说明它不是一时冲动。" : "现在的不确定不是胆小，是信息还差一点。",
            meta: [positive ? "推进" : "缓一缓", "一锤定音"],
            tint: positive ? .green : .orange,
            symbol: positive ? "checkmark.seal.fill" : "pause.circle.fill"
        )
    }

    private func generatedCards(for question: String) -> [DecisionCard] {
        let pool: [DecisionCard]
        if question.contains("礼物") || question.contains("送") {
            pool = [
                card("桌面氛围灯", "不挑尺码，不像摆件那么空，刚入职的人真的用得到。", ["实用", "不冒犯"], .yellow, "lamp.desk.fill"),
                card("好写的钢笔", "有一点仪式感，但不会贵到让对方有负担。", ["质感", "职场"], .blue, "pencil.and.scribble"),
                card("精品咖啡礼盒", "消耗品永远安全，喝完就结束，不占对方生活空间。", ["低压力", "可分享"], .brown, "cup.and.saucer.fill"),
                card("降噪耳塞套装", "轻，也不挑人，适合通勤和办公室。", ["通勤", "高频"], .green, "earbuds")
            ]
        } else if question.contains("玩") || question.contains("去哪") || question.contains("周末") {
            pool = [
                card("河边 Citywalk", "路线松，预算低，走累了随时切咖啡店。", ["低预算", "轻运动"], .green, "figure.walk"),
                card("小型影展", "时长可控，结束后还能顺手吃饭。", ["室内", "2 小时"], .blue, "film.fill"),
                card("陶艺体验", "手上有事，嘴上不尴尬，适合刚认识或久未见。", ["预约制", "可带走"], .orange, "paintbrush.pointed.fill")
            ]
        } else {
            pool = [
                card("东四小馆", "菜品轻、选择多，适合两个人都不想被主食拖住的晚上。", ["评分 4.7", "人均 ¥96"], .green, "fork.knife"),
                card("巷口烧鸟", "小份多样，点单压力低，聊天空间比正式餐厅更松。", ["评分 4.8", "人均 ¥148"], .indigo, "flame.fill"),
                card("不太甜甜品室", "如果晚餐只是借口，甜品和茶更容易把气氛托住。", ["评分 4.6", "人均 ¥64"], .pink, "takeoutbag.and.cup.and.straw.fill"),
                card("半山精酿", "轻食、无酒精选项都有，适合临时把晚饭变成小聚。", ["评分 4.4", "人均 ¥118"], .teal, "wineglass.fill")
            ]
        }
        return Array(pool.prefix(cardCount))
    }

    private func manualCards() -> [DecisionCard] {
        let options = manualOptions
            .split(whereSeparator: { "\n,，、;".contains($0) })
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return options.prefix(8).enumerated().map { index, title in
            card(title, "你把「\(title)」写进候选里，说明它已经通过了第一轮筛选。", ["自定义", "候选 \(index + 1)"], [.green, .orange, .blue, .pink][index % 4], "sparkles")
        }
    }

    private func card(_ title: String, _ reason: String, _ meta: [String], _ tint: Color, _ symbol: String) -> DecisionCard {
        DecisionCard(title: title, reason: reason, meta: meta, tint: tint, symbol: symbol)
    }
}

private enum SwipeDirection {
    case left
    case right
}

private struct SetupView: View {
    @Binding var question: String
    @Binding var selectedConditions: Set<String>
    @Binding var customConditions: [String]
    @Binding var conditionDraft: String
    @Binding var mode: ChoiceMode
    @Binding var manualOptions: String
    @Binding var cardCount: Int
    let start: () -> Void
    let applyPreset: (Preset) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                AppHeader()

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                    ForEach(presets) { preset in
                        Button(preset.label) { applyPreset(preset) }
                            .buttonStyle(PresetButtonStyle())
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("问题")
                        .font(.subheadline.weight(.bold))
                    TextField("今晚吃什么？", text: $question, axis: .vertical)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2...3)
                        .padding(16)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.08)))
                }

                ConditionPicker(
                    selectedConditions: $selectedConditions,
                    customConditions: $customConditions,
                    conditionDraft: $conditionDraft
                )

                Picker("", selection: $mode) {
                    ForEach(ChoiceMode.allCases, id: \.self) { item in
                        Text(item.rawValue).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                if mode == .manual {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("候选项")
                            .font(.subheadline.weight(.bold))
                        TextEditor(text: $manualOptions)
                            .frame(minHeight: 116)
                            .padding(10)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.08)))
                    }
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("卡片数")
                                .font(.subheadline.weight(.bold))
                            Spacer()
                            Text("\(cardCount)")
                                .font(.headline.weight(.black))
                                .foregroundStyle(.white)
                                .frame(width: 42, height: 34)
                                .background(.black)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        Slider(value: Binding(get: { Double(cardCount) }, set: { cardCount = Int($0.rounded()) }), in: 3...8, step: 1)
                    }
                    .padding(16)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(.black.opacity(0.08)))
                }
            }
            .padding(18)
            .padding(.bottom, 96)
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: start) {
                Label("开局", systemImage: "paperplane.fill")
                    .font(.headline.weight(.black))
                    .frame(maxWidth: .infinity, minHeight: 56)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
            .background(.black)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .shadow(color: .black.opacity(0.18), radius: 20, x: 0, y: 10)
            .padding(.horizontal, 18)
            .padding(.top, 10)
            .padding(.bottom, 8)
            .background(.ultraThinMaterial)
        }
    }
}

private struct ConditionPicker: View {
    @Binding var selectedConditions: Set<String>
    @Binding var customConditions: [String]
    @Binding var conditionDraft: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("条件")
                    .font(.subheadline.weight(.bold))
                Spacer()
                Text("\(selectedConditions.count + customConditions.count)")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.secondary)
            }

            FlowLayout(spacing: 8) {
                ForEach(conditionChoices, id: \.self) { item in
                    let active = selectedConditions.contains(item)
                    Button {
                        if active {
                            selectedConditions.remove(item)
                        } else {
                            selectedConditions.insert(item)
                        }
                    } label: {
                        Text(item)
                            .font(.subheadline.weight(.bold))
                            .padding(.horizontal, 12)
                            .frame(height: 36)
                            .foregroundStyle(active ? .white : .primary)
                            .background(active ? .black : Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 8) {
                TextField("再补一句，比如：朋友在常营", text: $conditionDraft)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .frame(height: 42)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 13))
                Button {
                    let clean = conditionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !clean.isEmpty else { return }
                    if !customConditions.contains(clean) {
                        customConditions.append(clean)
                    }
                    conditionDraft = ""
                } label: {
                    Image(systemName: "plus")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .background(.black)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
            }

            if !customConditions.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(customConditions, id: \.self) { item in
                        Button {
                            customConditions.removeAll { $0 == item }
                        } label: {
                            Label(item, systemImage: "xmark")
                                .labelStyle(.titleAndIcon)
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 10)
                                .frame(height: 30)
                                .foregroundStyle(.green)
                                .background(Color.green.opacity(0.11))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(16)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.black.opacity(0.08)))
    }
}

private struct SwipeView: View {
    let cards: [DecisionCard]
    let activeIndex: Int
    let persona: Persona
    @Binding var dragOffset: CGSize
    let notice: String?
    let onBack: () -> Void
    let onSwipe: (SwipeDirection) -> Void

    var activeCard: DecisionCard? {
        cards.indices.contains(activeIndex) ? cards[activeIndex] : nil
    }

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                AppHeader(compact: true)
                Spacer()
                Button(action: onBack) {
                    Image(systemName: "arrow.left")
                        .frame(width: 42, height: 42)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("第 \(activeIndex + 1) / \(cards.count) 张")
                        .font(.title2.weight(.black))
                    ProgressView(value: Double(activeIndex + 1), total: Double(max(cards.count, 1)))
                        .tint(.green)
                }
                Spacer()
                Label(persona.rawValue, systemImage: "sparkles")
                    .font(.caption.weight(.black))
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.horizontal, 18)

            ZStack {
                ForEach(Array(cards.enumerated().reversed()), id: \.element.id) { index, card in
                    if index >= activeIndex && index < activeIndex + 3 {
                        DecisionCardView(card: card)
                            .scaleEffect(index == activeIndex ? 1 : 0.94 - CGFloat(index - activeIndex) * 0.03)
                            .offset(y: CGFloat(index - activeIndex) * 14)
                            .offset(index == activeIndex ? dragOffset : .zero)
                            .rotationEffect(.degrees(index == activeIndex ? Double(dragOffset.width / 18) : 0))
                            .gesture(index == activeIndex ? dragGesture : nil)
                            .zIndex(Double(cards.count - index))
                    }
                }
            }
            .frame(height: 510)
            .padding(.horizontal, 18)

            HStack(spacing: 18) {
                SwipeButton(symbol: "xmark", color: .red) { onSwipe(.left) }
                SwipeButton(symbol: "heart", color: .green) { onSwipe(.right) }
            }

            Spacer(minLength: 8)
        }
        .overlay(alignment: .bottom) {
            if let notice {
                Text(notice)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .frame(height: 48)
                    .background(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.bottom, 24)
            }
        }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                dragOffset = value.translation
            }
            .onEnded { value in
                if value.translation.width > 92 {
                    onSwipe(.right)
                } else if value.translation.width < -92 {
                    onSwipe(.left)
                } else {
                    dragOffset = .zero
                }
            }
    }
}

private struct DecisionCardView: View {
    let card: DecisionCard

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                LinearGradient(colors: [card.tint.opacity(0.92), .black.opacity(0.88)], startPoint: .topLeading, endPoint: .bottomTrailing)
                Image(systemName: card.symbol)
                    .font(.system(size: 74, weight: .black))
                    .foregroundStyle(.white.opacity(0.9))
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Capsule()
                            .fill(card.tint)
                            .frame(width: 58, height: 8)
                    }
                    .padding(18)
                }
            }
            .frame(height: 218)

            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 8) {
                    Image(systemName: "flame.fill")
                        .foregroundStyle(card.tint)
                    Text(card.title)
                        .font(.largeTitle.weight(.black))
                        .lineLimit(2)
                }
                Text(card.reason)
                    .foregroundStyle(.secondary)
                    .font(.body)
                    .lineSpacing(4)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer()

                FlowLayout(spacing: 8) {
                    ForEach(card.meta, id: \.self) { item in
                        Text(item)
                            .font(.caption.weight(.black))
                            .padding(.horizontal, 10)
                            .frame(height: 30)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                    }
                }
            }
            .padding(20)
        }
        .frame(maxWidth: .infinity)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.18), radius: 28, x: 0, y: 20)
    }
}

private struct ResultView: View {
    let result: DecisionResult
    let onAgain: () -> Void
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                AppHeader(compact: true)
                Spacer()
                Button(action: onBack) {
                    Image(systemName: "arrow.left")
                        .frame(width: 42, height: 42)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }

            VStack(alignment: .leading, spacing: 0) {
                ZStack {
                    LinearGradient(colors: [result.card.tint.opacity(0.88), .black], startPoint: .topLeading, endPoint: .bottomTrailing)
                    Image(systemName: result.card.symbol)
                        .font(.system(size: 88, weight: .black))
                        .foregroundStyle(.white.opacity(0.9))
                }
                .frame(height: 250)

                VStack(alignment: .leading, spacing: 18) {
                    Label(result.persona.rawValue, systemImage: "badge.checkmark")
                        .font(.subheadline.weight(.black))
                        .padding(.horizontal, 12)
                        .frame(height: 34)
                        .background(Color.yellow)
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    if let fallbackLine = result.fallbackLine {
                        Text(fallbackLine)
                            .font(.subheadline.weight(.black))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .frame(height: 34)
                            .background(.red)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Text("就它了 — \(result.card.title)")
                        .font(.system(size: 34, weight: .black))
                        .lineLimit(3)

                    Text(result.reason)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .lineSpacing(5)

                    FlowLayout(spacing: 8) {
                        ForEach(result.card.meta, id: \.self) { item in
                            Text(item)
                                .font(.caption.weight(.black))
                                .padding(.horizontal, 10)
                                .frame(height: 30)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                    }

                    Button(action: onAgain) {
                        Label("再来一局", systemImage: "arrow.clockwise")
                            .font(.headline.weight(.black))
                            .frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.white)
                    .background(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(20)
            }
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.14), radius: 24, x: 0, y: 16)

            Spacer()
        }
        .padding(18)
    }
}

private struct AppHeader: View {
    var compact = false

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(.black)
                LinearGradient(colors: [.green, .yellow, .red, .blue], startPoint: .leading, endPoint: .trailing)
                    .frame(height: 4)
                Text("不")
                    .font(.title2.weight(.black))
                    .foregroundStyle(.white)
            }
            .frame(width: compact ? 40 : 44, height: compact ? 40 : 44)

            VStack(alignment: .leading, spacing: 1) {
                Text("不做选择")
                    .font((compact ? Font.headline : Font.title3).weight(.black))
                Text("Mobile Demo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct SwipeButton: View {
    let symbol: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 66, height: 66)
                .background(color)
                .clipShape(Circle())
                .overlay(Circle().stroke(.white.opacity(0.9), lineWidth: 5))
                .shadow(color: .black.opacity(0.18), radius: 18, x: 0, y: 10)
        }
        .buttonStyle(.plain)
    }
}

private struct BackgroundView: View {
    var body: some View {
        LinearGradient(colors: [Color(.systemBackground), Color(.systemGray6), Color.green.opacity(0.08)], startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea()
            .overlay {
                GridPattern()
                    .stroke(.black.opacity(0.035), lineWidth: 1)
                    .ignoresSafeArea()
            }
    }
}

private struct GridPattern: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let step: CGFloat = 28
        stride(from: rect.minX, through: rect.maxX, by: step).forEach { x in
            path.move(to: CGPoint(x: x, y: rect.minY))
            path.addLine(to: CGPoint(x: x, y: rect.maxY))
        }
        stride(from: rect.minY, through: rect.maxY, by: step).forEach { y in
            path.move(to: CGPoint(x: rect.minX, y: y))
            path.addLine(to: CGPoint(x: rect.maxX, y: y))
        }
        return path
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        let rows = rows(width: width, subviews: subviews)
        return CGSize(width: width, height: rows.reduce(0) { $0 + $1.height } + CGFloat(max(rows.count - 1, 0)) * spacing)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for item in row.items {
                item.subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(item.size))
                x += item.size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private func rows(width: CGFloat, subviews: Subviews) -> [(items: [(subview: LayoutSubview, size: CGSize)], height: CGFloat)] {
        var rows: [(items: [(subview: LayoutSubview, size: CGSize)], height: CGFloat)] = []
        var current: [(subview: LayoutSubview, size: CGSize)] = []
        var currentWidth: CGFloat = 0
        var currentHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let nextWidth = current.isEmpty ? size.width : currentWidth + spacing + size.width
            if nextWidth > width, !current.isEmpty {
                rows.append((current, currentHeight))
                current = [(subview, size)]
                currentWidth = size.width
                currentHeight = size.height
            } else {
                current.append((subview, size))
                currentWidth = nextWidth
                currentHeight = max(currentHeight, size.height)
            }
        }

        if !current.isEmpty {
            rows.append((current, currentHeight))
        }

        return rows
    }
}

private struct PresetButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(configuration.isPressed ? Color(.systemGray5) : .white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(.black.opacity(0.08)))
    }
}

#Preview {
    ContentView()
}
