// Semaine adaptative : le coach ajuste la semaine en cours d'après ce qui s'est passé, et le propose sur l'accueil.
// - séance manquée hier ou avant-hier : la faire aujourd'hui (jour libre) ou la placer sur le prochain jour libre ;
// - muscles de la séance du jour pas remis : l'échanger avec une séance plus loin dans la semaine, sur des muscles prêts ;
// - pic de charge (js/balance.js) : alléger la séance du jour (une série de moins, charges un peu plus légères) ;
// - jour libre et muscles en retard : 25 minutes de rattrapage.
// Chaque proposition s'applique d'un geste ou se refuse ; un refus ne revient pas de la semaine. Les déplacements ne
// valent que pour cette semaine (state.weekAdapt, voir planner.js : adaptOf) : le programme type ne change pas.
import { state, save, getProgram, sessionsOn, weekStart } from "./store.js";
import { adaptOf, weekPlanNow, isWorkout, generateSession } from "./planner.js";
import { recovery, programStrain } from "./recovery.js";
import { trainingLoad, balanceOf } from "./balance.js";
import { MUSCLES } from "./body.js";
import { LOC } from "./i18n.js";
import { $$, esc, I } from "./ui.js";

const real = id => { const p = id ? getProgram(id) : null; return p && p.id !== "mobility" && isWorkout(p) ? p : null; };
const list = names => names.join(", ");
// typographie française : espace fine insécable avant « : ; ! ? » et après « (la traduction l'ignore, i18n.js)
const nb = html => html.replace(/ ([?!:;»])/g, "\u202f$1").replace(/« /g, "«\u202f");

// Propositions pour aujourd'hui (au plus 2, la plus utile d'abord) : { key, kind, ...données, act }
export function proposals(now = new Date()) {
  const plan = weekPlanNow(now), a = adaptOf(now), t = (now.getDay() + 6) % 7, start = weekStart(now);
  const dateOf = i => { const d = new Date(start); d.setDate(d.getDate() + i); return d; };
  const doneOn = i => sessionsOn(dateOf(i)).length > 0;
  const doneToday = doneOn(t), today = real(plan[t]), out = [];
  const nextFree = () => { for (let i = t + 1; i < 7; i++) if (!real(plan[i])) return i; return -1; };
  const fresh = key => !a.skip.includes(key);
  // 1. séance manquée hier ou avant-hier (pas faite ce jour-là ni depuis)
  for (const i of [t - 1, t - 2]) {
    const p = i >= 0 ? real(plan[i]) : null;
    if (!p || doneOn(i) || state.sessions.some(s => s.programId === p.id && s.date >= dateOf(i).getTime())) continue;
    const key = `missed:${p.id}:${i}`;
    if (!fresh(key)) break;
    if (!today && !doneToday) out.push({ key, kind: "missed", p, day: i, act: { moves: { [i]: null, [t]: p.id } } });
    else { const f = nextFree(); if (f >= 0) out.push({ key, kind: "missed", p, day: i, to: f, act: { moves: { [i]: null, [f]: p.id } } }); }
    break; // une à la fois
  }
  if (today && !doneToday) {
    // 2. muscles pas remis : échange avec la prochaine séance dont les muscles sont prêts
    const rec = recovery(state.sessions, now.getTime()), tired = programStrain(today, rec).filter(x => x.ready < 0.5);
    if (tired.length >= 2) for (let j = t + 1; j < 7; j++) {
      const q = real(plan[j]);
      if (!q || q.id === today.id || programStrain(q, rec).some(x => x.ready < 0.5)) continue;
      const key = `swap:${today.id}:${q.id}`;
      if (fresh(key)) out.push({ key, kind: "tired", p: today, q, day: j, muscles: tired.slice(0, 3).map(x => x.name), act: { moves: { [t]: q.id, [j]: today.id } } });
      break;
    }
    // 3. pic de charge : séance du jour allégée
    const L = trainingLoad(state.sessions, { now: now.getTime() });
    if (L.zone === "spike" && !a.light.includes(t) && fresh(`light:${t}`)) out.push({ key: `light:${t}`, kind: "spike", pct: Math.round((L.ratio - 1) * 100), act: { light: t } });
  } else if (!doneToday) {
    // 4. jour libre, muscles en retard : rattrapage court
    const B = balanceOf(state.sessions, { now: now.getTime() });
    if (B.enough && B.groups.length && B.low.length && fresh(`catch:${t}`))
      out.push({ key: `catch:${t}`, kind: "catchup", muscles: B.low.slice(0, 3).map(m => MUSCLES[m]), act: { start: { groups: B.groups, minutes: 25 } } });
  }
  return out.slice(0, 2);
}

