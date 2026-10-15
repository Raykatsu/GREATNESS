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
    }
    var session: String
}
#endif
