// Écran du bilan de la semaine : carte sur l'accueil (dimanche soir → mardi), feuille détaillée, analyse
// du coach par l'IA en ligne (avec ajustements proposés en boutons), liste des bilans dans Progrès.
import { state, save } from "./store.js";
import { weekReport, reviewWeek, reportText, mondayOf } from "./weekly.js";
import { athleteContext } from "./brain.js";
import { onlineReady, onlineChat } from "./online.js";
import { parseActions, streamText, describe, applyAction, actionsGuide } from "./aiact.js";
import { generateWeekPlan } from "./planner.js";
import { coachName } from "./chars/index.js";
import { $, $$, esc, md, I, sheet, toast, ring, animateRings, fmtNum } from "./ui.js";
import { LOC } from "./i18n.js";

const DAY = 864e5;
const rangeLabel = ts => {
  const a = new Date(ts), b = new Date(ts + 6 * DAY);
  return `Du ${a.getDate()} ${a.toLocaleDateString(LOC(), { month: "long" })} au ${b.getDate()} ${b.toLocaleDateString(LOC(), { month: "long" })}`;
};
const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

// Carte de l'accueil : dimanche dès 17 h, lundi, et mardi tant que le bilan n'a pas été ouvert
export function reviewCard(now = new Date()) {
  const start = reviewWeek(now), key = start.getTime(), d = now.getDay();
  if (!((d === 0 && now.getHours() >= 17) || d === 1 || (d === 2 && !state.reviews?.[key]?.seen))) return "";
  const r = weekReport(state, start);
  if (r.empty) return "";
  return `<button class="card banner review-card mt" id="review-open" data-week="${key}">${ring(r.score / 100, `<b class="tnum">${r.score}</b>`, 50)}
    <div class="grow"><b>Bilan de ta semaine</b><div class="small muted">${r.sessions}/${r.planned} séances${r.prs.length ? ` · ${r.prs.length} record${r.prs.length > 1 ? "s" : ""}` : ""}${r.nutri ? ` · ${fmtNum(r.nutri.k)} kcal/jour` : ""}</div></div>${I.chev}</button>`;
}
export function bindReviewCard(root) {
  const b = $("#review-open", root);
  if (!b) return null;
  b.onclick = () => openReview(+b.dataset.week);
  return +b.dataset.week;
}

// Les derniers bilans (pour Progrès)
export function reviewsList(n = 4, now = new Date()) {
  const cur = mondayOf(now).getTime();
  return Array.from({ length: n }, (_, i) => cur - (i + 1) * 7 * DAY).map(ts => ({ ts, r: weekReport(state, new Date(ts)) })).filter(x => !x.r.empty);
}
export function reviewsHtml(now = new Date()) {
  const list = reviewsList(4, now);
  if (!list.length) return "";
  return `<div class="section"><h2>Bilans de la semaine</h2></div>
    <div class="card card-list">${list.map(({ ts, r }) => `<button class="rv-week" data-week="${ts}"><span class="rv-score tnum s${r.score >= 75 ? "hi" : r.score >= 50 ? "mid" : "lo"}">${r.score}</span>
      <span class="grow"><b>${rangeLabel(ts)}</b><span class="xs muted">${r.sessions}/${r.planned} séances · ${fmtNum(r.volume)} kg${r.prs.length ? ` · ${r.prs.length} record${r.prs.length > 1 ? "s" : ""}` : ""}</span></span>${I.chev}</button>`).join("")}</div>`;
}
export const bindReviews = root => $$(".rv-week", root).forEach(b => b.onclick = () => openReview(+b.dataset.week));

