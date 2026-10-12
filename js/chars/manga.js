// Coachs du groupe « Manga » : personnages originaux inspirés des grands héros d'animation japonaise.
// Contrat : voir l'en-tête de js/chars/spider.js (repère 60 × 80, pivots fixes, sol à y = 78).

// ---------- petits utilitaires de dessin (aucun import) ----------
// yeux « chibi » : iris + pupille + double reflet blanc (les groupes sp-eyeL / sp-eyeR changent d'humeur)
const eye = (cls, cx, y, iris, rx = 2.2, ry = 2.8, lash = "") =>
  `<g class="${cls}"><ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${iris}"/>` +
  `<ellipse cx="${cx}" cy="${y + ry * 0.22}" rx="${rx * 0.55}" ry="${ry * 0.55}" fill="#120d14" opacity=".75"/>` +
  `<circle cx="${cx + rx * 0.35}" cy="${y - ry * 0.38}" r="${rx * 0.42}" fill="#fff"/>` +
  `<circle cx="${cx - rx * 0.32}" cy="${y + ry * 0.42}" r="${rx * 0.2}" fill="#fff" opacity=".85"/>${lash}</g>`;
const eyes = (y, dx, iris, rx, ry, lash = false) => {
  const l = (cx, s) => lash ? `<path d="M${cx - s * 2.9} ${y - ry + 0.6} Q${cx} ${y - ry - 1.4} ${cx + s * 2.6} ${y - ry + 0.2} L${cx + s * 3.5} ${y - ry - 0.8}" stroke="#2a1d26" stroke-width=".9" fill="none" stroke-linecap="round"/>` : "";
  return `<g class="sp-eyes">${eye("sp-eyeL", 30 - dx, y, iris, rx, ry, l(30 - dx, -1))}${eye("sp-eyeR", 30 + dx, y, iris, rx, ry, l(30 + dx, 1))}</g>`;
};
const blush = (y, o = 0.45, c = "#ff7a8a", dx = 7.6) => `<ellipse cx="${30 - dx}" cy="${y}" rx="2.1" ry="1.2" fill="${c}" opacity="${o}"/><ellipse cx="${30 + dx}" cy="${y}" rx="2.1" ry="1.2" fill="${c}" opacity="${o}"/>`;
// les groupes d'yeux se déforment autour de leur propre centre ; le clignement se fait à hauteur des yeux
const eyeBox = (id, y = 16) => `.ch-${id} g.sp-eyeL, .ch-${id} g.sp-eyeR { transform-box: fill-box; transform-origin: center; }
  .ch-${id} .sp-eyes { transform-origin: 30px ${y}px; }`;
// membres : segment haut + segment bas
const limb = (a, b, c, w1, w2, col1, col2) => `<path d="M${a} L${b}" stroke="${col1}" stroke-width="${w1}" stroke-linecap="round"/><path d="M${b} L${c}" stroke="${col2}" stroke-width="${w2}" stroke-linecap="round"/>`;
const TORSO = "M18.5 28 Q30 23.5 41.5 28 L39.5 48.5 Q30 51.5 20.5 48.5 Z";
const skin = id => `<linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0c4"/><stop offset="1" stop-color="#f2bf98"/></linearGradient>`;
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const SK = "#f6c9a4"; // teinte de peau des membres

