// Siri et Raccourcis (iOS 16) : « Lance ma séance », « Ma séance du jour », « Combien de repos », « Note un verre
// d'eau » et « Note mon poids ». « Ma séance du jour » et « Combien de repos » répondent sans ouvrir l'app (données du
// widget, Live Activity du repos) ; les autres ouvrent l'app, qui fait l'action (GreatnessPlugin → événement « siri »
// → js/app.js). Phrases en français dans le code, en anglais dans en.lproj/AppShortcuts.strings (ios-setup.mjs).
import Foundation
import AppIntents
#if canImport(ActivityKit)
import ActivityKit
#endif

// Les actions pour l'app web, gardées jusqu'à ce qu'elle écoute : Siri peut lancer l'app
enum SiriInbox {
    static let note = Notification.Name("GreatnessSiri")
    static let key = "greatness.siri"
    static func push(_ action: String, _ value: Double? = nil) {
        var list = UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
        var item: [String: Any] = ["action": action, "at": Date().timeIntervalSince1970 * 1000]
        if let value = value { item["value"] = value }
        list.append(item)
        UserDefaults.standard.set(list, forKey: key)
        NotificationCenter.default.post(name: note, object: nil)
    }
    static func take() -> [[String: Any]] {
        let list = UserDefaults.standard.array(forKey: key) as? [[String: Any]] ?? []
        UserDefaults.standard.removeObject(forKey: key)
        return list
    }
}

// Les réponses parlées, dans la langue du téléphone
enum SiriText {
    static var fr: Bool { (Locale.preferredLanguages.first ?? "fr").hasPrefix("fr") }

    // La séance du jour, d'après les données du widget (écrites par l'app)
    static func today() -> String {
        guard let json = UserDefaults(suiteName: SharedArt.group)?.string(forKey: "widget"),
              let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let days = obj["days"] as? [[String: Any]] else {
            return fr ? "Ouvre GREATNESS une fois pour que je connaisse ton programme." : "Open GREATNESS once so I know your plan."
        }
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let key = f.string(from: Date())
        guard let day = days.first(where: { ($0["date"] as? String) == key }) else {
            return fr ? "Je n'ai pas encore ton programme du jour : ouvre GREATNESS." : "I don't have today's plan yet: open GREATNESS."
        }
        let title = day["title"] as? String ?? "", sub = day["sub"] as? String ?? ""
        if (day["rest"] as? Bool) == true { return fr ? "Aujourd'hui : \(title). \(sub)." : "Today: \(title). \(sub)." }
        return fr ? "Aujourd'hui : \(title), \(sub). Dis « Lance ma séance » pour commencer." : "Today: \(title), \(sub). Say “Start my workout” to begin."
    }

    // Le repos en cours, d'après la Live Activity
    static func restLeft() -> String {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *), let activity = Activity<RestAttributes>.activities.first {
            let state = activity.content.state
            let left = Int(state.end.timeIntervalSinceNow.rounded())
            guard left > 0 else { return fr ? "Ton repos est fini : c'est reparti !" : "Your rest is over: let's go!" }
            let m = left / 60, s = left % 60
            let time = m > 0 ? "\(m) min \(s) s" : (fr ? "\(s) secondes" : "\(s) seconds")
            return fr ? "Encore \(time) de repos, puis \(state.title)." : "\(time) of rest left, then \(state.title)."
        }
        #endif
        return fr ? "Pas de repos en cours." : "No rest running."
    }
}

@available(iOS 16.0, *)
struct StartWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Lancer ma séance"
    static let openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        SiriInbox.push("start")
        return .result()
    }
}

@available(iOS 16.0, *)
struct TodayWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Ma séance du jour"
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = SiriText.today()
        return .result(dialog: "\(text)")
    }
}

@available(iOS 16.0, *)
struct RestLeftIntent: AppIntent {
    static let title: LocalizedStringResource = "Combien de repos"
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = SiriText.restLeft()
        return .result(dialog: "\(text)")
    }
}

@available(iOS 16.0, *)
struct LogWaterIntent: AppIntent {
    static let title: LocalizedStringResource = "Noter un verre d'eau"
    static let openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        SiriInbox.push("water")
        return .result()
    }
}

@available(iOS 16.0, *)
struct LogWeightIntent: AppIntent {
    static let title: LocalizedStringResource = "Noter mon poids"
    static let openAppWhenRun = true
    @Parameter(title: "Poids (kg)") var weight: Double
    @MainActor func perform() async throws -> some IntentResult {
        SiriInbox.push("weight", weight)
        return .result()
    }
}

@available(iOS 16.0, *)
struct GreatnessShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StartWorkoutIntent(), phrases: [
            "Lance ma séance dans \(.applicationName)",
            "Lance ma séance \(.applicationName)",
            "Commence ma séance \(.applicationName)",
        ])
        AppShortcut(intent: TodayWorkoutIntent(), phrases: [
            "C'est quoi ma séance du jour dans \(.applicationName)",
            "Ma séance du jour \(.applicationName)",
        ])
        AppShortcut(intent: RestLeftIntent(), phrases: [
            "Combien de repos dans \(.applicationName)",
            "Il me reste combien de repos \(.applicationName)",
        ])
        AppShortcut(intent: LogWaterIntent(), phrases: [
            "Note un verre d'eau dans \(.applicationName)",
            "Ajoute un verre d'eau \(.applicationName)",
        ])
        AppShortcut(intent: LogWeightIntent(), phrases: [
            "Note mon poids dans \(.applicationName)",
            "Enregistre ma pesée \(.applicationName)",
        ])
    }
}
