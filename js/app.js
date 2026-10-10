import { PROGRAMS, EXERCISES, QUOTES, RANKS } from "./data.js";
import { state, save, resetAll, totalXp, rankInfo, streak, weekVolume, recordLift, e1rm } from "./store.js";
import { Session, readinessScore, readinessVerdict, suggestProgram } from "./engine.js";
import { aiReady, aiAdjust, aiBrief, aiDebrief, aiChat, testKey, resetClient } from "./ai.js";
import { speak, beep, thwipSound, vibrate, burst, startBackground } from "./fx.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $("#view");
const overlay = $("#overlay");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const spider = (cls = "") => `<svg class="${cls}" viewBox="0 0 64 64"><use href="#spider"/></svg>`;
const webSvg = cls => `<svg class="${cls}" viewBox="-50 -50 100 100" fill="none" stroke="currentColor" stroke-width=".6">
  ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="0" y1="0" x2="${50 * Math.cos(a)}" y2="${50 * Math.sin(a)}"/>`; }).join("")}
  ${[10, 20, 30, 40, 50].map(r => `<polygon points="${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `${r * Math.cos(a)},${r * Math.sin(a)}`; }).join(" ")}"/>`).join("")}
</svg>`;
const ARROW = `<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z"/></svg>`;

function toast(msg, ms = 2400) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove("show"), ms);
}

/* =========================================================
   Router
   ========================================================= */
const routes = { "": home, train, coach, history, profile };
function route() {
  const key = location.hash.replace(/^#\/?/, "");
  const fn = routes[key] || home;
  $$(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === (key || "home")));
  view.innerHTML = "";
  fn();
  window.scrollTo({ top: 0 });
}
addEventListener("hashchange", route);

/* =========================================================
   QG (accueil)
   ========================================================= */
function home() {
  const name = state.profile.name;
  if (!name) return onboarding();
  const r = rankInfo();
  const vol = weekVolume();
  const max = Math.max(1, ...vol.map(v => v.vol));
  const next = suggestProgram(PROGRAMS);
  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const C = 2 * Math.PI * 40;
  const hour = new Date().getHours();
  const greet = hour < 6 ? "Patrouille de nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Salut" : "Bonsoir";
  const weekSessions = state.sessions.filter(s => Date.now() - s.date < 7 * 864e5).length;

  view.innerHTML = `
    <section class="hero">
      <div class="row between">
        <div class="greet">${greet}, <b>${esc(name)}</b></div>
        <span class="chip ${aiReady() ? "blue" : ""}"><span class="status-dot ${aiReady() ? "" : "off"}"></span> KAREN ${aiReady() ? "IA" : "locale"}</span>
      </div>
      <h1 class="h-display glitch" data-text="GREATNESS">GREATNESS</h1>
      <p class="quote mt-s">${quote}</p>
    </section>

    <section class="card glow-red rank-card mt">
      <div class="ring">
        <svg viewBox="0 0 100 100">
          <defs><linearGradient id="grad-rb" x1="0" x2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="1" stop-color="#ff2340"/></linearGradient></defs>
          <circle class="track" cx="50" cy="50" r="40"/>
          <circle class="bar" cx="50" cy="50" r="40" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-target="${C * (1 - r.pct)}"/>
        </svg>
        ${spider("emblem")}
        <div class="inner"><div><b>${r.level}</b><br><small>NIVEAU</small></div></div>
      </div>
      <div>
        <div class="eyebrow">Rang actuel</div>
        <div class="h-display" style="font-size:30px;margin-top:4px">${r.rank.name}</div>
        <div class="muted small mt-s">${r.xp} XP ${r.next ? `· encore ${r.next.xp - r.xp} XP pour <b style="color:var(--text)">${r.next.name}</b>` : "· rang maximum"}</div>
      </div>
      ${webSvg("web-corner")}
    </section>

    <section class="grid3 mt">
      <div class="card stat"><b>${streak()}</b><span>Jours d'affilée</span></div>
      <div class="card stat"><b>${weekSessions}</b><span>Séances / 7j</span></div>
      <div class="card stat"><b>${state.sessions.reduce((a, s) => a + (s.prs?.length || 0), 0)}</b><span>Records</span></div>
    </section>

    <section class="card cta-card mt">
      <div class="eyebrow">Mission du jour · conseillée par KAREN</div>
      <div class="h-display mt-s">${next.name}</div>
      <div class="muted">${next.tag} · ${next.exercises.length} exercices</div>
      <button class="btn btn-primary btn-block mt" id="go">${spider("")}<span>Lancer la mission</span></button>
      ${webSvg("web-corner")}
    </section>

    <section class="card mt">
      <div class="row between"><div class="eyebrow">Volume · 7 derniers jours</div><span class="small dim">kg × reps</span></div>
      <div class="bars">
        ${vol.map((v, i) => `<div class="b ${v.today ? "today" : ""}"><div class="fill" style="height:${Math.max(3, (v.vol / max) * 100)}%;animation-delay:${i * 60}ms" title="${v.vol} kg"></div><span>${v.day}</span></div>`).join("")}
      </div>
    </section>
  `;
  $("#go").onclick = () => openReadiness(next);
  $("#go svg").style.cssText = "width:26px;height:26px";
  requestAnimationFrame(() => setTimeout(() => {
    const bar = $(".ring .bar");
    if (bar) bar.style.strokeDashoffset = bar.dataset.target;
  }, 120));
}

