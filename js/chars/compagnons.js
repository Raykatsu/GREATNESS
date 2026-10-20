// Coachs « Compagnons » : petites créatures originales (robot, dragon, chiot, chat, paresseux, tortue, axolotl,
// yéti, hibou), dessinées à la main avec les outils de ./kit.js (format décrit en tête de ce fichier).
import { X, mir, line, flat, shape, dot, cloud, lin, eyePair, sneaker } from "./kit.js";

const G = "Compagnons";
// ventre rond, commun à la plupart des créatures
const BODY = "M18.4 28.4 Q30 23.2 41.6 28.4 Q45.6 43 41.8 55.6 Q30 60.6 18.2 55.6 Q14.4 43 18.4 28.4 Z";
const ARMP = s => `M${X(s, 20)} 30 Q${X(s, 15.8)} 39 ${X(s, 14.6)} 47`;
// patte avant (épaule fixe → main) et patte arrière trapue (hanche fixe → pied au sol)
const paw = (s, col, w, hand, ol) => line(ARMP(s), ol, w + 1.3) + line(ARMP(s), col, w) + dot(X(s, 14.4), 49, w * 0.55 + 0.6, hand, ` stroke="${ol}" stroke-width=".8"`);
const LEGP = s => `M${X(s, 26)} 49 L${X(s, 24.4)} 70`;
const foot = (s, col, w, f, ol) => line(LEGP(s), ol, w + 1.3) + line(LEGP(s), col, w) + `<ellipse cx="${X(s, 23.6)}" cy="74.8" rx="5.2" ry="3.2" fill="${f}" stroke="${ol}" stroke-width=".8"/>`;
const toes = (s, ol) => line(`M${X(s, 21.6)} 76.2 L${X(s, 21.8)} 77.5 M${X(s, 23.8)} 76.5 L${X(s, 23.8)} 77.9 M${X(s, 26)} 76.2 L${X(s, 25.8)} 77.5`, ol, 0.5, ' opacity=".7"');
const blush = (dx, cy, c = "#ff8fa8", o = 0.5) => `<ellipse cx="${30 - dx}" cy="${cy}" rx="2.3" ry="1.35" fill="${c}" opacity="${o}"/><ellipse cx="${30 + dx}" cy="${cy}" rx="2.3" ry="1.35" fill="${c}" opacity="${o}"/>`;
const both = (fn) => fn("L") + fn("R");
const pair = d => d + " " + mir(d);
const motion = css => `@media (prefers-reduced-motion: no-preference) {\n${css}\n}`;

/* ---------- Boulon, le robot ---------- */
const MET = "url(#boulon-metal)", MOL = "#5b6577";
const boulon = {
  id: "boulon", name: "Boulon", group: G, travel: "fly", fx: { color: "#38d6ff", trail: "sparks" },
  bio: "Petit robot de salle : il compte tes séries au millimètre et s'emballe à chaque record.",
  persona: "Petit robot coach optimiste et précis, qui parle en données et en pourcentages, ponctue ses phrases de « bip » enthousiastes et cache un très grand cœur sous sa carrosserie.",
  aliases: ["robot"],
  defs: lin("boulon-metal", "#f3f6fb", "#aab5c7") + lin("boulon-metal2", "#dfe5ee", "#939fb3") + lin("boulon-visor", "#2f3b58", "#111726"),
  back: both(s => `<rect x="${s === "L" ? 13.8 : 40.6}" y="29.4" width="5.6" height="15" rx="2.4" fill="url(#boulon-metal2)" stroke="${MOL}" stroke-width=".7"/>` +
    `<g class="kit-jet"><path d="M${X(s, 14.8)} 44.2 Q${X(s, 16.6)} 53.4 ${X(s, 18.4)} 44.2 Z" fill="#ffb02e"/><path d="M${X(s, 15.7)} 44.2 Q${X(s, 16.6)} 49.6 ${X(s, 17.5)} 44.2 Z" fill="#fff3c4"/></g>`),
  legL: "", legR: "", armL: "", armR: "",
  torso: `<rect x="27" y="21" width="6" height="6" rx="1.4" fill="url(#boulon-metal2)" stroke="${MOL}" stroke-width=".6"/>` +
    `<rect x="19" y="25" width="22" height="26.6" rx="6.4" fill="${MET}" stroke="${MOL}" stroke-width=".9"/>` +
    `<rect x="23.4" y="30.2" width="13.2" height="9.6" rx="2.4" fill="url(#boulon-visor)" stroke="#3b4458" stroke-width=".6"/>` +
    line("M24.6 35.4 L27.4 35.4 L28.6 32.4 L30.2 38.2 L31.6 34.4 L35.4 34.4", "#4dff9a", 0.8) +
    [[21.4, 27.6], [38.6, 27.6], [21.4, 49], [38.6, 49]].map(([x, y]) => dot(x, y, 0.8, "#c3ccda", ` stroke="${MOL}" stroke-width=".4"`)).join("") +
    line("M24.6 43.6 L35.4 43.6 M24.6 46 L35.4 46", MOL, 0.7, ' opacity=".6"') + `<rect x="34" y="26" width="6" height="25" rx="3" fill="#000" opacity=".06"/>`,
  head: line("M30 -0.4 L30 -5.2", MOL, 1.2) + `<circle class="kit-led" cx="30" cy="-6.6" r="2" fill="#ff4d5e" stroke="#8a1f2b" stroke-width=".5"/>` + dot(29.3, -7.3, 0.6, "#fff", ' opacity=".7"') +
    both(s => `<rect x="${s === "L" ? 13.6 : 43}" y="9.4" width="3.4" height="8" rx="1.6" fill="url(#boulon-metal2)" stroke="${MOL}" stroke-width=".7"/>` + dot(X(s, 15.3), 13.4, 0.8, "#38d6ff")) +
    `<rect x="16.6" y="-0.4" width="26.8" height="25.6" rx="8.4" fill="${MET}" stroke="${MOL}" stroke-width=".9"/>` +
    `<rect x="19.8" y="4.4" width="20.4" height="16.4" rx="6" fill="url(#boulon-visor)" stroke="#3b4458" stroke-width=".7"/>` +
    line("M21.8 7.4 Q23.4 5.6 26.4 5.6", "#fff", 0.7, ' opacity=".4"') +
    `<g class="sp-eyes"><g class="sp-eyeL"><rect x="22.8" y="8.8" width="4.4" height="5.8" rx="2.2" fill="#5ef0ff"/><rect x="23.5" y="9.6" width="1.4" height="1.8" rx=".7" fill="#fff" opacity=".85"/></g>` +
    `<g class="sp-eyeR"><rect x="32.8" y="8.8" width="4.4" height="5.8" rx="2.2" fill="#5ef0ff"/><rect x="33.5" y="9.6" width="1.4" height="1.8" rx=".7" fill="#fff" opacity=".85"/></g></g>` +
    `<rect x="20.6" y="15.2" width="2.6" height="1.4" rx=".7" fill="#ff8fb1" opacity=".75"/><rect x="36.8" y="15.2" width="2.6" height="1.4" rx=".7" fill="#ff8fb1" opacity=".75"/>` +
    line("M26.4 16.8 Q30 19.4 33.6 16.8", "#5ef0ff", 1.1) + `<rect x="27.6" y="-1.6" width="4.8" height="1.8" rx=".6" fill="url(#boulon-metal2)" stroke="${MOL}" stroke-width=".5"/>`,
  css: motion(`  .ch-boulon .kit-led { animation: boulonLed 1.8s ease-in-out infinite; }
  @keyframes boulonLed { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  .ch-boulon .kit-jet { transform-origin: 30px 44.2px; animation: boulonJet .18s ease-in-out infinite alternate; }
  @keyframes boulonJet { from { transform: scaleY(.8); } to { transform: scaleY(1.1); } }`) + `
  .ch-boulon .kit-jet { opacity: 0; transition: opacity .2s; }
  .ch-boulon.pose-fly .kit-jet, .ch-boulon.pose-float .kit-jet, .ch-boulon.pose-flip .kit-jet { opacity: 1; }`,
  faceBox: [12, -9.6, 36, 36],
  lines: {
    hello: ["Bip bip ! Système prêt. On lance la séance ?", "Batterie à 100 %. Et la tienne ?", "Bonjour, humain préféré. Analyse : motivation en hausse."],
    tap: ["Bip ! Ça chatouille mes capteurs.", "Toucher détecté. Câlin enregistré.", "Mes circuits disent : encore une série !"],
    pr: ["Nouveau record détecté ! Mise à jour de ma base de données.", "Calcul terminé : tu es plus fort qu'hier."],
    rest: ["Recharge en cours… respire profondément.", "Pause : je refroidis mes moteurs avec toi."],
    sleep: ["Mode veille… bip… réveille-moi pour une séance."],
  },
};
const bLeg = s => line(LEGP(s), MOL, 6) + line(LEGP(s), MET, 4.6) + dot(X(s, 25.2), 59.6, 2.3, MOL) + dot(X(s, 25.2), 59.6, 1.1, "#38d6ff") +
  `<path d="M${X(s, 18)} 77.6 C${X(s, 18)} 72.6 ${X(s, 20.2)} 70.6 ${X(s, 23.4)} 70.6 C${X(s, 26.6)} 70.6 ${X(s, 28.8)} 72.4 ${X(s, 28.8)} 75.6 L${X(s, 28.8)} 77.6 Q${X(s, 28.8)} 78.2 ${X(s, 28.2)} 78.2 L${X(s, 18.6)} 78.2 Q${X(s, 18)} 78.2 ${X(s, 18)} 77.6 Z" fill="${MET}" stroke="${MOL}" stroke-width=".8"/>` +
  `<rect x="${s === "L" ? 18.2 : 31.2}" y="76.4" width="10.6" height="1.8" rx=".6" fill="${MOL}"/>`;
