// Comptes (pseudo + code en chiffres) et synchronisation en ligne.
// - En ligne (Supabase configuré dans config.js) : le compte et ses données sont
//   sur le serveur, on peut se connecter depuis n'importe quel téléphone.
// - Sinon : les comptes existent seulement sur cet appareil.
// Dans les deux cas, chaque appareil garde une copie locale pour marcher hors ligne.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { state, setUser, clearUser, save, readLocal, setSaveHook, currentUser, publicSummary } from "./store.js";

export const isOnlineMode = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/;
export const PIN_RE = /^[0-9]{4,6}$/;

const REG = "greatness.accounts";
const LAST = "greatness.lastUser";
export const MESSAGES = {
  USERNAME_INVALID: "Pseudo invalide : 3 à 20 caractères (lettres, chiffres, . _ -).",
  PIN_INVALID: "Le code doit faire 4 à 6 chiffres.",
  USERNAME_TAKEN: "Ce pseudo est déjà pris.",
  BAD_CREDENTIALS: "Pseudo ou code incorrect.",
  LOCKED: "Trop d'essais. Réessaie dans 15 minutes.",
  NOT_FOUND: "Aucun compte avec ce pseudo sur cet appareil.",
  OFFLINE: "Pas de connexion internet. Connecte-toi une première fois en ligne sur cet appareil.",
  SERVER: "Le serveur ne répond pas. Réessaie dans un instant.",
};
const fail = code => Object.assign(new Error(MESSAGES[code] || code), { code });

/* ---------- Registre local des comptes connus sur l'appareil ---------- */
export function registry() {
  try { return JSON.parse(localStorage.getItem(REG) || "{}"); } catch { return {}; }
}
function writeRegistry(r) { localStorage.setItem(REG, JSON.stringify(r)); }
function updateEntry(u, patch) { const r = registry(); r[u] = { ...r[u], ...patch }; writeRegistry(r); }
export const lastUser = () => localStorage.getItem(LAST);
export function forget(u) {
  const r = registry(); delete r[u]; writeRegistry(r);
  localStorage.removeItem(`greatness.data.${u}`);
  if (lastUser() === u) localStorage.removeItem(LAST);
}

export const normalize = u => String(u || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");

async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");

async function rememberPin(u, pin, extra = {}) {
  const salt = newSalt();
  updateEntry(u, { salt, hash: await hashPin(pin, salt), len: pin.length, ...extra });
}
async function checkLocalPin(u, pin) {
  const e = registry()[u];
  return !!e?.hash && (await hashPin(pin, e.salt)) === e.hash;
}

/* ---------- Appels serveur ---------- */
async function rpc(fn, args) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        // anciennes clés "anon" (JWT) : à mettre aussi en Authorization ; les nouvelles clés "publishable" non
        ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
  } catch {
    throw fail("OFFLINE");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw fail("SERVER");
  return body;
}

/* ---------- Comptes ---------- */
export async function createAccount(username, pin, { importData } = {}) {
  const u = normalize(username);
  if (!USERNAME_RE.test(u)) throw fail("USERNAME_INVALID");
  if (!PIN_RE.test(pin)) throw fail("PIN_INVALID");
  let token = null;
  if (isOnlineMode()) {
    const r = await rpc("gt_signup", { p_username: u, p_pin: pin });
    if (r?.error) throw fail(r.error);
    token = r.token;
  } else if (registry()[u]) {
    throw fail("USERNAME_TAKEN");
  }
  await rememberPin(u, pin, { token, display: username.trim() });
  localStorage.setItem(LAST, u);
  setUser(u, importData || { profile: { name: capitalize(username.trim()) } });
  save();
  return u;
}

// Connexion ou déverrouillage. Vérifie d'abord le code sur l'appareil (rapide, hors ligne),
// sinon demande au serveur (nouvel appareil, ou code changé ailleurs).
export async function login(username, pin) {
  const u = normalize(username);
  if (!PIN_RE.test(pin)) throw fail("BAD_CREDENTIALS");
  const entry = registry()[u];
  const localOk = await checkLocalPin(u, pin);

  if (localOk && (!isOnlineMode() || entry?.token)) {
    open(u);
    if (isOnlineMode()) pull().catch(() => {});
    return u;
  }
  if (!isOnlineMode()) throw fail(entry ? "BAD_CREDENTIALS" : "NOT_FOUND");

  let r;
  try {
    r = await rpc("gt_login", { p_username: u, p_pin: pin });
  } catch (e) {
    if (localOk) { open(u); return u; } // hors ligne : on ouvre la copie locale
    throw e;
  }
  if (r?.error) throw fail(r.error);
  await rememberPin(u, pin, { token: r.token, display: entry?.display || username.trim() });
  open(u);
  await applyRemote(r.data);
  return u;
}

