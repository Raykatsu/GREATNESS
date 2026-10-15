// Pont entre l'app web et le natif propre à GREATNESS (appelé depuis js/native.js) :
// - restStart / restEnd : le repos qui défile dans la Dynamic Island et sur l'écran verrouillé (Live Activity) ;
// - widgetSet : les données du widget « Séance du jour », partagées avec l'extension par un App Group.
import Foundation
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

@objc(GreatnessPlugin)
public class GreatnessPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GreatnessPlugin"
    public let jsName = "Greatness"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "restStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restEnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "widgetSet", returnType: CAPPluginReturnPromise),
    ]
    static let appGroup = "group.io.github.raykatsu.greatness"

    @objc func restStart(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["ok": false]); return }
            let end = Date(timeIntervalSince1970: (call.getDouble("end") ?? 0) / 1000)
            var start = Date(timeIntervalSince1970: (call.getDouble("start") ?? Date().timeIntervalSince1970 * 1000) / 1000)
            if start >= end { start = end.addingTimeInterval(-1) } // un intervalle à l'envers ferait planter l'affichage
            let state = RestAttributes.ContentState(start: start, end: end, title: call.getString("title") ?? "Série suivante", detail: call.getString("detail") ?? "")
            // « périmé » à la fin du repos : l'affichage passe à « C'est reparti ! » même si l'app dort
            let content = ActivityContent(state: state, staleDate: end)
            let session = call.getString("session") ?? "GREATNESS"
            Task {
                let running = Activity<RestAttributes>.activities
                if let first = running.first {
                    await first.update(content)
                    for other in running.dropFirst() { await other.end(nil, dismissalPolicy: .immediate) }
                    call.resolve(["ok": true])
                } else {
                    do {
                        _ = try Activity.request(attributes: RestAttributes(session: session), content: content, pushType: nil)
                        call.resolve(["ok": true])
                    } catch {
                        call.resolve(["ok": false, "error": error.localizedDescription])
                    }
                }
            }
            return
        }
        #endif
        call.resolve(["ok": false])
    }

    @objc func restEnd(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            Task {
                for activity in Activity<RestAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func widgetSet(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else { call.reject("json manquant"); return }
        UserDefaults(suiteName: GreatnessPlugin.appGroup)?.set(json, forKey: "widget")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