function onboarding() {
  view.innerHTML = `
    <section class="hero center" style="padding-top:40px">
      <div style="width:110px;height:110px;margin:0 auto;color:var(--red);filter:drop-shadow(0 0 30px rgba(255,35,64,.6))">${spider("")}</div>
      <h1 class="h-display glitch mt" data-text="GREATNESS" style="font-size:64px">GREATNESS</h1>
      <p class="quote mt-s" style="display:inline-block">Un grand pouvoir implique de grandes responsabilités.</p>
    </section>
    <section class="card glow-red mt">
      <div class="eyebrow">Identification</div>
      <p class="muted">Je suis <b style="color:var(--text)">KAREN</b>, ton IA d'entraînement. Je pilote tes séances, j'ajuste tes charges en temps réel et je te donne les consignes. Comment je t'appelle ?</p>
      <label class="field"><span>Ton nom de héros</span><input class="input" id="name" placeholder="Peter, Miles, Gwen…" autocomplete="off"/></label>
      <label class="field"><span>Poids de corps (kg)</span><input class="input" id="bw" type="number" inputmode="decimal" value="${state.profile.bodyweight}"/></label>
      <button class="btn btn-primary btn-block mt" id="start">Enfiler le masque</button>
    </section>`;
  $("#start").onclick = () => {
    const n = $("#name").value.trim();
    if (!n) return toast("Il me faut un nom, héros.");
    state.profile.name = n.slice(0, 30);
    state.profile.bodyweight = +$("#bw").value || 75;
    save();
    burst("THWIP!", innerWidth / 2, innerHeight / 2);
    thwipSound();
    speak(`Bienvenue ${n}. Je suis Karen. On commence quand tu veux.`);
    route();
  };
}

/* =========================================================
   Séances (programmes)
   ========================================================= */
function train() {
  const sug = suggestProgram(PROGRAMS);
  view.innerHTML = `
    <div class="eyebrow">Choisis ta mission</div>
    <h1 class="h-display">SÉANCES</h1>
    ${PROGRAMS.map(p => `
      <article class="card program ${p.hue} mt" data-id="${p.id}">
        ${p.id === sug.id ? `<span class="chip red badge">Conseillé</span>` : ""}
        <div>
          <h3>${p.name}</h3>
          <div class="muted small">${p.tag}</div>
          <div class="dim small mt-s">${p.exercises.map(e => EXERCISES[e.id].name).join(" · ")}</div>
        </div>
        <div class="go">${ARROW}</div>
      </article>`).join("")}
  `;
  $$(".program").forEach(el => el.onclick = () => openReadiness(PROGRAMS.find(p => p.id === el.dataset.id)));
}

/* ---------- Check-in "sens d'araignée" ---------- */
function openReadiness(program) {
  const vals = { sleep: 3, energy: 3, soreness: 2 };
  const labels = {
    sleep: ["Sommeil", ["Nuit blanche", "Mauvais", "Correct", "Bon", "Parfait"]],
    energy: ["Énergie", ["À plat", "Faible", "Moyenne", "Haute", "Surchargé"]],
    soreness: ["Courbatures", ["Aucune", "Légères", "Présentes", "Fortes", "Partout"]],
  };
  overlay.innerHTML = `
    <div class="sheet-wrap"><div class="sheet">
      <div class="grab"></div>
      <div class="sense">${Array.from({ length: 8 }, (_, i) => `<i style="--a:${i * 45}deg;animation-delay:${i * .12}s"></i>`).join("")}<div class="head"></div></div>
      <div class="center"><div class="eyebrow">Check-in · ${program.name}</div><h2 class="h-display" style="font-size:34px">SENS D'ARAIGNÉE</h2>
      <p class="muted small">KAREN adapte la séance à ton état du jour.</p></div>
      ${Object.entries(labels).map(([k, [lab]]) => `
        <div class="slider-row"><label>${lab} <span><span class="val" id="v-${k}"></span></span></label>
        <input type="range" min="1" max="5" step="1" value="${vals[k]}" data-k="${k}"/></div>`).join("")}
      <div class="verdict" id="verdict"></div>
      <div class="grid2 mt"><button class="btn btn-ghost" id="cancel">Annuler</button><button class="btn btn-primary" id="launch">C'est parti</button></div>
    </div></div>`;
  const upd = () => {
    Object.entries(labels).forEach(([k, [, words]]) => {
      $(`#v-${k}`).textContent = words[vals[k] - 1];
      const inp = $(`input[data-k=${k}]`);
      inp.style.setProperty("--p", ((vals[k] - 1) / 4) * 100 + "%");
    });
    const v = readinessVerdict(readinessScore(vals));
    const el = $("#verdict");
    el.className = `verdict ${v.tone}`;
    el.innerHTML = `<b>${v.label}</b><div class="small muted">${v.text}</div>`;
  };
  $$("input[type=range]", overlay).forEach(inp => inp.oninput = () => { vals[inp.dataset.k] = +inp.value; upd(); });
  upd();
  $("#cancel").onclick = () => (overlay.innerHTML = "");
  $(".sheet-wrap").onclick = e => { if (e.target.classList.contains("sheet-wrap")) overlay.innerHTML = ""; };
  $("#launch").onclick = () => startLive(program, { ...vals });
}

