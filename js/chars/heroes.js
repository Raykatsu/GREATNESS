// Coachs du groupe « Héros » : personnages originaux inspirés des grands justiciers.
// Contrat : voir l'en-tête de js/chars/spider.js (repère 60 × 80, pivots fixes, sol à y = 78).

// ---------- petits utilitaires de dessin (aucun import) ----------
const star = (cx, cy, R, fill, r = R * 0.45) => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R;
    d += (i ? "L" : "M") + (cx + k * Math.cos(a)).toFixed(2) + " " + (cy + k * Math.sin(a)).toFixed(2);
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${fill}" stroke-width=".3" stroke-linejoin="round"/>`;
};

// yeux « chibi » : pupille sombre + double reflet blanc (les groupes sp-eyeL / sp-eyeR changent d'humeur)
const eyes = (y = 16, dx = 5, iris = "#2a1d18") => {
  const one = (cls, cx) => `<g class="${cls}"><ellipse cx="${cx}" cy="${y}" rx="2.05" ry="2.65" fill="${iris}"/>` +
    `<circle cx="${cx + 0.7}" cy="${y - 1}" r=".85" fill="#fff"/><circle cx="${cx - 0.6}" cy="${y + 1.1}" r=".4" fill="#fff" opacity=".8"/></g>`;
  return `<g class="sp-eyes">${one("sp-eyeL", 30 - dx)}${one("sp-eyeR", 30 + dx)}</g>`;
};
const blush = (y = 20, o = 0.45) => `<ellipse cx="22.6" cy="${y}" rx="2.1" ry="1.2" fill="#ff7a8a" opacity="${o}"/><ellipse cx="37.4" cy="${y}" rx="2.1" ry="1.2" fill="#ff7a8a" opacity="${o}"/>`;
const smile = (y = 21.6, c = "#8c3b2e") => `<path d="M27.6 ${y} Q30 ${y + 2.2} 32.4 ${y}" stroke="${c}" stroke-width=".95" fill="none" stroke-linecap="round"/>`;
// les groupes d'yeux se déforment autour de leur propre centre (le style global vise des formes simples)
const eyeBox = id => `.ch-${id} g.sp-eyeL, .ch-${id} g.sp-eyeR { transform-box: fill-box; transform-origin: center; }`;
// membres : segment haut + segment bas + main / pied
const limb = (a, b, c, w1, w2, col1, col2) => `<path d="M${a} L${b}" stroke="${col1}" stroke-width="${w1}" stroke-linecap="round"/><path d="M${b} L${c}" stroke="${col2}" stroke-width="${w2}" stroke-linecap="round"/>`;
const TORSO = "M18.5 28 Q30 23.5 41.5 28 L39.5 48.5 Q30 51.5 20.5 48.5 Z";

