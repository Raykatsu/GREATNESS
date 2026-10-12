// Coachs du groupe « Animaux » : petits animaux chibi originaux (shiba, renard, chat noir, grenouille, ourson).
// Contrat : voir l'en-tête de js/chars/spider.js (repère 60 × 80, pivots fixes, sol à y = 78).

// ---------- petits utilitaires de dessin (aucun import) ----------
// symétrie gauche / droite autour de x = 30 : on dessine le côté gauche, « mx » donne le droit
const mx = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(60 - +x).toFixed(2)} ${y}`);
// œil chibi : iris sombre + double reflet blanc (groupes sp-eyeL / sp-eyeR)
const eye = (cls, cx, cy, rx, ry, iris) =>
  `<g class="${cls}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${iris}"/>` +
  `<circle cx="${(cx + rx * 0.32).toFixed(2)}" cy="${(cy - ry * 0.38).toFixed(2)}" r="${(rx * 0.42).toFixed(2)}" fill="#fff"/>` +
  `<circle cx="${(cx - rx * 0.3).toFixed(2)}" cy="${(cy + ry * 0.42).toFixed(2)}" r="${(rx * 0.2).toFixed(2)}" fill="#fff" opacity=".8"/></g>`;
const eyes = (y, dx, rx, ry, iris = "#2a1a12") => `<g class="sp-eyes">${eye("sp-eyeL", 30 - dx, y, rx, ry, iris)}${eye("sp-eyeR", 30 + dx, y, rx, ry, iris)}</g>`;
const blush = (y, dx, o = 0.5, c = "#ff8a8a") =>
  `<ellipse cx="${30 - dx}" cy="${y}" rx="2.4" ry="1.3" fill="${c}" opacity="${o}"/><ellipse cx="${30 + dx}" cy="${y}" rx="2.4" ry="1.3" fill="${c}" opacity="${o}"/>`;
// bouche en « w »
const mouth = (y, c = "#3a2018") =>
  `<path d="M30 ${y - 1.3} V${y} M27.4 ${y - 0.3} Q28.7 ${y + 1.5} 30 ${y} Q31.3 ${y + 1.5} 32.6 ${y - 0.3}" stroke="${c}" stroke-width=".85" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
// reflet doux sur le haut de la tête
const shine = (cx = 23, cy = 5.5) => `<ellipse cx="${cx}" cy="${cy}" rx="4.2" ry="1.9" fill="#fff" opacity=".16" transform="rotate(-18 ${cx} ${cy})"/>`;
// ombre portée de la tête sur le torse
const neckShade = `<ellipse cx="30" cy="28.6" rx="8.6" ry="2.2" fill="#5a2a10" opacity=".14"/>`;
// les groupes d'yeux se déforment autour de leur propre centre (le style global vise des formes simples)
const eyeBox = (id) => `.ch-${id} g.sp-eyeL, .ch-${id} g.sp-eyeR { transform-box: fill-box; transform-origin: center; }`;
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// membres « peluche » : jambe épaisse de la hanche au pied, patte ronde
const leg = (side, fur, paw, w = 8) => {
  const d = side === "L" ? "M26 48 L23.8 71.5" : "M34 48 L36.2 71.5";
  const fx = side === "L" ? 23 : 37;
  return `<path d="${d}" stroke="${fur}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<ellipse cx="${fx}" cy="75" rx="5" ry="3" fill="${paw}"/>` +
    `<path d="M${fx - 1.4} 73.6 V75.4 M${fx + 1.4} 73.6 V75.4" stroke="#000" stroke-width=".55" opacity=".22" stroke-linecap="round"/>`;
};
const arm = (side, fur, paw, w = 6.2) => {
  const d = side === "L" ? "M20 30 Q16 38.5 14.6 47" : "M40 30 Q44 38.5 45.4 47";
  const hx = side === "L" ? 14.3 : 45.7;
  return `<path d="${d}" stroke="${fur}" stroke-width="${w}" stroke-linecap="round" fill="none"/><circle cx="${hx}" cy="49.4" r="3.4" fill="${paw}"/>`;
};
// corps rond en poire
const BODY = "M19.2 28.6 Q30 24 40.8 28.6 Q44.6 40 41 50.4 Q30 55 19 50.4 Q15.4 40 19.2 28.6 Z";

