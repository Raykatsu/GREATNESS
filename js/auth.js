// Écran de connexion : choix du compte, pavé numérique, création de compte.
import { knownAccounts, lastUser, login, createAccount, isOnlineMode, normalize, USERNAME_RE, PIN_RE, forget, bioOf, setBio, bioAsked, unlockKnown } from "./cloud.js";
import { bioName, bioEnroll, bioVerify } from "./bio.js";
import { legacyData, LEGACY_KEY } from "./store.js";
import { mascot } from "./mascot.js";
import { ringsSvg } from "./fx.js";
import { $, $$, esc, I, coachIcon, toast, confirmSheet, sheet } from "./ui.js";

let view, done, mode, ctx, sayTimer;
// Petite phrase du coach, annulée si on change d'écran entre-temps.
const sayLater = (text, ms, opts) => { clearTimeout(sayTimer); sayTimer = setTimeout(() => mascot.say(text, opts), ms); };

export function showAuth(container, onUnlocked) {
  view = container;
  done = onUnlocked;
  document.body.classList.add("hide-tabs");
  const accounts = knownAccounts();
  const last = lastUser();
  if (last && accounts.some(a => a.username === last)) go("pin", { user: accounts.find(a => a.username === last) });
  else if (accounts.length) go("pick");
  else go("welcome");
}

function go(m, c = {}) {
  clearTimeout(sayTimer);
  mascot.hideBubble();
  mode = m; ctx = { pin: "", ...c };
  view.className = "view";
  void view.offsetWidth;
  view.className = "view enter auth";
  ({ welcome, pick, pin: pinScreen, login: loginScreen, signup, choose: choosePin, confirm: confirmPin })[m]();
}

const avatar = (name, big) => `<div class="avatar ${big ? "big" : ""}">${esc((name || "?").charAt(0).toUpperCase())}</div>`;
// Emblème : le visage du coach entouré d'anneaux, en grand (accueil) ou en petit (autres écrans)
export const emblem = (big = false) => `<div class="auth-emblem ${big ? "big" : ""}" aria-hidden="true">${ringsSvg("auth-orn", [13, 25, 37, 49])}<span class="auth-mark">${coachIcon()}</span></div>`;
const header = (title, sub) => `${emblem()}<h1 class="h1 center auth-title">${title}</h1>${sub ? `<p class="muted center small auth-sub">${sub}</p>` : ""}`;

function welcome() {
  view.innerHTML = `<div class="onb auth-welcome">
    <div class="auth-hero">${emblem(true)}
      <div class="auth-word">GREATNESS</div>
      <h1 class="h1 center">Ton coach de poche.<br/><span class="accent">Prêt quand tu l'es.</span></h1>
      <p class="muted center auth-sub">Séances guidées, charges ajustées à chaque série, records et défis entre amis.</p>
    </div>
    <div class="auth-cta">
      <button class="btn btn-primary btn-lg btn-block" id="new">Créer mon compte</button>
      <button class="btn btn-soft btn-lg btn-block mt-s" id="have">J'ai déjà un compte</button>
      <p class="xs dim center auth-note">${isOnlineMode() ? "Ton compte est synchronisé : retrouve-le sur n'importe quel téléphone." : "Les comptes sont enregistrés sur cet appareil, protégés par un code secret."}</p>
    </div></div>`;
  $("#new").onclick = () => go("signup");
  $("#have").onclick = () => go("login");
  sayLater("Salut ! Crée ton compte, je m'occupe du reste.", 900, { mood: "happy" });
}