/* =========================================================
   Séance live
   ========================================================= */
let S = null;      // session courante
let ui = null;     // état de saisie
let tick = null;   // timer d'affichage
let wakeLock = null;

async function startLive(program, readiness) {
  S = new Session(program, readiness);
  document.body.classList.add("hide-tabs");
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* non supporté */ }
  S.push({ kind: S.verdict.tone === "info" ? "info" : S.verdict.tone, title: S.verdict.label, text: S.verdict.text });
  const intro = S.intro();
  resetInputs();
  renderLive();
  burst("THWIP!", innerWidth / 2, innerHeight / 3);
  thwipSound();
  speak(`${S.verdict.text} ${intro.say}`, { interrupt: true });
  clearInterval(tick);
  tick = setInterval(() => { const t = $("#elapsed"); if (t) t.textContent = fmtTime(S.elapsed); }, 1000);

  if (aiReady()) {
    aiBrief(S).then(txt => {
      if (!txt || !S) return;
      S.push({ kind: "ai", title: "KAREN · BRIEFING", text: txt });
      renderFeed();
      speak(txt);
    }).catch(err => console.warn("brief", err));
  }
}

function resetInputs() {
  const ex = S.current;
  if (!ex) return;
  ui = { reps: ex.goal, rpe: Math.round(ex.rpe), pain: false, weight: ex.weight };
}

function renderLive() {
  const ex = S.current;
  if (!ex) return finishSession();
  const isTime = ex.id === "plank" || ex.id === "hollow";
  overlay.innerHTML = `
  <div class="live"><div class="live-inner">
    <div class="live-top">
      <button class="icon-btn" id="quit" aria-label="Terminer"><svg viewBox="0 0 24 24"><path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg></button>
      <div class="center"><div class="title">${S.program.name}</div><div class="timer small muted" id="elapsed">${fmtTime(S.elapsed)}</div></div>
      <button class="icon-btn" id="speak" aria-label="Voix" style="color:${state.profile.voice ? "var(--red)" : "var(--dim)"}"><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg></button>
    </div>
    <div class="progress"><div style="width:${S.progress * 100}%"></div></div>
    <div class="sense-meter ${S.fatigue >= 65 ? "hot" : ""}"><span>FATIGUE</span><div class="track"><div style="width:${S.fatigue}%"></div></div><span>${Math.round(S.fatigue)}%</span></div>

    <section class="card ex-card glow-red">
      <div class="row between"><span class="eyebrow">${ex.muscle} · Exercice ${S.idx + 1}/${S.plan.length}</span>
        <span class="chip">RPE cible ${ex.rpe}</span></div>
      <div class="ex-name mt-s">${ex.name}</div>
      <div class="dots">${Array.from({ length: ex.sets }, (_, i) => `<i class="${i < ex.done.length ? "done" : i === ex.done.length ? "cur" : ""}"></i>`).join("")}</div>
      <div class="muted small mt-s">Série ${S.setNumber} sur ${ex.sets} · plage ${ex.reps[0]}–${ex.reps[1]}${isTime ? " s" : " reps"}</div>

      <div class="target">
        ${ex.type === "load" ? `
        <div class="cell"><div class="num" id="w">${ui.weight}</div><div class="unit">KG</div>
          <div class="stepper"><button data-w="-1">−</button><button data-w="1">+</button></div></div>
        <div class="x">×</div>` : `<div class="cell"><div class="num" style="font-size:40px;color:var(--muted)">PDC</div><div class="unit">POIDS DU CORPS</div></div><div class="x">×</div>`}
        <div class="cell"><div class="num" id="r">${ui.reps}</div><div class="unit">${isTime ? "SECONDES" : "REPS FAITES"}</div>
          <div class="stepper"><button data-r="-1">−</button><button data-r="1">+</button></div></div>
      </div>

      <div class="eyebrow mt">Difficulté ressentie (RPE)</div>
      <div class="rpe">
        ${[[6, "Facile"], [7, "Modéré"], [8, "Dur"], [9, "Très dur"], [10, "Échec"]].map(([v, l]) => `<button data-rpe="${v}" class="${ui.rpe === v ? "on" : ""}">${v}<small>${l}</small></button>`).join("")}
      </div>
      <label class="toggle-pain"><input type="checkbox" id="pain" ${ui.pain ? "checked" : ""}/> Douleur articulaire / inhabituelle</label>
      <button class="btn btn-primary btn-block mt" id="log">${spider("")}<span>Série validée</span></button>
      <div class="grid2 mt-s">
        <button class="btn btn-ghost btn-sm" id="swap">Remplacer</button>
        <button class="btn btn-ghost btn-sm" id="skip">Passer l'exercice</button>
      </div>
      ${webSvg("web-corner")}
    </section>

    <div class="h-section">KAREN</div>
    <div class="feed" id="feed"></div>

    <div class="h-section">Plan de mission</div>
    <div class="upnext">${S.plan.map((e, i) => `<div class="it ${e.status !== "todo" ? "done" : i === S.idx ? "cur" : ""}"><span>${e.name}</span><span class="muted">${e.done.length}/${e.sets} · ${e.type === "load" ? e.weight + " kg" : "PDC"}</span></div>`).join("")}</div>
  </div></div>`;

  $("#log svg").style.cssText = "width:24px;height:24px";
  renderFeed();

  $$("[data-w]").forEach(b => b.onclick = () => { ui.weight = Math.max(0, +(ui.weight + (+b.dataset.w) * ex.step).toFixed(2)); $("#w").textContent = ui.weight; });
  $$("[data-r]").forEach(b => b.onclick = () => { ui.reps = Math.max(0, ui.reps + (+b.dataset.r) * (isTime ? 5 : 1)); $("#r").textContent = ui.reps; });
  $$("[data-rpe]").forEach(b => b.onclick = () => { ui.rpe = +b.dataset.rpe; $$("[data-rpe]").forEach(x => x.classList.toggle("on", x === b)); vibrate(10); });
  $("#pain").onchange = e => (ui.pain = e.target.checked);
  $("#log").onclick = logSet;
  $("#skip").onclick = () => { S.skip(); afterChange(); };
  $("#swap").onclick = openSwap;
  $("#quit").onclick = () => {
    const any = S.plan.some(e => e.done.length);
    if (confirm(any ? "Terminer la séance maintenant ? Les séries faites seront enregistrées." : "Abandonner la séance ?")) {
      any ? finishSession() : closeLive();
    }
  };
  $("#speak").onclick = () => { state.profile.voice = !state.profile.voice; save(); if (!state.profile.voice) speechSynthesis?.cancel(); renderLive(); };
}

