// Onglet Coach : discussion avec Spider-Man (local, ou Claude si une clé est configurée).
import { state, save } from "./store.js";
import { answer } from "./brain.js";
import { aiReady, aiChat } from "./ai.js";
import { spidey } from "./spidey.js";
import { $, $$, esc, md, I } from "./ui.js";

const SUGGESTIONS = ["Fais mon bilan de la semaine", "Comment progresser au squat ?", "Que manger pour ma séance ?", "Je stagne, je fais quoi ?", "J'ai mal à l'épaule", "Comment bien m'échauffer ?", "Je n'ai pas la motivation"];

export function renderCoach(view) {
  const on = aiReady();
  view.innerHTML = `
    <div class="coach-head">
      <div class="coach-av" id="av"></div>
      <div class="grow"><h1 class="h2">Spider-Man</h1>
        <div class="status"><i></i> Ton coach · ${on ? "IA Claude connectée" : "mode gratuit, hors ligne"}</div></div>
      ${state.chat.length ? `<button class="icon-btn" id="clear" aria-label="Effacer la discussion">${I.trash}</button>` : ""}
    </div>
    <div class="chips mt" id="sugg">${SUGGESTIONS.map(s => `<button class="chip">${esc(s)}</button>`).join("")}</div>
    <div class="chat mt" id="chat"></div>
    <div class="composer"><form id="f"><input id="q" placeholder="Pose ta question…" autocomplete="off" enterkeyhint="send"/>
      <button class="btn btn-primary" aria-label="Envoyer">${I.send}</button></form></div>`;
  // mini Spider-Man dans l'avatar
  const sp = document.querySelector(".spidey .sp");
  if (sp) $("#av", view).innerHTML = sp.outerHTML.replace(/id="sp/g, 'id="av-sp').replace(/url\(#sp/g, "url(#av-sp").replace(/class="sp[^"]*"/, 'class="sp pose-wave"');

  const chat = $("#chat", view);
  const bubble = m => `<div class="msg ${m.role === "user" ? "me" : "bot"}">${m.role === "user" ? esc(m.content) : md(m.content)}${
    m.actions?.length ? `<div class="acts">${m.actions.map((a, i) => `<button class="chip red" data-act="${i}">${esc(a.label)}</button>`).join("")}</div>` : ""}</div>`;
  const draw = () => {
    const hello = { role: "assistant", content: `Salut ${state.profile.name || "héros"} ! Ton sympathique coach de quartier est là. Technique, nutrition, programme, motivation : demande-moi ce que tu veux.` };
    chat.innerHTML = [hello, ...state.chat].map(bubble).join("");
    $$("[data-act]", chat).forEach(b => {
      const msg = state.chat[$$(".msg", chat).indexOf(b.closest(".msg")) - 1];
      const a = msg?.actions?.[+b.dataset.act];
      b.onclick = () => { if (a?.route) location.hash = a.route; else if (a?.ask) send(a.ask); };
    });
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  };

  const send = async text => {
    text = text.trim();
    if (!text) return;
    state.chat.push({ role: "user", content: text });
    state.chat = state.chat.slice(-40);
    save(); draw();
    const b = document.createElement("div");
    b.className = "msg bot";
    b.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
    chat.appendChild(b);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    let reply = { role: "assistant", content: "" };
    try {
      if (aiReady()) {
        const msgs = state.chat.slice(-16).map(m => ({ role: m.role, content: m.content }));
        let out = "";
        reply.content = await aiChat(msgs, d => { out += d; b.innerHTML = md(out); });
      } else {
        await new Promise(r => setTimeout(r, 450 + Math.random() * 400));
        const a = answer(text);
        reply = { role: "assistant", content: a.text, actions: a.actions };
      }
    } catch (err) {
      const a = answer(text);
      reply = { role: "assistant", content: a.text + `\n\n(IA indisponible : ${err.message || err}. Réponse en mode gratuit.)`, actions: a.actions };
    }
    state.chat.push(reply);
    save(); draw();
    spidey.react("happy");
  };

  $("#f", view).onsubmit = e => { e.preventDefault(); const q = $("#q", view); send(q.value); q.value = ""; };
  $$("#sugg .chip", view).forEach(c => c.onclick = () => send(c.textContent));
  $("#clear", view)?.addEventListener("click", () => { state.chat = []; save(); renderCoach(view); });
  draw();
}
