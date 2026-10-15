// Widget « Séance du jour » (écran d'accueil et écran verrouillé) : la séance prévue, ta série de jours et ta
// semaine. L'app écrit les 7 jours qui viennent (App Group) ; le widget change de jour tout seul à minuit.
import WidgetKit
import SwiftUI

private let appGroup = "group.io.github.raykatsu.greatness"
private let accent = Color(red: 0.91, green: 0.16, blue: 0.23)

struct DayPlan: Codable { let date: String; let title: String; let sub: String; let rest: Bool }
struct GreatnessWidgetData: Codable { let days: [DayPlan]; let streak: Int; let weekDone: Int; let weekGoal: Int; let updated: Double }

struct SessionEntry: TimelineEntry {
    let date: Date
    let day: DayPlan?
    let data: GreatnessWidgetData?
}

struct SessionProvider: TimelineProvider {
    private static let keyFormat: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    private func load() -> GreatnessWidgetData? {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "widget"), let raw = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(GreatnessWidgetData.self, from: raw)
    }
    private func plan(for date: Date, in data: GreatnessWidgetData?) -> DayPlan? {
        let key = Self.keyFormat.string(from: date)
        return data?.days.first { $0.date == key }
    }
    func placeholder(in context: Context) -> SessionEntry {
        SessionEntry(date: Date(), day: DayPlan(date: "", title: "Push", sub: "~45 min · 6 exercices", rest: false), data: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (SessionEntry) -> Void) {
        let data = load()
        completion(SessionEntry(date: Date(), day: plan(for: Date(), in: data) ?? placeholder(in: context).day, data: data))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SessionEntry>) -> Void) {
        let data = load(), cal = Calendar.current
        var entries = [SessionEntry(date: Date(), day: plan(for: Date(), in: data), data: data)]
        var day = cal.startOfDay(for: Date())
        for _ in 0..<6 {
            guard let next = cal.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
            entries.append(SessionEntry(date: day, day: plan(for: day, in: data), data: data))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct NextSessionView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SessionEntry
    private var title: String { entry.day?.title ?? "Ouvre GREATNESS" }
    private var sub: String { entry.day?.sub ?? "pour préparer ta semaine" }
    private var restDay: Bool { entry.day?.rest ?? false }
    private var done: Int { entry.data?.weekDone ?? 0 }
    private var goal: Int { max(1, entry.data?.weekGoal ?? 1) }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(min(done, goal)), in: 0...Double(goal)) {
                Image(systemName: "figure.strengthtraining.traditional")
            } currentValueLabel: {
                Text("\(done)")
            }
            .gaugeStyle(.accessoryCircular)
            .widgetBackground(.clear)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(restDay ? "Récupération" : "Séance du jour").font(.caption2).foregroundStyle(.secondary)
                Text(title).font(.headline).lineLimit(1)
                Text(sub).font(.caption2).lineLimit(1)
            }
            .widgetBackground(.clear)
        case .accessoryInline:
            Text(restDay ? "Récup · \(title)" : "💪 \(title)").widgetBackground(.clear)
        default:
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("GREATNESS").font(.caption2.bold()).tracking(1.5).foregroundStyle(.secondary)
                    Spacer()
                    if let streak = entry.data?.streak, streak > 1 { Text("🔥 \(streak)").font(.caption.bold()) }
                }
                Spacer(minLength: 0)
                Text(restDay ? "RÉCUPÉRATION" : "AUJOURD'HUI").font(.caption2.bold()).foregroundStyle(accent)
                Text(title)
                    .font(.system(size: family == .systemSmall ? 18 : 22, weight: .heavy, design: .rounded))
                    .lineLimit(2).minimumScaleFactor(0.75)
                Text(sub).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                if family == .systemMedium {
                    ProgressView(value: Double(min(done, goal)), total: Double(goal)).tint(accent)
                    Text("\(done)/\(entry.data?.weekGoal ?? 0) séances cette semaine").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .environment(\.colorScheme, .dark)
            .widgetBackground(Color(red: 0.05, green: 0.05, blue: 0.08))
        }
    }
}

struct NextSessionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextSession", provider: SessionProvider()) { entry in
            NextSessionView(entry: entry)
        }
        .configurationDisplayName("Séance du jour")
        .description("Ta séance du jour, ta série de jours et ta semaine.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}
