// Coachs « Mignons » : personnages kawaii originaux (grosses têtes, couleurs douces).
// Format : voir l'en-tête de js/chars/spider.js (squelette 60 × 80, pivots fixes, ids préfixés).

// ---------- petits outils de dessin ----------
const lin = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rad = (id, a, b) => `<radialGradient id="${id}" cx=".42" cy=".34" r=".72"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
// symétrie gauche / droite autour de x = 30
const X = (s, x) => (s === "L" ? x : +(60 - x).toFixed(2));
// bras : épaule fixe → main (≈ 14.3, 49.5) ; `edge` = liseré doux (lisible sur fond clair)
const arm = (s, col, w, paw, edge) =>
  (edge ? `<path d="M${X(s, 20)} 30 Q${X(s, 15.6)} 39 ${X(s, 14.5)} 47" stroke="${edge}" stroke-width="${w + 1.1}" fill="none" stroke-linecap="round"/>` : "") +
  `<path d="M${X(s, 20)} 30 Q${X(s, 15.6)} 39 ${X(s, 14.5)} 47" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>` +
  `<circle cx="${X(s, 14.3)}" cy="49" r="3.3" fill="${paw}"${edge ? ` stroke="${edge}" stroke-width=".6"` : ""}/>`;
// jambe trapue : hanche fixe → pied posé au sol (y ≈ 78)
const leg = (s, col, w, foot, edge, footEdge) =>
  (edge ? `<path d="M${X(s, 26)} 48 L${X(s, 24)} 71" stroke="${edge}" stroke-width="${w + 1.1}" stroke-linecap="round"/>` : "") +
  `<path d="M${X(s, 26)} 48 L${X(s, 24)} 71" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>` +
  `<ellipse cx="${X(s, 23)}" cy="75" rx="5" ry="3" fill="${foot}"${footEdge ? ` stroke="${footEdge}" stroke-width=".6"` : ""}/>`;
// œil brillant : pupille + 2 reflets (groupe, pour les humeurs)
const eye = (cls, cx, cy, rx, ry, col = "#221d28") =>
  `<g class="${cls}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${col}"/>` +
  `<circle cx="${+(cx - rx * 0.32).toFixed(2)}" cy="${+(cy - ry * 0.38).toFixed(2)}" r="${+(rx * 0.42).toFixed(2)}" fill="#fff"/>` +
  `<circle cx="${+(cx + rx * 0.36).toFixed(2)}" cy="${+(cy + ry * 0.42).toFixed(2)}" r="${+(rx * 0.2).toFixed(2)}" fill="#fff" opacity=".85"/></g>`;
const eyes = (dx, cy, rx, ry, col) => `<g class="sp-eyes">${eye("sp-eyeL", 30 - dx, cy, rx, ry, col)}${eye("sp-eyeR", 30 + dx, cy, rx, ry, col)}</g>`;
const blush = (dx, cy, c = "#ff8fa8", o = 0.5) => `<ellipse cx="${30 - dx}" cy="${cy}" rx="2.4" ry="1.4" fill="${c}" opacity="${o}"/><ellipse cx="${30 + dx}" cy="${cy}" rx="2.4" ry="1.4" fill="${c}" opacity="${o}"/>`;
// les yeux (groupes) se déforment autour de leur propre centre ; le clignement se fait à leur hauteur
const eyeBox = (id, y) => `.ch-${id} g.sp-eyeL, .ch-${id} g.sp-eyeR { transform-box: fill-box; transform-origin: center; }
  .ch-${id} .sp-eyes { transform-origin: 30px ${y}px; }`;
// corps rond commun (un peu plus large que celui de Spider-Man)
const BODY = "M18.6 28 Q30 23 41.4 28 Q45.2 43 41.6 56 Q30 60.8 18.4 56 Q14.8 43 18.6 28 Z";

export default [
  // ---------------------------------------------------------------- Kitty
  {
    id: "kitty",
    name: "Kitty",
    group: "Mignons",
    bio: "Une chatonne toute douce, nœud au vent, qui croit en toi plus fort que tout.",
    persona: "Chatonne adorable, douce et pétillante, qui encourage avec tendresse et finit parfois ses phrases par « miaou ».",
    travel: "hop",
    climb: false,
    fx: { color: "#ff5c8a", trail: "hearts" },
    defs: rad("kitty-fur", "#ffffff", "#ebe7f1") + lin("kitty-pink", "#ff9cc2", "#ef5f97") + lin("kitty-bow", "#ff5a82", "#d91a50") + lin("kitty-nose", "#ffe680", "#f5b700"),
    back: `<g class="kitty-tail"><path d="M38.5 50 Q47.5 51.5 47.6 43.5 Q47.7 40.5 45.4 40.3" stroke="#d8d2e2" stroke-width="4.3" fill="none" stroke-linecap="round"/>
      <path d="M38.5 50 Q47.5 51.5 47.6 43.5 Q47.7 40.5 45.4 40.3" stroke="#fbfaff" stroke-width="3.2" fill="none" stroke-linecap="round"/></g>`,
    legL: leg("L", "url(#kitty-pink)", 8.6, "#fbfaff", "#d4497f", "#d8d2e2"),
    legR: leg("R", "url(#kitty-pink)", 8.6, "#fbfaff", "#d4497f", "#d8d2e2"),
    armL: arm("L", "#fbfaff", 5.8, "#fbfaff", "#d8d2e2"),
    armR: arm("R", "#fbfaff", 5.8, "#fbfaff", "#d8d2e2"),
    torso: `<path d="${BODY}" fill="url(#kitty-fur)" stroke="#d8d2e2" stroke-width=".6"/>
      <path d="M16.6 42 Q30 44.6 43.4 42 Q44 49.5 41.6 56 Q30 60.8 18.4 56 Q16 49.5 16.6 42 Z" fill="url(#kitty-pink)"/>
      <rect x="23.6" y="34.4" width="12.8" height="9.6" rx="2.6" fill="url(#kitty-pink)"/>
      <path d="M24.6 35.4 L21.4 28.6 M35.4 35.4 L38.6 28.6" stroke="#ef6a9f" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="25.2" cy="36.2" r="1" fill="#fff6b8"/><circle cx="34.8" cy="36.2" r="1" fill="#fff6b8"/>
      <path d="M30 41.6 C27 39.6 27.2 37.2 28.8 37.2 Q29.6 37.2 30 38 Q30.4 37.2 31.2 37.2 C32.8 37.2 33 39.6 30 41.6 Z" fill="#fff" opacity=".9"/>
      <path d="M20 54.6 Q30 58.4 40 54.6" stroke="#d4497f" stroke-width=".7" fill="none" opacity=".6"/>`,
    head: `<path d="M15.5 9.5 L16.3 -3 Q16.8 -5.4 19 -4.2 L27 2 Z" fill="#fbfaff" stroke="#d8d2e2" stroke-width=".6" stroke-linejoin="round"/>
      <path d="M44.5 9.5 L43.7 -3 Q43.2 -5.4 41 -4.2 L33 2 Z" fill="#fbfaff" stroke="#d8d2e2" stroke-width=".6" stroke-linejoin="round"/>
      <path d="M18.2 4 L18.6 -1.6 L22.6 1.6 Z" fill="#ffc7dc"/>
      <ellipse cx="30" cy="12.8" rx="17" ry="13.2" fill="url(#kitty-fur)" stroke="#d8d2e2" stroke-width=".6"/>
      ${blush(9.6, 18.6, "#ff9cbc", 0.45)}
      ${eyes(7.4, 13.4, 1.75, 2.35)}
      <ellipse cx="30" cy="17" rx="2.2" ry="1.55" fill="url(#kitty-nose)"/>
      <g stroke="#5a5463" stroke-width=".75" stroke-linecap="round" fill="none">
        <path d="M13.8 13.8 L19.4 15 M13.4 17.4 L19.2 17.3 M14.2 21 L19.5 19.5"/>
        <path d="M46.2 13.8 L40.6 15 M46.6 17.4 L40.8 17.3 M45.8 21 L40.5 19.5"/>
      </g>
      <g class="kitty-bow" transform="rotate(18 41 1.5)">
        <path d="M41 1.5 Q35.4 -5.4 32.6 -1.6 Q31.6 3.6 41 2.6 Z" fill="url(#kitty-bow)"/>
        <path d="M41 1.5 Q46.6 -5.4 49.4 -1.6 Q50.4 3.6 41 2.6 Z" fill="url(#kitty-bow)"/>
        <path d="M34.6 -1.4 Q36 -2.6 37.6 -1" stroke="#fff" stroke-width=".7" fill="none" opacity=".55" stroke-linecap="round"/>
        <circle cx="41" cy="2" r="2.4" fill="#f03a68"/><circle cx="40.3" cy="1.3" r=".7" fill="#fff" opacity=".6"/>
      </g>`,
    css: `${eyeBox("kitty", 13.4)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-kitty .kitty-tail { transform-box: view-box; transform-origin: 38.5px 50px; animation: kitty-tail 2.4s ease-in-out infinite; }
    @keyframes kitty-tail { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-12deg); } }
  }`,
    lines: {
      hello: ["Coucou ! On fait une jolie séance ensemble ?", "Miaou ! J'ai noué mon plus beau nœud pour toi.", "Te revoilà ! Mon cœur fait des petits bonds."],
      tap: ["Hi hi, ça chatouille les moustaches !", "Doucement, tu vas froisser mon nœud !", "Ronron… allez, encore une série ?"],
      pr: ["Nouveau record ! Je t'envoie mille cœurs !", "Waouh ! Même mon nœud en tremble de joie !", "Record battu ! Tu mérites un câlin géant."],
      rest: ["Pause câline : respire tout doucement.", "Je ronronne pendant ton repos. Détends-toi.", "Bois un peu d'eau, petite étoile."],
      sleep: ["Zzz… je rêve de pelotes et de squats…", "Ronron… réveille-moi pour la séance…"],
    },
  },

  // ---------------------------------------------------------------- Panda
  {
    id: "panda",
    name: "Panda",
    group: "Mignons",
    bio: "Un gros nounours tout rond, calme comme une forêt de bambous, solide comme un roc.",
    persona: "Panda câlin, zen et un peu gourmand, qui rassure, prône la régularité et parle de bambou et de siestes méritées.",
    travel: "walk",
    climb: false,
    fx: { color: "#5fc46a", trail: "leaves" },
    defs: rad("panda-fur", "#ffffff", "#e9e7ee") + lin("panda-black", "#3d3944", "#1d1b22"),
    legL: leg("L", "url(#panda-black)", 9.4, "#2a2730", "#5c5768", "#5c5768") + `<ellipse cx="23" cy="75.4" rx="2.6" ry="1.4" fill="#ffb3c3" opacity=".75"/>`,
    legR: leg("R", "url(#panda-black)", 9.4, "#2a2730", "#5c5768", "#5c5768") + `<ellipse cx="37" cy="75.4" rx="2.6" ry="1.4" fill="#ffb3c3" opacity=".75"/>`,
    armL: arm("L", "#2c2933", 6.8, "#2c2933", "#5c5768"),
    armR: arm("R", "#2c2933", 6.8, "#2c2933", "#5c5768"),
    torso: `<path d="M18 28 Q30 22.6 42 28 Q46.2 43 42 56.4 Q30 61.2 18 56.4 Q13.8 43 18 28 Z" fill="url(#panda-fur)" stroke="#d6d2de" stroke-width=".6"/>
      <path d="M18 28 Q30 22.6 42 28 Q43.4 31.6 43.8 35.4 Q30 30 16.2 35.4 Q16.6 31.6 18 28 Z" fill="url(#panda-black)"/>
      <ellipse cx="30" cy="46.4" rx="8.8" ry="9.4" fill="#fff" opacity=".7"/>
      <path d="M21 55 Q30 59 39 55" stroke="#cfcad8" stroke-width=".7" fill="none"/>`,
    head: `<circle cx="16.4" cy="1.6" r="5.6" fill="url(#panda-black)" stroke="#5c5768" stroke-width=".6"/><circle cx="43.6" cy="1.6" r="5.6" fill="url(#panda-black)" stroke="#5c5768" stroke-width=".6"/>
      <circle cx="16.8" cy="2.4" r="2.5" fill="#4d4856"/><circle cx="43.2" cy="2.4" r="2.5" fill="#4d4856"/>
      <ellipse cx="30" cy="13" rx="16" ry="13.2" fill="url(#panda-fur)" stroke="#d6d2de" stroke-width=".6"/>
      <ellipse cx="22.2" cy="14.4" rx="4.6" ry="6" transform="rotate(32 22.2 14.4)" fill="url(#panda-black)"/>
      <ellipse cx="37.8" cy="14.4" rx="4.6" ry="6" transform="rotate(-32 37.8 14.4)" fill="url(#panda-black)"/>
      ${blush(10.8, 20.4, "#ff9db4", 0.55)}
      <g class="sp-eyes">
        <g class="sp-eyeL"><circle cx="22.8" cy="13.8" r="2.3" fill="#fff"/><circle cx="23.1" cy="14.1" r="1.55" fill="#15131a"/><circle cx="22.5" cy="13.3" r=".6" fill="#fff"/></g>
        <g class="sp-eyeR"><circle cx="37.2" cy="13.8" r="2.3" fill="#fff"/><circle cx="36.9" cy="14.1" r="1.55" fill="#15131a"/><circle cx="36.3" cy="13.3" r=".6" fill="#fff"/></g>
      </g>
      <path d="M27.8 18.4 Q30 17.4 32.2 18.4 Q31.6 20.4 30 20.6 Q28.4 20.4 27.8 18.4 Z" fill="#26232c"/>
      <path d="M28 21.6 Q29 22.8 30 21.4 Q31 22.8 32 21.6" stroke="#2a2730" stroke-width=".7" fill="none" stroke-linecap="round"/>
      <g class="panda-leaf" transform="rotate(-24 42 -3)"><path d="M42 -2.4 Q46.8 -7.4 50.4 -5.4 Q47.4 -0.8 42 -2.4 Z" fill="#6fcf72"/><path d="M42 -2.4 Q46 -4.6 49.6 -5.2" stroke="#3f9b4a" stroke-width=".5" fill="none"/></g>`,
    css: `${eyeBox("panda", 13.8)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-panda .panda-leaf { transform-box: view-box; transform-origin: 42px -2.4px; animation: panda-leaf 3s ease-in-out infinite; }
    @keyframes panda-leaf { 0%, 100% { transform: rotate(-24deg); } 50% { transform: rotate(-10deg); } }
  }`,
    lines: {
      hello: ["Salut toi ! Une séance, puis une sieste ?", "Le bambou peut attendre : on s'entraîne !", "Coucou ! Pas à pas, on va loin ensemble."],
      tap: ["Hé ! Je suis tout moelleux, pas un coussin !", "Un câlin ? D'accord, mais après ta série.", "Mmh… tu as du bambou dans ta poche ?"],
      pr: ["Record ! Ça mérite une montagne de bambou !", "Incroyable ! Je roule de joie !", "Toujours plus fort, toujours aussi zen. Bravo !"],
      rest: ["Respire lentement… comme un panda au soleil.", "Repos : mâche ta victoire tranquillement.", "Pause zen. Le prochain set sera tout doux."],
      sleep: ["Zzz… encore cinq minutes de bambou…", "Zzz… réveille-moi pour bouger un peu…"],
    },
  },

  // ---------------------------------------------------------------- Lapinou
  {
    id: "bunny",
    name: "Lapinou",
    group: "Mignons",
    bio: "Un lapin crème plein de ressort, qui saute de joie à chaque série terminée.",
    persona: "Lapin crème hyper joyeux et bondissant, plein d'énergie, qui adore les sauts, les carottes et les petites victoires.",
    travel: "hop",
    climb: false,
    fx: { color: "#ff8fb1", trail: "hearts" },
    defs: rad("bunny-fur", "#fffaf0", "#f0dfc2") + lin("bunny-in", "#ffc8d6", "#ff9db7"),
    back: `<g class="bunny-tail"><circle cx="43" cy="53" r="4.4" fill="#fffaf0" stroke="#e2cda8" stroke-width=".6"/><circle cx="42" cy="51.8" r="1.6" fill="#fff"/></g>`,
    legL: leg("L", "#f6ead4", 8.8, "#fffaf0", "#e2cda8", "#e2cda8") + `<ellipse cx="23" cy="75.6" rx="2.4" ry="1.3" fill="#ffb8c9" opacity=".8"/>`,
    legR: leg("R", "#f6ead4", 8.8, "#fffaf0", "#e2cda8", "#e2cda8") + `<ellipse cx="37" cy="75.6" rx="2.4" ry="1.3" fill="#ffb8c9" opacity=".8"/>`,
    armL: arm("L", "#f6ead4", 5.6, "#fffaf0", "#e2cda8"),
    armR: arm("R", "#f6ead4", 5.6, "#fffaf0", "#e2cda8"),
    torso: `<path d="${BODY}" fill="url(#bunny-fur)" stroke="#e2cda8" stroke-width=".6"/>
      <ellipse cx="30" cy="46" rx="8.4" ry="10" fill="#fffdf8"/>
      <path d="M26.8 38.6 L30 40.6 L33.2 38.6 L33.2 42.6 L30 40.6 L26.8 42.6 Z" fill="#ff7fa2"/><circle cx="30" cy="40.6" r="1.1" fill="#e85d86"/>`,
    head: `<g class="bunny-earL"><ellipse cx="22" cy="-3" rx="4.6" ry="11.6" transform="rotate(-12 22 6)" fill="url(#bunny-fur)" stroke="#e2cda8" stroke-width=".6"/>
        <ellipse cx="22" cy="-2.4" rx="2.3" ry="8.6" transform="rotate(-12 22 6)" fill="url(#bunny-in)"/></g>
      <g class="bunny-earR"><ellipse cx="38" cy="-3" rx="4.6" ry="11.6" transform="rotate(16 38 6)" fill="url(#bunny-fur)" stroke="#e2cda8" stroke-width=".6"/>
        <ellipse cx="38" cy="-2.4" rx="2.3" ry="8.6" transform="rotate(16 38 6)" fill="url(#bunny-in)"/></g>
      <ellipse cx="30" cy="14.6" rx="15" ry="12.4" fill="url(#bunny-fur)" stroke="#e2cda8" stroke-width=".6"/>
      ${blush(9.4, 19.6, "#ff9db7", 0.55)}
      ${eyes(6.6, 14.6, 2.1, 2.7, "#3a2630")}
      <path d="M28.6 18.6 Q30 18 31.4 18.6 Q30.8 20 30 20.2 Q29.2 20 28.6 18.6 Z" fill="#ff7fa2"/>
      <path d="M30 20.2 V21 M27.8 21 Q28.9 22.4 30 21 Q31.1 22.4 32.2 21" stroke="#9a6b62" stroke-width=".65" fill="none" stroke-linecap="round"/>`,
    css: `${eyeBox("bunny", 14.6)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-bunny .bunny-earR { transform-box: view-box; transform-origin: 37px 6px; animation: bunny-ear 4s ease-in-out infinite; }
    @keyframes bunny-ear { 0%, 80%, 100% { transform: rotate(0deg); } 86% { transform: rotate(14deg); } 92% { transform: rotate(4deg); } }
    .ch-bunny .bunny-tail { transform-box: fill-box; transform-origin: center; animation: bunny-tail 1.6s ease-in-out infinite; }
    @keyframes bunny-tail { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  }`,
    lines: {
      hello: ["Coucou ! Je saute partout, on y va ?", "Hop hop hop ! Ta séance t'attend !", "Salut ! J'ai les pattes qui frétillent !"],
      tap: ["Hi hi ! Pas les oreilles, je suis sensible !", "Boing ! Encore un petit saut ensemble ?", "Tu as une carotte ? Non ? Alors une série !"],
      pr: ["Record ! Je fais trois saltos de joie !", "Boing boing ! Nouveau record, champion !", "Waouh ! Tu sautes plus haut que moi !"],
      rest: ["Pause carotte ! Respire et souffle.", "Je grignote pendant ton repos. Tranquille.", "Secoue les jambes, on repart bientôt !"],
      sleep: ["Zzz… je compte les carottes…", "Zzz… réveille-moi pour bondir…"],
    },
  },

  // ---------------------------------------------------------------- Pingouin
  {
    id: "penguin",
    name: "Pingouin",
    group: "Mignons",
    bio: "Un pingouin dodu en écharpe rouge, qui glisse vers tes objectifs sans jamais lâcher.",
    persona: "Pingouin dodu, flegmatique et drôle, qui adore le froid, les glissades et transforme chaque effort en aventure polaire.",
    travel: "walk",
    climb: false,
    fx: { color: "#5cc8ff", trail: "bubbles" },
    defs: lin("penguin-body", "#4a5e8a", "#25304d") + lin("penguin-belly", "#ffffff", "#e3e9f3") + lin("penguin-orange", "#ffc04d", "#f2891b") + lin("penguin-scarf", "#ff5566", "#d3203a"),
    legL: `<path d="M26 48 L24 71" stroke="url(#penguin-orange)" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M17.8 76.4 Q18.6 72.6 23 72.4 Q27.4 72.6 28.2 76.4 Q25.6 78 23 77 Q20.4 78 17.8 76.4 Z" fill="#f59a26"/>`,
    legR: `<path d="M34 48 L36 71" stroke="url(#penguin-orange)" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M31.8 76.4 Q32.6 72.6 37 72.4 Q41.4 72.6 42.2 76.4 Q39.6 78 37 77 Q34.4 78 31.8 76.4 Z" fill="#f59a26"/>`,
    armL: `<path d="M20.4 29 Q13.4 38 13.6 50.6 Q16.6 50 18 44.6 Q19.8 38 23 31.4 Z" fill="url(#penguin-body)"/>`,
    armR: `<path d="M39.6 29 Q46.6 38 46.4 50.6 Q43.4 50 42 44.6 Q40.2 38 37 31.4 Z" fill="url(#penguin-body)"/>`,
    torso: `<path d="M18 27.6 Q30 22.4 42 27.6 Q46.4 44 41.6 61 Q30 66.4 18.4 61 Q13.6 44 18 27.6 Z" fill="url(#penguin-body)" stroke="#6a7fae" stroke-width=".6"/>
      <ellipse cx="30" cy="47.6" rx="9.6" ry="14.2" fill="url(#penguin-belly)"/>
      <path d="M18 26.2 Q30 31.4 42 26.2 L42.4 30.4 Q30 35.8 17.6 30.4 Z" fill="url(#penguin-scarf)"/>
      <path d="M21.4 28.6 L21.4 32.4 M26 29.8 L26 33.8 M34 29.8 L34 33.8 M38.6 28.6 L38.6 32.4" stroke="#fff" stroke-width=".8" opacity=".55"/>
      <g class="penguin-scarf"><path d="M34.6 31 L36.4 43.4 L40.8 42.4 L38.8 30.2 Z" fill="url(#penguin-scarf)"/>
        <path d="M36.4 43.4 L36.2 45.2 M37.9 43.1 L37.8 44.9 M39.4 42.7 L39.5 44.5 M40.8 42.4 L41 44.1" stroke="#ff5566" stroke-width=".8" stroke-linecap="round"/>
        <path d="M35.8 38.4 L40 37.4" stroke="#fff" stroke-width=".8" opacity=".55"/></g>`,
    head: `<ellipse cx="30" cy="12.6" rx="15.6" ry="13.8" fill="url(#penguin-body)" stroke="#6a7fae" stroke-width=".6"/>
      <path d="M29.6 -0.6 Q30.6 -4.6 33.6 -3.4 Q31.4 -2.6 31.2 0.2 Z" fill="#33426a"/>
      <path d="M30 7.2 Q24.6 1.8 19.4 5.4 Q15 9.6 16.2 16.4 Q18.2 24.4 30 25 Q41.8 24.4 43.8 16.4 Q45 9.6 40.6 5.4 Q35.4 1.8 30 7.2 Z" fill="url(#penguin-belly)"/>
      ${blush(9.6, 19.2, "#ff9db4", 0.55)}
      ${eyes(6.2, 13.6, 1.9, 2.5, "#1c1f2e")}
      <path d="M26.8 17.6 Q30 15.8 33.2 17.6 Q31.8 20.6 30 20.8 Q28.2 20.6 26.8 17.6 Z" fill="url(#penguin-orange)"/>
      <path d="M27.6 17.6 Q30 16.6 32.4 17.6" stroke="#fff" stroke-width=".55" fill="none" opacity=".6"/>`,
    css: `${eyeBox("penguin", 13.6)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-penguin .penguin-scarf { transform-box: view-box; transform-origin: 36.8px 30.6px; animation: penguin-scarf 2.2s ease-in-out infinite; }
    @keyframes penguin-scarf { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
  }`,
    lines: {
      hello: ["Salut ! Le temps est frais, parfait pour bouger !", "Coin ! Prêt à glisser vers ta séance ?", "Écharpe nouée, on attaque la banquise !"],
      tap: ["Hé ! Ne touche pas mon écharpe préférée !", "Coin coin ? Non, ça c'est le canard.", "Je ne vole pas, mais je soulève !"],
      pr: ["Record ! Je fais une glissade d'honneur !", "Énorme ! Même l'iceberg est impressionné !", "Nouveau record ! Poisson frais pour tout le monde !"],
      rest: ["Pause polaire : respire l'air frais.", "Repos ! Je me dandine en attendant.", "Hydrate-toi, même les pingouins boivent !"],
      sleep: ["Zzz… je rêve de toboggans de glace…", "Zzz… réveille-moi, on glisse au sport…"],
    },
  },

  // ---------------------------------------------------------------- Hamster
  {
    id: "hamster",
    name: "Hamster",
    group: "Mignons",
    bio: "Un hamster doré aux joues pleines, champion du monde de la roue d'exercice.",
    persona: "Hamster doré surexcité et gourmand, qui parle de sa roue, de graines et de cardio avec un enthousiasme débordant.",
    travel: "hop",
    climb: false,
    fx: { color: "#ffb347", trail: "none" },
    defs: rad("hamster-fur", "#ffd48a", "#eb9b42") + lin("hamster-cream", "#fff6e4", "#f9e0b8"),
    legL: leg("L", "#eda04a", 9, "#ffb9b0") + `<path d="M21 76.2 V77.4 M23 76.4 V77.8 M25 76.2 V77.4" stroke="#e98a84" stroke-width=".55" stroke-linecap="round"/>`,
    legR: leg("R", "#eda04a", 9, "#ffb9b0") + `<path d="M35 76.2 V77.4 M37 76.4 V77.8 M39 76.2 V77.4" stroke="#e98a84" stroke-width=".55" stroke-linecap="round"/>`,
    armL: arm("L", "#eda04a", 6, "#ffb9b0"),
    armR: arm("R", "#eda04a", 6, "#ffb9b0"),
    torso: `<path d="M17.6 28 Q30 22.6 42.4 28 Q47.2 44 42.4 58 Q30 63 17.6 58 Q12.8 44 17.6 28 Z" fill="url(#hamster-fur)"/>
      <ellipse cx="30" cy="46.4" rx="10.2" ry="12" fill="url(#hamster-cream)"/>
      <path d="M26.4 40 Q27.4 41.4 26.6 43 M33.6 40 Q32.6 41.4 33.4 43" stroke="#ecc590" stroke-width=".6" fill="none" stroke-linecap="round"/>`,
    head: `<circle cx="17.6" cy="1.8" r="4.4" fill="#e38f36"/><circle cx="42.4" cy="1.8" r="4.4" fill="#e38f36"/>
      <circle cx="17.8" cy="2.4" r="2.4" fill="#ffb3b0"/><circle cx="42.2" cy="2.4" r="2.4" fill="#ffb3b0"/>
      <ellipse cx="30" cy="12.8" rx="14.6" ry="12.4" fill="url(#hamster-fur)"/>
      <g class="ham-cheeks">
        <ellipse cx="18.2" cy="17.4" rx="7" ry="6.6" fill="url(#hamster-cream)"/>
        <ellipse cx="41.8" cy="17.4" rx="7" ry="6.6" fill="url(#hamster-cream)"/>
      </g>
      <ellipse cx="30" cy="19.4" rx="7.4" ry="6" fill="url(#hamster-cream)"/>
      <path d="M30 1 Q28.6 5 30 9 Q31.4 5 30 1 Z" fill="#d8822c" opacity=".55"/>
      ${blush(11.6, 18.8, "#ff8f95", 0.6)}
      ${eyes(6.8, 12.4, 1.9, 2.3, "#2a1a14")}
      <path d="M28.6 16 Q30 15.2 31.4 16 Q30.8 17.4 30 17.5 Q29.2 17.4 28.6 16 Z" fill="#ff8f9a"/>
      <path d="M30 17.5 V18.4 M27.8 18.4 Q28.9 19.6 30 18.4 Q31.1 19.6 32.2 18.4" stroke="#a46a4a" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <rect x="29.05" y="19" width="1.9" height="2" rx=".5" fill="#fff" stroke="#e8d6c4" stroke-width=".3"/>
      <path d="M30 19 V21" stroke="#e8d6c4" stroke-width=".3"/>`,
    css: `${eyeBox("hamster", 12.4)}
  @media (prefers-reduced-motion: no-preference) {
    .ch-hamster .ham-cheeks { transform-box: fill-box; transform-origin: center; animation: ham-cheeks 1.8s ease-in-out infinite; }
    @keyframes ham-cheeks { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035, 1.05); } }
  }`,
    lines: {
      hello: ["Salut ! J'ai fait 300 tours de roue, à toi !", "Coucou ! Joues pleines, énergie à fond !", "Te voilà ! On court, on soulève, on grignote ?"],
      tap: ["Hé ! Mes joues sont pleines de graines !", "Pas touche à mes réserves secrètes !", "Hi hi ! Je roule, je roule…"],
      pr: ["Record ! Je fais dix tours de roue de joie !", "Waouh ! Tu mérites une graine en or !", "Nouveau record ! Mes joues explosent de fierté !"],
      rest: ["Pause graines ! Respire et grignote du calme.", "Je fais une petite pause roue avec toi.", "Repos mérité. Ta roue ne va nulle part !"],
      sleep: ["Zzz… je cache des graines dans mes rêves…", "Zzz… réveille-moi pour un tour de roue…"],
    },
  },
];