// ---------- 1. Shiba ----------
const shiba = {
  id: "shiba",
  name: "Shiba",
  group: "Animaux",
  bio: "Un petit shiba roux plein d'entrain qui remue la queue à chaque répétition.",
  persona: "Petit chien shiba joyeux et loyal, enthousiaste comme un chiot, qui parle de balades, de croquettes et de « bon toutou » pour féliciter.",
  travel: "walk",
  climb: false,
  fx: { color: "#e8893a", trail: "none" },
  defs: grad("shiba-fur", "#f4a052", "#d9772c") + grad("shiba-cream", "#fffaf0", "#f6e3c6"),
  back: `<g class="shiba-tail"><path d="M37 44 Q46.5 44.5 48.5 37 Q50 30.5 45 30 Q41.2 30.2 42.2 34.6" stroke="url(#shiba-fur)" stroke-width="6.4" fill="none" stroke-linecap="round"/>
      <path d="M44.6 33.4 Q46.6 32.6 46.6 35.4 Q46.4 38.6 42.6 39.6" stroke="#fff3df" stroke-width="2" fill="none" stroke-linecap="round"/></g>`,
  legL: leg("L", "#e2853a", "#fff3df"),
  legR: leg("R", "#e2853a", "#fff3df"),
  armL: arm("L", "#e8893a", "#fff3df"),
  armR: arm("R", "#e8893a", "#fff3df"),
  torso: `<path d="${BODY}" fill="url(#shiba-fur)"/>
      <path d="M23.6 29 Q30 27 36.4 29 Q38.4 40 34.6 50.6 Q30 52 25.4 50.6 Q21.6 40 23.6 29 Z" fill="url(#shiba-cream)"/>
      ${neckShade}`,
  head: `<path d="M12.6 10.5 L14.2 -3 Q15.1 -4.6 16.6 -3.4 L25 4 Z" fill="#e8893a"/><path d="${mx("M12.6 10.5 L14.2 -3 Q15.1 -4.6 16.6 -3.4 L25 4 Z")}" fill="#e8893a"/>
      <path d="M15.4 6.4 L15.8 0 L21.4 4.2 Z" fill="#ffd9bd"/><path d="${mx("M15.4 6.4 L15.8 0 L21.4 4.2 Z")}" fill="#ffd9bd"/>
      <ellipse cx="30" cy="14.8" rx="18.4" ry="12.8" fill="url(#shiba-fur)"/>
      <path d="M12.6 17.4 Q15.6 27.6 30 27.6 Q44.4 27.6 47.4 17.4 Q42.6 14.6 37.6 17.6 Q33.6 15.8 30 16.4 Q26.4 15.8 22.4 17.6 Q17.4 14.6 12.6 17.4 Z" fill="url(#shiba-cream)"/>
      <ellipse cx="23" cy="8.4" rx="1.8" ry="1.1" fill="#fff3df"/><ellipse cx="37" cy="8.4" rx="1.8" ry="1.1" fill="#fff3df"/>
      ${shine(22, 4.6)}
      ${eyes(13.4, 7, 2.3, 2.8)}
      ${blush(19.6, 11)}
      <ellipse cx="30" cy="18.6" rx="2.2" ry="1.5" fill="#2a1a12"/><ellipse cx="29.3" cy="18.1" rx=".7" ry=".4" fill="#fff" opacity=".7"/>
      ${mouth(21.4)}`,
  css: `${eyeBox("shiba")}
  @media (prefers-reduced-motion: no-preference) {
    .ch-shiba .shiba-tail { transform-origin: 38px 44px; animation: shiba-wag .45s ease-in-out infinite alternate; }
    @keyframes shiba-wag { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  }`,
  lines: {
    hello: ["Wouf ! On va se promener… à la salle ?", "Coucou ! J'ai remué la queue toute la matinée.", "Prêt ? Moi je suis TOUJOURS prêt !"],
    tap: ["Encore une caresse et je fais une série en plus !", "Hé ! Les oreilles, c'est sacré.", "Wouf ? Wouf !"],
    pr: ["Record ! Bon humain, très bon humain !", "Je remue la queue si fort que je m'envole !", "Ça mérite une croquette géante, ça !"],
    rest: ["Petite pause. Je surveille, truffe en l'air.", "Respire, bois un coup. Moi, je lape."],
    sleep: ["Zzz… je rêve de balles de tennis…", "Roupillon de chien… réveille-moi pour sortir."],
  },
};

