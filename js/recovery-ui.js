// Carte de récupération musculaire : sur l'accueil (silhouette en couleur) et en détail, muscle par muscle.
import { state, sessionsOn } from "./store.js";
import { bodyMap, MUSCLES } from "./body.js";
import { recovery, recoverySummary, programStrain, readyIn, LEVELS } from "./recovery.js";
import { todaysMission } from "./planner.js";
import { $, esc, I, sheet } from "./ui.js";

const pct = v => `${Math.round(v * 100)} %`;
const num = v => String(v).replace(".", ",");
const dot = t => (/[.…!]$/.test(t) ? t : t + "."); // fin de phrase sans double ponctuation
const names = (ms, n = 3) => ms.slice(0, n).map(m => MUSCLES[m]).join(", ") + (ms.length > n ? "…" : "");
// couleur de chaque muscle : niveau de récupération s'il a travaillé cette semaine, gris sinon
const colorOf = rec => m => (rec[m]?.week > 0 ? `mus ${LEVELS[rec[m].level].cls}` : "mz");
const recentWork = () => state.sessions.some(s => s.date > Date.now() - 7 * 864e5);

export function recoveryCard() {
  if (!recentWork()) return "";
  const rec = recovery(state.sessions), sum = recoverySummary(rec);
  const title = sum.tired.length ? `À reposer : ${names(sum.tired)}` : sum.almost.length ? `Presque prêts : ${names(sum.almost)}` : "Tout est récupéré";
  const sub = sum.fresh.length ? `Prêts : ${names(sum.fresh)}` : "Touche pour voir le détail de chaque muscle";
  return `<section class="card rec-card tap mt" id="rec-open" role="button" tabindex="0" aria-label="Récupération musculaire : ${esc(title)}">
    <div class="rec-mini">${bodyMap({}, { cls: colorOf(rec), label: "Récupération des muscles" })}</div>
    <div class="grow"><div class="eyebrow">Récupération</div><b class="rec-title">${esc(title)}</b><div class="small muted">${esc(sub)}</div></div>
    <span class="chev">${I.chev}</span></section>`;
}
export function bindRecoveryCard(root) {
  const el = $("#rec-open", root);
  if (!el) return;
  el.onclick = openRecovery;
  el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRecovery(); } };
}

// Une ligne d'avertissement quand la séance prévue tombe sur des muscles pas remis (accueil, aperçu de séance)
export function strainNote(program) {
  if (!program || !recentWork()) return "";
  const st = programStrain(program, recovery(state.sessions)).slice(0, 3);
  if (!st.length) return "";
  return `${st.map(x => `${x.name} ${pct(x.ready)}`).join(", ")} : pas encore remis. Le coach allège ces exercices (une série de moins).`;
}

// Volume de la semaine par muscle (séries dures, les muscles qui aident comptent pour moitié)
const volTag = w => (w >= 21 ? ["Beaucoup", "hi"] : w >= 10 ? ["Idéal", "ok"] : w >= 5 ? ["Correct", "mid"] : ["Peu", "lo"]);

export function openRecovery() {
  const rec = recovery(state.sessions), sum = recoverySummary(rec);
  const worked = Object.entries(rec).filter(([, r]) => r.week > 0).sort((a, b) => a[1].ready - b[1].ready || b[1].week - a[1].week);
  const rest = Object.keys(MUSCLES).filter(m => !rec[m].week);
  const m = todaysMission(), planned = !m.rest && !m.doneToday && !sessionsOn(new Date()).length ? m.program : null;
  const st = planned ? programStrain(planned, rec) : [];
  const advice = [];
  if (!worked.length) advice.push("Aucune séance ces 7 derniers jours : tous tes muscles sont frais.");
  else {
    if (sum.fresh.length) advice.push(dot(`Aujourd'hui, tu peux travailler à fond : ${names(sum.fresh, 4)}`));
    if (sum.tired.length) {
      const when = readyIn(Math.max(...sum.tired.map(x => rec[x].hours)));
      advice.push(`Laisse souffler ${names(sum.tired, 4)} : ${sum.tired.length > 1 ? when.replace("prêt", "tout sera prêt") : when}.`);
    }
    if (planned && st.length) advice.push(`Ta séance du jour (${planned.name}) tombe sur des muscles pas remis : je l'allège automatiquement, ou change de séance.`);
    else if (planned) advice.push(`Ta séance du jour (${planned.name}) tombe bien : ses muscles sont prêts.`);
    const low = worked.filter(([, r]) => r.week < 5).map(([x]) => x);
    if (low.length && worked.length > 2) advice.push(dot(`Peu travaillés cette semaine : ${names(low, 4)}`));
  }
  sheet(`<div class="rec-sheet">
    <div class="eyebrow">Ton corps cette semaine</div>
    <h2 class="h2">Récupération musculaire</h2>
    <p class="muted small">Calculée d'après tes séances des 7 derniers jours et leur dureté (ressenti). Les gros muscles mettent plus longtemps à récupérer que les petits.</p>
    <div class="rec-big">${bodyMap({}, { cls: colorOf(rec), label: "Récupération des muscles" })}</div>
    <div class="rec-leg">${[...LEVELS].reverse().map(l => `<span><i class="mus ${l.cls}"></i>${l.name}</span>`).join("")}<span><i class="mz"></i>Pas travaillé</span></div>
    <h3 class="demo-h">Le conseil du coach</h3>
    <ul class="demo-list ok">${advice.map(a => `<li>${I.sparkle}${esc(a)}</li>`).join("")}</ul>
    ${worked.length ? `<h3 class="demo-h">Muscle par muscle</h3>
    <ul class="rec-list">${worked.map(([x, r]) => { const [t, c] = volTag(r.week); return `<li>
      <span class="rec-dot mus ${LEVELS[r.level].cls}"></span>
      <span class="grow"><b>${esc(MUSCLES[x])}</b><small>${num(r.week)} série${r.week > 1 ? "s" : ""} cette semaine <em class="vol ${c}">${t}</em> · ${esc(readyIn(r.hours))}</small>
        <i class="rec-bar" aria-hidden="true"><b class="${LEVELS[r.level].cls}" style="width:${Math.max(4, r.ready * 100)}%"></b></i></span>
      <span class="rec-pct tnum">${pct(r.ready)}</span></li>`; }).join("")}</ul>
    <p class="xs muted mt">Repère : entre 10 et 20 séries par muscle et par semaine, c'est l'idéal pour progresser.</p>` : ""}
    ${rest.length && worked.length ? `<p class="small muted mt">Pas travaillés cette semaine : ${esc(rest.map(x => MUSCLES[x]).join(", "))}.</p>` : ""}
  </div>`);
}