const bArm = s => line(ARMP(s), MOL, 5.8) + line(ARMP(s), MET, 4.4) + dot(X(s, 16.6), 39, 1.9, MOL) + dot(X(s, 16.6), 39, 0.9, "#38d6ff") +
  dot(X(s, 14.4), 49.2, 3, MOL) + dot(X(s, 14.4), 49.2, 1.5, "url(#boulon-metal2)");
Object.assign(boulon, { legL: bLeg("L"), legR: bLeg("R"), armL: bArm("L"), armR: bArm("R") });

/* ---------- Braise, le bébé dragon ---------- */
const BRS = "url(#braise-skin)", BRO = "#9c2a14";
const wing = "M20.4 31.6 C15.6 23.6 7.8 21.6 3.4 26.8 C6.4 27.6 8.2 29.8 8.6 33 C10.6 31.8 12.8 32.2 14 34.2 C15.2 32.8 17.4 32.8 18.8 34 Z";
const wingLines = "M19.6 32 L5.6 26.8 M19.6 32.4 L10.6 31.6 M19.6 32.8 L15.4 33.4";
const braise = {
  id: "braise", name: "Braise", group: G, travel: "fly", fx: { color: "#ff7a2f", trail: "sparks" },
  bio: "Un bébé dragon plein de feu, qui crache des étincelles à chacun de tes records.",
  persona: "Bébé dragon fougueux et adorable, qui parle de flammes et de feu intérieur, s'enthousiasme pour tout et protège son humain comme un trésor.",
  aliases: ["dragon"],
  defs: lin("braise-skin", "#ff9a4d", "#e5532b") + lin("braise-belly", "#ffe8b3", "#ffc76e") + lin("braise-wing", "#ff7b52", "#d23f2a"),
  back: `<g class="kit-wingL">${shape(wing, "url(#braise-wing)", BRO, 0.8)}${line(wingLines, "#b8361d", 0.6, ' opacity=".7"')}</g>` +
    `<g class="kit-wingR">${shape(mir(wing), "url(#braise-wing)", BRO, 0.8)}${line(mir(wingLines), "#b8361d", 0.6, ' opacity=".7"')}</g>` +
    `<g class="kit-tail">${line("M37.6 51.4 C44.6 54.6 50.4 51.4 51 44.4 C51.2 41.8 50 40.2 48.4 40.6", BRO, 5.4)}${line("M37.6 51.4 C44.6 54.6 50.4 51.4 51 44.4 C51.2 41.8 50 40.2 48.4 40.6", BRS, 4)}` +
    `${shape("M48.6 40.8 L45.2 37.8 L49 35 L51.8 39.2 Z", "#ffd35c", BRO, 0.6)}</g>`,
  legL: foot("L", BRS, 7.4, BRS, BRO) + line("M19.6 76.6 L18.8 77.8 M22.6 77.4 L22.4 78.6 M25.6 77.2 L26.2 78.4", "#fff1d2", 1.1),
  legR: foot("R", BRS, 7.4, BRS, BRO) + line(mir("M19.6 76.6 L18.8 77.8 M22.6 77.4 L22.4 78.6 M25.6 77.2 L26.2 78.4"), "#fff1d2", 1.1),
  armL: paw("L", BRS, 5.2, BRS, BRO) + line("M12.6 51.4 L12 52.6 M14.6 52 L14.6 53.2", "#fff1d2", 0.9),
  armR: paw("R", BRS, 5.2, BRS, BRO) + line(mir("M12.6 51.4 L12 52.6 M14.6 52 L14.6 53.2"), "#fff1d2", 0.9),
  torso: shape(BODY, BRS, BRO, 0.9) + shape("M23.4 30.6 Q30 28.4 36.6 30.6 Q38.6 42 36.2 55.2 Q30 57.6 23.8 55.2 Q21.4 42 23.4 30.6 Z", "url(#braise-belly)") +
    line("M23 35.4 Q30 37 37 35.4 M22.6 40.6 Q30 42.2 37.4 40.6 M22.8 45.8 Q30 47.4 37.2 45.8 M23.4 51 Q30 52.6 36.6 51", "#e8a447", 0.6, ' opacity=".8"'),
  head: shape(pair("M22.4 5 C20.6 1 19.6 -2.4 20.4 -5.4 C22.6 -3.6 24.6 -0.6 25.6 3.2 Z"), "#fff1d2", "#b9875a", 0.7) +
    shape(pair("M17.4 10.4 L10.6 7.6 L12.6 12.4 L10.4 15.6 L17.2 15.2 Z"), "url(#braise-wing)", BRO, 0.7) +
    `<ellipse cx="30" cy="13.2" rx="13.4" ry="12" fill="${BRS}" stroke="${BRO}" stroke-width=".9"/>` +
    shape("M27.6 1.6 L30 -2 L32.4 1.6 Z", "#ffd35c", BRO, 0.5) + line("M21.6 4.6 Q25 2.2 29.6 2", "#fff", 1, ' opacity=".35"') +
    blush(10.2, 17.2, "#ff6b8b", 0.45) +
    `<ellipse cx="30" cy="19.4" rx="7.8" ry="5.4" fill="#ffb27a" stroke="#c4532d" stroke-width=".6"/>` +
    `<ellipse cx="27.6" cy="18" rx=".8" ry=".55" fill="#7a2410"/><ellipse cx="32.4" cy="18" rx=".8" ry=".55" fill="#7a2410"/>` +
    line("M25.4 21.4 Q30 24.6 34.6 21.4", "#7a2410", 0.9) + `<path d="M31.6 22.6 L32.4 24.3 L33.2 22.3 Z" fill="#fff"/>` +
    eyePair(5.6, 11.4, { rx: 2.3, ry: 2.8, color: "#2b140c" }) + line(pair("M21.8 7.4 Q24.2 6.2 26.6 7.2"), BRO, 1),
  css: motion(`  .ch-braise .kit-wingL { transform-origin: 20px 32px; animation: braiseL 1.6s ease-in-out infinite; }
  .ch-braise .kit-wingR { transform-origin: 40px 32px; animation: braiseR 1.6s ease-in-out infinite; }
  .ch-braise.pose-fly .kit-wingL, .ch-braise.pose-fly .kit-wingR, .ch-braise.pose-float .kit-wingL, .ch-braise.pose-float .kit-wingR { animation-duration: .36s; }
  @keyframes braiseL { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-16deg); } }
  @keyframes braiseR { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(16deg); } }
  .ch-braise .kit-tail { transform-origin: 38px 51px; animation: kitSway 2.4s ease-in-out infinite; }`),
  faceBox: [10, -7, 40, 40],
  lines: {
    hello: ["Salut ! Mon feu intérieur est allumé, et le tien ?", "Rrraa ! Prêt à faire chauffer la séance ?"],
    tap: ["Attention, je suis tout chaud !", "Hé ! Tu veux voir une étincelle ?", "Mes ailes frétillent quand tu me touches."],
    pr: ["Record ! Une gerbe d'étincelles rien que pour toi !", "Tu as tout brûlé ! Même les dragons sont jaloux."],
    rest: ["Je souffle sur les braises. Repose-toi.", "Pause : laisse redescendre la flamme."],
    sleep: ["Zzz… je couve ma prochaine séance…"],
  },
};