function pick() {
  const accounts = knownAccounts();
  view.innerHTML = `<div class="onb">${header("Qui s'entraîne ?")}
    <div class="accounts mt-l">${accounts.map(a => `<button class="account" data-u="${esc(a.username)}">${avatar(a.name)}<div class="grow"><b>${esc(a.name)}</b><span>@${esc(a.username)}</span></div>${I.chev}</button>`).join("")}</div>
    <div class="grid2 mt"><button class="btn btn-soft" id="have">Autre compte</button><button class="btn btn-soft" id="new">${I.plus} Nouveau</button></div></div>`;
  $$(".account").forEach(b => b.onclick = () => go("pin", { user: accounts.find(a => a.username === b.dataset.u) }));
  $("#new").onclick = () => go("signup");
  $("#have").onclick = () => go("login");
}

/* ---------- Pavé numérique ---------- */
function keypad({ max = 6, len, onDone, onChange }) {
  // Les points existants sont mis à jour (pas recréés) : le remplissage s'anime en douceur.
  const draw = () => {
    const box = $("#dots"), n = len || Math.max(4, Math.min(max, ctx.pin.length + (ctx.pin.length < max ? 1 : 0)));
    while (box.children.length < n) box.append(document.createElement("i"));
    while (box.children.length > n) box.lastElementChild.remove();
    [...box.children].forEach((d, i) => d.classList.toggle("on", i < ctx.pin.length));
    onChange?.();
  };
  const html = `<div class="dots" id="dots" aria-live="polite"></div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join("")}
      <button data-k="del" aria-label="Effacer">${I.back}</button><button data-k="0">0</button>
      <button data-k="ok" class="ok" aria-label="Valider">${I.check}</button></div>`;
  const bind = () => {
    const press = k => {
      if (k === "del") ctx.pin = ctx.pin.slice(0, -1);
      else if (k === "ok") return ctx.pin.length >= 4 && onDone(ctx.pin);
      else if (ctx.pin.length < (len || max)) ctx.pin += k;
      navigator.vibrate?.(6);
      draw();
      if (len && ctx.pin.length === len) setTimeout(() => onDone(ctx.pin), 120);
    };
    $$(".keypad button").forEach(b => b.onclick = () => press(b.dataset.k));
    // clavier physique
    onkeydown = e => {
      if (!view.classList.contains("auth")) return (onkeydown = null);
      if (document.activeElement?.tagName === "INPUT") return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    };
    draw();
  };
  return { html, bind };
}

function shake(msg) {
  const d = $("#dots");
  d?.classList.remove("shake"); void d?.offsetWidth; d?.classList.add("shake");
  navigator.vibrate?.([40, 30, 40]);
  ctx.pin = "";
  setTimeout(() => { $$("#dots i").forEach(i => i.classList.remove("on")); d?.classList.remove("shake"); }, 420);
  const e = $("#err");
  if (msg && e) { e.textContent = msg; e.classList.remove("show"); void e.offsetWidth; e.classList.add("show"); }
}

async function attempt(fn) {
  const spin = $("#busy");
  spin?.classList.remove("hidden");
  try { await fn(); } catch (e) { shake(e.message); mascot.react("alert"); } finally { spin?.classList.add("hidden"); }
}

