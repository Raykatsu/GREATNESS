// Onglet « Comprendre » de la nutrition : pourquoi tu manges autant (le calcul pas à pas, avec tes chiffres), pourquoi
// ton objectif s'adapte au jour le jour, à quoi servent protéines, glucides, lipides, fibres, eau, minéraux et
// vitamines, et les études sur lesquelles tout repose (nutri-refs.js). Plus la carte « Objectif du jour ajusté » du
// journal. HTML sans état, testé dans Node. Traduction : chaque texte est une phrase entière (js/lang/en.js), les
// chiffres personnels sont à part.
import { ACTIVITY, GOAL_ADJ, PROTEIN, bmrOf, targets } from "./nutrition.js";
import { dailyAdjust, safeFloor } from "./nutriadapt.js";
import { REFS, refBy } from "./nutri-refs.js";
import { GOALS } from "./data.js";
import { esc, fmtNum } from "./ui.js";
import { dec } from "./i18n.js";

// typographie française : espace fine insécable avant « : ; ! ? % » (la traduction l'ignore, i18n.js)
const nb = s => s.replace(/ ([?!:;»%])/g, "\u202f$1");
const d1 = x => dec(Math.round(x * 10) / 10);
const signed = n => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtNum(Math.abs(n))}`;
const kc = n => `${fmtNum(n)} kcal`;
const pct = (g, k, kcal) => Math.round((g * k * 100) / Math.max(1, kcal));
// renvoi vers une étude : un bouton (un lien « # » changerait d'écran), qui ouvre la liste des sources
export const cite = (...ids) => `<span class="nl-cites">${ids.map(id => `<button class="nl-cite" data-ref="${id}">${esc(refBy[id].short)}</button>`).join("")}</span>`;
const para = (text, ...ids) => `<p>${nb(text)}${ids.length ? ` ${cite(...ids)}` : ""}</p>`;

/* ---------- Le calcul ---------- */
const GOAL_TEXT = {
  seche: ["Un déficit modéré, environ 20 % sous ta dépense, pour perdre 0,5 à 1 % de ton poids par semaine. Plus vite, on perd du muscle et de la force : des athlètes qui perdaient 0,7 % de leur poids par semaine ont mieux gardé leur muscle et gagné plus de force que ceux qui en perdaient 1,4 %.", "helms", "garthe"],
  muscle: ["Un léger surplus, environ 10 % au-dessus de ta dépense : assez d'énergie pour construire du muscle sans stocker trop de gras. Le bon rythme : prendre 0,25 à 0,5 % de ton poids par semaine.", "slater19", "iraki"],
  force: ["Un petit surplus, environ 5 % au-dessus de ta dépense : de quoi bien récupérer et progresser sur tes charges, sans prise de gras inutile.", "slater11", "iraki"],
  forme: ["Autant que tu dépenses : ton poids reste stable et tu as l'énergie pour t'entraîner et récupérer.", "acsm"],
};
const step = (label, value, body = "", cls = "") => `<li class="nl-step ${cls}"><div class="nl-sl"><span>${nb(label)}</span><b class="tnum">${nb(value)}</b></div>${body}</li>`;

function calcHtml(p, base, adj, custom) {
  const female = p.sex === "f", w = +p.bodyweight || 75, h = +p.height || (female ? 165 : 177), a = +p.age || 28, days = +p.days || 3;
  const act = ACTIVITY[p.activity] || ACTIVITY.light, bmr = bmrOf(p), train = (days * 250) / 7, tdee = bmr * act.f + train;
  const goal = GOAL_ADJ[p.goal] != null ? p.goal : "forme", adjPct = Math.round(GOAL_ADJ[goal] * 100);
  const n = p.nutri || {}, formulaKcal = Math.round(tdee * (1 + GOAL_ADJ[goal]));
  const out = [];
  if (custom) out.push(`<p class="nl-note">${nb("Tu as fixé tes objectifs toi-même : l'app les respecte. Voici le calcul qu'elle ferait, pour comparer.")}</p>`);
  if (!p.height || !p.age || !p.sex) out.push(`<p class="nl-note">${nb("Calcul fait avec des valeurs par défaut : indique ta taille, ton âge et ton sexe dans Mes objectifs pour un résultat juste.")}</p>`);
  const steps = [
    step("Métabolisme de base", kc(Math.round(bmr)), `<div class="nl-formula tnum">10 × ${w} kg + 6,25 × ${h} cm − 5 × ${a} ans ${female ? "− 161" : "+ 5"}</div>
      ${para("Ce que ton corps dépense au repos complet, juste pour vivre : cœur, cerveau, respiration, température. C'est la plus grosse part de ta dépense. L'équation de Mifflin-St Jeor est la plus fiable pour l'estimer chez l'adulte en bonne santé.", "mifflin", "frankenfield")}`),
    step("Activité hors séances", `× ${dec(act.f)}`, `<div class="nl-formula"><span>${esc(act.name)}</span> · <span class="tnum">${kc(Math.round(bmr * act.f))}</span></div>
      ${para("Tout ce que tu fais en dehors de tes séances : marcher, travailler, bouger. Ton métabolisme de base est multiplié par un facteur qui va de 1,2 (assis toute la journée) à 1,65 (travail physique).", "fao")}`),
    step("Tes séances", `+${kc(Math.round(train))}`, `<div class="nl-formula tnum">${days} × 250 kcal ÷ 7</div>
      ${para("Estimation moyenne : chaque séance brûle environ 250 kcal de plus, réparties sur toute la semaine.")}`),
    step("Ta dépense de tous les jours", kc(Math.round(tdee)), "", "nl-sum"),
  ];
  if (base.adaptive) {
    steps.push(step("Ta dépense réelle, mesurée", kc(base.tdee), para("Même la meilleure formule peut se tromper de plus de 10 % : tes calories adaptatives mesurent ta vraie dépense, d'après ce que tu manges et l'évolution de ton poids (1 kg de poids de corps ≈ 7 700 kcal). Recalculées chaque lundi.", "frankenfield", "hall")));
    const r = +n.rate || 0, d = base.kcal - base.tdee;
    steps.push(step(r ? `Rythme visé : ${r > 0 ? "+" : "−"}${dec(Math.abs(r))} kg / semaine` : "Poids stable", d ? `${signed(d)} kcal` : "± 0 kcal"));
  } else {
    const [text, ...ids] = GOAL_TEXT[goal];
    steps.push(step(`Objectif : ${esc(GOALS[goal].name)}`, adjPct ? `${adjPct > 0 ? "+" : "−"}${Math.abs(adjPct)} %` : "± 0 %", para(text, ...ids)));
  }
  // relevé au minimum sûr
  if (!base.adaptive && base.kcal > Math.round(formulaKcal / 10) * 10 + 5)
    steps.push(step("Minimum sûr", kc(base.kcal), para("Ton objectif ne descend jamais sous ton minimum sûr : ton métabolisme de base + 5 %, et au moins 1 500 kcal (1 300 pour une femme). Manger trop peu trop longtemps nuit aux hormones, aux os et aux performances.", "mountjoy")));
  if (adj.delta) steps.push(step("Ajustement du jour", `${signed(adj.delta)} kcal`, `<p><span>${nb("Pour compenser les jours précédents :")}</span> <button class="link" data-goto="nl-adapt">voir le détail</button></p>`));
  if (custom) steps.push(step("Calcul de l'app", kc(base.kcal), "", "nl-sum"));
  steps.push(step(custom ? "Ton objectif personnalisé" : adj.delta ? "Ton objectif aujourd'hui" : "Ton objectif", kc(adj.kcal), "", "nl-sum nl-final"));
  return `${out.join("")}<ol class="nl-steps">${steps.join("")}</ol>`;
}

/* ---------- Pourquoi l'objectif s'adapte au jour le jour ---------- */
const AGO = ["", "Hier", "Avant-hier", "Il y a 3 jours"];
const RULE = {
  excess: "En sèche, un excès de plus de 100 kcal est réparti sur les 3 jours suivants : ton déficit de la semaine reste intact. Un jour sous l'objectif n'est pas rattrapé, ce serait manger plus pour rien.",
  deficit: "En prise de masse, un manque de plus de 100 kcal est rattrapé sur les 3 jours suivants : ton surplus de la semaine reste intact. Un jour au-dessus n'est pas retiré : quand on construit du muscle, un peu plus ne fait pas de mal.",
  both: "En maintien, la moitié de l'écart est compensée sur les 3 jours suivants, dans un sens comme dans l'autre : ton poids reste stable, sans compter au gramme près.",
};
function adaptHtml(p, base, adj) {
  const out = [];
  if (adj.off) out.push(`<p class="nl-note">${nb(base.custom ? "Avec des objectifs personnalisés, l'adaptation au jour le jour est en pause." : "L'adaptation au jour le jour est désactivée : tu peux la rallumer dans Mes objectifs.")}</p>`);
  else if (adj.days.length) {
    out.push(`<ul class="nl-days">${adj.days.map(d => `<li><b>${AGO[d.ago] || ""}</b> <span class="tnum">${kc(d.eaten)}</span> <span>notées pour un objectif de</span> <span class="tnum">${kc(base.kcal)}</span>
      <div class="nl-share"><span class="tnum">${signed(d.gap)} kcal</span> → <b class="tnum">${signed(d.share)} kcal</b> <span>par jour pendant 3 jours</span></div></li>`).join("")}</ul>`);
    out.push(`<p class="nl-today"><span>${nb("Aujourd'hui :")}</span> <b class="tnum">${adj.delta ? `${signed(adj.delta)} kcal` : "Pas de changement"}</b>${adj.delta ? ` <span>→</span> <b class="tnum">${kc(adj.kcal)}</b>` : ""}</p>`);
    if (adj.capped) out.push(`<p class="nl-note">${nb("Plafonné : au plus 350 kcal par jour, et 15 % de ton objectif.")}</p>`);
    if (adj.floored) out.push(`<p class="nl-note">${nb("Limité par ton minimum sûr : ton objectif ne descend pas plus bas.")}</p>`);
  } else out.push(`<p class="nl-today">${nb("Ces 3 derniers jours, rien à compenser : ton objectif est tenu, à 100 kcal près.")}</p>`);
  out.push(para(RULE[adj.dir] || RULE.both));
  out.push(para("Ton poids suit ton bilan d'énergie sur plusieurs jours, pas repas par repas : 300 kcal de trop un jour, c'est comme 100 kcal de trop trois jours de suite. Et faire varier les calories d'un jour à l'autre marche au moins aussi bien qu'un objectif fixe.", "hall12", "davoodi"));
  out.push(`<div class="eyebrow mt">Garde-fous</div><ul class="nl-list">
    <li>${nb("Au plus 350 kcal par jour, et jamais plus de 15 % de ton objectif : assez pour compenser, sans te priver ni gêner tes séances.")} ${cite("helms")}</li>
    <li><span>${nb("Jamais sous ton minimum sûr (ton métabolisme de base + 5 %) :")}</span> <b class="tnum">${kc(safeFloor(p, base))}</b>. <span>${nb("Manger trop peu nuit aux hormones, aux os et aux performances.")}</span> ${cite("mountjoy")}</li>
    <li>${nb("Les protéines ne bougent jamais : ce sont elles qui protègent ton muscle. Glucides (75 %) et lipides (25 %) absorbent la différence.")} ${cite("jager", "helms")}</li>
    <li>${nb("Une journée notée à moins de 60 % de l'objectif est sans doute incomplète : elle ne compte pas comme un manque.")}</li>
    <li>${nb("Ton plan de repas suit : la journée du jour est recalculée (féculents, fruits, matières grasses), protéines et légumes ne bougent pas.")}</li></ul>`);
  return out.join("");
}

/* ---------- À quoi sert chaque nutriment ---------- */
export const MACROS = [
  { id: "p", name: "Protéines", kcal: 4,
    role: "Elles apportent les acides aminés qui réparent et construisent tes muscles après chaque séance. Elles fabriquent aussi tes enzymes, tes hormones et tes anticorps.",
    why: [["Au-delà d'environ 1,6 g par kg et par jour, le gain de muscle n'augmente presque plus ; viser jusqu'à 2,2 g par kg couvre presque tout le monde.", "morton"],
      ["Les sportifs ont besoin de 1,4 à 2 g par kg. En sèche, on monte plus haut pour protéger le muscle quand les calories baissent.", "jager", "helms"],
      ["Le mieux : les répartir sur au moins 4 repas, environ 0,4 g par kg à chaque fois.", "schoenfeld"]],
    food: "Viande, poisson, œufs, skyr, fromage blanc, légumineuses, tofu, whey." },
  { id: "c", name: "Glucides", kcal: 4,
    role: "Le carburant des efforts intenses : stockés dans tes muscles sous forme de glycogène, ils alimentent tes séries. Ton cerveau en consomme aussi beaucoup.",
    why: [["Une fois les protéines et les lipides assurés, le reste de tes calories va aux glucides. Pour la musculation, les études conseillent 3 à 7 g par kg et par jour selon ton volume d'entraînement.", "slater11", "acsm"],
      ["Privilégie les céréales complètes, les légumineuses, les fruits et les légumes : riches en fibres, ils protègent ta santé sur le long terme.", "reynolds"]],
    cut: ["En sèche, ce sont eux qui baissent en premier : protéines et lipides restent assurés.", "helms"],
    food: "Riz, pâtes, pain complet, flocons d'avoine, pommes de terre, légumineuses, fruits." },
  { id: "f", name: "Lipides", kcal: 9,
    role: "Indispensables : ils fabriquent tes hormones (dont la testostérone), forment la paroi de tes cellules, font absorber les vitamines A, D, E et K et apportent les acides gras essentiels (oméga-3 et oméga-6) que ton corps ne sait pas fabriquer.",
    why: [["Repère : 20 à 35 % de tes calories. L'app en garde au moins 0,7 g par kg : les régimes trop pauvres en graisses font baisser la testostérone.", "acsm", "efsa-fats", "whittaker"],
      ["Surtout des graisses insaturées : huile d'olive ou de colza, noix, amandes, avocat, poissons gras. Limite les graisses saturées : charcuterie, beurre, fritures, viennoiseries.", "efsa-fats"]],
    food: "Huile d'olive ou de colza, oléagineux, avocat, poissons gras, œufs." },
  { id: "fi", name: "Fibres",
    role: "Elles nourrissent ta flore intestinale, règlent ton transit, rassasient et freinent le passage du sucre dans le sang.",
    why: [["14 g pour 1 000 kcal, et au moins 25 g par jour.", "iom", "efsa-drv"],
      ["Les plus gros mangeurs de fibres ont 15 à 30 % de risque en moins de mourir prématurément, de maladie cardiaque, d'AVC, de diabète de type 2 et de cancer colorectal ; le bénéfice est le plus net entre 25 et 29 g par jour.", "reynolds"]],
    food: "Légumes, fruits, légumineuses, céréales complètes, flocons d'avoine." },
  { id: "water", name: "Eau",
    role: "Ton corps en contient environ 60 % : elle transporte les nutriments, règle ta température grâce à la sueur et fait travailler tes muscles.",
    why: [["35 ml par kg et par jour, plus 0,5 L les jours d'entraînement. Perdre plus de 2 % de ton poids en eau fait baisser tes performances. Repère simple : des urines claires.", "sawka"],
      ["Les autorités européennes conseillent 2 L par jour pour une femme et 2,5 L pour un homme, en comptant l'eau des aliments.", "efsa-water"]],
    food: "Eau, eaux minérales, thé, café, soupes, fruits et légumes." },
];
// Repères quotidiens pour un adulte (EFSA ; sel : OMS) : [homme, femme]
export const MICROS = [
  { name: "Calcium", v: ["950 mg", "950 mg"], role: "Solidité des os et des dents, contraction des muscles, influx nerveux. 1 000 mg avant 25 ans.", food: "Produits laitiers, eaux riches en calcium, tofu, amandes, choux.", ref: "efsa-drv" },
  { name: "Fer", v: ["11 mg", "16 mg"], role: "Transporte l'oxygène dans le sang et les muscles : un manque fatigue et coupe l'endurance. Les femmes en perdent avec les règles (11 mg après la ménopause).", food: "Viande rouge, lentilles, pois chiches, épinards, avec de la vitamine C pour mieux l'absorber.", ref: "efsa-drv" },
  { name: "Magnésium", v: ["350 mg", "300 mg"], role: "Production d'énergie, contraction et détente des muscles : il participe à plus de 300 réactions du corps.", food: "Oléagineux, céréales complètes, légumineuses, chocolat noir, eaux riches en magnésium.", ref: "efsa-drv" },
  { name: "Potassium", v: ["3500 mg", "3500 mg"], role: "Équilibre de l'eau dans le corps, contraction des muscles, tension artérielle.", food: "Fruits, légumes, pommes de terre, légumineuses.", ref: "efsa-drv" },
  { name: "Sel (sodium)", v: ["moins de 5 g", "moins de 5 g"], role: "Le sodium règle l'eau du corps et l'influx nerveux, et tu en perds en transpirant. En excès, il fait monter la tension.", food: "Pain, fromages, charcuterie et plats préparés en apportent déjà beaucoup.", ref: "who-salt" },
  { name: "Zinc", v: ["9,4 à 16,3 mg", "7,5 à 12,7 mg"], role: "Immunité, cicatrisation, fabrication des protéines et des hormones. Il en faut plus si tu manges beaucoup de céréales complètes et de légumineuses.", food: "Viande, fruits de mer, œufs, légumineuses, graines.", ref: "efsa-drv" },
  { name: "Vitamine D", v: ["15 µg", "15 µg"], role: "Fixe le calcium sur les os, aide tes muscles et ton immunité. Ta peau la fabrique au soleil : elle manque souvent en hiver.", food: "Soleil, poissons gras, œufs.", ref: "efsa-drv" },
  { name: "Vitamine B12", v: ["4 µg", "4 µg"], role: "Globules rouges et système nerveux. Elle n'existe que dans les produits animaux : un complément est indispensable si tu es vegan.", food: "Viande, poisson, œufs, produits laitiers.", ref: "efsa-drv" },
  { name: "Vitamine C", v: ["110 mg", "95 mg"], role: "Immunité, collagène des tendons et de la peau, absorption du fer.", food: "Kiwi, poivron, agrumes, fraises, brocoli.", ref: "efsa-drv" },
  { name: "Oméga-3 (EPA + DHA)", v: ["250 mg", "250 mg"], role: "Cœur, cerveau et vision.", food: "Poissons gras (saumon, sardine, maquereau) une à deux fois par semaine.", ref: "efsa-fats" },
];

// Ce que tu vises, pour chaque nutriment (objectif du jour)
function amounts(p, base, adj) {
  const w = +p.bodyweight || 75, kcal = adj.kcal, goal = GOAL_ADJ[p.goal] != null ? p.goal : "forme";
  const day = (g, k) => `<b class="tnum">${g} g</b> <span class="muted tnum">${nb(`· ${d1(g / w)} g/kg · ${pct(g, k, kcal)} %`)}</span>`;
  const moved = k => (adj.delta ? `<div class="nl-formula"><span>Ajusté aujourd'hui</span> <span class="tnum">(${signed(adj[k] - base[k])} g)</span></div>` : "");
  return {
    p: { amt: `${adj.p} g`, line: `${day(adj.p, 4)}<div class="nl-formula"><span>${nb(`${esc(GOALS[goal].name)} :`)}</span> <b class="tnum">${d1(PROTEIN[goal])} g/kg</b> · <span>environ</span> <b class="tnum">${Math.round(adj.p / 4)} g</b> <span>à chacun de tes 4 repas</span></div>` },
    c: { amt: `${adj.c} g`, line: `${day(adj.c, 4)}${moved("c")}` },
    f: { amt: `${adj.f} g`, line: `${day(adj.f, 9)}${moved("f")}` },
    fi: { amt: `${base.fi} g`, line: `<b class="tnum">${base.fi} g</b> <span>par jour</span>` },
    water: { amt: `${d1(base.water / 1000)} L`, line: `<b class="tnum">${d1(base.water / 1000)} L</b> <span>par jour</span>` },
  };
}