function renderFeed() {
  const feed = $("#feed");
  if (!feed) return;
  feed.innerHTML = S.log.slice(0, 6).map(m => `
    <div class="msg ${m.kind}">
      <div class="av">${spider("")}</div>
      <div><b>${esc(m.title)}</b><p>${esc(m.text)}</p>
      ${m.swap && EXERCISES[m.swap] ? `<button class="btn btn-ghost btn-sm mt-s" data-alt="${m.swap}">Ajouter ${EXERCISES[m.swap].name}</button>` : ""}</div>
    </div>`).join("");
  $$("[data-alt]", feed).forEach(b => b.onclick = () => {
    S.insertAlt(b.dataset.alt);
    const m = S.log.find(x => x.swap === b.dataset.alt);
    if (m) m.swap = null;
    S.push({ kind: "info", title: "REMPLACEMENT", text: `${EXERCISES[b.dataset.alt].name} ajouté au plan.` });
    afterChange();
  });
}

function afterChange() {
  if (S.finished) return finishSession();
  resetInputs();
  const intro = S.intro();
  renderLive();
  speak(intro.say, { interrupt: true });
}

function openSwap() {
  const ex = S.current;
  const alts = [...new Set([...(EXERCISES[ex.id].alts || []), ...Object.keys(EXERCISES).filter(k => EXERCISES[k].muscle === ex.muscle && k !== ex.id)])];
  if (!alts.length) return toast("Pas d'alternative pour cet exercice.");
  const sheet = document.createElement("div");
  sheet.className = "sheet-wrap";
  sheet.style.zIndex = 60;
  sheet.innerHTML = `<div class="sheet"><div class="grab"></div><div class="eyebrow">Remplacer ${ex.name}</div>
    ${alts.map(a => `<button class="card program mt-s" style="width:100%;text-align:left" data-a="${a}"><div><h3 style="font-size:26px">${EXERCISES[a].name}</h3><div class="muted small">${EXERCISES[a].muscle} · ${EXERCISES[a].type === "load" ? "charge" : "poids du corps"}</div></div><div class="go">${ARROW}</div></button>`).join("")}</div>`;
  document.body.appendChild(sheet);
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  $$("[data-a]", sheet).forEach(b => b.onclick = () => { sheet.remove(); S.swap(b.dataset.a); afterChange(); });
}