export function openReview(ts) {
  const r = weekReport(state, new Date(ts));
  state.reviews ||= {};
  const rec = (state.reviews[ts] ||= {});
  if (!rec.seen) { rec.seen = Date.now(); save({ silent: true }); }
  const mus = Object.entries(r.muscles).sort((a, b) => b[1] - a[1]);
  const tile = (v, l, sub = "") => `<div class="rv-tile"><b class="tnum">${v}</b><small>${l}</small>${sub}</div>`;
  const sh = sheet(`<div class="eyebrow">Bilan de la semaine</div><h2 class="h2" style="margin-top:2px">${rangeLabel(ts)}</h2>
    <div class="rv-top">${ring(r.score / 100, `<b class="tnum">${r.score}</b><small>/100</small>`, 96)}
      <div class="rv-tiles">${tile(`${r.sessions}/${r.planned}`, "séances")}${tile(`${fmtNum(r.volume)}`, "kg soulevés", r.dv != null ? `<i class="${r.dv >= 0 ? "up" : "down"}">${r.dv >= 0 ? "+" : ""}${r.dv} %</i>` : "")}
        ${tile(r.prs.length, `record${r.prs.length > 1 ? "s" : ""}`)}${tile(r.minutes, "minutes")}</div></div>
    ${mus.length ? `<div class="chips mt-s rv-mus">${mus.map(([m, n]) => `<span class="chip">${esc(m)} <b class="tnum">${n}</b></span>`).join("")}</div>` : ""}
    ${r.nutri ? `<div class="card rv-nut mt-s"><b>Nutrition</b><span class="small muted">${r.nutri.n} jour${r.nutri.n > 1 ? "s" : ""} noté${r.nutri.n > 1 ? "s" : ""} · ${fmtNum(r.nutri.k)} kcal / ${fmtNum(r.t.kcal)} · protéines ${r.nutri.p} / ${r.t.p} g par jour</span></div>` : ""}
    ${r.good.length ? `<h3 class="demo-h">Points forts</h3><ul class="demo-list ok">${r.good.map(x => `<li>${I.check}${esc(x)}</li>`).join("")}</ul>` : ""}
    ${r.todo.length ? `<h3 class="demo-h">À travailler</h3><ul class="demo-list todo">${r.todo.map(x => `<li>${ARROW}${esc(x)}</li>`).join("")}</ul>` : ""}
    <h3 class="demo-h">L'analyse de ${esc(coachName())}</h3>
    <div id="rv-ai" class="rv-ai">${rec.text ? md(rec.text) : onlineReady() ? `<button class="btn btn-primary btn-block" id="rv-go">${I.sparkle} Analyse détaillée par le coach</button>`
      : `<p class="small muted">Avec l'IA en ligne, ton coach t'écrit une analyse détaillée et propose d'ajuster ta semaine en un geste.</p>`}</div>
    <div class="acts" id="rv-acts"></div>`);
  animateRings(sh.el);
  const acts = $("#rv-acts", sh.el), created = {};
  const showActions = list => {
    acts.innerHTML = list.map((a, i) => `<button class="chip red" data-i="${i}">${esc(describe(a))}</button>`).join("");
    $$("[data-i]", acts).forEach(b => b.onclick = () => {
      const a = list[+b.dataset.i], res = applyAction(a, created);
      if (res.ok) { b.disabled = true; b.textContent = `✓ ${describe(a)}`; if (res.replan) state.weekPlan = generateWeekPlan(); save(); }
      toast(res.text, 3200);
    });
  };
  $("#rv-go", sh.el)?.addEventListener("click", async () => {
    const box = $("#rv-ai", sh.el);
    box.innerHTML = `<div class="rv-wait"><i class="spinner"></i><span>${esc(coachName())} analyse ta semaine…</span></div>`;
    try {
      const res = await onlineChat({
        search: false,
        system: `Tu es ${coachName()}, le coach sportif de l'app GREATNESS. Réponds en français, en tutoyant, avec des chiffres précis et un ton motivant.\n\n### Données de l'athlète\n${athleteContext({ full: true })}\n\n${actionsGuide("programme de la semaine séance")}`,
        messages: [{ role: "user", content: `${reportText(r)}\n\nFais le bilan de ma semaine : ce qui va, ce qui coince, puis 3 ajustements concrets pour la semaine prochaine (séances, charges, nutrition, récupération). Si c'est utile, propose aussi le programme de la semaine prochaine (week_plan) ou des charges (set_weight).` }],
        onDelta: t => { box.innerHTML = md(streamText(t)); },
      });
      const { text, actions } = parseActions(res.text);
      rec.text = text; rec.at = Date.now(); save();
      box.innerHTML = md(text);
      const auto = actions.filter(a => a.type === "remember");
      auto.forEach(a => applyAction(a));
      showActions(actions.filter(a => a.type !== "remember"));
    } catch (e) {
      box.innerHTML = `<p class="small muted">${esc(e.message || "L'IA en ligne ne répond pas.")}${e.detail ? ` (${esc(e.detail)})` : ""}</p>`;
    }
  });
}

export { reviewWeek };