// ---------- 1. Chevalier Noir ----------
const knight = {
  id: "knight",
  name: "Chevalier Noir",
  group: "Héros",
  bio: "Le justicier de la nuit : discret, méthodique, il ne rate jamais une séance.",
  persona: "Justicier nocturne laconique et déterminé, voix grave, humour pince-sans-rire, obsédé par la discipline et la préparation.",
  travel: "web",
  climb: true,
  fx: { color: "#c9ced8", trail: "none" },
  defs: `<linearGradient id="knight-suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#666c7a"/><stop offset="1" stop-color="#3c414d"/></linearGradient>
    <linearGradient id="knight-cowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b404c"/><stop offset="1" stop-color="#1c1f27"/></linearGradient>
    <linearGradient id="knight-cape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363d4d"/><stop offset="1" stop-color="#1b1f29"/></linearGradient>
    <linearGradient id="knight-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d3b6"/><stop offset="1" stop-color="#e6b896"/></linearGradient>`,
  back: `<g class="knight-cape"><path d="M19 26.5 Q30 23.5 41 26.5 L50.5 63 Q47.5 60.6 45 64 Q42.2 61 38.6 64.6 Q35 61.4 30 65.2 Q25 61.4 21.4 64.6 Q17.8 61 15 64 Q12.5 60.6 9.5 63 Z" fill="url(#knight-cape)" stroke="#5c6476" stroke-width=".6" stroke-linejoin="round"/>
      <path d="M24 30 L19 60 M36 30 L41 60" stroke="#0c0d11" stroke-width=".7" opacity=".55"/></g>`,
  legL: limb("26 48", "24 61", "24 72.5", 7, 6.4, "#555c6b", "#262a34") + `<ellipse cx="23" cy="75.5" rx="4.3" ry="2.6" fill="#0f1116"/>`,
  legR: limb("34 48", "36 61", "36 72.5", 7, 6.4, "#555c6b", "#262a34") + `<ellipse cx="37" cy="75.5" rx="4.3" ry="2.6" fill="#0f1116"/>`,
  armL: limb("20 30", "16 39.5", "14.5 48", 5.6, 5.2, "#5a606d", "#1d2028") + `<path d="M15.6 41.5 L12.6 42.6 L15.3 44 Z M15.3 44.4 L12.4 45.6 L15 47 Z" fill="#1d2028"/><circle cx="14.3" cy="49.5" r="3" fill="#1d2028"/>`,
  armR: limb("40 30", "44 39.5", "45.5 48", 5.6, 5.2, "#5a606d", "#1d2028") + `<path d="M44.4 41.5 L47.4 42.6 L44.7 44 Z M44.7 44.4 L47.6 45.6 L45 47 Z" fill="#1d2028"/><circle cx="45.7" cy="49.5" r="3" fill="#1d2028"/>`,
  torso: `<path d="${TORSO}" fill="url(#knight-suit)"/>
      <path d="M20.4 46 Q30 48.6 39.6 46 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="#23262f"/>
      <path d="M23 33.6 Q26 31.6 28.2 33.5 L30 31.4 L31.8 33.5 Q34 31.6 37 33.6 Q34.6 34.4 33.4 37 Q32 35.6 30 36.6 Q28 35.6 26.6 37 Q25.4 34.4 23 33.6 Z" fill="#15171d"/>
      <rect x="20.4" y="42.6" width="19.2" height="3.4" rx="1.2" fill="#f4c534"/>
      <rect x="21.6" y="43.1" width="2.6" height="2.4" rx=".5" fill="#d29b14"/><rect x="35.8" y="43.1" width="2.6" height="2.4" rx=".5" fill="#d29b14"/>
      <rect x="28.4" y="42.9" width="3.2" height="2.8" rx=".7" fill="#ffe27a"/>
      <path d="M21 30 Q30 27 39 30" stroke="#fff" stroke-width=".8" opacity=".12" fill="none"/>`,
  head: `<path d="M20.2 8 L18.6 -4.2 L26 3.4 Z M39.8 8 L41.4 -4.2 L34 3.4 Z" fill="#2c303a" stroke="#2c303a" stroke-width="1" stroke-linejoin="round"/>
      <ellipse cx="30" cy="14.6" rx="11.3" ry="12.4" fill="url(#knight-cowl)"/>
      <path d="M20.2 18 Q30 15.6 39.8 18 L38.6 22.8 Q35.6 27.2 30 27.2 Q24.4 27.2 21.4 22.8 Z" fill="url(#knight-skin)"/>
      <path d="M26.8 22.6 Q30 24.4 33.2 22.6" stroke="#8c4a3a" stroke-width=".95" fill="none" stroke-linecap="round"/>
      <ellipse cx="24.5" cy="6.4" rx="3.4" ry="1.6" fill="#fff" opacity=".1" transform="rotate(-20 24.5 6.4)"/>
      <g class="sp-eyes">
        <path class="sp-eyeL" d="M20.6 11.6 L28.2 14.2 Q27.6 16.8 24.8 16.8 Q21.4 16.4 20.6 11.6 Z" fill="#f4f6fb"/>
        <path class="sp-eyeR" d="M39.4 11.6 L31.8 14.2 Q32.4 16.8 35.2 16.8 Q38.6 16.4 39.4 11.6 Z" fill="#f4f6fb"/>
      </g>`,
  css: `@media (prefers-reduced-motion: no-preference) {
    .ch-knight .knight-cape { transform-origin: 30px 26px; animation: knight-cape 3.4s ease-in-out infinite; }
    @keyframes knight-cape { 0%, 100% { transform: skewX(0deg) scaleX(1); } 50% { transform: skewX(-2.5deg) scaleX(1.04); } }
  }`,
  lines: {
    hello: ["La nuit tombe. L'entraînement commence.", "Je ne suis pas en retard. J'étais déjà là.", "Ta ville compte sur toi. Tes muscles aussi."],
    tap: ["Tu m'as repéré. Pas mal.", "Je préfère l'ombre. Retourne t'entraîner.", "Pas de bruit. On reste concentré."],
    pr: ["Record battu. J'avais tout prévu, bien sûr.", "Même dans le noir, ça brille. Bravo.", "Le crime a peur. Tes haltères aussi."],
    rest: ["Repos. Un justicier récupère pour mieux frapper.", "Respire. Je surveille le chrono depuis les toits."],
    sleep: ["Zzz… même les justiciers dorment…", "Je médite dans l'ombre. Ne me dérange pas."],
  },
};