// ---------- 1. Ninja Renard ----------
const ninja = {
  id: "ninja",
  name: "Ninja Renard",
  group: "Manga",
  bio: "Le ninja le plus bruyant du village : il ne renonce jamais, et toi non plus.",
  persona: "Jeune ninja survolté, têtu et optimiste, qui parle fort, ne lâche jamais rien et transforme chaque série en promesse à tenir.",
  travel: "dash",
  climb: true,
  fx: { color: "#ff8a1f", trail: "smoke" },
  defs: skin("ninja") + grad("ninja-hair", "#ffe36b", "#f3b21b") + grad("ninja-suit", "#ff9a2e", "#ec6a0c") + grad("ninja-plate", "#f4f7fb", "#a3adbb"),
  legL: limb("26 48", "24.4 61", "24 71.5", 7.4, 6.6, "#f27a14", "#e8680a") + `<rect x="20.6" y="69.6" width="6.8" height="2.6" rx="1" fill="#f1f3f6"/><ellipse cx="23" cy="75.4" rx="4.3" ry="2.6" fill="#24345e"/>`,
  legR: limb("34 48", "35.6 61", "36 71.5", 7.4, 6.6, "#f27a14", "#e8680a") + `<rect x="32.6" y="69.6" width="6.8" height="2.6" rx="1" fill="#f1f3f6"/><rect x="34.2" y="53" width="5.2" height="2.2" rx=".8" fill="#2b3c6e" transform="rotate(8 36.8 54)"/><ellipse cx="37" cy="75.4" rx="4.3" ry="2.6" fill="#24345e"/>`,
  armL: limb("20 30", "16 39.5", "14.6 47", 5.8, 5.2, "#23262e", "#f2780f") + `<circle cx="14.3" cy="49.5" r="2.9" fill="${SK}"/>`,
  armR: limb("40 30", "44 39.5", "45.4 47", 5.8, 5.2, "#23262e", "#f2780f") + `<circle cx="45.7" cy="49.5" r="2.9" fill="${SK}"/>`,
  torso: `<path d="${TORSO}" fill="url(#ninja-suit)"/>
      <path d="M18.5 28 Q30 23.5 41.5 28 L41 33.4 Q30 29.6 19 33.4 Z" fill="#23262e"/>
      <path d="M24.4 26.4 Q30 29.8 35.6 26.4 L36.4 28.8 Q30 32.6 23.6 28.8 Z" fill="#fff4e6"/>
      <path d="M30 31.4 V48.6" stroke="#b44c06" stroke-width=".9"/><rect x="29.1" y="33" width="1.8" height="2.6" rx=".6" fill="#e9edf2"/>
      <path d="M20.6 45.6 Q30 48.6 39.4 45.6 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="#c95408"/>
      <path d="M21.4 36 Q22.6 40 21.6 44" stroke="#fff" stroke-width=".9" opacity=".18" fill="none" stroke-linecap="round"/>`,
  head: `<path d="M18.4 20 L12.4 15 L17.6 12.6 L11.6 6.4 L18.4 5.6 L15.8 -1.4 L23 1.6 L23.4 -5.2 L28.6 -0.4 L31.4 -6.6 L34 -0.6 L39.4 -4.6 L38.8 1.8 L45.6 -0.2 L42.8 5.6 L49 6.6 L43.4 12.2 L48.4 15.4 L41.6 20 Z" fill="url(#ninja-hair)" stroke="#e9a312" stroke-width=".6" stroke-linejoin="round"/>
      <ellipse cx="30" cy="16.2" rx="10.4" ry="10.2" fill="url(#ninja-skin)"/>
      <path d="M19.8 10 L20.2 17.6 L22.4 11.4 L23.6 14.6 L25.2 10.4 L27.2 13.2 L28.6 10 Z M40.2 10 L39.8 17.6 L37.6 11.4 L36.4 14.6 L34.8 10.4 L32.8 13.2 L31.4 10 Z" fill="url(#ninja-hair)" stroke="#e9a312" stroke-width=".5" stroke-linejoin="round"/>
      <g class="ninja-tails"><path d="M40.6 7.4 Q45.4 7.6 49.2 11.6 Q45.6 10.6 43 11.4 Q46.6 13.6 47.6 17 Q43.6 13.4 40.6 11.2 Z" fill="#2554c7"/></g>
      <path d="M18.8 7.6 Q30 3.2 41.2 7.6 L41.4 11.4 Q30 7.4 18.6 11.4 Z" fill="#2f63e0"/>
      <path d="M24.2 5.8 Q30 4.4 35.8 5.8 L35.8 10.2 Q30 9 24.2 10.2 Z" fill="url(#ninja-plate)" stroke="#7d8796" stroke-width=".45"/>
      <path d="M28.4 7.6 Q28.6 6.2 30 6.3 Q31.6 6.5 31.4 7.9 Q31.2 9 30 8.9 Q29.2 8.8 29.3 8" stroke="#5f6977" stroke-width=".55" fill="none" stroke-linecap="round"/>
      ${eyes(16.4, 4.9, "#2d78e8", 2.1, 2.7)}
      <path d="M21.4 13 Q24 11.8 27 12.8 M38.6 13 Q36 11.8 33 12.8" stroke="#d99a1a" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <g stroke="#9b6142" stroke-width=".5" stroke-linecap="round" opacity=".85"><path d="M20.6 19.4 L23.8 20 M20.8 21 L23.8 21.2 M21.2 22.6 L24 22.3 M39.4 19.4 L36.2 20 M39.2 21 L36.2 21.2 M38.8 22.6 L36 22.3"/></g>
      <path d="M26.6 21.6 Q30 22.6 33.4 21.6 Q32.6 25.4 30 25.4 Q27.4 25.4 26.6 21.6 Z" fill="#8a2f2a"/><path d="M27.4 23.8 Q30 22.8 32.6 23.8 Q31.6 25.2 30 25.2 Q28.4 25.2 27.4 23.8 Z" fill="#ff8c8c"/>`,
  css: `${eyeBox("ninja", 16.4)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-ninja .ninja-tails { transform-origin: 41px 9px; animation: ninja-tails 1.6s ease-in-out infinite; }
    @keyframes ninja-tails { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-9deg); } }
  }`,
  lines: {
    hello: ["Yo ! Le ninja est là. On lance la séance ?", "Je ne recule jamais : alors toi non plus !", "Prêt à devenir le plus fort du village ?"],
    tap: ["Hé ! On ne touche pas un ninja comme ça !", "Technique secrète : une série de plus !", "Tu m'as repéré ? Je me ramollis…"],
    pr: ["Record battu ! Ton énergie déborde !", "Ça, c'est un niveau de maître ninja !", "Je te l'avais dit : tu ne lâches jamais !"],
    rest: ["Repos : même les ninjas rechargent.", "Respire. La prochaine série sera fulgurante.", "Je médite en t'attendant. Inspire, expire."],
    sleep: ["Zzz… un bol de nouilles… extra-large…", "Zzz… je m'entraîne même en rêve…"],
  },
};

