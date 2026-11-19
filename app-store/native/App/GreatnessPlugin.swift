// Pont entre l'app web et le natif propre à GREATNESS (appelé depuis js/native.js) :
// - restStart / restEnd : le repos qui défile dans la Dynamic Island et sur l'écran verrouillé (Live Activity), avec
//   le morceau qui joue (pochette, titre) et l'accent de l'app ;
// - duck : la voix du coach baisse la musique des autres apps (Spotify, Apple Music…) le temps de parler ;
// - widgetSet : les données du widget « Séance du jour », partagées avec l'extension par un App Group ;
// - musicNow : le morceau en cours dans l'app Musique (Apple Music ou bibliothèque), avec sa pochette (js/music.js) ;
// - webAuth : une connexion web sécurisée qui revient d'elle-même dans l'app (connexion Spotify).
import Foundation
import UIKit
import Capacitor
import WidgetKit
import MediaPlayer
import AuthenticationServices
import AVFoundation
import CryptoKit
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
        CAPPluginMethod(name: "duck", returnType: CAPPluginReturnPromise),
    ]
    var authSession: ASWebAuthenticationSession? // gardée le temps de la connexion
    var ducking = false // la musique des autres apps est baissée (duck)
    static let appGroup = "group.io.github.raykatsu.greatness"

    @objc func restStart(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["ok": false]); return }
            let end = Date(timeIntervalSince1970: (call.getDouble("end") ?? 0) / 1000)
            var start = Date(timeIntervalSince1970: (call.getDouble("start") ?? Date().timeIntervalSince1970 * 1000) / 1000)
            if start >= end { start = end.addingTimeInterval(-1) } // un intervalle à l'envers ferait planter l'affichage
            // le morceau qui joue : sa pochette est déposée dans le dossier partagé (une fois par morceau)
            let song = call.getString("song") ?? "", tint = call.getString("tint") ?? "", artSrc = call.getString("art") ?? ""
            let artName = artSrc.isEmpty ? "" : GreatnessPlugin.artFile(artSrc)
            let haveArt = !artName.isEmpty && GreatnessPlugin.hasArt(artName)
            let state = RestAttributes.ContentState(start: start, end: end, title: call.getString("title") ?? "Série suivante", detail: call.getString("detail") ?? "",
                                                    song: song.isEmpty ? nil : song, art: haveArt ? artName : nil, tint: tint.isEmpty ? nil : tint)
            let needArt = !artName.isEmpty && !haveArt
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
                // un nouveau morceau : sa pochette, une fois déposée, s'ajoute au repos s'il est toujours en cours
                if needArt, await GreatnessPlugin.storeArt(artSrc, name: artName) {
                    var withArt = state
                    withArt.art = artName
                    for activity in Activity<RestAttributes>.activities where abs(activity.content.state.end.timeIntervalSince(end)) < 1 {
                        await activity.update(ActivityContent(state: withArt, staleDate: end))
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

    // Nom du fichier de la pochette, le même pour une même source (adresse https ou data URL de l'app Musique)
    static func artFile(_ src: String) -> String {
        let digest = SHA256.hash(data: Data(src.utf8))
        return "art-" + digest.prefix(8).map { String(format: "%02x", $0) }.joined() + ".jpg"
    }
    static func hasArt(_ name: String) -> Bool {
        guard let url = SharedArt.url(name) else { return false }
        return FileManager.default.fileExists(atPath: url.path)
    }
    static func storeArt(_ src: String, name: String) async -> Bool {
        await withCheckedContinuation { cont in GreatnessPlugin.saveArt(src, name: name) { cont.resume(returning: $0) } }
    }
    // Dépose la pochette en petit (96 pt) dans le dossier partagé, à la place de la précédente
    static func saveArt(_ src: String, name: String, done: @escaping (Bool) -> Void) {
        guard let target = SharedArt.url(name) else { done(false); return }
        let write: (Data) -> Void = { data in
            guard let image = UIImage(data: data) else { done(false); return }
            let format = UIGraphicsImageRendererFormat()
            format.scale = 2
            let side: CGFloat = 96
            let small = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { _ in
                image.draw(in: CGRect(x: 0, y: 0, width: side, height: side))
            }
            guard let jpeg = small.jpegData(compressionQuality: 0.8) else { done(false); return }
            let dir = target.deletingLastPathComponent()
            if let old = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
                for file in old where file.lastPathComponent.hasPrefix("art-") { try? FileManager.default.removeItem(at: file) }
            }
            done((try? jpeg.write(to: target, options: .atomic)) != nil)
        }
        if src.hasPrefix("data:") {
            guard let comma = src.firstIndex(of: ","), let data = Data(base64Encoded: String(src[src.index(after: comma)...])) else { done(false); return }
            write(data)
            return
        }
        guard let url = URL(string: src), url.scheme == "https" else { done(false); return }
        URLSession.shared.dataTask(with: URLRequest(url: url, timeoutInterval: 8)) { data, response, _ in
            guard let data = data, (response as? HTTPURLResponse)?.statusCode == 200 else { done(false); return }
            write(data)
        }.resume()
    }

    // La voix du coach baisse la musique des autres apps le temps de parler (on : true), puis la rend (on : false).
    // Rien ne joue ailleurs : on ne touche pas au son.
    @objc func duck(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        let session = AVAudioSession.sharedInstance()
        if on {
            guard session.isOtherAudioPlaying || ducking else { call.resolve(["ok": false]); return }
            do {
                try session.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
                try session.setActive(true)
                ducking = true
                call.resolve(["ok": true])
            } catch {
                call.resolve(["ok": false, "error": error.localizedDescription])
            }
            return
        }
        guard ducking else { call.resolve(["ok": true]); return }
        ducking = false
        GreatnessPlugin.release(session, tries: 3)
        call.resolve(["ok": true])
    }
    // Rend le son aux autres apps ; si la voix finit tout juste (session encore occupée), on réessaie un peu plus tard
    static func release(_ session: AVAudioSession, tries: Int) {
        do {
            try session.setActive(false, options: .notifyOthersOnDeactivation)
            // la suite (bips du repos…) se mélange à la musique sans la couper
            try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        } catch {
            guard tries > 0 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { GreatnessPlugin.release(session, tries: tries - 1) }
        }
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