function logSet(e) {
  if (!S || S.finished) return; // double tap pendant la transition de fin
  const ex = S.current;
  const rect = e.currentTarget.getBoundingClientRect();
  const lastSet = { exercice: ex.name, charge_kg: ex.type === "load" ? ui.weight : 0, reps: ui.reps, rpe: ui.rpe, douleur: ui.pain };
  const { events, rest } = S.logSet({ reps: ui.reps, rpe: ui.rpe, pain: ui.pain, weight: ex.type === "load" ? ui.weight : 0 });

  const isPR = events.some(ev => ev.title === "NOUVEAU RECORD");
  burst(isPR ? "RECORD!" : ["THWIP!", "BAM!", "THWIP!", "POW!"][ex.done.length % 4], rect.left + rect.width / 2, rect.top - 40, isPR ? "gold" : ex.done.length % 2 ? "blue" : "red");
  thwipSound();
  vibrate(isPR ? [40, 40, 80] : 30);
  speak(events.map(ev => ev.say).filter(Boolean).slice(0, 3).join(" "), { interrupt: true });

  if (S.finished) { e.currentTarget.disabled = true; return setTimeout(finishSession, 700); }

  resetInputs();
  renderLive();
  // Animation sur la valeur qui a changé
  const w = $("#w");
  if (w && lastSet.charge_kg && S.current.weight !== lastSet.charge_kg) w.classList.add(S.current.weight > lastSet.charge_kg ? "flash-up" : "flash-down");

  const restCtl = showRest(rest);

  if (aiReady()) {
    const local = { repos_s: rest, prochaine_charge_kg: S.current.weight, prochain_objectif_reps: S.current.goal };
    restCtl.thinking(true);
    aiAdjust(S, lastSet, local).then(rec => {
      restCtl.thinking(false);
      if (!rec || !S) return;
      const changed = S.applyAi(rec);
      if (Number.isFinite(rec.rest_seconds)) restCtl.setRemaining(Math.min(300, Math.max(30, rec.rest_seconds)));
      S.push({ kind: "ai", title: changed ? "KAREN · AJUSTEMENT IA" : "KAREN", text: rec.message });
      restCtl.say(rec.message);
      speak(rec.message);
      resetInputs();
      if (!restCtl.active()) renderLive(); else renderFeed();
    }).catch(err => { restCtl.thinking(false); console.warn("adjust", err); });
  }
}

function showRest(total) {
  let remaining = total, active = true, full = total;
  const C = 2 * Math.PI * 45;
  const el = document.createElement("div");
  el.className = "rest";
  const nx = S.current;
  el.innerHTML = `
    <div class="eyebrow">Récupération</div>
    <div class="rest-ring">
      <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="45"/><circle class="bar" cx="50" cy="50" r="45" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      ${webSvg("web")}
      <div class="inner"><div><b id="rt">${fmtTime(remaining)}</b><br><small>REPOS</small></div></div>
    </div>
    <div class="ai-line" id="ai-line"></div>
    <div class="next"><div class="eyebrow">Prochaine série</div><div class="h-display">${nx.name}</div>
      <div class="muted" id="nx">${nx.type === "load" ? nx.weight + " kg × " : ""}${nx.goal} · série ${nx.done.length + 1}/${nx.sets}</div></div>
    <div class="row" style="gap:10px">
      <button class="btn btn-ghost btn-sm" data-d="-15">−15 s</button>
      <button class="btn btn-blue" id="skiprest">Je suis prêt</button>
      <button class="btn btn-ghost btn-sm" data-d="15">+15 s</button>
    </div>`;
  document.body.appendChild(el);
  const bar = $(".bar", el), rt = $("#rt", el), ring = $(".rest-ring", el);

  const paint = () => {
    rt.textContent = fmtTime(Math.max(0, remaining));
    bar.style.strokeDashoffset = C * (1 - remaining / full);
    ring.classList.toggle("ending", remaining <= 5);
  };
  const end = () => {
    if (!active) return;
    active = false;
    clearInterval(h);
    el.remove();
    beep(1320, .25, "square", .12);
    vibrate([60, 40, 60]);
    if (!S) return;
    const n = S.current;
    renderLive();
    speak(`C'est reparti. Série ${n.done.length + 1}. ${n.type === "load" ? n.weight + " kilos, " : ""}${n.goal} ${n.id === "plank" || n.id === "hollow" ? "secondes" : "répétitions"}.`, { interrupt: true });
  };
  const h = setInterval(() => {
    remaining--;
    if (remaining <= 3 && remaining > 0) beep(880, .1);
    if (remaining === 10) speak("Dix secondes.");
    paint();
    if (remaining <= 0) end();
  }, 1000);
  $$("[data-d]", el).forEach(b => b.onclick = () => { remaining = Math.max(1, remaining + +b.dataset.d); full = Math.max(full, remaining); paint(); });
  $("#skiprest", el).onclick = end;
  requestAnimationFrame(paint);

  return {
    active: () => active,
    setRemaining: s => { if (!active) return; remaining = s; full = Math.max(s, 1); paint(); },
    say: t => { const l = $("#ai-line", el); if (l) l.textContent = t; const n = S?.current; const nxEl = $("#nx", el); if (n && nxEl) nxEl.textContent = `${n.type === "load" ? n.weight + " kg × " : ""}${n.goal} · série ${n.done.length + 1}/${n.sets}`; },
    thinking: on => { const l = $("#ai-line", el); if (l && on) l.textContent = "KAREN analyse ta série…"; },
  };
}

function closeLive() {
  clearInterval(tick);
  wakeLock?.release?.();
  wakeLock = null;
  document.querySelectorAll(".rest").forEach(n => n.remove());
  overlay.innerHTML = "";
  document.body.classList.remove("hide-tabs");
  S = null;
  route();
}

