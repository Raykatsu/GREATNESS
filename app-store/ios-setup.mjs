// Réglages du projet iPhone créé par « npx cap add ios » : textes des autorisations (caméra, micro, Santé, Face ID…),
// Apple Santé (HealthKit), iPhone seulement, en portrait. Relançable sans risque.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, "ios", "App");
const plist = path.join(app, "App", "Info.plist"), pbx = path.join(app, "App.xcodeproj", "project.pbxproj");
if (!fs.existsSync(plist) || !fs.existsSync(pbx)) { console.error("Projet iOS introuvable : lance d'abord « npx cap add ios »."); process.exit(1); }

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const KEYS = {
  NSCameraUsageDescription: "La caméra compte tes répétitions, mesure ta vitesse de barre et corrige ta posture en direct. Les images restent sur ton téléphone.",
  NSMicrophoneUsageDescription: "Le micro sert au mode mains libres : dis « série faite » ou « go » sans toucher l'écran.",
  NSSpeechRecognitionUsageDescription: "La reconnaissance vocale comprend tes commandes pendant la séance (mode mains libres).",
  NSPhotoLibraryUsageDescription: "Pour choisir une vidéo de ta série (analyse de technique), une photo de repas ou une photo de progrès.",
  NSHealthShareUsageDescription: "GREATNESS lit ton sommeil, ta variabilité cardiaque, ta fréquence cardiaque au repos, tes pas, ton poids et ton énergie active pour préremplir ton bilan de forme et adapter tes séances.",
  NSHealthUpdateUsageDescription: "GREATNESS n'écrit rien dans Santé.",
  NSFaceIDUsageDescription: "Face ID déverrouille ton compte GREATNESS à la place de ton code secret. Rien ne quitte ton téléphone.",
};
let p = fs.readFileSync(plist, "utf8");
const setKey = (k, xml) => {
  const re = new RegExp(`\\s*<key>${k}</key>\\s*(<string>[\\s\\S]*?</string>|<true/>|<false/>|<array>[\\s\\S]*?</array>)`);
  p = re.test(p) ? p.replace(re, `\n\t<key>${k}</key>\n\t${xml}`) : p.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n\t<key>${k}</key>\n\t${xml}\n</dict>\n</plist>\n`);
};
for (const [k, v] of Object.entries(KEYS)) setKey(k, `<string>${esc(v)}</string>`);
setKey("CFBundleDevelopmentRegion", "<string>fr</string>");
setKey("ITSAppUsesNonExemptEncryption", "<false/>"); // HTTPS seulement : pas de déclaration d'export à faire
setKey("UIRequiredDeviceCapabilities", "<array>\n\t\t<string>arm64</string>\n\t</array>");
setKey("UISupportedInterfaceOrientations", "<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>");
fs.writeFileSync(plist, p);

// Apple Santé : droit HealthKit (lecture seulement)
fs.writeFileSync(path.join(app, "App", "App.entitlements"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.healthkit</key>
	<true/>
	<key>com.apple.developer.healthkit.access</key>
	<array/>
</dict>
</plist>
`);
let x = fs.readFileSync(pbx, "utf8");
// la cible App : réglages qui portent INFOPLIST_FILE = App/Info.plist
x = x.replace(/(buildSettings = \{[^}]*?INFOPLIST_FILE = App\/Info\.plist;[^}]*?\};)/g, block => {
  let b = block.replace(/TARGETED_DEVICE_FAMILY = "1,2";/, "TARGETED_DEVICE_FAMILY = 1;");
  if (!/CODE_SIGN_ENTITLEMENTS/.test(b)) b = b.replace(/(\t+)CODE_SIGN_STYLE = Automatic;/, "$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n$1CODE_SIGN_STYLE = Automatic;");
  return b;
});
fs.writeFileSync(pbx, x);
const n = (x.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || []).length;
console.log(`Projet iPhone réglé : autorisations, Apple Santé (${n} configurations), iPhone en portrait.`);
if (n < 2) { console.error("Réglage HealthKit introuvable dans le projet Xcode."); process.exit(1); }
