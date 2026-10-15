// Extension de GREATNESS (iOS 16.2 et plus) : le widget « Séance du jour » et le repos en Live Activity.
import WidgetKit
import SwiftUI

@main
struct GreatnessWidgetsBundle: WidgetBundle {
    var body: some Widget {
        NextSessionWidget()
        RestLiveActivity()
    }
}

extension View {
    // iOS 17 : fond déclaré par containerBackground (sinon le système affiche un message à la place du widget)
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) { containerBackground(color, for: .widget) } else { background(color) }
    }
}
