// L'avis du coach sur ce que tu manges, à l'écran (la logique est dans plate.js) : l'avis sur un aliment (feuille de la
// portion, bulle après l'ajout), le point de couleur de chaque aliment du journal, la carte « Ton assiette du jour » et
// sa feuille (ce qui est bien, à éviter, à réduire, ce qui manque, échanges conseillés, ta semaine, aliment par
// aliment), et le résumé donné au coach IA. Réglage : Moi → Réglages → Coach & sons → « Avis sur tes repas ». Les
// gabarits sont traduits puis remplis (affichés en translate="no", comme les piques du coach taquin).
import { state } from "./store.js";
import { tr } from "./i18n.js";
import { $, esc, sheet, I } from "./ui.js";
import { fillLine, banterOn, quip, quipOf } from "./banter.js";
import { judgeFood, dayReview, weekStats, TIERS, GRADES, REF, itemSituation, portionFact, plateSituation } from "./plate.js";
import { dayOf, dayKey, shiftKey, targets } from "./nutrition.js";

export const plateOn = () => state.profile?.plateTips !== false;
// un gabarit traduit puis rempli (accords, nombres, typographie) ; les noms d'aliments aussi traduits
const T = (t, v = {}) => fillLine(tr(t), v.f != null ? { ...v, f: tr(String(v.f)) } : v, state.profile?.sex);
const ICON = { top: "👍", ok: "👌", limit: "⚠️", avoid: "⛔" };

// Les 7 derniers jours (le jour regardé compris), pour la semaine
export const weekOf = (st, key) => Array.from({ length: 7 }, (_, i) => dayOf(st, shiftKey(key, i - 6)).items || []);

// La revue d'une journée du journal
export function reviewOf(st, key, { kcal = 2000, protein = 0, waterGoal = 0, now = new Date() } = {}) {
  const day = dayOf(st, key), isToday = key === dayKey(now);
  return dayReview(day.items || [], { kcal, protein, hour: isToday ? now.getHours() : 24, water: day.water || 0, waterGoal, week: weekStats(weekOf(st, key)) });
}

/* ---------- Un aliment ---------- */
// Le point de couleur d'un aliment du journal (rien pour « ça passe »)
export function tierDot(it) {
  if (!plateOn()) return "";
  const v = judgeFood(it, it.g);
  return v && v.tier !== "ok" ? `<i class="tier-dot t-${v.tier}" role="img" aria-label="${esc(TIERS[v.tier])}"></i>` : "";
}

// L'avis dans la feuille de la portion (mis à jour quand la quantité change)
export function verdictHtml(food, g) {
  if (!plateOn()) return "";
  const v = judgeFood(food, g);
  if (!v) return "";
  const fact = portionFact(v);
  return `<div class="pf-verdict t-${v.tier}" translate="no">
    <div class="vd-head"><i class="tier-dot t-${v.tier}"></i><b>${esc(tr(TIERS[v.tier]))}</b><span class="vd-grp">${esc(tr(v.name))}</span></div>
    <p>${esc(T(v.why))}</p>
    ${fact ? `<p class="vd-fact">${esc(T(fact.t, fact.v))}</p>` : ""}
    ${v.tip && v.tier !== "top" ? `<p class="vd-tip">${esc(T(v.tip))}</p>` : ""}
  </div>`;
}