// ---------- 2. Renard ----------
const fox = {
  id: "fox",
  name: "Renard",
  group: "Animaux",
  bio: "Un renard malin et rapide qui file comme une flèche d'une série à l'autre.",
  persona: "Petit renard rusé, vif et espiègle, qui donne des astuces malignes et compare l'effort à une course dans la forêt.",
  travel: "dash",
  climb: false,
  fx: { color: "#ff7a1a", trail: "leaves" },
  defs: grad("fox-fur", "#ff8f2e", "#ec5f0e") + grad("fox-tail", "#ff9a3a", "#e2560a"),
  back: `<g class="fox-tail"><path d="M35 47 C44 52 56.6 48.6 57.4 36.8 C57.8 30.6 55.4 25.6 51.4 23.6 C52.6 31.6 48.6 39.6 36.4 41.6 Z" fill="url(#fox-tail)"/>
      <path d="M57.3 33.6 C57.4 29 55.4 25.4 51.4 23.6 C52.2 27.4 51.6 30.6 50.4 33.2 Q53.8 35.2 57.3 33.6 Z" fill="#fff8ef"/></g>`,
  legL: `<path d="M26 48 L24.6 60" stroke="#ec6a14" stroke-width="7.6" stroke-linecap="round"/><path d="M24.6 60 L23.8 71.5" stroke="#3a2418" stroke-width="7" stroke-linecap="round"/><ellipse cx="23" cy="75" rx="4.8" ry="2.9" fill="#2a1a12"/>`,
  legR: `<path d="M34 48 L35.4 60" stroke="#ec6a14" stroke-width="7.6" stroke-linecap="round"/><path d="M35.4 60 L36.2 71.5" stroke="#3a2418" stroke-width="7" stroke-linecap="round"/><ellipse cx="37" cy="75" rx="4.8" ry="2.9" fill="#2a1a12"/>`,
  armL: `<path d="M20 30 Q17.6 35 16.6 39.8" stroke="#f27418" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M16.6 39.8 Q15.2 44 14.6 47" stroke="#3a2418" stroke-width="5.6" stroke-linecap="round" fill="none"/><circle cx="14.3" cy="49.4" r="3.3" fill="#2a1a12"/>`,
  armR: `<path d="M40 30 Q42.4 35 43.4 39.8" stroke="#f27418" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M43.4 39.8 Q44.8 44 45.4 47" stroke="#3a2418" stroke-width="5.6" stroke-linecap="round" fill="none"/><circle cx="45.7" cy="49.4" r="3.3" fill="#2a1a12"/>`,
  torso: `<path d="${BODY}" fill="url(#fox-fur)"/>
      <path d="M24.6 28.4 L30 41.6 L35.4 28.4 Q37.4 40 34.2 50.8 Q30 52 25.8 50.8 Q22.6 40 24.6 28.4 Z" fill="#fff8ef"/>
      ${neckShade}`,
  head: `<path d="M11.4 11 L12 -3.6 Q12.8 -5.4 14.4 -4.2 L25 3.4 Z" fill="#f27418"/><path d="${mx("M11.4 11 L12 -3.6 Q12.8 -5.4 14.4 -4.2 L25 3.4 Z")}" fill="#f27418"/>
      <path d="M14.4 7 L14.6 0.4 L20.8 4 Z" fill="#ffe0c2"/><path d="${mx("M14.4 7 L14.6 0.4 L20.8 4 Z")}" fill="#ffe0c2"/>
      <path d="M12 -1.2 L12 -3.6 Q12.8 -5.4 14.4 -4.2 L17 -2.3 Q14.4 -0.4 12 -1.2 Z" fill="#3a2418"/><path d="${mx("M12 -1.2 L12 -3.6 Q12.8 -5.4 14.4 -4.2 L17 -2.3 Q14.4 -0.4 12 -1.2 Z")}" fill="#3a2418"/>
      <path d="M30 1.8 C41.6 1.8 48.4 8.6 48.4 15 L50.6 21.4 L44.6 21 Q39.6 27.8 30 27.8 Q20.4 27.8 15.4 21 L9.4 21.4 L11.6 15 C11.6 8.6 18.4 1.8 30 1.8 Z" fill="url(#fox-fur)"/>
      <path d="M10.6 20.4 Q13 15.6 18 16.6 Q22.8 17.4 25 19.4 Q27.4 18.2 30 18.6 Q32.6 18.2 35 19.4 Q37.2 17.4 42 16.6 Q47 15.6 49.4 20.4 L44.4 21.4 Q39.4 27.8 30 27.8 Q20.6 27.8 15.6 21.4 Z" fill="#fff8ef"/>
      ${shine(22, 5.4)}
      ${eyes(13.6, 7.2, 2.3, 2.8)}
      ${blush(19.4, 11.4, 0.45)}
      <ellipse cx="30" cy="21.4" rx="2.1" ry="1.45" fill="#2a1a12"/><ellipse cx="29.3" cy="20.9" rx=".7" ry=".4" fill="#fff" opacity=".7"/>
      ${mouth(24)}`,
  css: `${eyeBox("fox")}
  @media (prefers-reduced-motion: no-preference) {
    .ch-fox .fox-tail { transform-origin: 36px 46px; animation: fox-sway 2.4s ease-in-out infinite; }
    @keyframes fox-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(6deg); } }
  }`,
  lines: {
    hello: ["Psst ! J'ai une ruse : on s'entraîne maintenant.", "Salut ! J'ai couru jusqu'ici, à toi de jouer.", "Le renard est prêt. Et toi, champion ?"],
    tap: ["Hé, attention à ma queue, elle est brossée !", "Tu m'as attrapé ? Coup de chance.", "Plus rapide que moi ? On verra ça."],
    pr: ["Record ! Même le plus rusé des renards est bluffé.", "Tu files plus vite que moi, là !", "Bravo ! Tu chasses les records comme un pro."],
    rest: ["Pause terrier. Souffle, on repart vite.", "Je fais le guet. Récupère tranquille."],
    sleep: ["Zzz… roulé en boule dans ma queue…", "Je dors d'un œil… réveille-moi pour courir."],
  },
};