// ---------- 2. Super Nova ----------
const nova = {
  id: "nova",
  name: "Super Nova",
  group: "Héros",
  bio: "Venu des étoiles, il soulève des montagnes et croit en toi plus que quiconque.",
  persona: "Héros solaire, optimiste et chaleureux, d'une force tranquille, qui encourage avec douceur et parle d'étoiles et de lumière.",
  travel: "fly",
  climb: false,
  fx: { color: "#ffd24a", trail: "stars" },
  defs: `<linearGradient id="nova-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a86ff"/><stop offset="1" stop-color="#1f4ccc"/></linearGradient>
    <linearGradient id="nova-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4f55"/><stop offset="1" stop-color="#bd1424"/></linearGradient>
    <linearGradient id="nova-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0c6"/><stop offset="1" stop-color="#f6c3a0"/></linearGradient>
    <linearGradient id="nova-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b452c"/><stop offset="1" stop-color="#3f2617"/></linearGradient>
    <linearGradient id="nova-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f2aa1c"/></linearGradient>`,
  back: `<g class="nova-cape"><path d="M18.6 27 Q30 23.6 41.4 27 L48.5 64.5 Q44 67.4 39 65.6 Q34.5 68 30 66.2 Q25.5 68 21 65.6 Q16 67.4 11.5 64.5 Z" fill="url(#nova-red)"/>
      <path d="M25 31 L21.5 63 M35 31 L38.5 63" stroke="#8e0c18" stroke-width=".8" opacity=".5" fill="none"/></g>`,
  legL: limb("26 48", "24 61", "24 72.5", 7, 6.4, "#2a5ae0", "#d81e2c") + `<ellipse cx="23" cy="75.5" rx="4.2" ry="2.6" fill="#a8101e"/>`,
  legR: limb("34 48", "36 61", "36 72.5", 7, 6.4, "#2a5ae0", "#d81e2c") + `<ellipse cx="37" cy="75.5" rx="4.2" ry="2.6" fill="#a8101e"/>`,
  armL: limb("20 30", "16 39.5", "14.5 48", 5.6, 5, "#3a72f4", "#2a5ae0") + `<circle cx="14.3" cy="49.5" r="2.9" fill="#f6c3a0"/>`,
  armR: limb("40 30", "44 39.5", "45.5 48", 5.6, 5, "#3a72f4", "#2a5ae0") + `<circle cx="45.7" cy="49.5" r="2.9" fill="#f6c3a0"/>`,
  torso: `<path d="${TORSO}" fill="url(#nova-blue)"/>
      <path d="M20.4 45.4 Q30 48 39.6 45.4 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="url(#nova-red)"/>
      <path d="M20.5 44.2 Q30 46.8 39.5 44.2 L39.5 45.8 Q30 48.4 20.5 45.8 Z" fill="url(#nova-gold)"/>
      <path d="M18.6 28 Q20 26.4 23 26 L21.2 31 Z M41.4 28 Q40 26.4 37 26 L38.8 31 Z" fill="url(#nova-red)"/>
      <circle cx="30" cy="35.4" r="6.1" fill="#ffd24a" opacity=".22"/>
      ${star(30, 35.6, 5.2, "url(#nova-gold)")}
      <path d="M28.4 33.6 L29.4 32.4" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity=".8"/>`,
  head: `<ellipse cx="30" cy="12.6" rx="11.6" ry="11" fill="url(#nova-hair)"/>
      <circle cx="19.6" cy="17" r="2.1" fill="#f6c3a0"/><circle cx="40.4" cy="17" r="2.1" fill="#f6c3a0"/>
      <ellipse cx="30" cy="16" rx="10.4" ry="10.6" fill="url(#nova-skin)"/>
      <path d="M19.2 14 Q18.6 2.4 30 2 Q41.4 2.4 40.8 14 Q38.4 8.6 32.6 8.4 Q29 10.4 24.6 9 Q21 10 19.2 14 Z" fill="url(#nova-hair)"/>
      <path d="M30.2 8.6 Q27.4 10.6 28.8 12.6 Q30.6 12.4 30 11" stroke="#4a2c1a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="25" cy="4.6" rx="3" ry="1.2" fill="#fff" opacity=".18" transform="rotate(-18 25 4.6)"/>
      ${blush(20.4)}${smile(21.8)}${eyes(16.2, 4.9, "#1d3a7a")}`,
  css: `${eyeBox("nova")}
  @media (prefers-reduced-motion: no-preference) {
    .ch-nova .nova-cape { transform-origin: 30px 27px; animation: nova-cape 2.6s ease-in-out infinite; }
    @keyframes nova-cape { 0%, 100% { transform: skewX(0deg); } 50% { transform: skewX(3deg) scaleX(1.03); } }
  }`,
  lines: {
    hello: ["Bonjour, petite étoile ! On brille aujourd'hui ?", "Le soleil est levé, et toi aussi. Allez !", "Prêt à décoller ? Ta séance t'attend."],
    tap: ["Hihi, ça chatouille comme une comète !", "Tu cherches ta force ? Elle est déjà en toi.", "Je pourrais soulever un camion. Toi, ta série !"],
    pr: ["Supernova ! Tu viens d'exploser ton record !", "Une nouvelle étoile est née : toi !", "Plus fort que l'acier, bravo !"],
    rest: ["Recharge au soleil, je veille sur toi.", "Repos : même les étoiles prennent leur temps."],
    sleep: ["Zzz… je rêve de galaxies…", "Je recharge mes rayons. À tout à l'heure…"],
  },
};