// La bulle après l'ajout d'un aliment (déjà ajouté au journal du jour `key`) : la pique du coach taquin, ou l'avis.
// Les familles « à privilégier » ne sont saluées qu'une fois par jour ; « ça passe » : rien à dire. null sinon.
export function addedNote(food, g, key = dayKey()) {
  if (!plateOn()) return null;
  const v = judgeFood(food, g);
  if (!v) return null;
  const items = dayOf(state, key).items || [], all = items.map(x => judgeFood(x, x.g));
  const first = all.filter(x => x?.group === v.group).length <= 1;
  const week = weekStats(weekOf(state, key));
  if (banterOn()) {
    const sugarToday = all.reduce((a, x) => a + (x?.sugar || 0), 0);
    const sit = itemSituation(v, { name: food.name, first, week, sugarToday });
    const q = sit ? quip(sit.kind, { ...sit.vals, f: tr(String(sit.vals.f || "")) }) : "";
    if (q) return { text: q, banter: true };
  }
  if (v.tier === "ok" || (v.tier === "top" && !first)) return null;
  const fact = portionFact(v);
  const wk = !week.logged ? "" : v.group === "deli" ? T("Charcuterie cette semaine : %n g sur 150 g au plus.", { n: week.deli })
    : v.group === "redmeat" ? T("Viande rouge cette semaine : %n g sur 500 g au plus.", { n: week.red }) : "";
  const body = v.tier === "top" ? T(v.why) : [fact ? T(fact.t, fact.v) : wk || T(v.why), v.tip ? T(v.tip) : ""].filter(Boolean).join(" ");
  return { text: `${ICON[v.tier]} ${tr(TIERS[v.tier])} · ${tr(v.name)}\n${body}` };
}

/* ---------- La journée ---------- */
const chip = (cls, n, label) => (n ? `<span class="pc-chip ${cls}"><b class="tnum">${n}</b> ${esc(tr(label))}</span>` : "");
// La carte du journal (rien si le journal du jour est vide ou si l'avis est coupé)
export function plateCard(rv, { today = true } = {}) {
  if (!plateOn() || !rv?.n) return "";
  const top = rv.avoid[0] || rv.reduce[0] || rv.missing[0] || rv.good[0];
  return `<section class="card plate-card g-${rv.grade}" id="plate-open" role="button" tabindex="0" translate="no">
    <div class="pc-head"><span class="pc-score tnum">${rv.score}</span>
      <div class="grow"><b>${esc(tr(today ? "Ton assiette du jour" : "Ton assiette ce jour-là"))}</b><div class="small muted">${esc(tr(GRADES[rv.grade]))}</div></div>
      <span class="chev">${I.chev}</span></div>
    <div class="pc-chips">${chip("c-good", rv.good.length, rv.good.length > 1 ? "points forts" : "point fort")}${chip("c-avoid", rv.avoid.length, "à éviter")}${chip("c-reduce", rv.reduce.length, "à réduire")}${chip("c-miss", rv.missing.length, "à compléter")}</div>
    ${top ? `<p class="pc-top small">${esc(T(top.t, top.v))}</p>` : ""}
  </section>`;
}

// La semaine : charcuterie, viande rouge, alcool (au plus), poisson et légumineuses (au moins)
function weekHtml(w) {
  if (!w) return "";
  const row = (t, n, ref, max) => {
    const ok = max ? n <= ref : n >= ref, pct = Math.min(100, Math.round((n / ref) * 100));
    return `<li class="${ok ? "ok" : "bad"}"><div class="pw-l"><span>${esc(T(t, { n }))}</span><b>${ok ? "✓" : max ? "↓" : "+"}</b></div><i class="pw-bar"><i style="width:${pct}%"></i></i></li>`;
  };
  return `<h3 class="ps-h">${esc(tr("Ta semaine"))} <span class="muted small">${esc(T("Jours notés : %n sur 7", { n: w.logged }))}</span></h3>
    <ul class="ps-week">
      ${row("Charcuterie : %n g sur 150 g au plus", w.deli, REF.deliWeek, true)}
      ${row("Viande rouge : %n g sur 500 g au plus", w.red, REF.redWeek, true)}
      ${row("Alcool : %n verres sur 10 au plus", w.alc, REF.alcWeek, true)}
      ${row("Poisson : %n fois, 2 conseillées", w.fishDays, REF.fishWeek, false)}
      ${row("Légumineuses : %n fois, 2 conseillées", w.legumeDays, REF.legumeWeek, false)}
    </ul>`;
}