// Accepter (déplacements, allègement ; renvoie la séance à lancer pour un rattrapage) ou refuser une proposition
export function apply(p, now = new Date()) {
  const a = adaptOf(now), next = { ...a, moves: { ...a.moves, ...(p.act.moves || {}) }, light: [...a.light], skip: [...a.skip, p.key] };
  if (p.act.light != null) next.light.push(p.act.light);
  state.weekAdapt = next; save();
  return p.act.start ? generateSession({ ...p.act.start, name: "Séance de rattrapage" }) : null;
}
export function dismiss(p, now = new Date()) {
  const a = adaptOf(now);
  state.weekAdapt = { ...a, skip: [...a.skip, p.key] }; save();
}

/* ---------- Carte de l'accueil ---------- */
const dayName = (i, now = new Date()) => { const d = weekStart(now); d.setDate(d.getDate() + i); return d.toLocaleDateString(LOC(), { weekday: "long" }); };
const ICON = { missed: I.clock, tired: I.swap, spike: I.bolt, catchup: I.play };
function itemHtml(x) {
  const n = s => `<b>« ${esc(s)} »</b>`;
  const body = {
    missed: () => ["Séance manquée", `${n(x.p.name)} <span>était prévue</span> <span>${esc(dayName(x.day))}.</span> ${x.to == null
      ? `<span>Aujourd'hui est libre : fais-la maintenant, ta semaine reste complète.</span>`
      : `<span>Ton prochain jour libre :</span> <span>${esc(dayName(x.to))}.</span>`}`, x.to == null ? "La faire aujourd'hui" : "La placer ce jour-là"],
    tired: () => ["Muscles pas encore remis", `<span>Échange tes séances :</span> ${n(x.q.name)} <span>aujourd'hui,</span> ${n(x.p.name)} <span>${esc(dayName(x.day))}.</span>
      <span>Le temps de récupérer pour :</span> <span>${esc(list(x.muscles))}.</span>`, "Échanger"],
    spike: () => ["Grosse semaine", `<span>Ta charge est</span> <b>+${x.pct} %</b> <span>au-dessus de tes 4 semaines d'avant. J'allège la séance du jour : une série de moins par exercice et des charges un peu plus légères.</span>`, "Alléger la séance"],
    catchup: () => ["Jour libre", `<span>En retard ces 4 semaines :</span> <span>${esc(list(x.muscles))}.</span> <span>25 minutes pour les rattraper, sans toucher au reste de ta semaine.</span>`, "Lancer le rattrapage"],
  }[x.kind]();
  return `<div class="wa-item k-${x.kind}"><span class="wa-ic">${ICON[x.kind]}</span><div class="grow">
    <b class="wa-t">${body[0]}</b><p class="small wa-w">${nb(body[1])}</p>
    <div class="wa-acts"><button class="btn btn-primary btn-sm" data-wa-go="${esc(x.key)}">${body[2]}</button><button class="btn btn-ghost btn-sm" data-wa-no="${esc(x.key)}">Non merci</button></div>
  </div></div>`;
}
export function weekAdaptCard(now = new Date()) {
  const ps = proposals(now);
  if (!ps.length) return "";
  return `<section class="card wa-card mt" id="wa-card"><div class="eyebrow wa-head">${I.bolt} Le coach adapte ta semaine</div>${ps.map(itemHtml).join("")}</section>`;
}
// onDone(texte du toast, séance à lancer ou null)
export function bindWeekAdapt(root, onDone) {
  const find = key => proposals().find(x => x.key === key);
  $$("[data-wa-go]", root).forEach(b => b.addEventListener("click", () => {
    const x = find(b.dataset.waGo);
    if (!x) return;
    const start = apply(x);
    onDone({ missed: "Semaine mise à jour", tired: "Séances échangées", spike: "Séance du jour allégée", catchup: "" }[x.kind], start);
  }));
  $$("[data-wa-no]", root).forEach(b => b.addEventListener("click", () => {
    const x = find(b.dataset.waNo);
    if (x) dismiss(x);
    onDone("", null);
  }));
}
