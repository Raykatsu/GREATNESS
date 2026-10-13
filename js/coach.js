// Onglet Coach : discussion avec le coach choisi (Spider-Man par défaut).
// Priorité : Claude (si une clé est configurée) → IA locale (si chargée) → cerveau local.
import { state, save } from "./store.js";
import { answer, llmMessages, onlineMessages } from "./brain.js";
import { onlineReady, onlineChat, onlineRemaining } from "./online.js";
import { aiReady, aiChat } from "./ai.js";
import * as llm from "./llm.js";
import { spidey } from "./spidey.js";
import { parseCommand, runCommand, COMMAND_EXAMPLES } from "./actions.js";
import { $, $$, esc, md, I, spider, sheet, confirmSheet, toast } from "./ui.js";
import { coachName } from "./chars/index.js";
import { parseActions, streamText, describe, applyAction } from "./aiact.js";
import { memoryCommand, addMemory } from "./memory.js";
import { generateWeekPlan } from "./planner.js";

const SUGGESTIONS = ["Ce que tu peux faire pour moi", "Crée une séance pecs de 45 min", "Fais mon bilan de la semaine", "Comment progresser au squat ?", "Que manger avant et après la séance ?", "Je stagne, je fais quoi ?", "Crée-moi une séance bras de 30 min", "J'ai mal à l'épaule", "Comment mieux dormir ?"];