/* ---------- Pépite, le chiot ---------- */
const PF = "url(#pepite-fur)", PO = "#8f5420";
const pepite = {
  id: "pepite", name: "Pépite", group: G, travel: "hop", fx: { color: "#f5a524", trail: "hearts" },
  bio: "Un chiot doré fou de joie à chaque séance, qui ne te lâche pas d'une semelle.",
  persona: "Chiot joyeux et fidèle, toujours content de te voir, qui encourage avec une énergie débordante, adore courir et ponctue ses phrases de « wouf » de bonheur.",
  aliases: ["chien", "chiot", "toutou"],
  defs: lin("pepite-fur", "#f7c06a", "#de9038") + lin("pepite-ear", "#c27a35", "#9a5520") + lin("pepite-cream", "#fff6e6", "#f3dcb8"),
  back: `<g class="kit-tail">${line("M37.6 50.4 C44.6 50.8 47.6 45.4 46.6 39.6", PO, 5.2)}${line("M37.6 50.4 C44.6 50.8 47.6 45.4 46.6 39.6", PF, 3.9)}${dot(46.6, 39.4, 2.2, "#fff3dc", ` stroke="${PO}" stroke-width=".6"`)}</g>`,
  legL: foot("L", PF, 7.6, "url(#pepite-cream)", PO) + toes("L", PO),
  legR: foot("R", PF, 7.6, "url(#pepite-cream)", PO) + toes("R", PO),
  armL: paw("L", PF, 5.6, "url(#pepite-cream)", PO),
  armR: paw("R", PF, 5.6, "url(#pepite-cream)", PO),
  torso: shape(BODY, PF, PO, 0.9) + shape("M24.4 28.4 Q30 26.6 35.6 28.4 Q37.2 38 34.6 47.4 Q30 49.8 25.4 47.4 Q22.8 38 24.4 28.4 Z", "url(#pepite-cream)") +
    shape("M21.6 27.2 Q30 23.8 38.4 27.2 L38 29.8 Q30 26.6 22 29.8 Z", "#e8283b", "#8a1020", 0.6) + dot(30, 30.4, 1.8, "#f5c542", ' stroke="#a87b18" stroke-width=".5"'),
  head: `<ellipse cx="30" cy="13.8" rx="12.8" ry="11.6" fill="${PF}" stroke="${PO}" stroke-width=".9"/>` +
    shape("M27.4 2.8 Q28.4 -0.6 30 2.2 Q31.2 -0.9 32.8 2.6 Z", PF, PO, 0.6) + line("M21.8 5.2 Q25.4 2.6 29.6 2.6", "#fff", 1, ' opacity=".35"') +
    blush(9.4, 18.4, "#ff8a8a", 0.45) +
    `<ellipse cx="30" cy="19" rx="6.8" ry="4.8" fill="url(#pepite-cream)" stroke="#c99a62" stroke-width=".5"/>` +
    `<path d="M27.8 16.2 Q30 15.2 32.2 16.2 Q32 18.4 30 18.8 Q28 18.4 27.8 16.2 Z" fill="#2b1d1a"/><ellipse cx="29.2" cy="16.4" rx=".7" ry=".35" fill="#fff" opacity=".6"/>` +
    line("M30 18.8 L30 19.8 M27.6 19.8 Q28.8 21.4 30 19.8 Q31.2 21.4 32.4 19.8", "#4a2a1a", 0.7) +
    shape("M29.4 21 Q29.4 23.8 30.9 23.8 Q32.4 23.8 32.2 21 Z", "#ff7f8e", "#c4475a", 0.45) +
    eyePair(5.6, 12.2, { rx: 2, ry: 2.4, color: "#2a1a10" }) +
    `<ellipse cx="24.2" cy="8.4" rx="1.4" ry=".9" fill="#fff0d4" opacity=".85"/><ellipse cx="35.8" cy="8.4" rx="1.4" ry=".9" fill="#fff0d4" opacity=".85"/>` +
    `<g class="kit-earL">${shape("M20.4 4.2 C14.6 3.4 11 8.6 11.2 15.2 C11.4 19.6 13.4 22.8 16 23 C18 23.2 19 20.8 19 17.6 C19 13.2 20 9 22.4 6.4 Z", "url(#pepite-ear)", "#6e3c14", 0.8)}</g>` +
    `<g class="kit-earR">${shape(mir("M20.4 4.2 C14.6 3.4 11 8.6 11.2 15.2 C11.4 19.6 13.4 22.8 16 23 C18 23.2 19 20.8 19 17.6 C19 13.2 20 9 22.4 6.4 Z"), "url(#pepite-ear)", "#6e3c14", 0.8)}</g>`,
  css: motion(`  .ch-pepite .kit-tail { transform-origin: 38px 50px; animation: pepiteWag .5s ease-in-out infinite alternate; }
  @keyframes pepiteWag { from { transform: rotate(-12deg); } to { transform: rotate(14deg); } }
  .ch-pepite.pose-hop .kit-earL { transform-origin: 21px 5px; transform: rotate(14deg); }
  .ch-pepite.pose-hop .kit-earR { transform-origin: 39px 5px; transform: rotate(-14deg); }`),
  faceBox: [11, -5.2, 38, 38],
  lines: {
    hello: ["Wouf ! Tu es là ! On va courir ?", "Ma queue remue toute seule : c'est l'heure du sport !"],
    tap: ["Wouf wouf ! Encore une caresse ?", "Je t'apporte la balle ? Non ? Alors une série !", "Hiii, ça me fait tout drôle !"],
    pr: ["Wouf ! Record ! Je fais trois tours sur moi-même !", "Meilleur humain du monde, c'est officiel !"],
    rest: ["Je m'allonge à côté de toi. Respire.", "Pause gamelle… euh, pause eau !"],
    sleep: ["Zzz… je rêve qu'on part courir…"],
  },
};