// La feuille de la revue : ce qui est bien, à éviter, à réduire, ce qui manque, échanges, semaine, aliment par aliment
export function openPlate(key, rv, { onLearn, coach = "" } = {}) {
  const isToday = key === dayKey(), items = dayOf(state, key).items || [];
  const sec = (cls, title, list) => (list.length ? `<h3 class="ps-h ${cls}">${esc(tr(title))}</h3><ul class="ps-list ${cls}">${list.map(x => `<li>${esc(T(x.t, x.v))}</li>`).join("")}</ul>` : "");
  const q = banterOn() ? quipOf(plateSituation(rv, isToday ? new Date().getHours() : 24), { seed: key }) : "";
  const each = items.map(it => ({ it, v: judgeFood(it, it.g) })).filter(x => x.v)
    .sort((a, b) => ["avoid", "limit", "top", "ok"].indexOf(a.v.tier) - ["avoid", "limit", "top", "ok"].indexOf(b.v.tier));
  const sh = sheet(`<div class="plate-sheet" translate="no">
    <h2 class="h2">${esc(tr(isToday ? "Ton assiette du jour" : "Ton assiette ce jour-là"))}</h2>
    <div class="ps-hero g-${rv.grade}"><div class="ps-score"><b class="tnum">${rv.score}</b><span>/100</span></div>
      <div class="grow"><b>${esc(tr(GRADES[rv.grade]))}</b><p class="small muted">${esc(T("D'après les repères de l'OMS et de Santé publique France (PNNS)."))}</p></div></div>
    ${q ? `<div class="coach-line quip"><div class="av">${coach}</div><p class="grow">${esc(q)}</p></div>` : ""}
    ${sec("s-good", "Ce qui est bien", rv.good)}
    ${sec("s-avoid", "À éviter au quotidien", rv.avoid)}
    ${sec("s-reduce", "À réduire", rv.reduce)}
    ${sec("s-miss", "Ce qui manque", rv.missing)}
    ${rv.swaps.length ? `<h3 class="ps-h s-swap">${esc(tr("Échanges conseillés"))}</h3><ul class="ps-swaps">${rv.swaps.map(s => `<li><b>${esc(tr(s.f))}</b><span>${esc(T(s.tip))}</span></li>`).join("")}</ul>` : ""}
    ${weekHtml(rv.week)}
    ${each.length ? `<h3 class="ps-h">${esc(tr("Aliment par aliment"))}</h3><div class="ps-items">${each.map(({ it, v }) => `<details class="ps-it t-${v.tier}"><summary><i class="tier-dot t-${v.tier}"></i><span class="grow ellipsis">${esc(tr(it.name))}</span><span class="ps-tier">${esc(tr(TIERS[v.tier]))}</span></summary>
      <p><b>${esc(tr(v.name))}</b> · ${esc(T(v.why))}</p>${v.tip && v.tier !== "top" ? `<p class="vd-tip">${esc(T(v.tip))}</p>` : ""}</details>`).join("")}</div>` : ""}
    <button class="btn btn-soft btn-block mt" id="ps-learn">${I.info} ${esc(tr("Les repères et leurs sources"))}</button>
    <p class="xs muted mt-s">${esc(T("Repères pour un adulte en bonne santé. Enceinte, mineur ou malade : demande l'avis d'un médecin ou d'un diététicien."))}</p>
  </div>`, { z: 90 });
  $("#ps-learn", sh.el)?.addEventListener("click", () => { sh.close(); onLearn?.("plate"); });
  return sh;
}

/* ---------- Pour le coach IA ---------- */
// L'avis sur l'assiette du jour, en une poignée de lignes (en français, comme le reste du contexte)
export function plateContext(st = state, now = new Date()) {
  const key = dayKey(now), t = targets(st.profile || {});
  const rv = dayReview(dayOf(st, key).items || [], { kcal: t.kcal, protein: t.p, hour: now.getHours(), week: weekStats(weekOf(st, key)) });
  if (!rv.n) return "";
  const fr = x => fillLine(x.t, x.v, "a");
  const part = (label, l) => (l.length ? `${label} : ${l.map(fr).join(" ")}` : "");
  return [`Avis sur l'assiette du jour (repères OMS et PNNS), note ${rv.score}/100.`, part("Bien", rv.good), part("À éviter", rv.avoid), part("À réduire", rv.reduce), part("À compléter", rv.missing)]
    .filter(Boolean).join("\n");
}