const HINT_KEY = "greatness.coach.noGpuHint";
let cleanup = null;

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const pct = p => Math.max(0, Math.min(100, Math.round((p || 0) * 100)));
// espaces fines insécables avant ? ! : ; » et après « : jamais de ponctuation orpheline en début de ligne
const fr = h => h.replace(/ ([?!:;»])/g, "\u202f$1").replace(/« /g, "«\u202f");
const avatar = () => `<span class="msg-av" aria-hidden="true">${spider()}</span>`;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export function renderCoach(view) {
  cleanup?.();
  view.innerHTML = `
    <header class="coach-head">
      <div class="coach-av" aria-hidden="true">${spider()}<i class="coach-dot" id="dot"></i></div>
      <div class="coach-id"><h1 class="coach-name" data-coach-name>${esc(coachName())}</h1><div class="status" id="status" aria-live="polite"></div></div>
      <button class="icon-btn plain" id="clear" aria-label="Effacer la discussion" ${state.chat.length ? "" : "hidden"}>${I.trash}</button>
    </header>
    <div id="llm-card"></div>
    <div class="chat" id="chat" role="log" aria-label="Discussion avec ${esc(coachName())}"></div>
    <div class="eyebrow sugg-title" id="sugg-t" ${state.chat.length ? "hidden" : ""}>Pour commencer</div>
    <div class="chips sugg ${state.chat.length ? "" : "wrap"}" id="sugg" aria-label="Suggestions">${SUGGESTIONS.map(s => `<button class="chip">${esc(s)}</button>`).join("")}</div>
    <div class="coach-pad" aria-hidden="true"></div>
    <div class="composer" id="composer">
      <button class="chat-down" id="down" aria-label="Revenir aux derniers messages" tabindex="-1">${I.down}</button>
      <form id="f"><textarea id="q" rows="1" placeholder="Écris à ton coach…" aria-label="Ton message" autocomplete="off" enterkeyhint="send"></textarea>
      <button class="send" id="send" aria-label="Envoyer" disabled>${I.send}</button></form>
    </div>`;

  const chat = $("#chat", view), comp = $("#composer", view), q = $("#q", view), sendBtn = $("#send", view), sugg = $("#sugg", view);
  let sending = false;
  const offs = [];
  const alive = () => document.body.contains(chat);
  // écouteurs globaux retirés dès que l'écran a été quitté
  const on = (el, ev, fn, opts) => {
    const h = (...a) => (alive() ? fn(...a) : cleanup?.());
    el.addEventListener(ev, h, opts); offs.push(() => el.removeEventListener(ev, h, opts));
  };

  // ---------- Défilement : on ne colle en bas que si l'utilisateur y était déjà ----------
  const root = document.scrollingElement || document.documentElement;
  const atBottom = () => root.scrollHeight - (root.scrollTop + innerHeight) < 120;
  const toBottom = (smooth = true) => window.scrollTo({ top: root.scrollHeight, behavior: smooth && !reduced() ? "smooth" : "auto" });
  let scrollRaf = 0;
  const syncDown = () => { scrollRaf = 0; comp.classList.toggle("show-down", !atBottom()); };
  on(window, "scroll", () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(syncDown); }, { passive: true });
  $("#down", view).onclick = () => toBottom();

  // ---------- Barre de saisie : hauteur réelle, clavier (visualViewport) ----------
  const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zoom")) || 1;
  const ro = new ResizeObserver(() => {
    if (!alive()) return cleanup?.();
    view.style.setProperty("--composer-h", comp.offsetHeight + "px");
    document.documentElement.style.setProperty("--composer-vh", comp.getBoundingClientRect().height + "px");
  });
  ro.observe(comp);
  offs.push(() => ro.disconnect());
  const vv = window.visualViewport;
  if (vv) {
    let kbRaf = 0;
    const onVV = () => {
      if (kbRaf) return;
      kbRaf = requestAnimationFrame(() => {
        kbRaf = 0;
        const stick = atBottom();
        const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
        const open = kb > 80;
        comp.classList.toggle("kb", open);
        comp.style.setProperty("--kb", open ? kb / zoom() + "px" : "0px");
        if (open && stick) toBottom(false);
      });
    };
    on(vv, "resize", onVV); on(vv, "scroll", onVV);
  }
  const grow = () => {
    q.style.height = "auto";
    q.style.height = Math.min(q.scrollHeight, 132) + "px";
    sendBtn.disabled = !q.value.trim() || sending;
  };
  q.addEventListener("input", grow);
  q.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } });
  const submit = () => { const text = q.value; if (!text.trim() || sending) return; q.value = ""; grow(); send(text); };
  $("#f", view).onsubmit = e => { e.preventDefault(); submit(); };

  // ---------- En-tête : état de l'IA ----------
  const drawStatus = () => {
    const el = $("#status", view), dot = $("#dot", view);
    if (!el) return;
    const i = llm.info();
    let tone = "on", text;
    if (sending) text = `<span class="typing-txt">écrit<b>.</b><b>.</b><b>.</b></span>`;
    else if (aiReady()) text = "Claude connecté";
    else if (onlineReady()) text = `IA en ligne${onlineRemaining() != null ? ` · <span class="tnum">${onlineRemaining()}</span> messages restants aujourd'hui` : ""}`;
    else if (i.ready) text = `IA locale · ${esc(llm.MODELS.find(m => m.id === i.model)?.name || "")}`;
    else if (i.status === "loading") { tone = "warm"; text = `Chargement de l'IA · <span class="tnum">${pct(i.progress)} %</span>`; }
    else { tone = "off"; text = "Mode simple"; }
    el.className = `status ${tone}`;
    el.innerHTML = `<i></i><span>${text}</span>`;
    dot.className = `coach-dot ${tone}`;
  };

  // ---------- Carte « Débloque l'IA » ----------
  const card = $("#llm-card", view);
  let cardKind = "", cardErr = "";
  const drawCard = () => {
    const i = llm.info();
    const kind = aiReady() || i.ready || onlineReady() ? "none" : !llm.supported() ? (store.get(HINT_KEY) ? "none" : "nogpu") : i.status === "loading" ? "loading" : "offer";
    if (kind === "loading" && cardKind === "loading") {
      // mise à jour légère : pas de reconstruction, la jauge avance par transform
      $(".ai-load-txt", card).textContent = i.progressText || "Préparation…";
      $(".ai-load-pct", card).textContent = pct(i.progress) + " %";
      $(".ai-bar > i", card).style.transform = `scaleX(${Math.max(0.02, i.progress || 0)})`;
      return;
    }
    const err = i.status === "error" ? i.error || "" : "";
    if (kind === cardKind && err === cardErr) return;
    cardKind = kind; cardErr = err;
    if (kind === "none") { card.innerHTML = ""; return; }
    if (kind === "nogpu") {
      card.innerHTML = `<div class="ai-card ai-quiet anim-rise"><span class="ai-ico soft">${I.info}</span>
        <div class="grow"><b>IA intelligente indisponible ici</b><p>Ton navigateur ne gère pas WebGPU. Essaie Chrome (Android, ordinateur) ou Safari à jour. En attendant, je réponds en mode simple.</p></div>
        <button class="icon-btn plain ai-x" aria-label="Masquer">${I.x}</button></div>`;
      $(".ai-x", card).onclick = () => { store.set(HINT_KEY, "1"); drawCard(); };
      return;
    }
    if (kind === "loading") {
      card.innerHTML = `<div class="ai-card ai-loading anim-rise" role="status">
        <span class="ai-ico">${I.sparkle}</span>
        <div class="grow"><div class="ai-load-top"><b class="ai-load-txt">${esc(i.progressText || "Préparation…")}</b><span class="ai-load-pct tnum">${pct(i.progress)} %</span></div>
          <div class="ai-bar"><i style="transform:scaleX(${Math.max(0.02, i.progress || 0)})"></i></div>
          <p>Une seule fois : ensuite l'IA démarre en quelques secondes, même sans internet. Garde l'app ouverte et l'écran allumé.</p></div></div>`;
      return;
    }
    card.innerHTML = `<button class="ai-card ai-offer tap anim-rise" id="ai-open">
        <span class="ai-ico">${I.sparkle}</span>
        <span class="grow"><b>Débloque l'IA intelligente</b><span>Gratuite, privée, directement sur ton téléphone</span>
        ${err ? `<span class="ai-err">${esc(err)}</span>` : ""}</span>
        <span class="ai-go">${I.chev}</span></button>`;
    $("#ai-open", card).onclick = openAiSheet;
  };
  const openAiSheet = () => {
    const models = llm.MODELS.filter(llm.modelAllowed);
    let sel = llm.prefs().model;
    if (!models.some(m => m.id === sel)) sel = models[0]?.id;
    const sizeOf = id => llm.MODELS.find(m => m.id === id)?.size || "";
    const sh = sheet(`<div class="ai-sheet">
      <div class="ai-hero" aria-hidden="true"><span class="ai-hero-av">${spider()}</span><span class="ai-hero-spark">${I.sparkle}</span></div>
      <h2 class="h2 center">Débloque l'IA intelligente</h2>
      <p class="muted center ai-lead">Un vrai modèle d'IA tourne dans ton téléphone. Il répond à toutes tes questions en s'appuyant sur tes séances et tes stats.</p>
      <ul class="ai-perks">
        <li><span>${I.heart}</span><div><b>Gratuite</b>Aucun abonnement, aucune clé</div></li>
        <li><span>${I.eye}</span><div><b>Privée</b>Tes messages ne quittent jamais ton téléphone</div></li>
        <li><span>${I.bolt}</span><div><b>Hors ligne</b>Après un téléchargement unique</div></li>
      </ul>
      <div class="eyebrow ai-pick">Choisis ton modèle</div>
      <div class="ai-models">${models.map(m => `<button class="opt ${m.id === sel ? "on" : ""}" data-m="${m.id}" aria-pressed="${m.id === sel}"><span class="ai-radio"></span><span class="grow"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></span><span class="ai-size tnum">${esc(m.size)}</span></button>`).join("")}</div>
      <p class="xs dim center ai-note">Wi-Fi conseillé · téléchargement unique</p>
      <div class="sheet-foot"><button class="btn btn-primary btn-block btn-lg" id="llm-on">${I.sparkle} Activer l'IA · <span id="llm-size" class="tnum">${esc(sizeOf(sel))}</span></button></div>
    </div>`);
    $$("[data-m]", sh.el).forEach(b => b.onclick = () => {
      sel = b.dataset.m;
      $$("[data-m]", sh.el).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
      $("#llm-size", sh.el).textContent = sizeOf(sel);
    });
    $("#llm-on", sh.el).onclick = () => { sh.close(); llm.enable(sel); };
  };

  const redrawAi = () => { if (!alive()) return cleanup?.(); drawStatus(); drawCard(); };
  offs.push(llm.onChange(redrawAi));
  redrawAi();

  // ---------- Messages ----------
  const actionsHtml = m => m.actions?.length ? `<div class="acts">${m.actions.map((a, i) => `<button class="chip red" data-act="${i}">${esc(a.label)}</button>`).join("")}</div>` : "";
  const bindActions = (el, m) => $$("[data-act]", el).forEach(b => {
    const a = m.actions?.[+b.dataset.act];
    if (a?.done) { b.disabled = true; b.classList.add("done"); }
    b.onclick = () => {
      if (a?.start) window.dispatchEvent(new CustomEvent("greatness:start", { detail: a.start }));
      else if (a?.route) location.hash = a.route;
      else if (a?.ask) send(a.ask);
      else if (a?.ai || a?.all) runAi(el, m, a);
    };
  });
  // Actions proposées par l'IA en ligne : appliquées au toucher (« Tout appliquer » les fait dans l'ordre)
  const runAi = (el, m, a) => {
    m.created ||= {};
    const list = a.all ? m.actions.filter(x => x.ai && !x.done) : [a];
    const out = [];
    for (const x of list) {
      const r = applyAction(x.ai, m.created);
      out.push(r.text);
      if (!r.ok) continue;
      x.done = true; x.label = `✓ ${x.label}`;
      if (r.programId) m.actions.push({ label: "▶ Lancer la séance", start: r.programId });
      if (r.replan) state.weekPlan = generateWeekPlan();
    }
    if (a.all) a.done = true;
    if (m.actions.every(x => !x.ai || x.done)) m.actions = m.actions.filter(x => !x.all);
    save();
    toast(out.join(" · "), 3500);
    spidey.react("happy");
    const box = $(".acts", el);
    if (box) { box.outerHTML = actionsHtml(m); bindActions(el, m); }
  };
  const row = (m, isNew) => {
    const me = m.role === "user";
    const el = document.createElement("div");
    el.className = `msg-row ${me ? "me" : "bot"}${isNew ? " new" : ""}`;
    el.innerHTML = `${me ? "" : avatar()}<div class="msg ${me ? "me" : "bot"}">${fr(me ? esc(m.content) : md(m.content))}${actionsHtml(m)}</div>`;
    bindActions(el, m);
    return el;
  };
  const hello = { role: "assistant", content: `Salut ${state.profile.name || "héros"} ! Ton sympathique coach de quartier est là. Technique, nutrition, programme, motivation… demande-moi ce que tu veux.` };
  const draw = () => {
    const frag = document.createDocumentFragment();
    [hello, ...state.chat].forEach(m => frag.appendChild(row(m, false)));
    chat.replaceChildren(frag);
  };

  const send = async text => {
    text = text.trim();
    if (!text || sending) return;
    sending = true;
    sendBtn.disabled = true;
    view.classList.add("is-sending");
    const history = state.chat.slice();
    const user = { role: "user", content: text };
    state.chat.push(user);
    state.chat = state.chat.slice(-40);
    save();
    $("#clear", view).hidden = false;
    $("#sugg-t", view).hidden = true;
    sugg.classList.remove("wrap");
    chat.appendChild(row(user, true));
    drawStatus();
    // bulle « écrit… » : elle devient la réponse elle-même (pas de saut quand le texte arrive)
    const r = document.createElement("div");
    r.className = "msg-row bot new";
    r.innerHTML = `${avatar()}<div class="msg bot is-typing" aria-label="${esc(coachName())} écrit…"><span class="typing"><span></span><span></span><span></span></span></div>`;
    chat.appendChild(r);
    const b = $(".msg", r);
    requestAnimationFrame(() => toBottom());
    // flux : une écriture par image au plus, et on ne suit que si l'utilisateur est en bas
    let pending = null, raf = 0;
    const stream = t => {
      pending = t;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const stick = atBottom();
        b.classList.remove("is-typing");
        b.innerHTML = fr(md(pending));
        if (stick) toBottom(false);
      });
    };
    let reply, auto = null;
    try {
      const cmd = parseCommand(text);
      // créer une séance : l'IA en ligne la compose (elle tient compte de ta mémoire et de ton historique) ;
      // le générateur de l'app reste en secours. Les réglages simples restent instantanés, en local.
      const aiFirst = cmd?.type === "create" && onlineReady();
      const rc = cmd && !aiFirst && runCommand(cmd);
      const mem = !rc && !/\?/.test(text) ? memoryCommand(text) : null;
      if (/ce que tu peux faire|que peux[- ]tu faire|tes (pouvoirs|capacites)|aide$/i.test(text.normalize("NFD").replace(/[̀-ͯ]/g, ""))) {
        await new Promise(res => setTimeout(res, 450));
        reply = { role: "assistant", content: `Je réponds à toutes tes questions, et je peux aussi **modifier l'app pour toi**. Par exemple :\n${COMMAND_EXAMPLES.map(e => `• « ${e} »`).join("\n")}`, actions: COMMAND_EXAMPLES.slice(0, 3).map(e => ({ label: e, ask: e })) };
      } else if (rc) {
        await new Promise(res => setTimeout(res, 450));
        reply = { role: "assistant", content: rc.text, actions: rc.actions };
        auto = rc.auto;
        if (rc.mood) spidey.react(rc.mood === "party" ? "party" : "happy");
      } else if (mem) {
        await new Promise(res => setTimeout(res, 350));
        const m = addMemory(state, mem, "user");
        reply = { role: "assistant", content: m ? `C'est noté, je m'en souviendrai : **${m.text}**\n\nTu retrouves tout ce que je sais de toi dans Moi → Réglages.` : "Je n'ai pas compris quoi retenir." };
      } else if (aiReady()) {
        const msgs = [...history, { role: "user", content: text }].slice(-16).map(m => ({ role: m.role, content: m.content }));
        let out = "";
        reply = { role: "assistant", content: await aiChat(msgs, d => stream((out += d))) };
      } else if (onlineReady()) {
        try {
          const { system, messages } = onlineMessages(history, text);
          const res = await onlineChat({ system, messages, onDelta: t => stream(streamText(t)) });
          const src = res.sources.length ? `\n\nSources : ${res.sources.map(x => `[${x.title.replace(/[[\]]/g, "")}](${x.url})`).join(" · ")}` : "";
          const cut = res.cut ? "\n\n*(Réponse coupée par le réseau : écris « continue » pour la suite.)*" : "";
          // actions proposées : « retenir » s'applique tout seul, le reste devient des boutons
          const { text: clean, actions } = parseActions(res.text), notes = [], buttons = [];
          for (const a of actions) {
            if (a.type === "remember") { const r = applyAction(a); if (r.ok) notes.push(`📝 ${r.text}`); }
            else buttons.push({ label: describe(a), ai: a });
          }
          if (buttons.length > 1) buttons.push({ label: "Tout appliquer", all: true });
          if (notes.length) save();
          reply = { role: "assistant", content: (clean || "C'est prêt :") + cut + (notes.length ? `\n\n${notes.join("\n")}` : "") + src, actions: buttons };
        } catch (err) {
          // l'IA en ligne ne répond pas : l'IA du téléphone ou le mode simple prend le relais
          const why = err.detail ? ` (${err.detail})` : "";
          const note = `\n\n${err.message}${why}`;
          if (aiFirst) { const rc2 = runCommand(cmd); reply = { role: "assistant", content: rc2.text, actions: rc2.actions }; auto = rc2.auto; }
          else if (llm.info().ready) reply = { role: "assistant", content: (await llm.chat(llmMessages(history, text), { onDelta: stream })) + note };
          else { const a = answer(text); reply = { role: "assistant", content: a.text + note, actions: a.actions }; }
        }
      } else if (llm.info().ready) {
        reply = { role: "assistant", content: await llm.chat(llmMessages(history, text), { onDelta: stream }) };
        if (!reply.content) throw new Error("vide");
      } else {
        await new Promise(res => setTimeout(res, 550 + Math.random() * 350));
        const a = answer(text);
        const loadingNote = llm.info().status === "loading" ? "\n\n(L'IA intelligente se charge, elle prendra le relais dans un instant.)" : "";
        reply = { role: "assistant", content: a.text + loadingNote, actions: a.actions };
      }
    } catch (err) {
      const a = answer(text);
      reply = { role: "assistant", content: a.text, actions: a.actions };
    }
    cancelAnimationFrame(raf);
    state.chat.push(reply);
    save();
    sending = false;
    view.classList.remove("is-sending");
    if (alive()) {
      const stick = atBottom();
      b.classList.remove("is-typing");
      b.removeAttribute("aria-label");
      b.innerHTML = fr(md(reply.content)) + actionsHtml(reply);
      bindActions(r, reply);
      if (stick) requestAnimationFrame(() => toBottom());
      sendBtn.disabled = !q.value.trim();
      drawStatus();
    }
    if (!auto) spidey.react("happy");
    if (auto?.route) setTimeout(() => (location.hash = auto.route), 500);
    if (auto?.start) setTimeout(() => window.dispatchEvent(new CustomEvent("greatness:start", { detail: auto.start })), 500);
  };

  $$(".chip", sugg).forEach(c => c.onclick = () => send(c.textContent));
  $("#clear", view).onclick = async () => {
    if (sending) return;
    if (!(await confirmSheet("Effacer la discussion ?", "Tous les messages seront supprimés de cet appareil.", "Effacer", true))) return;
    state.chat = []; save(); renderCoach(view);
  };

  cleanup = () => { offs.splice(0).forEach(f => f()); cleanup = null; };
  draw();
  // arrivée : directement sur les derniers messages, sans animation de défilement
  requestAnimationFrame(() => { if (alive()) { if (state.chat.length) toBottom(false); syncDown(); } });
}