/* ---------- Mochi, le chat tigré ---------- */
const MF = "url(#mochi-fur)", MO = "#5d586c", MS = "#6f6a7e";
const mochi = {
  id: "mochi", name: "Mochi", group: G, travel: "hop", fx: { color: "#9d8cf0", trail: "stars" },
  bio: "Un chat tigré taquin, roi des étirements et de la sieste… entre deux séries.",
  persona: "Chat tigré malicieux et un peu flemmard, élégant et taquin, qui encourage avec un humour pince-sans-rire, adore les étirements et glisse quelques « miaou » bien placés.",
  aliases: ["chat", "minou"],
  defs: lin("mochi-fur", "#c3bfcf", "#8e899c") + lin("mochi-white", "#ffffff", "#e9e8f0"),
  back: `<g class="kit-tail">${line("M38 51 C47.6 52.6 50.6 44.6 48.6 37 C48 34.6 45.6 34 44.8 36", MO, 5)}${line("M38 51 C47.6 52.6 50.6 44.6 48.6 37 C48 34.6 45.6 34 44.8 36", MF, 3.8)}${flat("M38 51 C47.6 52.6 50.6 44.6 48.6 37 C48 34.6 45.6 34 44.8 36", MS, 3.8, ' stroke-dasharray="2.2 3"')}</g>`,
  legL: foot("L", MF, 7, "url(#mochi-white)", MO) + toes("L", MO),
  legR: foot("R", MF, 7, "url(#mochi-white)", MO) + toes("R", MO),
  armL: paw("L", MF, 5.4, "url(#mochi-white)", MO),
  armR: paw("R", MF, 5.4, "url(#mochi-white)", MO),
  torso: shape(BODY, MF, MO, 0.9) + shape("M24.6 28.6 Q30 26.6 35.4 28.6 Q36.8 37.6 34.4 46 Q30 48.2 25.6 46 Q23.2 37.6 24.6 28.6 Z", "url(#mochi-white)") +
    line(pair("M18.6 36 Q21.6 36.6 22.6 38.6 M17.6 41.6 Q20.8 42 22 44 M18 47.4 Q21 47.6 22.4 49.4"), MS, 1.2),
  head: shape(pair("M16.6 9.4 L17.4 -2.8 Q18 -5 20.2 -3.8 L26.8 2.2 Z"), MF, MO, 0.8) + `<path d="${pair("M18.8 4.4 L19 -1.2 L23.6 2.6 Z")}" fill="#ffb3c7"/>` +
    `<ellipse cx="30" cy="13.8" rx="13.8" ry="11.4" fill="${MF}" stroke="${MO}" stroke-width=".9"/>` +
    `<path d="M27.2 3.2 L28.4 7.6 L29.2 3.2 Z M29.4 2.8 L30 7.2 L30.6 2.8 Z M30.8 3.2 L31.6 7.6 L32.8 3.2 Z" fill="${MS}"/>` +
    line(pair("M16.6 14.6 L20.4 15.2 M16.8 17.4 L20.4 17.2"), MS, 1) + blush(9.8, 18.6, "#ff9cbc", 0.5) +
    `<path d="M23.6 19.6 Q26.4 15.8 30 17.4 Q33.6 15.8 36.4 19.6 Q36.6 24 30 24.6 Q23.4 24 23.6 19.6 Z" fill="url(#mochi-white)"/>` +
    shape("M28.6 17.6 L31.4 17.6 L30 19.2 Z", "#ff8fa8", "#c45a74", 0.4) +
    line("M30 19.2 L30 20.2 M27.8 20.2 Q28.9 21.6 30 20.2 Q31.1 21.6 32.2 20.2", "#4a4458", 0.65) +
    line(pair("M22 19.6 L15.6 18.6 M22 21 L15.8 21.6"), "#4a4458", 0.45, ' opacity=".7"') +
    eyePair(5.8, 12.8, { rx: 2.3, ry: 2.6, color: "#1d1a24", iris: "#7ed957" }),
  css: motion(`  .ch-mochi .kit-tail { transform-origin: 38px 51px; animation: kitSway 2.8s ease-in-out infinite; }`),
  faceBox: [12, -6.2, 36, 36],
  lines: {
    hello: ["Miaou. Je t'attendais… enfin, presque.", "Tu es là. Bon. On s'étire d'abord, comme moi."],
    tap: ["Miaou ! Pas les moustaches.", "Tu me grattes derrière l'oreille ? D'accord, une série.", "Ronron… continue, mais pense à ta séance."],
    pr: ["Record ! Même moi je me lève pour applaudir.", "Pas mal, humain. Pas mal du tout."],
    rest: ["Les chats sont des champions du repos. Fais comme moi.", "Pause : étire-toi, lentement, avec style."],
    sleep: ["Zzz… ma douzième sieste de la journée…"],
  },
};