function open(u) {
  localStorage.setItem(LAST, u);
  setUser(u);
  setStatus(isOnlineMode() ? "syncing" : "local");
}

export function logout() {
  flush();
  clearUser();
}

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Synchronisation ---------- */
let status = "local", listeners = [], pushTimer = null, dirty = false, onRemote = null;
export const syncStatus = () => status;
export const onSyncStatus = fn => listeners.push(fn);
export const onRemoteUpdate = fn => (onRemote = fn);
function setStatus(s) { status = s; listeners.forEach(fn => fn(s)); }

const token = () => registry()[currentUser]?.token;

// Applique les données du serveur si elles sont plus récentes que la copie locale.
async function applyRemote(remote) {
  if (!currentUser) return;
  const remoteAt = remote?.meta?.updatedAt || 0;
  if (remote && remoteAt > (state.meta?.updatedAt || 0)) {
    const aiKey = state.profile.aiKey; // la clé API reste sur l'appareil
    setUser(currentUser, { ...remote, profile: { ...remote.profile, aiKey } });
    save({ silent: true });
    setStatus("synced");
    onRemote?.();
  } else if ((state.meta?.updatedAt || 0) > remoteAt) {
    await push();
  } else {
    setStatus("synced");
  }
}

export async function pull() {
  if (!isOnlineMode() || !currentUser) return;
  const t = token();
  if (!t) return setStatus("error");
  setStatus("syncing");
  try {
    const r = await rpc("gt_pull", { p_token: t });
    if (r?.error) { updateEntry(currentUser, { token: null }); return setStatus("error"); }
    await applyRemote(r.data);
  } catch {
    setStatus("offline");
  }
}

export async function push() {
  if (!isOnlineMode() || !currentUser) return;
  const t = token();
  if (!t) return setStatus("error");
  clearTimeout(pushTimer);
  const data = structuredClone(state);
  data.profile.aiKey = "";
  data.public = publicSummary();
  setStatus("syncing");
  try {
    const r = await rpc("gt_push", { p_token: t, p_data: data });
    if (r?.error) { updateEntry(currentUser, { token: null }); dirty = true; return setStatus("error"); }
    dirty = false;
    setStatus("synced");
  } catch {
    dirty = true;
    setStatus("offline");
  }
}

function flush() { if (dirty || pushTimer) { clearTimeout(pushTimer); pushTimer = null; push(); } }

setSaveHook(() => {
  if (!isOnlineMode()) return;
  dirty = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; push(); }, 1500);
});
addEventListener("online", () => { if (dirty) push(); else pull(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); else if (currentUser) pull(); });

// Changer de code (en ligne : sur le serveur aussi).
export async function changePin(oldPin, newPin) {
  if (!PIN_RE.test(newPin)) throw fail("PIN_INVALID");
  if (!(await checkLocalPin(currentUser, oldPin))) throw fail("BAD_CREDENTIALS");
  if (isOnlineMode()) {
    const r = await rpc("gt_change_pin", { p_token: token(), p_old: oldPin, p_new: newPin });
    if (r?.error) throw fail(r.error);
  }
  await rememberPin(currentUser, newPin, { token: token() });
}

export function knownAccounts() {
  const r = registry();
  return Object.keys(r).map(u => ({ username: u, display: r[u].display || u, len: r[u].len || 4, name: readLocal(u)?.profile?.name || r[u].display || u }));
}

// Appels "amis" (comptes en ligne uniquement).
export async function friendCall(fn, args = {}) {
  if (!isOnlineMode()) throw fail("OFFLINE_MODE");
  const t = token();
  if (!t) throw fail("BAD_TOKEN");
  const r = await rpc(fn, { p_token: t, ...args });
  if (r?.error) throw fail(r.error === "NOT_FOUND" ? "FRIEND_NOT_FOUND" : r.error);
  return r;
}
Object.assign(MESSAGES, {
  SELF: "C'est ton propre pseudo !",
  FRIEND_NOT_FOUND: "Aucun compte avec ce pseudo.",
  TOO_MANY: "Trop de demandes en attente.",
  BAD_TOKEN: "Reconnecte-toi (verrouille puis retape ton code).",
  OFFLINE_MODE: "Les amis nécessitent les comptes en ligne.",
});