// ---------- 3. Armure Titane ----------
const titan = {
  id: "titan",
  name: "Armure Titane",
  group: "Héros",
  bio: "Génie en armure rouge et or, il calcule ta progression au gramme près.",
  persona: "Inventeur génial en armure, sûr de lui et très drôle, qui parle de données, de réacteurs et d'optimisation avec un brin de frime.",
  travel: "fly",
  climb: false,
  fx: { color: "#ffb43a", trail: "sparks" },
  defs: `<linearGradient id="titan-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef3a40"/><stop offset="1" stop-color="#9c0f1c"/></linearGradient>
    <linearGradient id="titan-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#d79a22"/></linearGradient>
    <radialGradient id="titan-glow"><stop offset="0" stop-color="#e9fdff"/><stop offset=".45" stop-color="#7fe3ff" stop-opacity=".8"/><stop offset="1" stop-color="#2fb8ff" stop-opacity="0"/></radialGradient>`,
  legL: limb("26 48", "24 61", "24 72.5", 7.2, 6.6, "url(#titan-gold)", "#c81c28") + `<circle cx="24.2" cy="61" r="2.4" fill="#e6b03a"/><ellipse cx="23" cy="75.5" rx="4.4" ry="2.6" fill="#8e0d18"/>`,
  legR: limb("34 48", "36 61", "36 72.5", 7.2, 6.6, "url(#titan-gold)", "#c81c28") + `<circle cx="35.8" cy="61" r="2.4" fill="#e6b03a"/><ellipse cx="37" cy="75.5" rx="4.4" ry="2.6" fill="#8e0d18"/>`,
  armL: limb("20 30", "16 39.5", "14.5 48", 6, 5.4, "#d8222e", "#c81c28") + `<path d="M13.2 44.6 L17.6 45.4" stroke="#f2c34c" stroke-width="1.4" stroke-linecap="round"/><circle cx="14.3" cy="49.5" r="3.1" fill="#b3141f"/><circle cx="14.3" cy="50" r="1.1" fill="#bff4ff"/>`,
  armR: limb("40 30", "44 39.5", "45.5 48", 6, 5.4, "#d8222e", "#c81c28") + `<path d="M46.8 44.6 L42.4 45.4" stroke="#f2c34c" stroke-width="1.4" stroke-linecap="round"/><circle cx="45.7" cy="49.5" r="3.1" fill="#b3141f"/><circle cx="45.7" cy="50" r="1.1" fill="#bff4ff"/>`,
  torso: `<path d="${TORSO}" fill="url(#titan-red)"/>
      <path d="M23.6 38.6 Q30 40.2 36.4 38.6 L35.6 47.6 Q30 49.4 24.4 47.6 Z" fill="url(#titan-gold)"/>
      <path d="M24.2 42 H35.8 M24.4 44.9 H35.6 M30 39.6 V48.6" stroke="#b9831a" stroke-width=".6"/>
      <path d="M18.8 29 Q22 26.4 25.6 26.4 L24 31.6 Q21 31.2 18.8 29 Z M41.2 29 Q38 26.4 34.4 26.4 L36 31.6 Q39 31.2 41.2 29 Z" fill="url(#titan-gold)"/>
      <circle class="titan-glow" cx="30" cy="33.2" r="5.6" fill="url(#titan-glow)"/>
      <circle cx="30" cy="33.2" r="3.1" fill="#3a3f4c"/><circle cx="30" cy="33.2" r="2.3" fill="#c9f6ff"/><circle cx="29.3" cy="32.5" r=".7" fill="#fff"/>`,
  head: `<ellipse cx="30" cy="14.5" rx="11.2" ry="12.4" fill="url(#titan-red)"/>
      <path d="M21.2 8.6 Q30 6.6 38.8 8.6 L38.4 19 Q36.8 24.8 30 26.2 Q23.2 24.8 21.6 19 Z" fill="url(#titan-gold)"/>
      <path d="M26.4 21.8 H33.6 M24.4 19.6 L22.6 21.6 M35.6 19.6 L37.4 21.6" stroke="#b07812" stroke-width=".7" stroke-linecap="round"/>
      <path d="M30 8 V11" stroke="#b07812" stroke-width=".6"/>
      <ellipse cx="24.6" cy="4.6" rx="3.2" ry="1.3" fill="#fff" opacity=".28" transform="rotate(-18 24.6 4.6)"/>
      <ellipse class="titan-glow" cx="30" cy="14.6" rx="8.6" ry="3.4" fill="url(#titan-glow)" opacity=".55"/>
      <g class="sp-eyes">
        <path class="sp-eyeL" d="M22.6 13 L28 14 L27.6 15.9 L23.2 15.2 Z" fill="#dffaff" stroke="#7fe3ff" stroke-width=".5" stroke-linejoin="round"/>
        <path class="sp-eyeR" d="M37.4 13 L32 14 L32.4 15.9 L36.8 15.2 Z" fill="#dffaff" stroke="#7fe3ff" stroke-width=".5" stroke-linejoin="round"/>
      </g>`,
  css: `@media (prefers-reduced-motion: no-preference) {
    .ch-titan .titan-glow { animation: titan-pulse 1.8s ease-in-out infinite; }
    @keyframes titan-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
  }`,
  lines: {
    hello: ["Systèmes en ligne. Toi aussi, j'espère ?", "Réacteur chargé à 100 %. Et ta motivation ?", "Salut ! J'ai optimisé ta séance. De rien."],
    tap: ["Attention, cette armure coûte une fortune.", "Scan terminé : potentiel énorme détecté.", "Touche pas aux boutons, génie en action."],
    pr: ["Nouveau record ! Je l'ajoute à mes archives.", "Puissance maximale atteinte. Impressionnant !", "Même mon armure n'a pas prévu ça. Bravo !"],
    rest: ["Mode recharge activé. Respire, je calcule.", "Repos : je refroidis les réacteurs."],
    sleep: ["Mise en veille… zzz…", "Batterie faible. Je rêve de nouvelles armures…"],
  },
};