/* ---------- Paco, le paresseux ---------- */
const KF = "url(#paco-fur)", KO = "#4e3622";
const claws = s => line(`M${X(s, 12.4)} 51.2 Q${X(s, 11.4)} 54 ${X(s, 12.6)} 56 M${X(s, 14.4)} 51.8 Q${X(s, 13.8)} 54.8 ${X(s, 15)} 56.6 M${X(s, 16.4)} 51 Q${X(s, 16.4)} 54 ${X(s, 17.4)} 55.6`, KO, 1.8) +
  line(`M${X(s, 12.4)} 51.2 Q${X(s, 11.4)} 54 ${X(s, 12.6)} 56 M${X(s, 14.4)} 51.8 Q${X(s, 13.8)} 54.8 ${X(s, 15)} 56.6 M${X(s, 16.4)} 51 Q${X(s, 16.4)} 54 ${X(s, 17.4)} 55.6`, "#f3ead8", 1);
const paco = {
  id: "paco", name: "Paco", group: G, travel: "walk", fx: { color: "#8bc34a", trail: "leaves" },
  bio: "Un paresseux zen qui prouve que lentement, mais régulièrement, on va très loin.",
  persona: "Paresseux zen et souriant, qui prône la régularité plutôt que la vitesse, parle lentement, avec douceur et humour, et rappelle que chaque petit pas compte.",
  aliases: ["paresseux"],
  defs: lin("paco-fur", "#a8845f", "#7a5a3d") + lin("paco-face", "#f6e6cc", "#e6cfa8"),
  legL: foot("L", KF, 7.4, "#8a6747", KO) + line("M20 76.8 L19.2 78.2 M23.2 77.6 L23 79 M26.4 77 L27 78.4", "#f3ead8", 1),
  legR: foot("R", KF, 7.4, "#8a6747", KO) + line(mir("M20 76.8 L19.2 78.2 M23.2 77.6 L23 79 M26.4 77 L27 78.4"), "#f3ead8", 1),
  armL: paw("L", KF, 5.8, KF, KO) + claws("L"),
  armR: paw("R", KF, 5.8, KF, KO) + claws("R"),
  torso: shape(cloud(30, 41.6, 12.4, 15.6, 18, 0.05), KF, KO, 0.9) + `<ellipse cx="30" cy="43" rx="7.4" ry="10.4" fill="#c9a882" opacity=".65"/>`,
  head: shape(cloud(30, 13.6, 13.4, 12, 18, 0.06), KF, KO, 0.9) + shape("M26.6 2.4 Q27.6 -1 29.4 1.8 Q30.4 -1.6 31.6 1.8 Q33 -0.8 33.6 2.6 Z", KF, KO, 0.6) +
    shape("M30 5 C37.8 5 41.4 9.8 41.2 15.4 C41 21.8 36.2 25.4 30 25.4 C23.8 25.4 19 21.8 18.8 15.4 C18.6 9.8 22.2 5 30 5 Z", "url(#paco-face)") +
    `<path d="${pair("M27.6 11.4 C25 10 21 10.8 20.2 14 C19.6 16.4 21.2 17.8 23.4 17 C25.8 16 28 14.2 27.6 11.4 Z")}" fill="#7a5843"/>` +
    blush(8.6, 20, "#ff9c8a", 0.4) + eyePair(5.8, 13.8, { rx: 1.55, ry: 1.8, color: "#120a06" }) +
    `<ellipse cx="30" cy="18.4" rx="2.4" ry="1.6" fill="#2b1d17"/><ellipse cx="29.3" cy="17.9" rx=".7" ry=".35" fill="#fff" opacity=".5"/>` +
    line("M26.4 20.8 Q30 23.8 33.6 20.8", KO, 0.9),
  faceBox: [11.6, -4.8, 36.8, 36.8],
  lines: {
    hello: ["Saaalut… On y va, tranquillement mais sûrement ?", "Pas besoin d'aller vite. Il faut juste y aller."],
    tap: ["Ooooh… une caresse… merci…", "Doucement… je suis encore en train de dire bonjour.", "Tu as vu ? J'ai bougé. Un peu."],
    pr: ["Record ! Lentement mais sûrement, tu vois ?", "Woaaah… même moi j'ai accéléré en voyant ça."],
    rest: ["Le repos, c'est ma spécialité. Profite.", "Respire… lentement… comme moi."],
    sleep: ["Zzz… vingt heures de sommeil par jour, c'est mon record…"],
  },
};

