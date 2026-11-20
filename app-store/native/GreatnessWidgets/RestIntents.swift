// Les boutons du repos dans la Live Activity (écran verrouillé, Dynamic Island) : « +15 s » et « Go », comme dans
// l'app. Le système exécute l'action dans l'app, même en arrière-plan : elle met la Live Activity à jour tout de suite,
// puis prévient l'app web (GreatnessPlugin → js/live.js). Fichier compilé dans l'app et dans l'extension.
import Foundation
import ActivityKit
import AppIntents

// Prévient le pont natif (GreatnessPlugin) qu'un bouton du repos a été touché
enum RestAction {
    static let note = Notification.Name("GreatnessRestAction")
}

@available(iOS 17.0, *)
struct RestActionIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Repos"
    static let isDiscoverable = false

    @Parameter(title: "Action") var action: String

    init() {}
    init(action: String) { self.action = action }

    func perform() async throws -> some IntentResult {
        let now = Date()
        for activity in Activity<RestAttributes>.activities {
            var s = activity.content.state
            if action == "add15" { s.end = max(s.end, now).addingTimeInterval(15) } else { s.end = now }
            if s.start >= s.end { s.start = s.end.addingTimeInterval(-1) }
            await activity.update(ActivityContent(state: s, staleDate: s.end))
        }
        let name = action
        await MainActor.run { NotificationCenter.default.post(name: RestAction.note, object: nil, userInfo: ["action": name]) }
        return .result()
    }
}
