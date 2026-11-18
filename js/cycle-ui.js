// Périodisation, côté écran : la carte « Ton cycle » de l'onglet Progrès (les 7 semaines, le bloc en cours et ce qu'il
// change) et la note du bloc dans l'aperçu d'une séance. Calculs : planner.js (cycleInfo, BLOCKS, blockTargets).
import { state } from "./store.js";
import { cycleInfo, BLOCKS, blockAt, blockTargets } from "./planner.js";
import { esc } from "./ui.js";

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
      <p class="xs muted cy-next"><span>Ensuite :</span> <b>${esc(BLOCKS[nextBlock].name)}</b> <span>dans</span> <span class="tnum">${inWeeks}</span> <span>${inWeeks > 1 ? "semaines" : "semaine"}.</span></p>
    </div>`;
}

// Note de l'aperçu d'une séance adaptée à l'objectif (HTML) : le bloc en cours et ce qu'il change
export function blockNote(program, now = Date.now()) {
  const c = cycleInfo(now);
  if (!c.week || c.deload || !program || program.simple || ["cardio", "custom", "mobility", "stretch", "care"].includes(program.cat) || program.classic) return "";
  return `<b>Bloc ${esc(BLOCKS[c.block].name)}.</b> <span>${nb(esc(BLOCKS[c.block].text))}</span>`;
}