// ---------- 3. Chat Noir ----------
const blackcat = {
  id: "blackcat",
  name: "Chat Noir",
  group: "Animaux",
  bio: "Un chat noir élégant aux grands yeux dorés, souple et silencieux, qui retombe toujours sur ses pattes.",
  persona: "Chat noir élégant, un brin hautain et pince-sans-rire, qui félicite avec classe et vante la souplesse et l'agilité.",
  travel: "hop",
  climb: true,
  fx: { color: "#ffd23a", trail: "none" },
  defs: grad("blackcat-fur", "#52526e", "#22222f") + grad("blackcat-eye", "#ffe36a", "#f5b21e"),
  back: `<g class="blackcat-tail"><path d="M35 47 Q49 50 50.4 39.6 Q51.4 31.6 55.4 29.4" stroke="#34344a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M50.6 36.4 Q51.6 31.4 55.4 29.4" stroke="#4c4c66" stroke-width="1" fill="none" stroke-linecap="round" opacity=".7"/></g>`,
  legL: leg("L", "#33334a", "#43435c", 7.4),
  legR: leg("R", "#33334a", "#43435c", 7.4),
  armL: arm("L", "#3a3a54", "#4a4a64", 5.8),
  armR: arm("R", "#3a3a54", "#4a4a64", 5.8),
  torso: `<path d="${BODY}" fill="url(#blackcat-fur)" stroke="#6a6a8c" stroke-width=".5" stroke-opacity=".5"/>
      <path d="M26 31 Q30 34 34 31 Q32.6 36.4 30 37.4 Q27.4 36.4 26 31 Z" fill="#6a6a8a" opacity=".35"/>
      <path d="M21 31 Q30 27.6 39 31" stroke="#fff" stroke-width=".8" opacity=".12" fill="none"/>
      ${neckShade}`,
  head: `<path d="M12.4 12.6 L12.8 -2.4 Q13.4 -4.4 15.2 -3.4 L26 4 Z" fill="#30304a"/><path d="${mx("M12.4 12.6 L12.8 -2.4 Q13.4 -4.4 15.2 -3.4 L26 4 Z")}" fill="#30304a"/>
      <path d="M15.2 7.6 L15.4 0.6 L21.6 4.6 Z" fill="#ff9fb6" opacity=".85"/><path d="${mx("M15.2 7.6 L15.4 0.6 L21.6 4.6 Z")}" fill="#ff9fb6" opacity=".85"/>
      <ellipse cx="30" cy="14.8" rx="18" ry="12.6" fill="url(#blackcat-fur)" stroke="#6a6a8c" stroke-width=".5" stroke-opacity=".5"/>
      ${shine(21.6, 5)}
      <g class="sp-eyes">
        <g class="sp-eyeL"><ellipse cx="22.6" cy="14" rx="3.7" ry="4" fill="url(#blackcat-eye)"/><ellipse cx="22.8" cy="14.2" rx="1.1" ry="3" fill="#15121a"/><circle cx="24" cy="12.4" r="1.15" fill="#fff"/><circle cx="21.6" cy="15.9" r=".5" fill="#fff" opacity=".8"/></g>
        <g class="sp-eyeR"><ellipse cx="37.4" cy="14" rx="3.7" ry="4" fill="url(#blackcat-eye)"/><ellipse cx="37.2" cy="14.2" rx="1.1" ry="3" fill="#15121a"/><circle cx="38.6" cy="12.4" r="1.15" fill="#fff"/><circle cx="36.2" cy="15.9" r=".5" fill="#fff" opacity=".8"/></g>
      </g>
      ${blush(19.8, 11.6, 0.35, "#ff7aa0")}
      <path d="M28.6 18.8 L31.4 18.8 L30 20.3 Z" fill="#ff8fb0" stroke="#ff8fb0" stroke-width=".6" stroke-linejoin="round"/>
      ${mouth(21.6, "#9a9ab8")}
      <path d="M17 19.2 L10.4 18 M17 21 L10.6 21.8 M43 19.2 L49.6 18 M43 21 L49.4 21.8" stroke="#c9c9e0" stroke-width=".45" stroke-linecap="round" opacity=".55"/>
      <path d="M21.4 26.2 Q30 29.4 38.6 26.2" stroke="#e8364d" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <circle cx="30" cy="29" r="2" fill="#ffcf3a"/><path d="M28.4 29.4 H31.6" stroke="#b58300" stroke-width=".5"/><circle cx="30" cy="30.1" r=".45" fill="#8a6200"/>`,
  css: `${eyeBox("blackcat")}
  @media (prefers-reduced-motion: no-preference) {
    .ch-blackcat .blackcat-tail { transform-origin: 36px 47px; animation: blackcat-tail 3s ease-in-out infinite; }
    @keyframes blackcat-tail { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
  }`,
  lines: {
    hello: ["Miaou. Tu es en retard, mais je te pardonne.", "Bonjour, humain. On s'étire et on y va ?", "Je t'attendais. Évidemment."],
    tap: ["Pas le pelage, merci. Je sors de chez le toiletteur.", "Ronron… bon, d'accord, encore une fois.", "Tu as de la chance que je sois de bonne humeur."],
    pr: ["Record. Je suis presque impressionné. Presque.", "Magnifique. Digne d'un chat, ce saut-là.", "Tu retombes sur tes pattes, et en beauté !"],
    rest: ["Repos. Fais comme moi : étire-toi lentement.", "Une sieste de 60 secondes, c'est permis."],
    sleep: ["Zzz… ma 14ᵉ sieste de la journée…", "Ronron… ne me dérange qu'en cas d'urgence."],
  },
};