/* ---------- Bolide, la tortue sprinteuse ---------- */
const TS = "url(#bolide-skin)", TO = "#2f5a1a";
const bolide = {
  id: "bolide", name: "Bolide", group: G, travel: "dash", fx: { color: "#4caf50", trail: "smoke" },
  bio: "La tortue la plus rapide du monde, et elle compte bien te le prouver.",
  persona: "Tortue sprinteuse survoltée et drôle, très fière de sa vitesse, qui ne lâche jamais rien, adore les défis, les chronos et les comptes à rebours.",
  aliases: ["tortue"],
  defs: lin("bolide-skin", "#a6dc77", "#62a83e") + lin("bolide-shell", "#9a7444", "#6a4a24") + lin("bolide-plastron", "#f6e39a", "#dcbc5e"),
  back: shape("M14.4 34.6 C14.4 25.8 21.4 22.6 30 22.6 C38.6 22.6 45.6 25.8 45.6 34.6 L45.6 47.6 C45.6 55.4 38.6 59 30 59 C21.4 59 14.4 55.4 14.4 47.6 Z", "url(#bolide-shell)", "#3f2a12", 0.9) +
    line(pair("M15 32 L18.6 33.2 M14.6 40 L18.6 40.4 M14.8 48 L18.8 47.4"), "#3f2a12", 0.7) + line("M18 26.6 Q30 22.6 42 26.6", "#c49a5e", 0.8, ' opacity=".6"'),
  legL: line(LEGP("L"), TO, 8.4) + line(LEGP("L"), TS, 7.1) + sneaker("L", { color: "#e8283b", sole: "#ffffff", accent: "#ffffff" }),
  legR: line(LEGP("R"), TO, 8.4) + line(LEGP("R"), TS, 7.1) + sneaker("R", { color: "#e8283b", sole: "#ffffff", accent: "#ffffff" }),
  armL: paw("L", TS, 5.6, TS, TO),
  armR: paw("R", TS, 5.6, TS, TO),
  torso: `<rect x="26.6" y="19" width="6.8" height="9" rx="2.4" fill="${TS}" stroke="${TO}" stroke-width=".7"/>` +
    shape("M21.4 27.6 Q30 25 38.6 27.6 Q40.8 41 38.2 54.4 Q30 57.6 21.8 54.4 Q19.2 41 21.4 27.6 Z", "url(#bolide-plastron)", "#9c7d2a", 0.8) +
    line("M21 34.6 Q30 36.4 39 34.6 M20.6 41.6 Q30 43.4 39.4 41.6 M21 48.6 Q30 50.4 39 48.6 M30 26.2 L30 56.2", "#b8962f", 0.6, ' opacity=".8"'),
  head: `<ellipse cx="30" cy="13.8" rx="12.4" ry="11.8" fill="${TS}" stroke="${TO}" stroke-width=".9"/>` +
    line("M21.6 6.4 Q25.4 3.4 30 3.2", "#fff", 1, ' opacity=".35"') +
    // lunettes de course relevées sur le front
    line("M17.8 9.4 Q30 4.2 42.2 9.4", "#5a3b1c", 1.6) +
    `<circle cx="25" cy="6.6" r="3.1" fill="#bfe9ff" stroke="#8a6a3c" stroke-width="1"/><circle cx="35" cy="6.6" r="3.1" fill="#bfe9ff" stroke="#8a6a3c" stroke-width="1"/>` +
    line("M28.1 6.4 L31.9 6.4", "#8a6a3c", 1) + line("M23.6 5.6 L24.8 4.8 M33.6 5.6 L34.8 4.8", "#fff", 0.6, ' opacity=".85"') +
    blush(9, 19.6, "#ff8a8a", 0.4) + eyePair(5.4, 14.6, { rx: 2.1, ry: 2.6 }) + line(pair("M21.8 11 Q24.6 10.6 27.2 12"), TO, 1.2) +
    dot(29, 18.6, 0.4, TO) + dot(31, 18.6, 0.4, TO) +
    `<path d="M26.4 20.8 Q30 21.8 33.6 20.8 Q33.2 24.8 30 24.8 Q26.8 24.8 26.4 20.8 Z" fill="#6a2220"/><path d="M26.9 21.1 Q30 21.9 33.1 21.1 L32.9 21.9 Q30 22.5 27.1 21.9 Z" fill="#fff"/>`,
  faceBox: [11.6, -2.4, 36.8, 36.8],
  lines: {
    hello: ["Prête, partez ! On ne m'appelle pas Bolide pour rien !", "Salut ! J'ai déjà fait trois tours d'écran."],
    tap: ["Hé ! Pas touche à la carapace, elle est aérodynamique.", "Vroum ! Tu veux faire la course ?", "Une tortue rapide, ça existe : la preuve !"],
    pr: ["Record ! Plus rapide que le lièvre, plus fort que tout !", "Ligne d'arrivée franchie ! Médaille d'or !"],
    rest: ["Je rentre dans ma carapace deux minutes. Toi aussi, souffle.", "Pause au stand : on fait le plein."],
    sleep: ["Zzz… même en dormant, je suis rapide…"],
  },
};