/* ---------- L'onglet entier ---------- */
export function learnHtml(state, now = new Date()) {
  const p = state.profile || {}, adj = dailyAdjust(state, now), base = adj.base;
  // objectifs personnalisés : le calcul de référence, pour comparer
  const ref = base.custom ? targets({ ...p, nutri: { ...p.nutri, custom: false } }) : base;
  const A = amounts(p, ref, adj), kcal = adj.kcal, sex = p.sex === "f" ? 1 : 0;
  const split = [["p", pct(adj.p, 4, kcal)], ["c", pct(adj.c, 4, kcal)], ["f", pct(adj.f, 9, kcal)]];
  const sec = (id, title, body, { amt = "", open = false, cls = "" } = {}) => `<details class="card adv nl-sec ${cls}" id="nl-${id}" ${open ? "open" : ""}><summary><span>${nb(title)}</span>${amt ? `<b class="nl-amt tnum">${amt}</b>` : ""}</summary><div class="nl-body">${body}</div></details>`;
  const macro = m => sec(m.id, m.name, `${m.kcal ? `<p class="nl-kg"><span class="tnum">1 g = ${m.kcal} kcal</span></p>` : ""}
      <div class="nl-you"><span class="eyebrow">Ton objectif</span><div>${A[m.id].line}</div></div>
      <div class="eyebrow">À quoi ça sert</div>${para(m.role)}
      <div class="eyebrow">Pourquoi autant</div>${m.why.map(([t, ...ids]) => para(t, ...ids)).join("")}${m.cut && p.goal === "seche" ? para(...m.cut) : ""}
      <div class="eyebrow">Où en trouver</div><p class="muted">${esc(m.food)}</p>`, { amt: A[m.id].amt, cls: `nl-m nl-m-${m.id}` });
  return `<div class="nl" id="nl">
    <section class="card nl-hero">
      <div class="eyebrow">${adj.delta ? "Ton objectif aujourd'hui" : "Ton objectif du jour"}</div>
      <div class="nl-big"><b class="tnum">${fmtNum(kcal)}</b> <span>kcal</span>${adj.delta ? ` <span class="nl-delta tnum">${signed(adj.delta)}</span>` : ""}</div>
      <div class="nl-split" aria-hidden="true">${split.map(([k, v]) => `<i class="s-${k}" style="flex:${Math.max(1, v)}"></i>`).join("")}</div>
      <div class="nl-legend xs">${split.map(([k, v]) => `<button class="nl-lg s-${k}" data-goto="nl-${k}"><i></i><span>${{ p: "Protéines", c: "Glucides", f: "Lipides" }[k]}</span> <b class="tnum">${adj[k]} g</b> <span class="tnum muted">${nb(`${v} %`)}</span></button>`).join("")}</div>
      <p class="small muted">${nb("Tout est calculé pour toi, à partir de ton profil et d'études scientifiques : touche un nom d'étude pour voir la source.")}</p>
    </section>
    ${sec("kcal", "Pourquoi autant de calories ?", calcHtml(p, ref, adj, base.custom), { open: true })}
    ${sec("adapt", "Pourquoi ton objectif change chaque jour", adaptHtml(p, base, adj))}
    <div class="section"><h2>À quoi sert chaque nutriment</h2></div>
    <p class="small muted nl-intro">${nb("1 g de protéines ou de glucides apporte 4 kcal, 1 g de lipides 9 kcal (et 1 g d'alcool 7 kcal).")}</p>
    ${MACROS.map(macro).join("")}
    ${sec("min", "Minéraux et vitamines", `${para("Ils n'apportent pas de calories, mais ton corps ne peut pas s'en passer. Voici les repères quotidiens des autorités de santé pour un adulte. Une alimentation variée, riche en fruits, légumes et produits peu transformés, suffit en général : un complément se prend sur avis médical, sauf la vitamine B12 si tu es vegan.", "efsa-drv", "who-salt")}
      <ul class="nl-micros">${MICROS.map(m => `<li><div class="nl-sl"><b>${m.name}</b><span class="tnum">${m.v[sex].replace(/\d{4,}/g, n => fmtNum(+n))}</span></div>
        <p>${nb(m.role)} ${cite(m.ref)}</p><p class="muted xs">${esc(m.food)}</p></li>`).join("")}</ul>`, { amt: `${MICROS.length}` })}
    ${sec("refs", "Sources scientifiques", `<ol class="nl-refs">${REFS.map(r => `<li id="nl-ref-${r.id}"><b>${esc(r.short)}</b> · <span translate="no">${esc(r.text)}${r.doi ? ` <a href="https://doi.org/${r.doi}" target="_blank" rel="noopener">doi:${r.doi}</a>` : ""}</span></li>`).join("")}</ol>`, { amt: `${REFS.length}` })}
    <p class="xs muted nl-disc">${nb("Ces repères valent pour un adulte en bonne santé. Enceinte, allaitante, mineur, ou en cas de maladie (diabète, reins…) : demande l'avis d'un médecin ou d'un diététicien.")}</p>
  </div>`;
}