function finishSession() {
  if (!S) return;
  document.querySelectorAll(".rest").forEach(n => n.remove());
  clearInterval(tick);
  const before = rankInfo();
  const sum = S.summary();
  // Meilleure série par exercice -> historique de progression
  const best = {};
  sum.sets.forEach(s => {
    const score = s.weight > 0 ? e1rm(s.weight, s.reps) : s.reps;
    if (!best[s.exId] || score > best[s.exId].score) best[s.exId] = { ...s, score };
  });
  Object.values(best).forEach(s => recordLift(s.exId, s.weight, s.reps));
  if (sum.sets.length) state.sessions.push(sum);
  save();
  const after = rankInfo();
  const sess = S;
  S = null;
  wakeLock?.release?.();

  const local = localDebrief(sum, sess);
  overlay.innerHTML = `
  <div class="live"><div class="live-inner">
    <div class="summary-hero"><div class="comic">MISSION<br>ACCOMPLIE!</div>
      <div class="xp-gain mt">+${sum.xp} XP</div>
      ${after.level > before.level ? `<div class="chip gold mt-s">NOUVEAU RANG : ${after.rank.name}</div>` : ""}
    </div>
    <div class="grid2 mt">
      <div class="card stat"><b>${fmtTime(sum.durationSec)}</b><span>Durée</span></div>
      <div class="card stat"><b>${sum.volume.toLocaleString("fr-FR")}</b><span>Volume (kg)</span></div>
      <div class="card stat"><b>${sum.sets.length}</b><span>Séries</span></div>
      <div class="card stat"><b>${sum.prs.length}</b><span>Records</span></div>
    </div>
    ${sum.prs.length ? `<div class="card mt glow-red"><div class="eyebrow">Nouveaux records</div>${sum.prs.map(id => `<div class="rec"><span>${EXERCISES[id].name}</span><b>PR</b></div>`).join("")}</div>` : ""}
    <div class="msg ai mt" style="grid-template-columns:34px 1fr"><div class="av">${spider("")}</div><div><b>KAREN · DÉBRIEF</b><p id="debrief">${esc(local)}</p></div></div>
    <button class="btn btn-primary btn-block mt" id="home">Retour au QG</button>
  </div></div>`;
  burst("MISSION OK!", innerWidth / 2, innerHeight / 3, "gold");
  thwipSound();
  speak(`Séance terminée. ${sum.xp} points d'expérience. ${local}`, { interrupt: true });
  $("#home").onclick = closeLive;

  if (aiReady() && sum.sets.length) {
    $("#debrief").textContent = "KAREN analyse ta séance…";
    aiDebrief(sum).then(t => { const d = $("#debrief"); if (d) d.textContent = t || local; if (t) speak(t, { interrupt: true }); })
      .catch(() => { const d = $("#debrief"); if (d) d.textContent = local; });
  }
}

function localDebrief(sum, sess) {
  const avgRpe = sum.sets.length ? sum.sets.reduce((a, s) => a + s.rpe, 0) / sum.sets.length : 0;
  const parts = [];
  if (sum.prs.length) parts.push(`${sum.prs.length} record${sum.prs.length > 1 ? "s" : ""} battu${sum.prs.length > 1 ? "s" : ""}, énorme.`);
  if (avgRpe >= 9) parts.push("Intensité très haute : pense à bien dormir et à manger suffisamment de protéines ce soir.");
  else if (avgRpe <= 7) parts.push("Séance confortable : la prochaine fois, je monterai les charges.");
  else parts.push("Intensité idéale, pile dans la zone de progression.");
  if (sess.flags.cut) parts.push("J'ai allégé la fin à cause de la fatigue : priorité à la récupération.");
  parts.push("Prochaine mission conseillée : " + suggestProgram(PROGRAMS).name + ".");
  return parts.join(" ");
}

/* =========================================================
   KAREN (chat)
   ========================================================= */
function coach() {
  const on = aiReady();
  view.innerHTML = `
    <div class="karen-head">
      <div class="karen-eye">${spider("")}</div>
      <div><h1 class="h-display" style="font-size:40px">KAREN</h1>
      <div class="small muted"><span class="status-dot ${on ? "" : "off"}"></span> ${on ? "IA connectée · Claude" : "Mode local · active l'IA dans Profil"}</div></div>
    </div>
    <div class="quick mt">
      ${["Construis-moi un programme de 4 jours", "Comment progresser au développé couché ?", "Que manger après la séance ?", "J'ai mal à l'épaule", "Analyse ma semaine"].map(q => `<button class="chip">${q}</button>`).join("")}
    </div>
    <div class="chat mt" id="chat"></div>
    <form class="composer" id="composer">
      <input id="q" placeholder="Parle à KAREN…" autocomplete="off"/>
      <button class="btn btn-primary" aria-label="Envoyer"><svg viewBox="0 0 24 24" style="width:20px;fill:#fff"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>
    </form>`;
  const chat = $("#chat");
  const draw = () => {
    const hello = { role: "assistant", content: `Salut ${state.profile.name || "héros"}. Je suis KAREN. Pose-moi n'importe quelle question sur ton entraînement, ta récup ou ta progression.` };
    chat.innerHTML = [hello, ...state.chat].map(m => `<div class="bubble ${m.role === "user" ? "me" : "bot"}">${esc(m.content)}</div>`).join("");
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  };
  draw();

  const send = async text => {
    if (!text.trim()) return;
    state.chat.push({ role: "user", content: text.trim() });
    state.chat = state.chat.slice(-30);
    save();
    draw();
    const b = document.createElement("div");
    b.className = "bubble bot typing";
    chat.appendChild(b);
    let out = "";
    try {
      if (aiReady()) {
        const msgs = state.chat.slice(-16).map(m => ({ role: m.role, content: m.content }));
        out = await aiChat(msgs, d => { out += d; b.textContent = out; window.scrollTo({ top: document.body.scrollHeight }); });
      } else {
        await new Promise(r => setTimeout(r, 500));
        out = localAnswer(text);
        b.textContent = out;
      }
    } catch (err) {
      out = `Connexion à l'IA impossible (${err.message || err}). Vérifie ta clé dans Profil.`;
    }
    b.classList.remove("typing");
    state.chat.push({ role: "assistant", content: out || "…" });
    save();
    draw();
  };

  $("#composer").onsubmit = e => { e.preventDefault(); const q = $("#q"); send(q.value); q.value = ""; };
  $$(".quick .chip").forEach(c => c.onclick = () => send(c.textContent));
}

