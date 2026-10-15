// Déverrouillage par Face ID ou Touch ID, à la place du code secret. Sur le site : une clé d'accès (WebAuthn) créée
// pour ce compte sur ce téléphone, que seuls ton visage ou ton doigt débloquent ; dans l'app App Store : la
// biométrie de l'iPhone. Rien ne quitte le téléphone, et le code secret marche toujours.
import { isNative, nativeBio, nativeBioVerify } from "./native.js";

export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));

// Données de l'authentificateur, octet 32 : bit 0 = présence, bit 2 = vérification (visage, doigt ou code du téléphone)
export const userVerified = data => { const f = new Uint8Array(data)[32]; return !!(f & 1) && !!(f & 4); };

// Ce que le téléphone sait faire : « Face ID », « Touch ID »… ou null
export function webBioName(ua = "", screenMax = 0) {
  if (/iPhone|iPod/.test(ua)) return screenMax >= 780 ? "Face ID" : "Touch ID"; // iPhone sans bouton d'accueil : Face ID
  if (/iPad/.test(ua)) return "Face ID ou Touch ID";
  if (/Macintosh/.test(ua)) return "Touch ID";
  if (/Windows/.test(ua)) return "Windows Hello";
  return "ton empreinte";
}
let cached;
export async function bioName() {
  if (cached !== undefined) return cached;
  if (isNative()) return (cached = await nativeBio());
  try {
    const ok = !!window.PublicKeyCredential && window.isSecureContext && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    cached = ok ? webBioName(navigator.userAgent, Math.max(screen.width, screen.height)) : null;
  } catch { cached = null; }
  return cached;
}

// Activer pour ce compte : renvoie ce qu'il faut garder sur l'appareil (à passer à bioVerify)
export async function bioEnroll(username, display) {
  if (isNative()) {
    if (!(await nativeBioVerify(`Activer ${(await bioName()) || "Face ID"} pour GREATNESS`))) throw new Error("Activation annulée.");
    return { kind: "native" };
  }
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rand(32),
    rp: { name: "GREATNESS" },
    user: { id: rand(16), name: username, displayName: display || username },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
    timeout: 60000, attestation: "none",
  } });
  if (!cred) throw new Error("Activation annulée.");
  return { kind: "web", id: b64u(cred.rawId) };
}

// Ton visage ou ton doigt : true si c'est bien toi (une demande à la fois)
let pending = null;
export function bioVerify(bio) {
  if (!bio) return Promise.resolve(false);
  return (pending ||= check(bio).finally(() => { pending = null; }));
}
async function check(bio) {
  if (bio.kind === "native") return isNative() && nativeBioVerify("Déverrouiller GREATNESS");
  const a = await navigator.credentials.get({ publicKey: {
    challenge: rand(32), allowCredentials: [{ type: "public-key", id: fromB64u(bio.id), transports: ["internal"] }],
    userVerification: "required", timeout: 60000,
  } });
  return !!a && b64u(a.rawId) === bio.id && userVerified(a.response.authenticatorData);
}