// ---------- 4. Capitaine Étoile ----------
const captain = {
  id: "captain",
  name: "Capitaine Étoile",
  group: "Héros",
  bio: "Soldat au grand cœur, bouclier au bras : il ne laisse jamais personne abandonner.",
  persona: "Capitaine loyal et inspirant, droit et un peu vieille école, qui parle d'équipe, de courage et de ne jamais lâcher.",
  travel: "hop",
  climb: false,
  fx: { color: "#e8eefc", trail: "none" },
  defs: `<linearGradient id="captain-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4069e0"/><stop offset="1" stop-color="#1f3b98"/></linearGradient>
    <linearGradient id="captain-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0384a"/><stop offset="1" stop-color="#b3121f"/></linearGradient>
    <linearGradient id="captain-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdfc4"/><stop offset="1" stop-color="#f3c09d"/></linearGradient>
    <clipPath id="captain-clip"><path d="${TORSO}"/></clipPath>`,
  legL: limb("26 48", "24 61", "24 72.5", 7, 6.4, "#2b4cba", "#d01f2e") + `<ellipse cx="23" cy="75.5" rx="4.2" ry="2.6" fill="#9e0f1c"/>`,
  legR: limb("34 48", "36 61", "36 72.5", 7, 6.4, "#2b4cba", "#d01f2e") + `<ellipse cx="37" cy="75.5" rx="4.2" ry="2.6" fill="#9e0f1c"/>`,
  armL: limb("20 30", "16 39.5", "14.5 48", 5.6, 5.2, "#3559cc", "#d01f2e") + `<circle cx="14.3" cy="49.5" r="3" fill="#b3121f"/>
      <g class="captain-shield"><circle cx="13.2" cy="43.6" r="7.6" fill="url(#captain-red)"/><circle cx="13.2" cy="43.6" r="5.9" fill="#f4f6fb"/>
      <circle cx="13.2" cy="43.6" r="4.3" fill="url(#captain-red)"/><circle cx="13.2" cy="43.6" r="2.9" fill="url(#captain-blue)"/>
      ${star(13.2, 43.7, 2.4, "#fff")}<path d="M8 40.4 Q9.6 37.4 12.6 36.8" stroke="#fff" stroke-width=".9" fill="none" opacity=".55" stroke-linecap="round"/></g>`,
  armR: limb("40 30", "44 39.5", "45.5 48", 5.6, 5.2, "#3559cc", "#d01f2e") + `<circle cx="45.7" cy="49.5" r="3" fill="#b3121f"/>`,
  torso: `<path d="${TORSO}" fill="url(#captain-blue)"/>
      <g clip-path="url(#captain-clip)">
        <rect x="18" y="38.4" width="24" height="6.8" fill="#f4f6fb"/>
        <rect x="21.6" y="38.4" width="2.4" height="6.8" fill="#d01f2e"/><rect x="26.4" y="38.4" width="2.4" height="6.8" fill="#d01f2e"/>
        <rect x="31.2" y="38.4" width="2.4" height="6.8" fill="#d01f2e"/><rect x="36" y="38.4" width="2.4" height="6.8" fill="#d01f2e"/>
        <rect x="18" y="45.2" width="24" height="2.2" fill="#7a4a26"/><rect x="28.4" y="45" width="3.2" height="2.6" rx=".6" fill="#d9b25a"/>
      </g>
      ${star(30, 32.6, 4.4, "#f4f6fb")}`,
  head: `<circle cx="19.6" cy="16.6" r="2.1" fill="#f3c09d"/><circle cx="40.4" cy="16.6" r="2.1" fill="#f3c09d"/>
      <ellipse cx="30" cy="15.4" rx="10.8" ry="11.4" fill="url(#captain-skin)"/>
      <path d="M18.8 16.2 Q17.6 2.2 30 1.8 Q42.4 2.2 41.2 16.2 Q40.2 12.2 38 11.6 Q30 9.4 22 11.6 Q19.8 12.2 18.8 16.2 Z" fill="url(#captain-blue)"/>
      <path d="M19.4 9.6 L22.6 8 L22.4 10.2 Z M40.6 9.6 L37.4 8 L37.6 10.2 Z" fill="#f4f6fb"/>
      ${star(30, 6.4, 2.7, "#f4f6fb")}
      <ellipse cx="24.4" cy="4.6" rx="2.8" ry="1.1" fill="#fff" opacity=".2" transform="rotate(-18 24.4 4.6)"/>
      <path d="M24.2 13.3 Q25.6 12.6 27.2 13.2 M35.8 13.3 Q34.4 12.6 32.8 13.2" stroke="#7a4a26" stroke-width=".8" fill="none" stroke-linecap="round"/>
      ${blush(20.6, 0.35)}${smile(22)}${eyes(16.5, 4.8, "#1f3b78")}`,
  css: eyeBox("captain"),
  lines: {
    hello: ["Soldat ! On commence quand tu es prêt.", "Bonjour, recrue. Aujourd'hui, on ne lâche rien.", "Rassemblement ! Ta séance t'attend."],
    tap: ["Garde-à-vous ! Bon, repos.", "Ce bouclier ? Il protège tes bonnes habitudes.", "Je pourrais faire ça toute la journée."],
    pr: ["Record battu ! Je suis fier de toi, soldat.", "Voilà l'esprit d'équipe ! Nouveau record !", "Mission accomplie, héros !"],
    rest: ["Repos, soldat. Tu l'as mérité.", "Respire. On repart ensemble dans un instant."],
    sleep: ["Zzz… réveille-moi pour la prochaine mission.", "Même un capitaine a besoin de sommeil…"],
  },
};

