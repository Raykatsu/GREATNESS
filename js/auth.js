// Écran de connexion : choix du compte, pavé numérique, création de compte.
import { knownAccounts, lastUser, login, createAccount, isOnlineMode, normalize, USERNAME_RE, PIN_RE, forget } from "./cloud.js";
import { legacyData, LEGACY_KEY } from "./store.js";
import { spidey } from "./spidey.js";
import { $, $$, esc, I, spider, toast, confirmSheet } from "./ui.js";

let view, done, mode, ctx, sayTimer;
// Petite phrase de Spider-Man, annulée si on change d'écran entre-temps.
const sayLater = (text, ms, opts) => { clearTimeout(sayTimer); sayTimer = setTimeout(() => spidey.say(text, opts), ms); };

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
  spidey.hideBubble();
  mode = m; ctx = { pin: "", ...c };
  view.className = "view";
  void view.offsetWidth;
  view.className = "view enter auth";
  ({ welcome, pick, pin: pinScreen, login: loginScreen, signup, choose: choosePin, confirm: confirmPin })[m]();
}

const avatar = (name, big) => `<div class="avatar ${big ? "big" : ""}">${esc((name || "?").charAt(0).toUpperCase())}</div>`;
const header = (title, sub) => `<div class="logo" style="justify-content:center">${spider()}GREATNESS</div>
  <h1 class="h1 center mt">${title}</h1>${sub ? `<p class="muted center small">${sub}</p>` : ""}`;

function welcome() {
  view.innerHTML = `<div class="onb">${header("Bienvenue", "Chaque personne a son compte, ses séances et ses stats, protégés par un code secret.")}
    <button class="btn btn-primary btn-lg btn-block mt-l" id="new">Créer mon compte</button>
    <button class="btn btn-soft btn-lg btn-block mt-s" id="have">J'ai déjà un compte</button>
    ${isOnlineMode() ? `<p class="xs dim center mt">Ton compte est synchronisé : retrouve-le sur n'importe quel téléphone.</p>` : `<p class="xs dim center mt">Les comptes sont enregistrés sur cet appareil.</p>`}</div>`;
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
  const dots = n => Array.from({ length: n }, (_, i) => `<i class="${i < ctx.pin.length ? "on" : ""}"></i>`).join("");
  const draw = () => { $("#dots").innerHTML = dots(len || Math.max(4, Math.min(max, ctx.pin.length + (ctx.pin.length < max ? 1 : 0)))); onChange?.(); };
  const html = `<div class="dots" id="dots"></div>
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
  setTimeout(() => $$("#dots i").forEach(i => i.classList.remove("on")), 350);
  if (msg) { const e = $("#err"); if (e) e.textContent = msg; }
}

async function attempt(fn) {
  const spin = $("#busy");
  spin?.classList.remove("hidden");
  try { await fn(); } catch (e) { shake(e.message); spidey.react("alert"); } finally { spin?.classList.add("hidden"); }
}

function pinScreen() {
  const u = ctx.user;
  const kp = keypad({ len: u.len, onDone: pin => attempt(async () => { await login(u.username, pin); finish(); }) });
  view.innerHTML = `<div class="onb lock">${avatar(u.name, true)}<h1 class="h2 center mt">Salut ${esc(u.name)} !</h1>
    <p class="muted center small">Tape ton code secret</p>${kp.html}
    <p class="err center" id="err"></p><div class="center"><span class="spinner hidden" id="busy"></span></div>
    <div class="row between mt"><button class="btn btn-ghost btn-sm" id="switch">Changer de compte</button><button class="btn btn-ghost btn-sm" id="forgot">Code oublié ?</button></div></div>`;
  kp.bind();
  $("#switch").onclick = () => go(knownAccounts().length > 1 ? "pick" : "welcome");
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
    await login(u, pin); finish();
  });
  view.innerHTML = `<div class="onb lock">${header("Connexion", isOnlineMode() ? "Ton pseudo et ton code, depuis n'importe quel téléphone." : "Compte enregistré sur cet appareil.")}
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

function finish(created) {
  onkeydown = null;
  view.classList.remove("auth");
  spidey.react("party");
  if (created) toast("Compte créé ✓");
  done?.(created);
}