// ---------- 4. Grenouille ----------
const frog = {
  id: "frog",
  name: "Grenouille",
  group: "Animaux",
  bio: "Une grenouille toute ronde et bondissante, championne du saut et de la bonne humeur.",
  persona: "Grenouille ronde et pétillante, toujours souriante, qui adore les sauts, les mares et les jeux de mots en « croa ».",
  travel: "hop",
  climb: false,
  fx: { color: "#5cc845", trail: "bubbles" },
  defs: grad("frog-skin", "#7fd65a", "#43a832") + grad("frog-belly", "#f4fbd8", "#d6efa8"),
  legL: `<path d="M26 48 Q18.6 58 22.8 71.4" stroke="#4cb038" stroke-width="7.6" fill="none" stroke-linecap="round"/>
      <path d="M17.6 75.6 Q23 72 28.4 75.6 Q23 77.6 17.6 75.6 Z" fill="#3e9a2e"/><circle cx="18.2" cy="76" r="1.5" fill="#55b83e"/><circle cx="23" cy="77" r="1.5" fill="#55b83e"/><circle cx="27.8" cy="76" r="1.5" fill="#55b83e"/>`,
  legR: `<path d="M34 48 Q41.4 58 37.2 71.4" stroke="#4cb038" stroke-width="7.6" fill="none" stroke-linecap="round"/>
      <path d="M42.4 75.6 Q37 72 31.6 75.6 Q37 77.6 42.4 75.6 Z" fill="#3e9a2e"/><circle cx="41.8" cy="76" r="1.5" fill="#55b83e"/><circle cx="37" cy="77" r="1.5" fill="#55b83e"/><circle cx="32.2" cy="76" r="1.5" fill="#55b83e"/>`,
  armL: `<path d="M20 30 Q16 38.5 14.6 47" stroke="#5cc845" stroke-width="5.6" stroke-linecap="round" fill="none"/><circle cx="14.3" cy="49.4" r="2.9" fill="#5cc845"/>
      <circle cx="12" cy="51.4" r="1.25" fill="#6fd256"/><circle cx="14.4" cy="52.4" r="1.25" fill="#6fd256"/><circle cx="16.7" cy="51.4" r="1.25" fill="#6fd256"/>`,
  armR: `<path d="M40 30 Q44 38.5 45.4 47" stroke="#5cc845" stroke-width="5.6" stroke-linecap="round" fill="none"/><circle cx="45.7" cy="49.4" r="2.9" fill="#5cc845"/>
      <circle cx="48" cy="51.4" r="1.25" fill="#6fd256"/><circle cx="45.6" cy="52.4" r="1.25" fill="#6fd256"/><circle cx="43.3" cy="51.4" r="1.25" fill="#6fd256"/>`,
  torso: `<path d="M18.6 28.4 Q30 23.6 41.4 28.4 Q46 40 41.6 51 Q30 56 18.4 51 Q14 40 18.6 28.4 Z" fill="url(#frog-skin)"/>
      <ellipse cx="30" cy="41.6" rx="8.6" ry="10" fill="url(#frog-belly)"/>
      <circle cx="21" cy="34" r="1.1" fill="#3a922a" opacity=".5"/><circle cx="39.4" cy="37" r="1.3" fill="#3a922a" opacity=".5"/>
      ${neckShade}`,
  head: `<circle cx="21.4" cy="6" r="7" fill="#6cd04e"/><circle cx="38.6" cy="6" r="7" fill="#6cd04e"/>
      <ellipse cx="30" cy="16.6" rx="19" ry="11.4" fill="url(#frog-skin)"/>
      <ellipse cx="30" cy="20.6" rx="11" ry="6" fill="#bfe68e" opacity=".55"/>
      <ellipse cx="30" cy="9.8" rx="4" ry="1.3" fill="#fff" opacity=".18"/>
      <g class="sp-eyes">
        <g class="sp-eyeL"><circle cx="21.4" cy="6" r="5" fill="#fff"/><ellipse cx="22" cy="6.6" rx="2.7" ry="3.1" fill="#1c2a14"/><circle cx="23" cy="5.2" r="1.15" fill="#fff"/><circle cx="21.1" cy="8" r=".5" fill="#fff" opacity=".8"/></g>
        <g class="sp-eyeR"><circle cx="38.6" cy="6" r="5" fill="#fff"/><ellipse cx="38" cy="6.6" rx="2.7" ry="3.1" fill="#1c2a14"/><circle cx="39" cy="5.2" r="1.15" fill="#fff"/><circle cx="37.1" cy="8" r=".5" fill="#fff" opacity=".8"/></g>
      </g>
      <circle cx="28.2" cy="14.4" r=".6" fill="#2d6e20"/><circle cx="31.8" cy="14.4" r=".6" fill="#2d6e20"/>
      ${blush(18.8, 12.4, 0.55, "#ff8f9a")}
      <path d="M20.4 18.2 Q30 26.2 39.6 18.2" stroke="#245c18" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M27.6 21.6 Q30 23.6 32.4 21.6 Q30 22.2 27.6 21.6 Z" fill="#ff7f8f"/>`,
  css: `${eyeBox("frog")}
  .ch-frog .sp-eyes { transform-origin: 30px 6px; }
  @media (prefers-reduced-motion: no-preference) {
    .ch-frog .frog-cheeks { transform-box: fill-box; transform-origin: center; animation: frog-puff 2.6s ease-in-out infinite; }
    @keyframes frog-puff { 0%, 80%, 100% { transform: scale(1); } 88% { transform: scale(1.25); } }
  }`,
  lines: {
    hello: ["Croâ ! Prêt à faire des bonds de géant ?", "Salut ! L'eau est bonne, l'entraînement aussi.", "Hop hop hop ! On saute dans la séance ?"],
    tap: ["Croâ ! Ça chatouille le ventre !", "Attention, je suis un peu glissante.", "Encore ? Je te réponds par un bond !"],
    pr: ["Record ! J'en saute de joie, croâ !", "Saut de géant ! Même les nénuphars applaudissent.", "Tu es le roi de la mare aujourd'hui !"],
    rest: ["Pause nénuphar. Respire, flotte, souris.", "Je gobe une mouche, tu reprends ton souffle."],
    sleep: ["Zzz… croâ… zzz…", "Sieste au bord de la mare… réveille-moi !"],
  },
};
// petites joues qui se gonflent (dessinées dans la tête, après le reste du visage)
frog.head = frog.head.replace(blush(18.8, 12.4, 0.55, "#ff8f9a"), `<g class="frog-cheeks">${blush(18.8, 12.4, 0.55, "#ff8f9a")}</g>`);