function pinScreen() {
  const u = ctx.user, bio = bioOf(u.username);
  const kp = keypad({ len: u.len, onDone: pin => attempt(async () => { await login(u.username, pin); finish(false, u); }) });
  view.innerHTML = `<div class="onb lock">${avatar(u.name, true)}<h1 class="h2 center auth-title">Salut ${esc(u.name)} !</h1>
    <p class="muted center small auth-sub">Tape ton code secret</p>${kp.html}
    <p class="err center" id="err"></p><div class="center auth-busy"><span class="spinner hidden" id="busy"></span></div>
    ${bio ? `<button class="btn btn-soft btn-block bio-btn hidden" id="bio">${I.face}<span>Déverrouiller avec <b id="bio-name">Face ID</b></span></button>` : ""}
    <div class="auth-links"><button class="btn btn-ghost btn-sm" id="switch">Changer de compte</button><button class="btn btn-ghost btn-sm" id="forgot">Code oublié ?</button></div></div>`;
  kp.bind();
  $("#switch").onclick = () => go(knownAccounts().length > 1 ? "pick" : "welcome");
  // Face ID / Touch ID : proposé tout de suite (sans geste, le navigateur peut refuser : on attend alors le bouton)
  if (bio) bioName().then(name => {
    const b = $("#bio");
    if (!name || !b || mode !== "pin" || ctx.user !== u) return;
    $("#bio-name").textContent = name;
    b.classList.remove("hidden");
    const unlock = auto => bioVerify(bio)
      .then(async ok => { if (!ok) throw new Error("refusé"); await unlockKnown(u.username); if (mode === "pin") finish(); })
      .catch(e => {
        if (mode !== "pin") return;
        if (e?.code === "BAD_CREDENTIALS") shake("Tape ton code une fois pour te reconnecter.");
        else if (!auto) shake(`${name} n'a pas marché : tape ton code.`);
      });
    b.onclick = () => unlock(false);
    unlock(true);
  });
  $("#forgot").onclick = async () => {
    if (isOnlineMode()) return toast("Demande à l'administrateur de l'app de réinitialiser ton code.", 4500);
    if (await confirmSheet("Code oublié ?", "Sur cet appareil, le seul moyen est de supprimer ce compte et ses données, puis d'en recréer un.", "Supprimer ce compte", true)) {
      forget(u.username); go(knownAccounts().length ? "pick" : "welcome");
    }
  };
}

function loginScreen() {
  const kp = keypad({ max: 6, onDone: pin => submit(pin), onChange: () => { const b = $("#go"); if (b) b.disabled = ctx.pin.length < 4; } });
  const submit = pin => attempt(async () => {
    const u = $("#user").value;
    if (!u.trim()) throw new Error("Entre ton pseudo.");
    await login(u, pin); finish(false, { username: normalize(u), name: u.trim() });
  });
  view.innerHTML = `<div class="onb lock compact">${header("Connexion", isOnlineMode() ? "Ton pseudo et ton code, depuis n'importe quel téléphone." : "Compte enregistré sur cet appareil.")}
    <label class="field mt"><span>Pseudo</span><input class="input" id="user" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(ctx.prefill || "")}"/></label>
    <p class="muted small center mt">Code secret</p>${kp.html}<p class="err center" id="err"></p>
    <button class="btn btn-primary btn-block mt-s" id="go" disabled>Se connecter <span class="spinner hidden" id="busy"></span></button>
    <button class="btn btn-ghost btn-block mt-s" id="back">${I.back} Retour</button></div>`;
  kp.bind();
  $("#go").onclick = () => submit(ctx.pin);
  $("#back").onclick = () => go(knownAccounts().length ? "pick" : "welcome");
}

function signup() {
  const legacy = legacyData();
  view.innerHTML = `<div class="onb">${header("Crée ton compte", "Choisis un pseudo, puis un code secret en chiffres.")}
    <label class="field mt-l"><span>Pseudo</span><input class="input" id="user" placeholder="ex. miles_m" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" value="${esc(ctx.username || "")}"/></label>
    <p class="xs dim mt-s">3 à 20 caractères : lettres, chiffres, point, tiret ou _. C'est avec lui que tu te connecteras.</p>
    ${legacy ? `<label class="toggle card mt" style="padding:12px 16px"><div><b>Récupérer mes séances</b><span class="xs muted">Importer les données déjà présentes sur ce téléphone (${esc(legacy.profile.name)}, ${legacy.sessions?.length || 0} séances)</span></div><input type="checkbox" id="imp" checked/></label>` : ""}
    <p class="err" id="err"></p>
    <button class="btn btn-primary btn-lg btn-block mt" id="next">Continuer</button>
    <button class="btn btn-ghost btn-block mt-s" id="back">${I.back} Retour</button></div>`;
  $("#user").focus();
  $("#user").onkeydown = e => { if (e.key === "Enter") $("#next").click(); };
  $("#next").onclick = () => {
    const u = normalize($("#user").value);
    if (!USERNAME_RE.test(u)) return ($("#err").textContent = "Pseudo invalide : 3 à 20 caractères (lettres, chiffres, . _ -).");
    go("choose", { username: $("#user").value.trim(), importLegacy: legacy && ($("#imp")?.checked ?? false) });
  };
  $("#back").onclick = () => go(knownAccounts().length ? "pick" : "welcome");
}

