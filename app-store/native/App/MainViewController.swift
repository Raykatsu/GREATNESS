// Le contrôleur de l'app (Main.storyboard) : celui de Capacitor, plus le pont propre à GREATNESS.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GreatnessPlugin())
    }
}