function localAnswer(q) {
  const t = q.toLowerCase();
  const n = state.sessions.length;
  if (/mal|douleur|bless/.test(t)) return "Si ça fait mal, on arrête l'exercice qui déclenche la douleur — même un super-héros ne s'entraîne pas blessé. Glace/repos 48 h, puis reprends léger. Si la douleur persiste ou est vive, consulte un kiné ou un médecin. En séance, coche « Douleur » et je te propose une alternative.";
  if (/mang|nutri|prot|repas/.test(t)) return "Après la séance : 25–40 g de protéines (poulet, œufs, skyr, whey) + des glucides (riz, pâtes, fruits) dans les 2 h. Sur la journée, vise environ 1,6 à 2 g de protéines par kilo de poids de corps, soit ~" + Math.round(state.profile.bodyweight * 1.8) + " g pour toi.";
  if (/programme|planning|jours/.test(t)) return "Pour 4 jours : PUSH / PULL / repos / LEGS / FULL BODY, puis 2 jours off. Je choisis automatiquement la mission du jour selon ce que tu as fait le moins récemment. Active l'IA dans Profil pour un programme 100 % sur mesure.";
  if (/couch|bench|progress/.test(t)) return "Double progression : reste dans la plage de reps (ex. 6–8). Quand tu fais 8 reps à toutes les séries avec un RPE ≤ 7, j'ajoute 2,5 kg. Omoplates serrées, pieds ancrés, descente contrôlée. Je m'occupe des ajustements en temps réel pendant la séance.";
  if (/semaine|analyse|bilan/.test(t)) {
    const w = state.sessions.filter(s => Date.now() - s.date < 7 * 864e5);
    const vol = w.reduce((a, s) => a + s.volume, 0);
    return w.length ? `Cette semaine : ${w.length} séance(s), ${vol.toLocaleString("fr-FR")} kg de volume, ${w.reduce((a, s) => a + s.prs.length, 0)} record(s). ${w.length >= 3 ? "Régularité de héros, continue." : "Vise au moins 3 séances pour progresser vite."}` : "Aucune séance cette semaine pour l'instant. Le quartier t'attend : lance une mission depuis le QG.";
  }
  if (/motiv|flemme|fatigu/.test(t)) return "Un grand pouvoir implique de grandes responsabilités — et ta responsabilité aujourd'hui, c'est juste de commencer. Fais l'échauffement et la première série. Si ton sens d'araignée dit vraiment non, le check-in adaptera la séance.";
  return `Je suis en mode local : je gère tes séances (charges, repos, consignes) sans connexion. Pour discuter librement, active l'IA dans Profil avec une clé API Anthropic. ${n ? `Tu as déjà ${n} séance(s) au compteur.` : "Lance ta première mission depuis le QG !"}`;
}

/* =========================================================
   Journal
   ========================================================= */
