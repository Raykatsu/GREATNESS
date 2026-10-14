// Objectifs chiffrés : carte (accueil, onglet Séances), création guidée (exercice, niveau actuel, objectif conseillé,
// durée), suivi semaine par semaine avec la courbe attendue, séance de la semaine et test final.
import { EXERCISES } from "./data.js";
import { state, save } from "./store.js";
import { KINDS, POPULAR, PHASES, STATUS, kindOf, currentLevel, suggestTarget, ambition, newGoal, planOf, prescription, progressOf,
  activeGoals, goalSession, goalTitle, fmtValue } from "./goals.js";
import { pickExercises } from "./train.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = { target: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>') };
const num = v => String(v).replace(".", ",");
const exName = id => EXERCISES[id]?.name || id;
const WEEK = 7 * 864e5;
const presc = (g, p) => (p.phase === "test" ? `objectif ${fmtValue(g.kind, g.target)}`
  : `${p.sets} × ${p.reps}${g.kind === "time" ? " s" : g.kind === "reps" ? " reps" : ""}${p.weight ? ` à ${num(p.weight)} kg` : ""}`);
const byId = id => (state.goals || []).find(g => g.id === id);
let refresh = () => {};
// Dernier résultat de test (3 semaines), tant qu'on ne l'a pas rangé
const recentResult = () => (state.goals || []).filter(g => g.result && !g.seen && Date.now() - g.result.at < 21 * 864e5).sort((a, b) => b.result.at - a.result.at)[0];

/* ---------- Carte ---------- */
export function goalCard({ invite = false } = {}) {
  const g = activeGoals()[0], res = !g && recentResult();
  if (res) {
    const ok = res.result.success;
    return `<section class="card goal-card gc-res ${ok ? "ok" : ""}"><div class="gc-top"><span class="gc-ic">${ok ? I.trophy : IC.target}</span>
      <div class="grow"><b>${ok ? "Objectif atteint !" : "Test final passé"}</b><span class="xs muted">${esc(goalTitle(res))} · résultat ${esc(fmtValue(res.kind, res.result.value))}</span></div></div>
      <div class="grid2 mt-s"><button class="btn btn-soft btn-sm" data-goal-seen="${res.id}">${I.check} Ranger</button><button class="btn btn-primary btn-sm" data-goal-again="${res.id}">${I.refresh} Nouveau cycle</button></div></section>`;
  }
  if (!g) return invite ? `<button class="card tap free-card goal-card gc-invite" id="goal-new"><span class="bi">${IC.target}</span>
      <span class="grow"><b>Objectif chiffré</b><span class="xs muted">8 à 12 semaines pour atteindre un chiffre : 100 kg au développé couché, 15 tractions…</span></span>
      <span class="chev">${I.chev}</span></button>` : "";
  const pr = progressOf(g), p = prescription(g, pr.week);
  return `<section class="card tap goal-card" data-goal="${g.id}">
    <div class="gc-top"><span class="gc-ic">${IC.target}</span><div class="grow"><b>${esc(goalTitle(g))}</b>
      <span class="xs muted">Semaine ${pr.week}/${g.weeks} · ${PHASES[pr.phase]} · <span class="gc-st st-${pr.status}">${STATUS[pr.status]}</span></span></div><span class="chev">${I.chev}</span></div>
    <div class="gc-bar" role="progressbar" aria-valuenow="${Math.round(pr.pct * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(pr.pct * 100).toFixed(1)}%"></i></div>
    <div class="gc-ends xs muted tnum"><span>${esc(fmtValue(g.kind, g.base))}</span>${pr.best > g.base ? `<span>meilleur ${esc(fmtValue(g.kind, pr.best))}</span>` : ""}<span>${esc(fmtValue(g.kind, g.target))}</span></div>
    <div class="gc-week"><span class="grow small">${p.phase === "test" ? "C'est la semaine du <b>test final</b> !" : `Cette semaine : <b>${esc(presc(g, p))}</b> · ${Math.min(pr.thisWeek, g.perWeek)}/${g.perWeek} séance${g.perWeek > 1 ? "s" : ""}`}</span>
      <button class="btn btn-primary btn-sm" data-goal-go="${g.id}">${I.play} ${p.phase === "test" ? "Le test" : "Séance"}</button></div>
  </section>`;
}
export function bindGoalCard(root, onChange) {
  refresh = onChange || (() => {});
  $("#goal-new", root)?.addEventListener("click", () => openGoalCreate());
  $$("[data-goal]", root).forEach(el => el.onclick = e => { if (!e.target.closest("button")) openGoal(el.dataset.goal); });
  $$("[data-goal-go]", root).forEach(b => b.onclick = () => startGoal(byId(b.dataset.goalGo)));
  $$("[data-goal-seen]", root).forEach(b => b.onclick = () => { const g = byId(b.dataset.goalSeen); if (g) { g.seen = true; g.at = Date.now(); save(); refresh(); } });
  $$("[data-goal-again]", root).forEach(b => b.onclick = () => { const g = byId(b.dataset.goalAgain); if (g) openGoalCreate({ exId: g.exId, base: g.result?.value || g.base, from: g }); });
}
export function startGoal(g) {
  if (!g) return;
  window.dispatchEvent(new CustomEvent("greatness:start", { detail: goalSession(g) }));
}