/* ---------- Axo, l'axolotl ---------- */
const AS = "url(#axo-skin)", AO = "#c4527a";
const GILLS = ["M18.6 8.4 Q14.6 4.4 10.4 3.8", "M17.4 12.6 Q12.4 11.6 8.6 13.2", "M18 16.6 Q13.8 18.6 11.2 21.8"];
const gill = d => line(d, "#b8336a", 3.2) + line(d, "url(#axo-gill)", 2.2);
const axo = {
  id: "axo", name: "Axo", group: G, travel: "hop", fx: { color: "#ff5c93", trail: "bubbles" },
  bio: "Un axolotl souriant qui fait des bulles de joie et pense toujours à ta gourde.",
  persona: "Axolotl souriant et rêveur, toujours positif, qui adore l'eau et les bulles, et rappelle avec douceur de bien s'hydrater et de bien récupérer.",
  aliases: ["axolotl"],
  defs: lin("axo-skin", "#ffc6d6", "#ff93b2") + lin("axo-belly", "#ffeaf1", "#ffd0de") + lin("axo-gill", "#ff7aa8", "#e2457e"),
  back: shape("M37.8 52 C45.6 54.4 52.6 50.6 53.6 42.6 C50.4 45.8 46 47.2 41.2 46.6 Z", AS, AO, 0.8) + line("M41 49.6 Q47.6 49.6 51.8 45", "#ffe0ea", 0.6, ' opacity=".8"'),
  legL: foot("L", AS, 6.6, AS, AO) + toes("L", AO),
  legR: foot("R", AS, 6.6, AS, AO) + toes("R", AO),
  armL: paw("L", AS, 5, AS, AO),
  armR: paw("R", AS, 5, AS, AO),
  torso: shape(BODY, AS, AO, 0.9) + `<ellipse cx="30" cy="43.4" rx="8.4" ry="11.4" fill="url(#axo-belly)"/>` +
    [[21.6, 33], [38.2, 36], [22.4, 48.4], [37.6, 51]].map(([x, y]) => dot(x, y, 1.1, "#ff7aa5", ' opacity=".55"')).join(""),
  head: `<g class="kit-gillL">${GILLS.map(gill).join("")}${dot(10.4, 3.8, 1.5, "#ff7aa8")}${dot(8.6, 13.2, 1.5, "#ff7aa8")}${dot(11.2, 21.8, 1.5, "#ff7aa8")}</g>` +
    `<g class="kit-gillR">${GILLS.map(d => gill(mir(d))).join("")}${dot(49.6, 3.8, 1.5, "#ff7aa8")}${dot(51.4, 13.2, 1.5, "#ff7aa8")}${dot(48.8, 21.8, 1.5, "#ff7aa8")}</g>` +
    `<ellipse cx="30" cy="14.6" rx="14" ry="10.8" fill="${AS}" stroke="${AO}" stroke-width=".9"/>` +
    line("M21 7.6 Q25.4 4.6 31 4.4", "#fff", 1, ' opacity=".4"') + dot(26.4, 8.4, 0.9, "#ff7aa5", ' opacity=".5"') + dot(35.6, 7.4, 0.7, "#ff7aa5", ' opacity=".5"') +
    blush(9, 18.6, "#ff5c8a", 0.42) + eyePair(8, 13.8, { rx: 1.75, ry: 1.95, color: "#22121a" }) + line("M22.6 18.8 Q30 24 37.4 18.8", "#8a2a50", 0.95),
  css: motion(`  .ch-axo .kit-gillL { transform-origin: 18px 12px; animation: axoGillL 2.2s ease-in-out infinite; }
  .ch-axo .kit-gillR { transform-origin: 42px 12px; animation: axoGillR 2.2s ease-in-out infinite; }
  @keyframes axoGillL { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-7deg); } }
  @keyframes axoGillR { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(7deg); } }`),
  faceBox: [8, -7.6, 44, 44],
  lines: {
    hello: ["Coucou ! Tu as bu ton verre d'eau ?", "Blop ! Prêt à faire des vagues ?"],
    tap: ["Blop ! Mes branchies frétillent !", "Hihi, je fais des bulles quand je suis content.", "Toujours le sourire, c'est ma spécialité."],
    pr: ["Record ! Une pluie de bulles pour toi !", "Incroyable ! Même mes branchies applaudissent."],
    rest: ["Pause : une gorgée d'eau, et on respire.", "Je flotte, tu flottes… repos."],
    sleep: ["Zzz… je rêve d'un grand lac…"],
  },
};

/* ---------- Flocon, le yéti ---------- */
const YF = "url(#flocon-fur)", YO = "#8fa3c0";
const yLeg = s => line(LEGP(s), YO, 9.6) + line(LEGP(s), YF, 8.3) + `<ellipse cx="${X(s, 23.4)}" cy="74.8" rx="6" ry="3.4" fill="${YF}" stroke="${YO}" stroke-width=".8"/>` +
  `<ellipse cx="${X(s, 23.4)}" cy="76.4" rx="3.6" ry="1.4" fill="#93c6ef"/>`;
const yArm = s => line(ARMP(s), YO, 8.3) + line(ARMP(s), YF, 7) + dot(X(s, 14.4), 49.2, 3.6, "url(#flocon-face)", ` stroke="#6f9cc4" stroke-width=".7"`);
const flocon = {
  id: "flocon", name: "Flocon", group: G, travel: "walk", fx: { color: "#7cc4ff", trail: "snow" },
  bio: "Un yéti tout doux et très costaud, qui adore les défis de force et les gros câlins.",
  persona: "Grand yéti doux et costaud, chaleureux comme un chocolat chaud, qui adore le froid, les défis de force et les gros câlins d'encouragement.",
  aliases: ["yeti"],
  defs: lin("flocon-fur", "#ffffff", "#dde6f2") + lin("flocon-face", "#cbe8ff", "#97c9f0"),
  legL: yLeg("L"), legR: yLeg("R"), armL: yArm("L"), armR: yArm("R"),
  torso: shape(cloud(30, 41.6, 13.6, 15.6, 20, 0.07), YF, YO, 0.9) + `<ellipse cx="30" cy="44" rx="7.6" ry="10" fill="#eaf2fc"/>`,
  head: shape(cloud(30, 13.4, 14.2, 12.8, 20, 0.1), YF, YO, 0.9) + shape(cloud(30, 0.8, 4, 2.6, 7, 0.3), YF, YO, 0.6) +
    shape("M30 7.2 C36.6 7.2 40 11 40 15.8 C40 21.4 35.8 24.8 30 24.8 C24.2 24.8 20 21.4 20 15.8 C20 11 23.4 7.2 30 7.2 Z", "url(#flocon-face)", "#6f9cc4", 0.6) +
    blush(6.6, 19.4, "#ff9cbc", 0.5) + eyePair(4.4, 14.2, { rx: 1.75, ry: 2.1, color: "#1d2a44" }) + line(pair("M22.6 10.2 Q25.4 8.6 27.8 10"), "#ffffff", 1.6) +
    `<ellipse cx="30" cy="18" rx="1.6" ry="1.1" fill="#3b5a86"/>` +
    `<path d="M26.4 19.8 Q30 20.8 33.6 19.8 Q33 23.6 30 23.6 Q27 23.6 26.4 19.8 Z" fill="#3b2a4a"/><rect x="27.8" y="20" width="1.7" height="1.5" rx=".3" fill="#fff"/><rect x="30.5" y="20" width="1.7" height="1.5" rx=".3" fill="#fff"/>`,
  faceBox: [11.6, -4.8, 36.8, 36.8],
  lines: {
    hello: ["Salut, petit flocon ! On fait chauffer les muscles ?", "Brrr… rien de tel qu'une séance pour se réchauffer !"],
    tap: ["Hé hé, ma fourrure est toute douce, hein ?", "Un câlin de yéti ? Après la série !", "Attention, je perds mes poils d'hiver."],
    pr: ["Record ! Je fais trembler la montagne !", "Ça, c'est une force de yéti !"],
    rest: ["On souffle un peu, comme le vent des sommets.", "Pause : je t'attends au chaud."],
    sleep: ["Zzz… hibernation en cours…"],
  },
};