function choosePin() {
  const keep = { username: ctx.username, importLegacy: ctx.importLegacy };
  const kp = keypad({ max: 6, onDone: pin => go("confirm", { ...keep, first: pin }), onChange: () => { const b = $("#go"); if (b) b.disabled = ctx.pin.length < 4; } });
  view.innerHTML = `<div class="onb lock">${header("Ton code secret", "4 à 6 chiffres. Tu le taperas à chaque ouverture de l'app.")}
    ${kp.html}<p class="err center" id="err"></p>
    <button class="btn btn-primary btn-block" id="go" disabled>Valider</button>
    <button class="btn btn-ghost btn-block mt-s" id="back">${I.back} Retour</button></div>`;
  kp.bind();
  $("#go").onclick = () => PIN_RE.test(ctx.pin) && go("confirm", { ...keep, first: ctx.pin });
  $("#back").onclick = () => go("signup", keep);
  sayLater("Choisis un code que toi seul connais. Pas 1234 !", 600);
}

function confirmPin() {
  const { username, first, importLegacy } = ctx;
  const kp = keypad({ len: first.length, onDone: pin => {
    if (pin !== first) return shake("Les deux codes ne sont pas identiques.");
    attempt(async () => {
      const legacy = importLegacy ? legacyData() : null;
      await createAccount(username, pin, { importData: legacy ? { ...legacy, profile: { ...legacy.profile, onboarded: true } } : null });
      if (legacy) localStorage.removeItem(LEGACY_KEY);
      finish(true);
    });
  } });
  view.innerHTML = `<div class="onb lock">${header("Confirme ton code")}${kp.html}<p class="err center" id="err"></p>
    <div class="center"><span class="spinner hidden" id="busy"></span></div>
    <button class="btn btn-ghost btn-block mt" id="back">${I.back} Recommencer</button></div>`;
  kp.bind();
  $("#back").onclick = () => go("choose", { username, importLegacy });
}

function finish(created, pinUser) {
  onkeydown = null;
  view.classList.remove("auth");
  mascot.react("party");
  if (created) toast("Compte créé ✓");
  done?.(created);
  if (pinUser) setTimeout(() => offerBio(pinUser), 1400);
}

// Après un code tapé : proposer Face ID / Touch ID une fois par compte et par appareil
async function offerBio(u) {
  if (bioOf(u.username) || bioAsked(u.username) || document.querySelector(".sheet-wrap, .live")) return;
  const name = await bioName();
  if (!name) return;
  const sh = sheet(`<div class="bio-offer"><span class="bio-ic" aria-hidden="true">${I.face}</span>
    <h2 class="h2">Déverrouiller avec ${esc(name)} ?</h2>
    <p class="muted small">La prochaine fois, un regard suffit : plus besoin de taper ton code. Rien ne quitte ton téléphone, et ton code marche toujours.</p>
    <button class="btn btn-primary btn-lg btn-block mt" id="bio-yes">Activer ${esc(name)}</button>
    <button class="btn btn-ghost btn-block mt-s" id="bio-no">Plus tard</button></div>`, { z: 70 });
  $("#bio-no", sh.el).onclick = () => { setBio(u.username, null); sh.close(); };
  // la demande part dans le geste (sinon Safari la refuse)
  $("#bio-yes", sh.el).onclick = () => bioEnroll(u.username, u.name)
    .then(b => { setBio(u.username, b); sh.close(); toast(`${name} activé ✓`); })
    .catch(() => toast(`${name} n'a pas pu être activé. Réessaie dans Moi → Réglages → Compte.`, 4500));
}