/* ---------- Création ---------- */
export function openGoalCreate(pre = {}) {
  const d = { exId: pre.exId || "bench", weeks: pre.weeks || 10, perWeek: 2, touched: false };
  const level = id => currentLevel(id);
  const reset = () => {
    const measured = level(d.exId);
    d.base = pre.exId === d.exId && pre.base ? pre.base : measured || defaultBase(d.exId);
    d.measured = measured > 0;
    if (!d.touched) d.target = suggestTarget(d.exId, d.base, d.weeks);
  };
  reset();
  const sh = sheet(`<div class="eyebrow">Objectif chiffré</div><h2 class="h2">Atteindre un chiffre</h2>
    <p class="muted small">De 8 à 12 semaines guidées : la progression semaine par semaine, des semaines allégées, puis un test final.</p>
    <div class="seg mt" id="gn-kind">${Object.entries(KINDS).map(([k, v]) => `<button data-k="${k}">${v.name}</button>`).join("")}</div>
    <div class="chips gn-ex mt-s" id="gn-ex"></div>
    <div class="grid2 mt"><label class="field"><span id="gn-base-l"></span><input class="input" id="gn-base" type="number" inputmode="decimal" min="0"/></label>
      <label class="field"><span>Objectif</span><input class="input" id="gn-target" type="number" inputmode="decimal" min="0"/></label></div>
    <p class="xs muted gn-hint" id="gn-hint"></p>
    <div class="eyebrow mt">Durée</div>
    <div class="seg" id="gn-weeks">${[8, 10, 12].map(w => `<button data-w="${w}">${w} semaines</button>`).join("")}</div>
    <div class="eyebrow mt">Séances par semaine sur cet exercice</div>
    <div class="seg" id="gn-per">${[1, 2, 3].map(n => `<button data-n="${n}">${n}</button>`).join("")}</div>
    <div class="eyebrow mt">Ton programme</div>
    <ol class="gd-weeks gn-plan" id="gn-plan"></ol>
    <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="gn-go">${IC.target} Lancer le programme</button></div>`, { z: 55 });
  const kind = () => kindOf(d.exId), unit = () => KINDS[kind()].unit;
  const draw = () => {
    const k = kind();
    $$("#gn-kind button", sh.el).forEach(b => b.classList.toggle("on", b.dataset.k === k));
    const list = [...new Set([...POPULAR[k], d.exId])].filter(id => EXERCISES[id] && kindOf(id) === k);
    $("#gn-ex", sh.el).innerHTML = list.map(id => `<button class="chip ${id === d.exId ? "on" : ""}" data-ex="${id}">${esc(exName(id))}</button>`).join("")
      + `<button class="chip" id="gn-other">${I.search} Autre…</button>`;
    $("#gn-base-l", sh.el).innerHTML = `${k === "load" ? "Max actuel" : k === "time" ? "Record actuel" : "Max d'affilée"} <i class="dim">(${unit()})</i>`;
    $("#gn-base", sh.el).value = d.base || "";
    $("#gn-target", sh.el).value = d.target || "";
    $("#gn-base", sh.el).step = $("#gn-target", sh.el).step = k === "load" ? "0.5" : k === "time" ? "5" : "1";
    $$("#gn-weeks button", sh.el).forEach(b => b.classList.toggle("on", +b.dataset.w === d.weeks));
    $$("#gn-per button", sh.el).forEach(b => b.classList.toggle("on", +b.dataset.n === d.perWeek));
    $$("#gn-ex [data-ex]", sh.el).forEach(b => b.onclick = () => { d.exId = b.dataset.ex; d.touched = false; reset(); draw(); });
    $("#gn-other", sh.el).onclick = () => pickExercises(([id]) => { if (!id) return; d.exId = id; d.touched = false; reset(); draw(); }, { single: true, title: "Exercice de l'objectif" });
    hint(); plan();
  };
  const hint = () => {
    const a = ambition(kind(), d.base, d.target, d.weeks);
    $("#gn-hint", sh.el).innerHTML = `${d.measured ? "Max mesuré d'après tes séances des 6 dernières semaines." : kind() === "load" ? "Jamais mesuré : mets la charge que tu soulèverais une fois." : "Jamais mesuré : mets ton meilleur essai."}
      ${a.level ? ` <span class="chip amb-${a.level}">${a.label}</span>` : d.target && d.base && d.target <= d.base ? ` <span class="chip amb-3">L'objectif doit dépasser ton niveau actuel</span>` : ""}`;
  };
  const plan = () => {
    if (!(d.base > 0 && d.target > d.base)) { $("#gn-plan", sh.el).innerHTML = ""; return; }
    const g = newGoal({ ...d }), weeks = planOf(g), rows = [];
    // semaines voisines de la même phase regroupées : « S1–3 · Volume : 4 × 6 à 67,5 → 72,5 kg »
    for (const p of weeks) {
      const last = rows.at(-1);
      if (last && last.phase === p.phase && p.phase !== "allege") last.to = p; else rows.push({ phase: p.phase, from: p, to: p });
    }
    $("#gn-plan", sh.el).innerHTML = rows.map(r => `<li class="ph-${r.phase}"><span class="w tnum">S${r.from.week}${r.to.week > r.from.week ? `–${r.to.week}` : ""}</span>
      <span class="grow"><b>${PHASES[r.phase]}</b><span class="small muted">${esc(span(g, r))}</span></span></li>`).join("");
  };
  const span = (g, r) => {
    if (r.phase === "test") return `objectif ${fmtValue(g.kind, g.target)}`;
    const a = presc(g, r.from), b = presc(g, r.to);
    if (a === b) return a;
    return g.kind === "load" ? `${r.from.sets} × ${r.from.reps} à ${num(r.from.weight)} → ${num(r.to.weight)} kg` : `${r.from.sets} × ${r.from.reps} → ${r.to.sets} × ${r.to.reps}${g.kind === "time" ? " s" : " reps"}`;
  };
  $$("#gn-kind button", sh.el).forEach(b => b.onclick = () => { if (kind() === b.dataset.k) return; d.exId = POPULAR[b.dataset.k][0]; d.touched = false; reset(); draw(); });
  $$("#gn-weeks button", sh.el).forEach(b => b.onclick = () => { d.weeks = +b.dataset.w; if (!d.touched) d.target = suggestTarget(d.exId, d.base, d.weeks); draw(); });
  $$("#gn-per button", sh.el).forEach(b => b.onclick = () => { d.perWeek = +b.dataset.n; draw(); });
  const val = el => { const v = parseFloat(String(el.value).replace(",", ".")); return v > 0 ? (kind() === "load" ? Math.round(v * 2) / 2 : Math.round(v)) : 0; };
  $("#gn-base", sh.el).oninput = e => { d.base = val(e.target); d.measured = false; if (!d.touched && d.base) { d.target = suggestTarget(d.exId, d.base, d.weeks); $("#gn-target", sh.el).value = d.target; } hint(); plan(); };
  $("#gn-target", sh.el).oninput = e => { d.target = val(e.target); d.touched = true; hint(); plan(); };
  $("#gn-go", sh.el).onclick = async () => {
    if (!(d.base > 0)) { $("#gn-base", sh.el).focus(); return toast("Indique ton niveau actuel."); }
    if (!(d.target > d.base)) { $("#gn-target", sh.el).focus(); return toast("L'objectif doit dépasser ton niveau actuel."); }
    const same = activeGoals().find(g => g.exId === d.exId);
    if (same && !(await confirmSheet("Remplacer l'objectif en cours ?", `« ${goalTitle(same)} » sera abandonné.`, "Remplacer", true))) return;
    if (same) { same.status = "abandoned"; same.at = Date.now(); }
    if (pre.from) { pre.from.seen = true; pre.from.at = Date.now(); }
    const g = newGoal({ exId: d.exId, base: d.base, target: d.target, weeks: d.weeks, perWeek: d.perWeek });
    (state.goals ||= []).push(g);
    save(); sh.close(); refresh();
    toast(`Programme lancé : ${goalTitle(g)} en ${g.weeks} semaines`, 3500);
    setTimeout(() => openGoal(g.id), 350);
  };
  draw();
}
// Sans historique : un point de départ plausible, à corriger
const defaultBase = id => {
  const bw = +state.profile?.bodyweight || 75, k = kindOf(id);
  if (k === "load") return Math.max(EXERCISES[id]?.step || 2.5, Math.round(({ bench: 0.7, squat: 0.9, deadlift: 1.1, ohp: 0.45, hip_thrust: 1, row: 0.6 }[id] || 0.4) * bw / 2.5) * 2.5);
  return k === "time" ? 45 : ({ pullup: 5, chinup: 6, dips: 8, pushup: 15, air_squat: 25 }[id] || 10);
};

