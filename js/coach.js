// Onglet Coach : discussion avec Spider-Man.
// Priorité : Claude (si une clé est configurée) → IA locale (si chargée) → cerveau local.
import { state, save } from "./store.js";
import { answer, llmMessages } from "./brain.js";
import { aiReady, aiChat } from "./ai.js";
import * as llm from "./llm.js";
import { spidey } from "./spidey.js";
import { parseCommand, runCommand, COMMAND_EXAMPLES } from "./actions.js";
import { $, $$, esc, md, I } from "./ui.js";

const SUGGESTIONS = ["Ce que tu peux faire pour moi", "Crée une séance pecs de 45 min", "Fais mon bilan de la semaine", "Comment progresser au squat ?", "Que manger avant et après la séance ?", "Je stagne, je fais quoi ?", "Crée-moi une séance bras de 30 min", "J'ai mal à l'épaule", "Comment mieux dormir ?"];
let unsub = null;

export function renderCoach(view) {
  view.innerHTML = `
    <div class="coach-head">
      <div class="coach-av" id="av"></div>
      <div class="grow"><h1 class="h2">Spider-Man</h1><div class="status" id="status"></div></div>
      ${state.chat.length ? `<button class="icon-btn" id="clear" aria-label="Effacer la discussion">${I.trash}</button>` : ""}
    </div>
    <div id="llm-card"></div>
    <div class="chips mt" id="sugg">${SUGGESTIONS.map(s => `<button class="chip">${esc(s)}</button>`).join("")}</div>
    <div class="chat mt" id="chat"></div>
    <div class="composer"><form id="f"><input id="q" placeholder="Pose n'importe quelle question…" autocomplete="off" enterkeyhint="send"/>
      <button class="btn btn-primary" aria-label="Envoyer">${I.send}</button></form></div>`;
  const sp = document.querySelector(".spidey .sp");
  if (sp) $("#av", view).innerHTML = sp.outerHTML.replace(/id="sp/g, 'id="av-sp').replace(/url\(#sp/g, "url(#av-sp").replace(/class="sp[^"]*"/, 'class="sp pose-wave"');

  const chat = $("#chat", view);
  const drawStatus = () => {
    const i = llm.info();
    const el = $("#status", view);
    if (!el) return;
    if (aiReady()) el.innerHTML = `<i></i> IA Claude connectée`;
    else if (i.ready) el.innerHTML = `<i></i> IA locale active · ${esc(llm.MODELS.find(m => m.id === i.model)?.name || "")}`;
    else if (i.status === "loading") el.innerHTML = `<i class="warm"></i> IA locale en chargement… ${Math.round(i.progress * 100)} %`;
    else el.innerHTML = `<i class="off"></i> Mode simple (hors ligne)`;
    drawCard();
  };
  const drawCard = () => {
    const card = $("#llm-card", view);
    if (!card) return;
    const i = llm.info();
    if (aiReady() || i.ready) { card.innerHTML = ""; return; }
    if (!llm.supported()) {
      card.innerHTML = `<div class="card llm mt"><b>IA intelligente indisponible ici</b><p class="small muted">Ton navigateur ne gère pas WebGPU. Essaie Chrome sur Android ou ordinateur, ou Safari à jour sur iPhone. En attendant, je réponds en mode simple.</p></div>`;
      return;
    }
    if (i.status === "loading") {
      card.innerHTML = `<div class="card llm mt"><div class="row between"><b>${esc(i.progressText)}</b><span class="num">${Math.round(i.progress * 100)} %</span></div>
        <div class="bar mt-s"><i style="width:${i.progress * 100}%"></i></div><p class="xs muted mt-s">Une seule fois : ensuite l'IA démarre en quelques secondes, même sans internet. Garde l'app ouverte.</p></div>`;
      return;
    }
    const sel = llm.prefs().model;
    card.innerHTML = `<div class="card card-hero llm mt">
      <div class="eyebrow">Gratuit · privé · sur ton téléphone</div>
      <h2 class="h3 mt-s">Débloque l'IA intelligente</h2>
      <p class="small muted">Un vrai modèle d'IA tourne dans ton téléphone : il répond à toutes tes questions en s'appuyant sur tes séances et tes stats. Téléchargement unique, Wi-Fi conseillé.</p>
      ${i.status === "error" ? `<p class="small" style="color:#ff7b88">${esc(i.error)}</p>` : ""}
      <div class="models mt-s">${llm.MODELS.map(m => `<button class="opt ${m.id === sel ? "on" : ""}" data-m="${m.id}"><b>${m.name}</b><span>${m.size} · ${m.note}</span></button>`).join("")}</div>
      <button class="btn btn-primary btn-block mt" id="llm-on">${I.sparkle} Activer l'IA</button></div>`;
    $$("[data-m]", card).forEach(b => b.onclick = () => { $$("[data-m]", card).forEach(x => x.classList.toggle("on", x === b)); card.dataset.m = b.dataset.m; });
    $("#llm-on", card).onclick = () => llm.enable(card.dataset.m || sel);
  };
  unsub?.();
  unsub = llm.onChange(() => { if (document.body.contains(chat)) drawStatus(); else unsub?.(); });
  drawStatus();

  const bubble = m => `<div class="msg ${m.role === "user" ? "me" : "bot"}">${m.role === "user" ? esc(m.content) : md(m.content)}${
    m.actions?.length ? `<div class="acts">${m.actions.map((a, i) => `<button class="chip red" data-act="${i}">${esc(a.label)}</button>`).join("")}</div>` : ""}</div>`;
  const draw = () => {
    const hello = { role: "assistant", content: `Salut ${state.profile.name || "héros"} ! Ton sympathique coach de quartier est là. Technique, nutrition, programme, motivation… demande-moi ce que tu veux.` };
    chat.innerHTML = [hello, ...state.chat].map(bubble).join("");
    $$("[data-act]", chat).forEach(b => {
      const msg = state.chat[$$(".msg", chat).indexOf(b.closest(".msg")) - 1];
      const a = msg?.actions?.[+b.dataset.act];
      b.onclick = () => {
        if (a?.start) window.dispatchEvent(new CustomEvent("greatness:start", { detail: a.start }));
        else if (a?.route) location.hash = a.route;
        else if (a?.ask) send(a.ask);
      };
    });
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  };

  let sending = false;
  const send = async text => {
    text = text.trim();
    if (!text || sending) return;
    sending = true;
    const history = state.chat.slice();
    state.chat.push({ role: "user", content: text });
    state.chat = state.chat.slice(-40);
    save(); draw();
    const b = document.createElement("div");
    b.className = "msg bot";
    b.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
    chat.appendChild(b);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    const stream = t => { b.innerHTML = md(t); window.scrollTo({ top: document.body.scrollHeight }); };
    let reply, auto = null;
    try {
      const cmd = parseCommand(text);
      const r = cmd && runCommand(cmd);
      if (/ce que tu peux faire|que peux[- ]tu faire|tes (pouvoirs|capacites)|aide$/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
        reply = { role: "assistant", content: `Je réponds à toutes tes questions, et je peux aussi **modifier l'app pour toi**. Par exemple :\n${COMMAND_EXAMPLES.map(e => `• « ${e} »`).join("\n")}`, actions: COMMAND_EXAMPLES.slice(0, 3).map(e => ({ label: e, ask: e })) };
      } else if (r) {
        await new Promise(res => setTimeout(res, 350));
        reply = { role: "assistant", content: r.text, actions: r.actions };
        auto = r.auto;
        if (r.mood) spidey.react(r.mood === "party" ? "party" : "happy");
      } else if (aiReady()) {
        const msgs = [...history, { role: "user", content: text }].slice(-16).map(m => ({ role: m.role, content: m.content }));
        let out = "";
        reply = { role: "assistant", content: await aiChat(msgs, d => stream((out += d))) };
      } else if (llm.info().ready) {
        reply = { role: "assistant", content: await llm.chat(llmMessages(history, text), { onDelta: stream }) };
        if (!reply.content) throw new Error("vide");
      } else {
        await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
        const a = answer(text);
        const loadingNote = llm.info().status === "loading" ? "\n\n(L'IA intelligente se charge, elle prendra le relais dans un instant.)" : "";
        reply = { role: "assistant", content: a.text + loadingNote, actions: a.actions };
      }
    } catch (err) {
      const a = answer(text);
      reply = { role: "assistant", content: a.text, actions: a.actions };
    }
    state.chat.push(reply);
    save(); draw();
    sending = false;
    if (!auto) spidey.react("happy");
    if (auto?.route) setTimeout(() => (location.hash = auto.route), 500);
    if (auto?.start) setTimeout(() => window.dispatchEvent(new CustomEvent("greatness:start", { detail: auto.start })), 500);
  };

  $("#f", view).onsubmit = e => { e.preventDefault(); const q = $("#q", view); send(q.value); q.value = ""; };
  $$("#sugg .chip", view).forEach(c => c.onclick = () => send(c.textContent));
  $("#clear", view)?.addEventListener("click", () => { state.chat = []; save(); renderCoach(view); });
  draw();
}