// Liens de l'onglet : renvois aux études, « voir le détail », légende ; focus : la partie à ouvrir (« p », « adapt »…)
export function bindLearn(root, focus) {
  const open = (id, { highlight = null } = {}) => {
    const d = root.querySelector(`#${id}`);
    if (!d) return;
    if (d.tagName === "DETAILS") d.open = true;
    const target = highlight ? root.querySelector(`#${highlight}`) || d : d;
    target.scrollIntoView?.({ behavior: "smooth", block: highlight ? "center" : "start" });
    if (highlight && target !== d) { target.classList.remove("hl"); void target.offsetWidth; target.classList.add("hl"); }
  };
  root.querySelectorAll(".nl-cite").forEach(b => b.onclick = e => { e.preventDefault(); open("nl-refs", { highlight: `nl-ref-${b.dataset.ref}` }); });
  root.querySelectorAll("[data-goto]").forEach(b => b.onclick = e => { e.preventDefault(); open(b.dataset.goto); });
  if (focus) requestAnimationFrame(() => open(`nl-${focus}`));
}

/* ---------- Carte du journal : l'objectif du jour ajusté ---------- */
export function adjustCard(adj) {
  if (!adj?.delta) return "";
  const up = adj.delta > 0;
  return `<section class="card nut-adj ${up ? "up" : "down"}" id="nut-adj">
    <div class="na-head"><b>Objectif du jour ajusté</b><b class="tnum na-d">${signed(adj.delta)} kcal</b></div>
    <p class="small">${nb(up ? "Tu as mangé moins que prévu ces derniers jours : tu rattrapes l'écart sur 3 jours pour garder ton rythme. Protéines inchangées." : "Tu as mangé plus que prévu ces derniers jours : l'écart est réparti sur 3 jours pour garder ton rythme. Protéines inchangées.")}</p>
    <button class="link small" data-learn="adapt">Pourquoi ?</button>
  </section>`;
}