function history() {
  const sessions = [...state.sessions].reverse();
  const lifts = Object.entries(state.lifts).filter(([id]) => EXERCISES[id]);
  view.innerHTML = `
    <div class="eyebrow">Archives du QG</div>
    <h1 class="h-display">JOURNAL</h1>
    <div class="h-section">Records</div>
    ${lifts.length ? `<div class="card">${lifts.map(([id, l]) => `<div class="rec"><span>${EXERCISES[id].name}</span><b>${EXERCISES[id].type === "load" ? `${Math.round(l.best)} kg <small class="dim" style="font-family:var(--font);font-size:11px">1RM est.</small>` : `${l.bestReps} reps`}</b></div>`).join("")}</div>`
      : `<div class="card empty">${spider("")}Aucun record pour l'instant.</div>`}
    <div class="h-section">Séances</div>
    ${sessions.length ? sessions.map(s => `
      <article class="card session-item mt-s">
        <div class="row between"><h4>${esc(s.name)}</h4><span class="small muted">${new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span></div>
        <div class="row small muted" style="gap:14px;margin-top:4px"><span>${fmtTime(s.durationSec)}</span><span>${s.volume.toLocaleString("fr-FR")} kg</span><span>${s.sets.length} séries</span><span class="chip gold" style="padding:2px 8px">+${s.xp} XP</span></div>
        <div class="details">${groupSets(s.sets)}</div>
      </article>`).join("") : `<div class="card empty">${spider("")}Ton journal est vide. Ta première mission t'attend.</div>`}
  `;
  $$(".empty svg").forEach(s => s.style.cssText = "width:64px;height:64px;margin:0 auto 12px;color:var(--dim)");
  $$(".session-item").forEach(el => el.onclick = () => el.classList.toggle("open"));
}

function groupSets(sets) {
  const g = {};
  sets.forEach(s => (g[s.name] ||= []).push(s));
  return Object.entries(g).map(([n, arr]) => `<div style="margin-top:6px"><b style="color:var(--text)">${esc(n)}</b> — ${arr.map(s => `${s.weight ? s.weight + "×" : ""}${s.reps} <span class="dim">@${s.rpe}</span>`).join(" · ")}</div>`).join("");
}

/* =========================================================
   Profil
   ========================================================= */
function profile() {
  const p = state.profile;
  view.innerHTML = `
    <div class="eyebrow">Identité secrète</div>
    <h1 class="h-display">PROFIL</h1>
    <section class="card mt">
      <label class="field"><span>Nom</span><input class="input" id="p-name" value="${esc(p.name)}"/></label>
      <div class="grid2">
        <label class="field"><span>Poids (kg)</span><input class="input" id="p-bw" type="number" inputmode="decimal" value="${p.bodyweight}"/></label>
        <label class="field"><span>Objectif</span><select class="input" id="p-goal">
          ${[["force", "Force"], ["muscle", "Prise de muscle"], ["seche", "Sèche"], ["forme", "Forme générale"]].map(([v, l]) => `<option value="${v}" ${p.goal === v ? "selected" : ""}>${l}</option>`).join("")}
        </select></label>
      </div>
      <div class="switch mt"><div><b>Consignes vocales</b><div class="small muted">KAREN te parle pendant la séance</div></div><input type="checkbox" id="p-voice" ${p.voice ? "checked" : ""}/></div>
    </section>

    <div class="h-section">Intelligence artificielle</div>
    <section class="card glow-blue">
      <div class="switch" style="padding-top:0"><div><b>KAREN connectée (Claude)</b><div class="small muted">Ajustements IA après chaque série, briefing, débrief et chat libre</div></div><input type="checkbox" id="p-ai" ${p.aiEnabled ? "checked" : ""}/></div>
      <label class="field"><span>Clé API Anthropic</span><input class="input" id="p-key" type="password" placeholder="sk-ant-…" value="${esc(p.aiKey)}" autocomplete="off"/></label>
      <p class="small dim">La clé reste sur cet appareil et n'est envoyée qu'à l'API Anthropic. Sans clé, KAREN fonctionne en mode local (ajustements automatiques hors ligne).</p>
      <button class="btn btn-blue btn-sm" id="p-test">Tester la connexion</button>
    </section>

    <div class="h-section">Données</div>
    <section class="card">
      <div class="grid2"><button class="btn btn-ghost btn-sm" id="p-export">Exporter</button><label class="btn btn-ghost btn-sm">Importer<input type="file" id="p-import" accept="application/json" hidden/></label></div>
      <button class="btn btn-ghost btn-sm btn-block mt-s" id="p-reset" style="color:#ff8a9a">Tout réinitialiser</button>
    </section>
    <p class="center dim small mt">Rangs : ${RANKS.map(r => r.name).join(" → ")}</p>
  `;
  const bind = (id, fn) => $(id).addEventListener("change", e => { fn(e.target); save(); });
  bind("#p-name", t => (p.name = t.value.trim().slice(0, 30)));
  bind("#p-bw", t => (p.bodyweight = +t.value || 75));
  bind("#p-goal", t => (p.goal = t.value));
  bind("#p-voice", t => { p.voice = t.checked; if (t.checked) speak("Consignes vocales activées."); });
  bind("#p-ai", t => { p.aiEnabled = t.checked; toast(t.checked ? "KAREN IA activée" : "Mode local"); });
  bind("#p-key", t => { p.aiKey = t.value.trim(); resetClient(); });
  $("#p-test").onclick = async () => {
    p.aiKey = $("#p-key").value.trim(); p.aiEnabled = true; $("#p-ai").checked = true; save(); resetClient();
    if (!p.aiKey) return toast("Ajoute d'abord ta clé.");
    toast("Connexion à KAREN…");
    try { const t = await testKey(); toast("✓ " + t, 5000); speak(t); }
    catch (err) { toast("Échec : " + (err.message || err), 5000); }
  };
  $("#p-export").onclick = () => {
    const data = { ...state, profile: { ...state.profile, aiKey: "" } };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `greatness-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $("#p-import").onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.sessions)) throw new Error("format");
      state.sessions = data.sessions; state.lifts = data.lifts || {};
      state.profile = { ...state.profile, ...data.profile, aiKey: state.profile.aiKey };
      save(); toast("Données importées"); route();
    } catch { toast("Fichier invalide"); }
  };
  $("#p-reset").onclick = () => { if (confirm("Effacer toutes les données ? Irréversible.")) resetAll(); };
}

/* =========================================================
   Boot
   ========================================================= */
startBackground($("#bg"));
route();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