// ---------- 5. Ourson ----------
const bear = {
  id: "bear",
  name: "Ourson",
  group: "Animaux",
  bio: "Un ourson en peluche tout doux, avec son petit nœud, qui t'encourage avec des câlins.",
  persona: "Ourson en peluche doux et câlin, très encourageant, qui parle de miel, de câlins et de petites victoires à fêter.",
  travel: "walk",
  climb: false,
  fx: { color: "#ff6b8a", trail: "hearts" },
  defs: grad("bear-fur", "#b47a45", "#8a5530") + grad("bear-light", "#f3dcb8", "#e2c194"),
  legL: leg("L", "#9a6236", "#f0d6ae", 8.4),
  legR: leg("R", "#9a6236", "#f0d6ae", 8.4),
  armL: arm("L", "#a56c3c", "#f0d6ae", 6.6),
  armR: arm("R", "#a56c3c", "#f0d6ae", 6.6),
  torso: `<path d="${BODY}" fill="url(#bear-fur)"/>
      <ellipse cx="30" cy="41.4" rx="7.4" ry="8.4" fill="url(#bear-light)"/>
      <ellipse cx="30" cy="41.4" rx="6.2" ry="7.2" fill="none" stroke="#b8905e" stroke-width=".55" stroke-dasharray="1.2 1"/>
      ${neckShade}`,
  head: `<circle cx="14.6" cy="3.6" r="5.8" fill="#9a6236"/><circle cx="45.4" cy="3.6" r="5.8" fill="#9a6236"/>
      <circle cx="14.8" cy="3.9" r="3.3" fill="#e8c79c"/><circle cx="45.2" cy="3.9" r="3.3" fill="#e8c79c"/>
      <ellipse cx="30" cy="14.8" rx="17.6" ry="13" fill="url(#bear-fur)"/>
      ${shine(22, 4.8)}
      <ellipse cx="30" cy="20" rx="7" ry="5.2" fill="url(#bear-light)"/>
      ${eyes(13, 7.4, 2.2, 2.5, "#1e120c")}
      ${blush(18.6, 12, 0.5, "#ff8a8a")}
      <path d="M27.8 17.2 Q30 16.2 32.2 17.2 Q31.6 19.2 30 19.4 Q28.4 19.2 27.8 17.2 Z" fill="#3a2016"/><ellipse cx="29.4" cy="17.4" rx=".7" ry=".35" fill="#fff" opacity=".7"/>
      ${mouth(21.6, "#5a3020")}
      <g class="bear-bow"><path d="M30 28.4 L23.8 25.4 Q22.4 28.4 23.8 31.4 Z M30 28.4 L36.2 25.4 Q37.6 28.4 36.2 31.4 Z" fill="#ff5d7e" stroke="#ff5d7e" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M25 27.6 L27.6 28.4 M35 27.6 L32.4 28.4" stroke="#d63a5c" stroke-width=".6" stroke-linecap="round"/>
        <circle cx="30" cy="28.4" r="1.9" fill="#e8436a"/><circle cx="29.5" cy="27.8" r=".5" fill="#fff" opacity=".6"/></g>`,
  css: `${eyeBox("bear")}
  @media (prefers-reduced-motion: no-preference) {
    .ch-bear .bear-bow { transform-origin: 30px 28.4px; animation: bear-bow 3.2s ease-in-out infinite; }
    @keyframes bear-bow { 0%, 86%, 100% { transform: rotate(0deg); } 90% { transform: rotate(-8deg); } 95% { transform: rotate(6deg); } }
  }`,
  lines: {
    hello: ["Coucou ! Un petit câlin, et on s'entraîne ?", "Bonjour toi ! J'ai gardé du miel pour après.", "Prêt ? Je suis tout doux mais très motivé !"],
    tap: ["Hihi, je suis tout moelleux !", "Câlin accepté. Maintenant, au travail !", "Attention à mon nœud, il est tout neuf."],
    pr: ["Record ! Câlin géant de félicitations !", "Bravo ! Tu mérites un pot de miel entier.", "Je suis si fier que mes coutures craquent !"],
    rest: ["Pause douceur. Respire, je reste avec toi.", "Bois un peu d'eau. Le miel, c'est pour après."],
    sleep: ["Zzz… je rêve de miel…", "Petit dodo de peluche… réveille-moi !"],
  },
};

export default [shiba, fox, blackcat, frog, bear];
