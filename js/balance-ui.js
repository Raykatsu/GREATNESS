// Onglet Progrès : « Charge d'entraînement » (cette semaine face aux 4 précédentes) et « Équilibre musculaire » (séries par
// muscle et par semaine sur 4 semaines, déséquilibres, séance de rattrapage). Calculs : js/balance.js.
import { state } from "./store.js";
import { MUSCLES } from "./body.js";
import { GROUPS, generateSession } from "./planner.js";
import { balanceOf, trainingLoad, volLevel } from "./balance.js";
import { $, esc, I } from "./ui.js";

const ZONE = { new: ["En rodage", ""], ok: ["Idéale", "green"], high: ["En hausse", "amber"], spike: ["Pic", "red"], low: ["En baisse", "blue"] };
const ORDER = ["pecs", "delts", "traps", "lats", "biceps", "triceps", "abs", "lowerback", "glutes", "quads", "hams", "calves"];
// typographie française : espace fine insécable avant « : ; ! ? » (la traduction l'ignore, i18n.js)
const nb = s => s.replace(/ ([?!:;»])/g, "\u202f$1");

export function loadCardHtml(sessions = state.sessions) {
  const L = trainingLoad(sessions), max = Math.max(1, ...L.weeks), [name, chip] = ZONE[L.zone];
  const big = L.ratio == null ? "—" : `${L.ratio >= 1 ? "+" : "−"}${Math.round(Math.abs(L.ratio - 1) * 100)} %`;
  return `<div class="section"><h2>Charge d'entraînement</h2><span class="xs muted">cette semaine</span></div>
    <div class="card load-card z-${L.zone}">
      <div class="row between"><div><div class="load-big num">${big}</div><div class="xs muted">face à tes 4 semaines d'avant</div></div><span class="chip ${chip}">${name}</span></div>
      <div class="load-bars" aria-hidden="true">${L.weeks.map((w, i) => `<i class="${i === L.weeks.length - 1 ? "cur" : ""}" style="height:${Math.max(4, (w / max) * 100).toFixed(0)}%"></i>`).join("")}</div>
      <p class="small muted load-t">${nb(esc(L.text))}</p>
    </div>`;
}

export function balanceCardHtml(sessions = state.sessions) {
  const B = balanceOf(sessions);
  const head = `<div class="section"><h2>Équilibre musculaire</h2><span class="xs muted">séries par semaine</span></div>`;
  if (!B.enough) return `${head}<div class="card empty" id="bal-card">${I.flame}<b>Encore quelques séances</b>Après 3 séances, je te montre les muscles en retard et les déséquilibres à corriger.</div>`;
  const bar = m => {
    const n = B.sets[m], lv = volLevel(n);
    return `<div class="bal-row lv-${lv}"><span class="bal-n">${esc(MUSCLES[m])}</span>
      <span class="bal-bar" role="img" aria-label="${esc(MUSCLES[m])} : ${String(n).replace(".", ",")}"><i style="width:${Math.min(100, (n / 25) * 100).toFixed(1)}%"></i></span>
      <b class="bal-v tnum">${String(n).replace(".", ",")}</b></div>`;
  };
  return `${head}<div class="card bal-card" id="bal-card">
      <div class="bal-key xs muted"><span><i class="k-low"></i>Peu</span><span><i class="k-ideal"></i>Idéal : 10 à 20</span><span><i class="k-high"></i>Beaucoup</span></div>
      <div class="bal-list">${ORDER.map(bar).join("")}</div>
      ${B.issues.length ? `<ul class="bal-issues">${B.issues.map(x => `<li>${I.info}<span>${nb(esc(x.text))}</span></li>`).join("")}</ul>`
        : B.low.length ? "" : `<p class="small muted bal-ok">${I.check} Tout est bien équilibré : continue comme ça.</p>`}
      ${B.low.length ? `<p class="small bal-lowt">En retard : <b>${esc(B.low.slice(0, 4).map(m => MUSCLES[m]).join(", "))}</b></p>` : ""}
      ${B.groups.length ? `<button class="btn btn-primary btn-sm btn-block mt-s" id="bal-go" data-g="${B.groups.join(",")}">${I.play} Séance de rattrapage : ${esc(B.groups.map(g => GROUPS[g]?.name || g).join(" + "))}</button>` : ""}
    </div>`;
}

// Séance de rattrapage : le générateur compose une séance pour les groupes en retard, à la durée habituelle
export function bindBalance(root) {
  $("#bal-go", root)?.addEventListener("click", e => {
    const groups = e.currentTarget.dataset.g.split(",");
    const p = generateSession({ groups, minutes: state.profile.minutes || 45, name: "Séance de rattrapage" });
    dispatchEvent(new CustomEvent("greatness:start", { detail: p }));
  });
}
