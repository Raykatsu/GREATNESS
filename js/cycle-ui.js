// Périodisation, côté écran : la carte « Ton cycle » de l'onglet Progrès (les 7 semaines, le bloc en cours et ce qu'il
// change, la semaine test à la fin du bloc Pic), le bilan du cycle (pendant la récupération et la semaine d'après) et
// la note du bloc dans l'aperçu d'une séance. Calculs : planner.js (cycleInfo, BLOCKS, blockTargets), cyclereport.js.
import { state } from "./store.js";
import { cycleInfo, BLOCKS, blockAt, blockTargets } from "./planner.js";
import { reportCycle, cycleReport } from "./cyclereport.js";
import { esc, fmtNum } from "./ui.js";

// typographie française : espace fine insécable avant « : ; ! ? » (la traduction l'ignore, i18n.js)
const nb = s => s.replace(/ ([?!:;»])/g, " $1");
const range = ([a, b]) => `${a}–${b}`;
const dec = x => String(x).replace(".", ",");

export function cycleCardHtml(now = Date.now()) {
  const c = cycleInfo(now);
  if (!c.week) return "";
  const B = BLOCKS[c.block], T = blockTargets(state.profile.goal, c.block);
  // prochain bloc : la semaine où il commence
  let k = c.pos + 1; while (k <= 7 && blockAt(k) === c.block) k++;
  const nextBlock = k > 7 ? "volume" : blockAt(k), inWeeks = k - c.pos;
  const seg = Array.from({ length: 7 }, (_, i) => `<i class="b-${blockAt(i + 1)} ${i + 1 < c.pos ? "past" : i + 1 === c.pos ? "cur" : ""}"></i>`).join("");
  return `<div class="section"><h2>Ton cycle</h2><span class="xs muted">semaine ${c.pos} sur 7</span></div>
    <div class="card cycle-card" id="cycle-card">
      <div class="cy-bar" aria-hidden="true">${seg}</div>
      <div class="cy-names xs muted" aria-hidden="true"><span style="grid-column:span 2">Volume</span><span style="grid-column:span 2">Force</span><span style="grid-column:span 2">Pic</span><span>Récup</span></div>
      <p class="cy-now"><b class="cy-b b-${c.block}">${esc(B.name)}</b> <span>${nb(esc(B.text))}</span></p>
      ${c.deload ? "" : `<p class="small muted cy-t"><span>Cette semaine :</span> <span class="tnum">${range(T.main)}</span> <span>reps sur les mouvements principaux, ressenti visé</span> <span class="tnum">${dec(T.rpe)}</span> <span>sur 10.</span></p>`}
      ${c.pos === 6 ? `<p class="small cy-test"><b>Semaine test</b> <span>${nb("Va chercher tes records sur tes mouvements principaux : ton bilan du cycle arrive avec la semaine de récupération.")}</span></p>` : ""}
      <p class="xs muted cy-next"><span>Ensuite :</span> <b>${esc(BLOCKS[nextBlock].name)}</b> <span>dans</span> <span class="tnum">${inWeeks}</span> <span>${inWeeks > 1 ? "semaines" : "semaine"}.</span></p>
    </div>`;
}

// Le bilan du cycle (cyclereport.js) : pendant la semaine de récupération, puis la première semaine du cycle suivant
export function cycleReportHtml(now = Date.now()) {
  if (state.profile.deload === false) return "";
  const n = reportCycle(state.cycleStart, now);
  if (!n) return "";
  const r = cycleReport(state.sessions || [], state.cycleStart, n);
  if (!r.sessions) return "";
  const pct = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}&nbsp;%`, tons = r.volume >= 10000;
  const verdict = r.up && r.up === r.tracked ? "Tous tes mouvements suivis ont progressé : le cycle a payé."
    : r.up ? "Des mouvements en progrès : le prochain cycle repart de plus haut."
    : r.records ? "Des records battus : la base est posée pour le prochain cycle."
    : "Cycle tenu : la régularité paie, le prochain va chercher plus haut.";
  return `<div class="section"><h2>Bilan du cycle <span class="tnum">${r.n}</span></h2><span class="xs muted">7 semaines</span></div>
    <div class="card cyr-card" id="cycle-report">
      <div class="cyr-stats">
        <div><b class="tnum">${r.sessions}</b><span>${r.sessions > 1 ? "séances" : "séance"}</span></div>
        <div><b class="tnum">${tons ? String(Math.round(r.volume / 100) / 10).replace(".", ",") : fmtNum(r.volume)}</b><span>${tons ? "tonnes soulevées" : "kg soulevés"}</span>${r.volumeVsPrev !== null ? `<i class="${r.volumeVsPrev >= 0 ? "up" : "down"}">${pct(r.volumeVsPrev)} <span>vs cycle ${r.n - 1}</span></i>` : ""}</div>
        <div><b class="tnum">${r.records}</b><span>${r.records > 1 ? "records" : "record"}</span></div>
      </div>
      ${r.lifts.length ? `<ul class="cyr-lifts">${r.lifts.map(l => `<li><span class="grow ellipsis">${esc(l.name)}</span>
        <span class="tnum muted">${dec(l.before)} → <b>${dec(l.now)}</b> kg</span><span class="cyr-pct ${l.pct > 0 ? "up" : l.pct < 0 ? "down" : ""}">${pct(l.pct)}</span></li>`).join("")}</ul>
        <p class="xs muted">${nb("1RM estimé : la charge maximale sur une répétition, d'après ta meilleure série du cycle, comparée à ton meilleur d'avant.")}</p>` : ""}
      <p class="small cyr-verdict">${nb(verdict)}</p>
    </div>`;
}

// Note de l'aperçu d'une séance adaptée à l'objectif (HTML) : le bloc en cours et ce qu'il change
export function blockNote(program, now = Date.now()) {
  const c = cycleInfo(now);
  if (!c.week || c.deload || !program || program.simple || ["cardio", "custom", "mobility", "stretch", "care"].includes(program.cat) || program.classic) return "";
  if (c.pos === 6) return `<b>Bloc ${esc(BLOCKS[c.block].name)}.</b> <b>Semaine test.</b> <span>${nb("Va chercher tes records sur tes mouvements principaux : ton bilan du cycle arrive avec la semaine de récupération.")}</span>`;
  return `<b>Bloc ${esc(BLOCKS[c.block].name)}.</b> <span>${nb(esc(BLOCKS[c.block].text))}</span>`;
}