/* ---------- Plume, le hibou ---------- */
const OF = "url(#plume-feather)", OO = "#4a3626";
const WING = "M20.6 29 C15.4 31.4 12.8 38.6 13.2 45.4 C13.4 49 14.6 51.6 16.4 52.4 C16.8 50.6 17.8 49.6 19 49.6 C18.6 47.8 19.4 46.4 20.6 46.2 C20.2 44.6 20.8 43.4 22 43.2 Z";
const oLeg = s => line(`M${X(s, 26)} 52 L${X(s, 25)} 72`, "#a8641e", 3.4) + line(`M${X(s, 26)} 52 L${X(s, 25)} 72`, "#f2a93b", 2.3) +
  line(`M${X(s, 25)} 72 L${X(s, 21.4)} 76.8 M${X(s, 25)} 72 L${X(s, 25)} 77.4 M${X(s, 25)} 72 L${X(s, 28.6)} 76.8`, "#a8641e", 2.1) +
  line(`M${X(s, 25)} 72 L${X(s, 21.4)} 76.8 M${X(s, 25)} 72 L${X(s, 25)} 77.4 M${X(s, 25)} 72 L${X(s, 28.6)} 76.8`, "#f2a93b", 1.2);
const oEye = (cls, x) => `<g class="${cls}"><circle cx="${x}" cy="13.6" r="3.9" fill="#ffb02e" stroke="#7a4a12" stroke-width=".7"/><circle cx="${x}" cy="13.8" r="2.3" fill="#1b120c"/>${dot(x - 1, 12.6, 1, "#fff")}${dot(x + 1, 14.8, 0.45, "#fff", ' opacity=".8"')}</g>`;
const plume = {
  id: "plume", name: "Plume", group: G, travel: "fly", fx: { color: "#ffb02e", trail: "stars" },
  bio: "Un hibou savant qui t'explique tout, du sommeil à la technique, sans jamais te juger.",
  persona: "Hibou savant et bienveillant, qui explique le pourquoi de chaque exercice, cite des faits sur le corps et le sommeil, avec calme et un brin d'humour.",
  aliases: ["hibou", "chouette"],
  defs: lin("plume-feather", "#a88a70", "#735842") + lin("plume-disc", "#fbf0de", "#ead6b6") + lin("plume-belly", "#f0e0c4", "#dcc39f"),
  legL: oLeg("L"), legR: oLeg("R"),
  armL: shape(WING, OF, OO, 0.8) + line("M15.6 44 L18.4 46.6 M14.6 40 L18.8 42.6", OO, 0.6, ' opacity=".6"'),
  armR: shape(mir(WING), OF, OO, 0.8) + line(mir("M15.6 44 L18.4 46.6 M14.6 40 L18.8 42.6"), OO, 0.6, ' opacity=".6"'),
  torso: shape("M17.6 29.6 Q30 22.4 42.4 29.6 Q47 44 43 57.6 Q30 63.4 17 57.6 Q13 44 17.6 29.6 Z", OF, OO, 0.9) +
    shape("M22.4 33 Q30 29.4 37.6 33 Q40 45 37 56 Q30 59.6 23 56 Q20 45 22.4 33 Z", "url(#plume-belly)") +
    line("M26 38 l1.4 1.4 1.4 -1.4 M31.4 38 l1.4 1.4 1.4 -1.4 M28.6 43.4 l1.4 1.4 1.4 -1.4 M25.6 48.6 l1.4 1.4 1.4 -1.4 M31.8 48.6 l1.4 1.4 1.4 -1.4", "#b08d68", 0.7),
  head: shape(pair("M19.4 7.4 L16.2 -3.6 L25.2 3.2 Z"), OF, OO, 0.8) +
    `<ellipse cx="30" cy="13.8" rx="13.4" ry="12" fill="${OF}" stroke="${OO}" stroke-width=".9"/>` +
    shape("M30 9.6 C27.6 5.6 19.4 5.8 18.6 12.6 C17.8 19.6 24.6 23.6 30 21.4 C35.4 23.6 42.2 19.6 41.4 12.6 C40.6 5.8 32.4 5.6 30 9.6 Z", "url(#plume-disc)", "#c9ad86", 0.5) +
    blush(9.4, 19.2, "#ff9c8a", 0.45) + `<g class="sp-eyes">${oEye("sp-eyeL", 24.6)}${oEye("sp-eyeR", 35.4)}</g>` +
    line(pair("M20.2 8.6 Q24.4 7 28.2 9.8"), "#5c4431", 1.1) +
    shape("M28.4 16.6 Q30 15.8 31.6 16.6 L30 20.4 Z", "#f2a93b", "#a8641e", 0.6),
  faceBox: [11.2, -5.4, 37.6, 37.6],
  lines: {
    hello: ["Hou hou ! Prêt à apprendre en t'entraînant ?", "Bonsoir… ou bonjour ! Pour un hibou, c'est pareil."],
    tap: ["Hou ! Mes plumes sont toutes ébouriffées.", "Le savais-tu ? Le muscle se construit au repos.", "Hou hou, je t'ai à l'œil."],
    pr: ["Record ! Je le note dans mon grand livre.", "Remarquable. Vraiment remarquable."],
    rest: ["Le repos fait partie de l'entraînement. Respire.", "Pause : laisse ton cœur ralentir."],
    sleep: ["Zzz… le sommeil, c'est la moitié des progrès…"],
  },
};

export default [boulon, braise, pepite, mochi, paco, bolide, axo, flocon, plume];