/* ---------- Suivi ---------- */
export function openGoal(id) {
  const g = byId(id);
  if (!g) return;
  const pr = progressOf(g), cur = pr.week, active = g.status === "active";
  const sh = sheet(`<div class="eyebrow">Objectif chiffré · ${active ? `semaine ${cur}/${g.weeks}` : g.result ? "terminé" : "arrêté"}</div>
    <h2 class="h2">${esc(goalTitle(g))}</h2>
    <span class="chip gc-st st-${pr.status}">${active || g.result ? STATUS[pr.status] : "Abandonné"}</span>
    <div class="gd-stats mt">
      <div><small>Départ</small><b class="tnum">${esc(fmtValue(g.kind, g.base))}</b></div>
      <div><small>${g.result ? "Test final" : "Meilleur mesuré"}</small><b class="tnum">${esc(fmtValue(g.kind, g.result ? g.result.value : pr.best || g.base))}</b></div>
      <div><small>${active ? "Jours restants" : "Objectif"}</small><b class="tnum">${active ? pr.daysLeft : esc(fmtValue(g.kind, g.target))}</b></div>
    </div>
    ${chart(g)}
    <p class="xs muted">Trait : la progression prévue. Points : ton meilleur niveau à chaque séance${g.kind === "load" ? " (1RM estimé d'après les séries et le ressenti)" : ""}.</p>
    <div class="eyebrow mt">Le programme</div>
    <ol class="gd-weeks">${planOf(g).map(p => `<li class="ph-${p.phase} ${active && p.week === cur ? "on" : p.week < cur || !active ? "past" : ""}">
      <span class="w tnum">S${p.week}</span><span class="grow"><b>${PHASES[p.phase]}</b><span class="small muted">${esc(presc(g, p))}</span></span>
      ${weekDone(g, p.week) ? `<span class="gd-ok">${I.check}</span>` : ""}</li>`).join("")}</ol>
    <p class="xs muted">Les charges se recalent toutes seules : séries manquées, elles baissent un peu ; réussies avec de la marge, elles montent.</p>
    ${active ? `<div class="sheet-foot grid2"><button class="btn btn-soft" id="gd-stop">${I.x} Arrêter</button><button class="btn btn-primary" id="gd-go">${I.play} ${pr.phase === "test" ? "Passer le test" : "Séance de la semaine"}</button></div>`
      : `<div class="sheet-foot"><button class="btn btn-primary btn-block" id="gd-again">${I.refresh} Nouveau cycle</button></div>`}`, { z: 55 });
  $("#gd-go", sh.el)?.addEventListener("click", () => { sh.close(); startGoal(g); });
  $("#gd-again", sh.el)?.addEventListener("click", () => { sh.close(); openGoalCreate({ exId: g.exId, base: g.result?.value || pr.best || g.base, from: g }); });
  $("#gd-stop", sh.el)?.addEventListener("click", async () => {
    if (!(await confirmSheet("Arrêter cet objectif ?", "Tes séances restent dans l'historique.", "Arrêter", true))) return;
    g.status = "abandoned"; g.at = Date.now(); save(); sh.close(); refresh(); toast("Objectif arrêté");
  });
}
// Semaine faite : autant de séances sur l'exercice que prévu
function weekDone(g, w) {
  const a = g.start + (w - 1) * WEEK, b = a + WEEK;
  return (state.sessions || []).filter(s => s.date >= a && s.date < b && s.sets?.some(x => x.exId === g.exId)).length >= (w === g.weeks ? 1 : g.perWeek);
}
// Courbe : progression prévue (trait) et niveau mesuré à chaque séance (points)
function chart(g) {
  const W = 300, H = 110, pts = (g.log || []).map(l => ({ x: (l.d - g.start) / WEEK + 0.5, y: l.best }));
  if (g.result) pts.push({ x: (g.result.at - g.start) / WEEK + 0.5, y: g.result.value, r: true });
  const ys = [g.base, g.target, ...pts.map(p => p.y)], lo = Math.min(...ys) * 0.97, hi = Math.max(...ys) * 1.02;
  const X = x => 8 + (Math.min(g.weeks, Math.max(0, x)) / g.weeks) * (W - 16), Y = y => H - 10 - ((y - lo) / Math.max(1e-6, hi - lo)) * (H - 22);
  const exp = Array.from({ length: g.weeks + 1 }, (_, i) => { const v = g.base + (g.target - g.base) * Math.min(1, i / Math.max(1, g.weeks - 2)); return `${X(i).toFixed(1)},${Y(v).toFixed(1)}`; });
  const now = (Date.now() - g.start) / WEEK;
  return `<svg class="gd-chart" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <line class="tg" x1="8" x2="${W - 8}" y1="${Y(g.target).toFixed(1)}" y2="${Y(g.target).toFixed(1)}"/>
    <polyline class="ex" points="${exp.join(" ")}"/>
    ${g.status === "active" && now <= g.weeks ? `<line class="now" x1="${X(now).toFixed(1)}" x2="${X(now).toFixed(1)}" y1="6" y2="${H - 6}"/>` : ""}
    ${pts.map(p => `<circle class="${p.r ? "res" : "pt"}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.r ? 5 : 3}"/>`).join("")}
    <text x="${W - 10}" y="${(Y(g.target) - 4).toFixed(1)}" text-anchor="end">${esc(fmtValue(g.kind, g.target))}</text></svg>`;
}