// ---------- 2. Guerrier Légendaire ----------
const saiyan = {
  id: "saiyan",
  name: "Guerrier Légendaire",
  group: "Manga",
  bio: "Un combattant au grand cœur qui ne vit que pour dépasser ses limites… et manger.",
  persona: "Guerrier jovial, naïf et généreux, obsédé par l'entraînement et les défis, qui s'enthousiasme pour chaque progrès et parle souvent de dépasser ses limites.",
  travel: "fly",
  climb: false,
  fx: { color: "#ffc93c", trail: "aura" },
  defs: skin("saiyan") + grad("saiyan-hair", "#343849", "#0e1018") + grad("saiyan-gi", "#ff9a32", "#ea6c12") +
    `<radialGradient id="saiyan-aura" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#fff3a6" stop-opacity=".75"/><stop offset=".55" stop-color="#ffd23f" stop-opacity=".42"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient>`,
  back: `<g class="saiyan-aura"><path d="M30 -16 Q35 -6 40 -12 Q42 -2 49 -6 Q47 6 56 6 Q50 18 58 26 Q50 34 56 48 Q48 52 52 66 Q42 66 40 80 L20 80 Q18 66 8 66 Q12 52 4 48 Q10 34 2 26 Q10 18 4 6 Q13 6 11 -6 Q18 -2 20 -12 Q25 -6 30 -16 Z" fill="url(#saiyan-aura)"/></g>`,
  legL: limb("26 48", "24 61", "24 68", 8.4, 7.4, "#f27a14", "#ea6c12") + `<path d="M20.2 67 L27.8 67 L27.6 73.4 L20.4 73.4 Z" fill="#2e4fc4"/><rect x="20" y="66.4" width="8" height="1.8" rx=".8" fill="#e9c24a"/><ellipse cx="23" cy="75.4" rx="4.4" ry="2.6" fill="#22399a"/>`,
  legR: limb("34 48", "36 61", "36 68", 8.4, 7.4, "#f27a14", "#ea6c12") + `<path d="M32.2 67 L39.8 67 L39.6 73.4 L32.4 73.4 Z" fill="#2e4fc4"/><rect x="32" y="66.4" width="8" height="1.8" rx=".8" fill="#e9c24a"/><ellipse cx="37" cy="75.4" rx="4.4" ry="2.6" fill="#22399a"/>`,
  armL: limb("20 30", "16.6 37", "14.6 46", 6.4, 5.2, "#2a49c2", SK) + `<path d="M15.6 43.6 L13.4 43.2 L13 47 L15.4 47.4 Z" fill="#2a49c2" stroke="#2a49c2" stroke-width="1.6" stroke-linejoin="round"/><circle cx="14.3" cy="49.5" r="3" fill="${SK}"/>`,
  armR: limb("40 30", "43.4 37", "45.4 46", 6.4, 5.2, "#2a49c2", SK) + `<path d="M44.4 43.6 L46.6 43.2 L47 47 L44.6 47.4 Z" fill="#2a49c2" stroke="#2a49c2" stroke-width="1.6" stroke-linejoin="round"/><circle cx="45.7" cy="49.5" r="3" fill="${SK}"/>`,
  torso: `<path d="${TORSO}" fill="url(#saiyan-gi)"/>
      <path d="M23.6 26 Q30 24.6 36.4 26 L30 37.4 Z" fill="#2a49c2"/>
      <path d="M23 25.8 L30 37.8 L31.6 35.4 L25.6 25.4 Z M37 25.8 L30 37.8 L28.4 35.4 L34.4 25.4 Z" fill="#ff9f3c"/>
      <path d="M30 37.8 L33 33.4" stroke="#c4560c" stroke-width=".6"/>
      <circle cx="35.4" cy="33.6" r="2.3" fill="#fff6e8"/><circle cx="35.4" cy="33.6" r="1.25" fill="none" stroke="#ea6c12" stroke-width=".7"/>
      <path d="M20.4 43 Q30 45.6 39.6 43 L39.5 47 Q30 49.6 20.5 47 Z" fill="#2a49c2"/>
      <path d="M28.4 45.4 L26.6 51.4 L28.6 51 Z M31.4 45.4 L33.6 51 L31.8 51.4 Z" fill="#223c9e"/><rect x="28.2" y="44.2" width="3.6" height="2.8" rx=".9" fill="#3a5ad6"/>
      <path d="M20.5 47.6 Q30 50.6 39.5 47.6 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="#c4560c"/>`,
  head: `<path d="M19 19 L6.6 13.4 L14 10.2 L5 2.4 L14.6 2.8 L10 -6.6 L19.8 -2 L21.4 -9.6 L27 -3.4 L31.4 -11 L34.4 -3.6 L41 -9.4 L40.6 -2 L50 -5.2 L46 2.4 L55 3.4 L46.6 9.2 L53.4 13.6 L41 19 Z" fill="url(#saiyan-hair)" stroke-linejoin="round"/>
      <ellipse cx="30" cy="16.4" rx="10.2" ry="10" fill="url(#saiyan-skin)"/>
      <path d="M19.6 13.6 Q19.4 6.8 25 5.4 Q30 4.4 35 5.4 Q40.6 6.8 40.4 13.6 L38.8 9.8 L37.6 14 L35 8.8 L33.8 12.4 L31.4 7.6 L28.8 12.8 L27.6 8 L24.6 13.2 L24 9.2 L21.4 14.8 Z" fill="url(#saiyan-hair)" stroke-linejoin="round"/>
      <path d="M22.6 2 Q27 -2.6 31.8 -1.6" stroke="#6a7192" stroke-width=".8" fill="none" opacity=".7" stroke-linecap="round"/>
      ${eyes(16.8, 4.8, "#1d1a22", 2, 2.6)}
      <path d="M21.6 13.4 L27.2 14.4 M38.4 13.4 L32.8 14.4" stroke="#14151c" stroke-width="1" stroke-linecap="round"/>
      <path d="M27 22 Q30.4 24 33.4 21.4" stroke="#8c3b2e" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  css: `${eyeBox("saiyan", 16.8)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-saiyan .saiyan-aura { transform-origin: 30px 44px; animation: saiyan-aura 1.4s ease-in-out infinite; }
    @keyframes saiyan-aura { 0%, 100% { transform: scale(.94); opacity: .7; } 50% { transform: scale(1.05); opacity: 1; } }
  }`,
  lines: {
    hello: ["Salut ! Tu sens cette énergie ? On s'entraîne !", "Je suis prêt à dépasser mes limites. Et toi ?", "Un petit combat contre la fonte, ça te dit ?"],
    tap: ["Ha ha ! Tu veux un duel ?", "Attention, mon énergie monte en flèche !", "Ça me donne faim, ça… On finit la séance ?"],
    pr: ["Incroyable ! Ta puissance vient d'exploser !", "Tu as franchi un nouveau niveau, bravo !", "Là, tu viens de dépasser tes limites !"],
    rest: ["Repos : on recharge l'énergie avant l'assaut.", "Respire à fond. La puissance revient.", "Pause courte : les vrais guerriers repartent vite."],
    sleep: ["Zzz… encore une assiette, s'il vous plaît…", "Zzz… je m'entraîne dans mes rêves…"],
  },
};

// ---------- 3. Pirate Élastique ----------
const pirate = {
  id: "pirate",
  name: "Pirate Élastique",
  group: "Manga",
  bio: "Un pirate au chapeau de paille, élastique et affamé, qui fait de chaque séance une aventure.",
  persona: "Capitaine pirate insouciant, rieur et ultra-loyal, qui parle d'aventure, de trésors et de festins, et croit dur comme fer en son équipage.",
  travel: "hop",
  climb: false,
  fx: { color: "#e8343c", trail: "none" },
  defs: skin("pirate") + grad("pirate-straw", "#ffe48a", "#e7b545") + grad("pirate-vest", "#f2424a", "#c91e2a"),
  legL: `<path d="M26 48 L24.6 58.6" stroke="#2f5fd0" stroke-width="8.6" stroke-linecap="round"/><ellipse cx="24.4" cy="60.4" rx="4.6" ry="1.9" fill="#4b7ae6"/>` +
    `<path d="M24.4 62 L24 72.6" stroke="${SK}" stroke-width="5.2" stroke-linecap="round"/><ellipse cx="23" cy="75.6" rx="4.4" ry="2.4" fill="#a8683a"/><path d="M20.6 74.4 L25.4 74.4 M23 73 L23 75" stroke="#6e3e1c" stroke-width=".9" stroke-linecap="round"/>`,
  legR: `<path d="M34 48 L35.4 58.6" stroke="#2f5fd0" stroke-width="8.6" stroke-linecap="round"/><ellipse cx="35.6" cy="60.4" rx="4.6" ry="1.9" fill="#4b7ae6"/>` +
    `<path d="M35.6 62 L36 72.6" stroke="${SK}" stroke-width="5.2" stroke-linecap="round"/><ellipse cx="37" cy="75.6" rx="4.4" ry="2.4" fill="#a8683a"/><path d="M34.6 74.4 L39.4 74.4 M37 73 L37 75" stroke="#6e3e1c" stroke-width=".9" stroke-linecap="round"/>`,
  armL: limb("20 30", "16 39.5", "14.6 47.5", 5.4, 5, SK, SK) + `<circle cx="14.3" cy="49.5" r="3" fill="#f3c19a"/>`,
  armR: limb("40 30", "44 39.5", "45.4 47.5", 5.4, 5, SK, SK) + `<circle cx="45.7" cy="49.5" r="3" fill="#f3c19a"/>`,
  torso: `<path d="${TORSO}" fill="url(#pirate-skin)"/>
      <path d="M26.4 33.6 Q28.4 35 30 33.6 Q31.6 35 33.6 33.6 M28.2 38.4 Q30 39.2 31.8 38.4 M28.4 41.6 Q30 42.4 31.6 41.6" stroke="#d99a74" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <path d="M18.5 28 Q21.6 26 25.6 25.4 Q27 31 26.2 37 L25 47 L20.4 46 Z" fill="url(#pirate-vest)"/>
      <path d="M41.5 28 Q38.4 26 34.4 25.4 Q33 31 33.8 37 L35 47 L39.6 46 Z" fill="url(#pirate-vest)"/>
      <g fill="#ffd66b"><circle cx="25.4" cy="33" r=".7"/><circle cx="25" cy="37.6" r=".7"/><circle cx="24.6" cy="42.2" r=".7"/></g>
      <path d="M20.4 45.2 Q30 47.8 39.6 45.2 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="#f2c94c"/>
      <path d="M36.2 47 L38.4 52.4 L40.2 51.6 L38.6 46.6 Z" fill="#e2b438"/>`,
  head: `<path d="M18.6 19.6 Q17.6 8 30 7 Q42.4 8 41.4 19.6 L40 23.4 L39.4 18 L38 21.6 Z M18.6 19.6 L20 23.4 L20.6 18 L22 21.6 Z" fill="#1c1d26"/>
      <ellipse cx="30" cy="16.6" rx="10.2" ry="10" fill="url(#pirate-skin)"/>
      <path d="M19.8 9 L20.4 14.6 L22.6 10.4 L24 13.8 L25.8 10.2 L27.4 13.2 L29.4 10 L30.8 13.4 L32.6 10 L34.4 13.6 L35.8 10.2 L37.6 14 L38.4 10.6 L40.2 14.8 L40.2 8.4 Z" fill="#1c1d26" stroke="#1c1d26" stroke-width=".5" stroke-linejoin="round"/>
      <path d="M21.4 4.2 Q21 -5.6 30 -5.8 Q39 -5.6 38.6 4.2 Z" fill="url(#pirate-straw)"/>
      <path d="M21.3 1.2 Q30 -0.6 38.7 1.2 L38.7 4.2 Q30 2.6 21.3 4.2 Z" fill="#e0303a"/>
      <ellipse cx="30" cy="5" rx="17.4" ry="4" fill="url(#pirate-straw)"/>
      <ellipse cx="30" cy="4.2" rx="10" ry="1.8" fill="#c99a32" opacity=".55"/>
      <path d="M15 5.8 Q30 10 45 5.8 M24 -1.8 L23.6 0.8 M30 -2.6 V0 M36 -1.8 L36.4 0.8" stroke="#c99a32" stroke-width=".5" fill="none" opacity=".8"/>
      <path d="M23.6 -4 Q27 -5.4 30 -5" stroke="#fff6cf" stroke-width=".8" fill="none" opacity=".7" stroke-linecap="round"/>
      ${eyes(15.6, 4.8, "#1a1720", 2.1, 2.7)}
      <path d="M33.4 19.6 L37.2 19.6 M34.4 18.8 L34.2 20.4 M36.2 18.8 L36 20.4" stroke="#b05a48" stroke-width=".5" stroke-linecap="round"/>
      <path d="M24.4 20.4 Q30 22.2 35.6 20.4 Q34.8 26.2 30 26.2 Q25.2 26.2 24.4 20.4 Z" fill="#7a1f22"/>
      <path d="M24.8 20.6 Q30 22.4 35.2 20.6 L34.8 22.2 Q30 23.6 25.2 22.2 Z" fill="#fff"/>
      <path d="M27 24.6 Q30 23 33 24.6 Q31.8 26 30 26 Q28.2 26 27 24.6 Z" fill="#ff7d86"/>`,
  css: `${eyeBox("pirate", 15.6)}`,
  lines: {
    hello: ["Salut ! Embarque, on part pour une séance !", "Je vais devenir le roi des muscles ! Tu viens ?", "Ohé ! Ta séance t'attend sur le pont !"],
    tap: ["Hé ! Je suis tout élastique, ça rebondit !", "J'ai faim… mais d'abord, une série !", "Ha ha ! Pas touche au chapeau !"],
    pr: ["Record ! Ce soir, festin pour tout l'équipage !", "Ça, c'est un vrai trésor ! Nouveau record !", "Énorme ! Tu deviens une légende des mers !"],
    rest: ["Repos : je surveille l'horizon pour toi.", "On jette l'ancre un instant. Respire.", "Pause ! Pas trop longue, l'aventure attend."],
    sleep: ["Zzz… de la viande… encore de la viande…", "Zzz… mon chapeau… n'y touche pas…"],
  },
};

// ---------- 4. Guerrière Lunaire ----------
// longue mèche de couette (côté gauche ; la droite est son miroir)
const tailL = `M15.6 4.6 Q6.4 14 6.6 28 Q6.8 38 11.4 45.4 Q9.6 37 10.8 28 Q12 17.4 18.6 8.4 Z`;
const moon = {
  id: "moon",
  name: "Guerrière Lunaire",
  group: "Manga",
  bio: "Une collégienne pas très sportive qui se transforme en guerrière dès que la séance commence.",
  persona: "Collégienne pétillante, un peu tête en l'air et gourmande, qui se plaint pour rire puis se donne à fond, avec un grand cœur et des encouragements lumineux.",
  travel: "hop",
  climb: false,
  fx: { color: "#ff5c8a", trail: "hearts" },
  defs: skin("moon") + grad("moon-hair", "#ffeb8f", "#f4bf3c") + grad("moon-skirt", "#3a74f0", "#2350c4") + grad("moon-top", "#ffffff", "#e3e8f2"),
  legL: limb("26 48", "24.4 60", "24 63", 5.6, 5.4, SK, SK) + `<path d="M24 62.6 L24 72.8" stroke="#e2283e" stroke-width="6" stroke-linecap="round"/><path d="M20.8 62 L24 64.6 L27.2 62" stroke="#ff6474" stroke-width=".9" fill="none" stroke-linecap="round"/><ellipse cx="23" cy="75.4" rx="4" ry="2.5" fill="#c3172c"/>`,
  legR: limb("34 48", "35.6 60", "36 63", 5.6, 5.4, SK, SK) + `<path d="M36 62.6 L36 72.8" stroke="#e2283e" stroke-width="6" stroke-linecap="round"/><path d="M32.8 62 L36 64.6 L39.2 62" stroke="#ff6474" stroke-width=".9" fill="none" stroke-linecap="round"/><ellipse cx="37" cy="75.4" rx="4" ry="2.5" fill="#c3172c"/>`,
  armL: limb("20 30", "16 39.5", "14.6 47.5", 4.8, 4.8, SK, "#f7f9fd") + `<ellipse cx="16" cy="39.4" rx="3.1" ry="1.5" fill="#e2283e" transform="rotate(-20 16 39.4)"/><circle cx="14.3" cy="49.5" r="2.8" fill="#f7f9fd"/><circle cx="20.2" cy="29.8" r="3.6" fill="#f7f9fd"/>`,
  armR: limb("40 30", "44 39.5", "45.4 47.5", 4.8, 4.8, SK, "#f7f9fd") + `<ellipse cx="44" cy="39.4" rx="3.1" ry="1.5" fill="#e2283e" transform="rotate(20 44 39.4)"/><circle cx="45.7" cy="49.5" r="2.8" fill="#f7f9fd"/><circle cx="39.8" cy="29.8" r="3.6" fill="#f7f9fd"/>`,
  torso: `<path d="M19 28 Q30 23.5 41 28 L39.4 45 Q30 47 20.6 45 Z" fill="url(#moon-top)"/>
      <path d="M18.6 27.8 Q30 23.4 41.4 27.8 L41 32.4 Q36 31.2 30 37.6 Q24 31.2 19 32.4 Z" fill="#2c62e6"/>
      <path d="M19.2 30.6 Q24.6 30 28.6 35 M40.8 30.6 Q35.4 30 31.4 35" stroke="#fff" stroke-width=".6" fill="none"/>
      <path d="M30 35.4 Q24.6 31.2 22.4 34.4 Q22 37.6 30 36.8 Z M30 35.4 Q35.4 31.2 37.6 34.4 Q38 37.6 30 36.8 Z" fill="#ef2f47"/>
      <path d="M29.2 36.6 L26.6 42.6 L28.8 41.8 Z M30.8 36.6 L33.4 42.6 L31.2 41.8 Z" fill="#d11e35"/>
      <circle cx="30" cy="36" r="1.7" fill="#ffd34d" stroke="#e8a91c" stroke-width=".4"/><circle cx="30" cy="36" r=".6" fill="#ff7d9a"/>
      <path d="M20.4 44 Q30 46.4 39.6 44 L43.6 52.6 Q30 56 16.4 52.6 Z" fill="url(#moon-skirt)"/>
      <path d="M24.6 45.8 L22.4 54 M30 46.4 V55 M35.4 45.8 L37.6 54" stroke="#1d43a8" stroke-width=".55" opacity=".8"/>
      <path d="M20.6 44 Q30 46.4 39.4 44" stroke="#f7f9fd" stroke-width="1" fill="none"/>`,
  head: `<g class="moon-tailL"><path d="${tailL}" fill="url(#moon-hair)"/></g>
      <g class="moon-tailR"><path d="${tailL}" transform="translate(60 0) scale(-1 1)" fill="url(#moon-hair)"/></g>
      <circle cx="17" cy="3" r="5.6" fill="url(#moon-hair)"/><circle cx="43" cy="3" r="5.6" fill="url(#moon-hair)"/>
      <path d="M14.4 0.8 Q16.4 -1.6 19 -0.8 M45.6 0.8 Q43.6 -1.6 41 -0.8" stroke="#fff6c8" stroke-width=".8" fill="none" opacity=".8" stroke-linecap="round"/>
      <path d="M19 21 Q17.6 6 30 4.8 Q42.4 6 41 21 Z" fill="url(#moon-hair)"/>
      <ellipse cx="30" cy="16.6" rx="10" ry="10" fill="url(#moon-skin)"/>
      <path d="M19.6 16.6 Q19.4 6.6 30 6 Q40.6 6.6 40.4 16.6 Q39 12.4 36.8 11.4 Q35.8 13.6 33.6 13.4 Q33 11.4 30 10.4 Q27 11.4 26.4 13.4 Q24.2 13.6 23.2 11.4 Q21 12.4 19.6 16.6 Z" fill="url(#moon-hair)"/>
      <path d="M21.6 8.6 Q30 5.6 38.4 8.6" stroke="#ffd34d" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M28.4 8 L30 5.4 L31.6 8 L30 9.6 Z" fill="#ffd34d"/><ellipse cx="30" cy="7.6" rx=".9" ry="1.1" fill="#ef2f47"/>
      ${eyes(17, 4.7, "#2f74ec", 2.3, 2.9, true)}
      ${blush(21.2, 0.5)}
      <path d="M28.2 22.4 Q30 23.8 31.8 22.4" stroke="#b5485a" stroke-width=".9" fill="none" stroke-linecap="round"/>`,
  css: `${eyeBox("moon", 17)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-moon .moon-tailL { transform-origin: 16px 5px; animation: moon-sway 3s ease-in-out infinite; }
    .ch-moon .moon-tailR { transform-origin: 44px 5px; animation: moon-sway 3s ease-in-out infinite reverse; }
    @keyframes moon-sway { 0%, 100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
  }`,
  lines: {
    hello: ["Coucou ! Ce soir, la lune veille sur ta séance !", "On va briller ensemble aujourd'hui !", "Salut ! Ta force intérieure est prête ?"],
    tap: ["Hiii ! Tu m'as fait peur !", "Attention à mes couettes, hein !", "Toc toc ! Encore quelques séries !"],
    pr: ["Record ! Tu brilles plus que la pleine lune !", "Waouh ! Ça, c'est une vraie transformation !", "Je suis trop fière de toi : record battu !"],
    rest: ["Repos : respire et pense à un bon gâteau.", "Petite pause sous les étoiles, tu l'as méritée.", "Bois une gorgée d'eau, ça fait briller !"],
    sleep: ["Zzz… encore cinq minutes…", "Zzz… je rêve d'un dessert géant…"],
  },
};

// ---------- 5. Électro-souris ----------
const pika = {
  id: "pika",
  name: "Électro-souris",
  group: "Manga",
  bio: "Une petite souris pleine d'étincelles qui transforme chaque série en décharge de motivation.",
  persona: "Petite souris électrique espiègle et affectueuse, qui ponctue ses phrases de « bzzt », parle d'énergie, de batteries et d'étincelles, et encourage avec malice.",
  travel: "hop",
  climb: false,
  fx: { color: "#ffd43b", trail: "sparks" },
  defs: grad("pika-fur", "#ffe45c", "#f6bf1d") + grad("pika-tail", "#ffe04d", "#f5b914"),
  back: `<g class="pika-tail"><path d="M36.6 56 L42.4 50.6 L39.8 48.2 L47.6 41.4 L45 38.6 L54.4 28.6 L58.6 31.6 L51.2 39.6 L54 42 L46.4 49.6 L48.8 51.6 L40.4 58.6 Z" fill="url(#pika-tail)" stroke="#e8a90e" stroke-width=".6" stroke-linejoin="round"/>
      <path d="M36.6 56 L42.4 50.6 L44.2 52.4 L40.4 58.6 Z" fill="#a8652a"/></g>`,
  legL: `<path d="M26 48 L24.2 72" stroke="#f8c826" stroke-width="7.4" stroke-linecap="round"/><ellipse cx="23" cy="75.4" rx="4.6" ry="2.7" fill="#f2b616"/><path d="M20.4 76.4 V74.6 M23 76.8 V74.8 M25.6 76.4 V74.6" stroke="#d99a0c" stroke-width=".55" stroke-linecap="round"/>`,
  legR: `<path d="M34 48 L35.8 72" stroke="#f8c826" stroke-width="7.4" stroke-linecap="round"/><ellipse cx="37" cy="75.4" rx="4.6" ry="2.7" fill="#f2b616"/><path d="M34.4 76.4 V74.6 M37 76.8 V74.8 M39.6 76.4 V74.6" stroke="#d99a0c" stroke-width=".55" stroke-linecap="round"/>`,
  armL: limb("20 30", "16.4 39.5", "15 47", 5, 4.6, "#fbd232", "#fbd232") + `<circle cx="14.3" cy="49.5" r="2.7" fill="#f6c21e"/>`,
  armR: limb("40 30", "43.6 39.5", "45 47", 5, 4.6, "#fbd232", "#fbd232") + `<circle cx="45.7" cy="49.5" r="2.7" fill="#f6c21e"/>`,
  torso: `<path d="M19.6 29 Q30 24 40.4 29 Q44.8 42 42.6 54 Q40.4 65 30 65 Q19.6 65 17.4 54 Q15.2 42 19.6 29 Z" fill="url(#pika-fur)"/>
      <path d="M21 33 Q18.6 44 20.4 54" stroke="#fff6b8" stroke-width="1.2" fill="none" opacity=".55" stroke-linecap="round"/>
      <path d="M25.4 57.8 Q30 60.4 34.6 57.8" stroke="#e5a813" stroke-width=".7" fill="none" opacity=".7" stroke-linecap="round"/>`,
  head: `<g class="pika-earL"><path d="M22.4 7.4 Q14.6 2.6 9.4 -6.4 Q18.6 -4.6 27 4.6 Z" fill="url(#pika-fur)"/><path d="M9.4 -6.4 Q12.6 -5.8 15.8 -4 Q14.2 -1.6 12.8 -0.8 Q10.8 -3.2 9.4 -6.4 Z" fill="#1f1c22"/></g>
      <g class="pika-earR"><path d="M37.6 7.4 Q45.4 2.6 50.6 -6.4 Q41.4 -4.6 33 4.6 Z" fill="url(#pika-fur)"/><path d="M50.6 -6.4 Q47.4 -5.8 44.2 -4 Q45.8 -1.6 47.2 -0.8 Q49.2 -3.2 50.6 -6.4 Z" fill="#1f1c22"/></g>
      <ellipse cx="30" cy="15" rx="12.6" ry="11.2" fill="url(#pika-fur)"/>
      <path d="M21.4 8.4 Q25 5.2 29.6 5" stroke="#fff6b8" stroke-width="1" fill="none" opacity=".7" stroke-linecap="round"/>
      ${eyes(14.4, 5.4, "#1b1820", 2.2, 2.5)}
      <circle cx="20.4" cy="19.4" r="2.7" fill="#f2433d"/><circle cx="39.6" cy="19.4" r="2.7" fill="#f2433d"/>
      <circle cx="19.6" cy="18.6" r=".8" fill="#fff" opacity=".45"/><circle cx="38.8" cy="18.6" r=".8" fill="#fff" opacity=".45"/>
      <ellipse cx="30" cy="17.4" rx=".75" ry=".5" fill="#2a1d18"/>
      <path d="M27.4 19.2 Q28.7 20.8 30 19.4 Q31.3 20.8 32.6 19.2" stroke="#5a2b1e" stroke-width=".75" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  css: `${eyeBox("pika", 14.4)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-pika .pika-tail { transform-origin: 38px 57px; animation: pika-tail 1.8s ease-in-out infinite; }
    @keyframes pika-tail { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
    .ch-pika .pika-earR { transform-origin: 35px 6px; animation: pika-ear 5s ease-in-out infinite; }
    @keyframes pika-ear { 0%, 84%, 100% { transform: rotate(0deg); } 88% { transform: rotate(14deg); } 92% { transform: rotate(-4deg); } }
  }`,
  lines: {
    hello: ["Bzzt ! Salut ! On s'électrise un peu ?", "Je suis chargé à bloc ! Et toi ?", "Petite souris, grosse énergie. On y va ?"],
    tap: ["Bzzt ! Attention, je suis électrique !", "Hé ! Mes joues crépitent !", "Tu veux une petite décharge de motivation ?"],
    pr: ["Record ! Ça fait des étincelles !", "Bzzzt ! Cent mille volts de fierté !", "Électrisant ! Nouveau record !"],
    rest: ["Repos : je recharge mes batteries aussi.", "Pause ! Mes joues refroidissent.", "Respire… la prochaine série sera survoltée."],
    sleep: ["Zzz… bzz… zzz…", "Zzz… recharge en cours… 3 %… 4 %…"],
  },
};

export default [ninja, saiyan, pirate, moon, pika];