// ---------- 5. Amazone ----------
const amazon = {
  id: "amazon",
  name: "Amazone",
  group: "Héros",
  bio: "Guerrière d'une île cachée, elle combat avec cœur, honneur et un lasso doré.",
  persona: "Guerrière noble et bienveillante, fière et directe, qui parle de courage, de vérité et de force intérieure, avec chaleur.",
  travel: "hop",
  climb: false,
  fx: { color: "#ffcf4a", trail: "sparks" },
  defs: `<linearGradient id="amazon-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ee3344"/><stop offset="1" stop-color="#b0101e"/></linearGradient>
    <linearGradient id="amazon-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a64e0"/><stop offset="1" stop-color="#1c3a9e"/></linearGradient>
    <linearGradient id="amazon-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe489"/><stop offset="1" stop-color="#e2a420"/></linearGradient>
    <linearGradient id="amazon-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cfab"/><stop offset="1" stop-color="#e2ad84"/></linearGradient>
    <linearGradient id="amazon-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a3a"/><stop offset="1" stop-color="#17111c"/></linearGradient>`,
  legL: limb("26 48", "24 60", "24 72.5", 6.6, 6.4, "#e6b48c", "#d01f2e") + `<path d="M21 62.4 H27" stroke="#f4f6fb" stroke-width="1" stroke-linecap="round"/><ellipse cx="23" cy="75.5" rx="4.1" ry="2.6" fill="#9e0f1c"/>`,
  legR: limb("34 48", "36 60", "36 72.5", 6.6, 6.4, "#e6b48c", "#d01f2e") + `<path d="M33 62.4 H39" stroke="#f4f6fb" stroke-width="1" stroke-linecap="round"/><ellipse cx="37" cy="75.5" rx="4.1" ry="2.6" fill="#9e0f1c"/>`,
  armL: limb("20 30", "16 39.5", "14.5 48", 5.2, 4.8, "#efc29c", "#e6b48c") + `<path d="M13 43.6 L17.8 44.6" stroke="url(#amazon-gold)" stroke-width="3.2" stroke-linecap="round"/><circle cx="14.3" cy="49.5" r="2.7" fill="#e6b48c"/>`,
  armR: limb("40 30", "44 39.5", "45.5 48", 5.2, 4.8, "#efc29c", "#e6b48c") + `<path d="M47 43.6 L42.2 44.6" stroke="url(#amazon-gold)" stroke-width="3.2" stroke-linecap="round"/><circle cx="45.7" cy="49.5" r="2.7" fill="#e6b48c"/>`,
  torso: `<path d="${TORSO}" fill="url(#amazon-skin)"/>
      <path d="M19.4 31.2 Q30 34.6 40.6 31.2 L39.7 44.4 Q30 46.4 20.3 44.4 Z" fill="url(#amazon-red)"/>
      <path d="M22.6 31.8 Q26.4 35.2 30 34.4 Q33.6 35.2 37.4 31.8 L36 34.2 Q33 37 30 36.4 Q27 37 24 34.2 Z" fill="url(#amazon-gold)"/>
      <path d="M20.2 43 Q30 45.4 39.8 43 L39.8 45 Q30 47.4 20.2 45 Z" fill="url(#amazon-gold)"/>
      <path d="M20.2 44.6 Q30 46.8 39.8 44.6 L42.2 53.2 Q30 56.4 17.8 53.2 Z" fill="url(#amazon-blue)"/>
      ${star(24.6, 49.6, 1.3, "#fff")}${star(30, 51.4, 1.3, "#fff")}${star(35.4, 49.6, 1.3, "#fff")}
      <g fill="none" stroke="url(#amazon-gold)" stroke-width="1.1"><ellipse cx="38.6" cy="46.8" rx="2.4" ry="3"/><ellipse cx="39.2" cy="47.2" rx="1.6" ry="2.2"/></g>`,
  head: `<path d="M18.4 15 Q17.4 1 30 1 Q42.6 1 41.6 15 L43 28 Q40.2 30 37.4 27.6 L22.6 27.6 Q19.8 30 17 28 Z" fill="url(#amazon-hair)"/>
      <ellipse cx="30" cy="15.8" rx="10.2" ry="10.8" fill="url(#amazon-skin)"/>
      <path d="M19.6 14.6 Q19.6 3.6 30 3.4 Q40.4 3.6 40.4 14.6 Q38.6 9.4 33.4 9 Q30.6 11 26.4 9.4 Q21.2 9.6 19.6 14.6 Z" fill="url(#amazon-hair)"/>
      <path d="M20.6 9.8 Q30 5.4 39.4 9.8 L39 11.4 Q30 7.4 21 11.4 Z" fill="url(#amazon-gold)"/>
      ${star(30, 7.8, 1.9, "#e8202f")}
      <path d="M22.8 14.6 L22 13.8 M37.2 14.6 L38 13.8" stroke="#2a1d18" stroke-width=".7" stroke-linecap="round"/>
      ${blush(20.4, 0.4)}<path d="M27.8 21.6 Q30 23.6 32.2 21.6" stroke="#c0283a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      ${eyes(16.2, 4.8, "#3a2416")}`,
  css: `${eyeBox("amazon")}`,
  lines: {
    hello: ["Salut, héros ! On part au combat ?", "Que la force soit dans tes bras aujourd'hui !", "L'île m'envoie : on s'entraîne ensemble ?"],
    tap: ["Mon lasso dit la vérité : tu peux le faire.", "Doucement ! J'ai des bracelets réflexes.", "Une vraie guerrière ne recule jamais."],
    pr: ["Record ! Même les dieux applaudissent.", "Victoire ! Ta force est légendaire.", "Ça, c'est digne d'une amazone !"],
    rest: ["Repos, guerrier. La bataille reprend bientôt.", "Respire profondément, comme sur mon île."],
    sleep: ["Zzz… je rêve de mon île…", "Le lasso se repose, moi aussi…"],
  },
};

export default [knight, nova, titan, captain, amazon];
