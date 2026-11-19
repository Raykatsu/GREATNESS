// Pont entre l'app web et le natif propre à GREATNESS (appelé depuis js/native.js) :
// - restStart / restEnd : le repos qui défile dans la Dynamic Island et sur l'écran verrouillé (Live Activity) ;
// - widgetSet : les données du widget « Séance du jour », partagées avec l'extension par un App Group ;
// - musicNow : le morceau en cours dans l'app Musique (Apple Music ou bibliothèque), avec sa pochette (js/music.js) ;
// - webAuth : une connexion web sécurisée qui revient d'elle-même dans l'app (connexion Spotify).
import Foundation
import UIKit
import Capacitor
import WidgetKit
import MediaPlayer
import AuthenticationServices
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
        CAPPluginMethod(name: "musicNow", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "webAuth", returnType: CAPPluginReturnPromise),
    ]
    var authSession: ASWebAuthenticationSession? // gardée le temps de la connexion
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

    // Le morceau en cours dans l'app Musique. ask : demande l'accès à la musique s'il n'a pas encore été donné.
    // Réponse : { title, artist, album, playing, id (catalogue Apple Music), art (pochette JPEG en data URL) },
    // { playing: false } si rien ne joue, { denied: true } si l'accès est refusé.
    @objc func musicNow(_ call: CAPPluginCall) {
        let ask = call.getBool("ask") ?? false
        let read = {
            let player = MPMusicPlayerController.systemMusicPlayer
            guard let item = player.nowPlayingItem else { call.resolve(["playing": false, "status": "authorized"]); return }
            var out: [String: Any] = [
                "title": item.title ?? "", "artist": item.artist ?? "", "album": item.albumTitle ?? "",
                "playing": player.playbackState == .playing, "id": item.playbackStoreID, "status": "authorized", "genre": item.genre ?? "",
            ]
            if let image = item.artwork?.image(at: CGSize(width: 300, height: 300)), let data = image.jpegData(compressionQuality: 0.82) {
                out["art"] = "data:image/jpeg;base64," + data.base64EncodedString()
            }
            call.resolve(out)
        }
        let status = MPMediaLibrary.authorizationStatus()
        if status == .authorized { DispatchQueue.main.async { read() }; return }
        if status == .notDetermined && ask {
            MPMediaLibrary.requestAuthorization { granted in
                DispatchQueue.main.async { if granted == .authorized { read() } else { call.resolve(["denied": true, "status": "denied"]) } }
            }
            return
        }
        // pas encore demandée (et pas de demande cette fois-ci), ou refusée : les réglages de l'app le disent
        call.resolve(["denied": status == .denied || status == .restricted, "playing": false, "status": status == .notDetermined ? "notDetermined" : "denied"])
    }

    // Connexion web (Spotify) dans une fenêtre sécurisée ; revient avec l'adresse de retour (scheme://…)
    @objc func webAuth(_ call: CAPPluginCall) {
        guard let s = call.getString("url"), let url = URL(string: s), let scheme = call.getString("scheme") else {
            call.reject("url ou scheme manquant"); return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, _ in
                self.authSession = nil
                if let callback = callback { call.resolve(["url": callback.absoluteString]) } else { call.resolve(["cancelled": true]) }
            }
            session.presentationContextProvider = self
            self.authSession = session
            if !session.start() { self.authSession = nil; call.resolve(["cancelled": true]) }
        }
    }

    @objc func widgetSet(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else { call.reject("json manquant"); return }
        UserDefaults(suiteName: GreatnessPlugin.appGroup)?.set(json, forKey: "widget")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

extension GreatnessPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return self.bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
