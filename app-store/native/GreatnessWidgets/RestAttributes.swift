// Le repos en cours, partagé entre l'app (qui lance la Live Activity) et l'extension (qui la dessine dans la
// Dynamic Island et sur l'écran verrouillé). Fichier compilé dans les deux cibles.
import Foundation
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
struct RestAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var start: Date
        var end: Date
        var title: String   // l'exercice qui suit
        var detail: String  // « Série 2/4 · 80 kg × 5 »
        var song: String? = nil // le morceau qui joue : « Titre · Artiste »
        var art: String? = nil  // sa pochette : un fichier du dossier partagé (SharedArt)
        var tint: String? = nil // l'accent de l'app, aux couleurs du morceau : « #rrggbb »
    }
    var session: String
}
#endif

// La pochette du morceau en cours, déposée par l'app (GreatnessPlugin.saveArt) dans le dossier du groupe d'apps : la
// Live Activity ne peut rien télécharger elle-même. Un seul fichier « art-….jpg » à la fois.
enum SharedArt {
    static let group = "group.io.github.raykatsu.greatness"
    static func url(_ name: String) -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent(name)
    }
}
