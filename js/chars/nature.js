// Coachs « Nature » : escalade, vélo, skate, surf, randonnée, ski.
import { person } from "./kit.js";

const G = "Nature";
// planche de surf portée dans le dos (dépasse au-dessus de l'épaule droite)
const SURF = `<g transform="rotate(18 38 28)"><rect x="33.6" y="-9" width="10.4" height="64" rx="5.2" fill="#fff4dc" stroke="#b39a6e" stroke-width=".8"/>` +
  `<rect x="37.9" y="-9" width="1.8" height="64" fill="#ff8a3d"/><path d="M35.4 -2 Q38.8 -6.4 42.2 -2" stroke="#22b8c9" stroke-width="1.4" fill="none"/></g>`;

export default [
  person({
    id: "nadia", name: "Nadia", group: G, travel: "dash", climb: true, fx: { color: "#ff7a2f", trail: "smoke" },
    bio: "Grimpeuse intrépide : elle escalade les murs de l'écran et t'aide à atteindre tes sommets.",
    persona: "Grimpeuse aventurière et rieuse, passionnée de falaises et de blocs, qui parle de prises, de confiance et de sommets à atteindre, avec un enthousiasme contagieux.",
    aliases: ["grimpeuse", "escalade"],
    skin: 3, build: "fit", hair: { style: "curly", color: "black" }, hat: { style: "bandana", color: "#ff7a2f", color2: "#d95a12" }, brows: "soft", mouth: "grin", eyes: { lash: true },
    top: { style: "tank", color: "#7a8b3a" }, bottom: { style: "pants", color: "#d8c7a3" }, extras: ["harness", "chalk"],
    shoes: { color: "#e94f37", sole: "#2a2d38" },
    lines: {
      hello: ["Salut ! Aujourd'hui, on grimpe vers le sommet.", "Magnésie, corde, sourire : je suis prête ! Et toi ?"],
      tap: ["Hé ! Je suis assurée, pas de panique.", "Une prise après l'autre, c'est le secret.", "Tu veux grimper avec moi ?"],
      pr: ["Sommet atteint ! Nouveau record !", "Quelle voie ! Tu l'as enchaînée !"],
      rest: ["Je fais une pause accrochée là-haut.", "Secoue les bras, respire, on repart."],
      sleep: ["Zzz… dans mon hamac de paroi…"],
    },
  }),
  person({
    id: "kofi", name: "Kofi", group: G, travel: "dash", fx: { color: "#1f9d55", trail: "none" },
    bio: "Cycliste passionné : il avale les cols et t'apprend à garder le rythme dans la montée.",
    persona: "Cycliste endurant et jovial, passionné de cols et de longues sorties, qui parle de cadence, de souffle et de persévérance dans les montées.",
    aliases: ["cycliste", "velo"],
    skin: 7, build: "fit", hair: { style: "none" }, hat: { style: "helmet", color: "#f4f5f8", shades: true }, brows: "soft", mouth: "grin",
    top: { style: "cycling", color: "#ffd23f", color2: "#1f9d55", color3: "#e8283b" }, bottom: { style: "shorts", color: "#1d1f26", short: 0.46 },
    gloves: { color: "#1d1f26" }, shoes: { color: "#f4f5f8", accent: "#1f9d55" },
    lines: {
      hello: ["Salut ! On attaque le col du jour ?", "Casque bouclé, on roule !"],
      tap: ["Dring dring ! Attention, cycliste !", "Garde la cadence, c'est la clé.", "Dans la montée, on ne lâche rien."],
      pr: ["Victoire d'étape ! Nouveau record !", "Quel sprint ! Tu as tout lâché !"],
      rest: ["Roue libre : on récupère.", "Pause au sommet : profite de la vue."],
      sleep: ["Zzz… je rêve de longues descentes…"],
    },
  }),
  person({
    id: "jade", name: "Jade", group: G, travel: "roll", fx: { color: "#ff83b5", trail: "stars" },
    bio: "Skateuse créative et libre : elle glisse partout et transforme chaque chute en nouvel essai.",
    persona: "Skateuse décontractée, créative et bienveillante, qui parle de style, de persévérance et d'essais ratés qui mènent à la réussite, avec un langage cool.",
    aliases: ["skateuse", "skate"],
    skin: 5, build: "slim", hair: { style: "bob", color: "teal" }, brows: "soft", mouth: "smirk", face: { vitiligo: true, earrings: { style: "hoop", color: "#d9dbe3" } },
    top: { style: "hoodie", color: "#ff83b5", color2: "#ffffff" }, bottom: { style: "pants", color: "#3a4256" }, board: { color: "#ffd23f" },
    shoes: { color: "#2a2d38", sole: "#ffffff" },
    lines: {
      hello: ["Yo ! On ride la séance ?", "Salut ! Prête à glisser, et toi ?"],
      tap: ["Wooh ! Attention, je suis en pleine figure.", "Tomber, c'est apprendre. Allez, encore !", "Trop stylé, ton mouvement."],
      pr: ["Record ! Figure réussie !", "Waouh, la classe ! Tu l'as plaquée !"],
      rest: ["Je fais une pause sur ma planche.", "Tranquille… on respire et on repart."],
      sleep: ["Zzz… je rêve d'un skatepark géant…"],
    },
  }),
  person({
    id: "diego", name: "Diego", group: G, travel: "walk", fx: { color: "#3fc5f0", trail: "bubbles" },
    bio: "Surfeur zen et solaire : il t'apprend à surfer sur la vague de la motivation.",
    persona: "Surfeur détendu, solaire et positif, qui parle de vagues, d'équilibre et de bonnes ondes, avec un ton cool et apaisant.",
    aliases: ["surfeur", "surf"],
    skin: 4, build: "fit", hair: { style: "wavy", color: "#b48a4f" }, brows: "soft", mouth: "grin",
    top: { style: "rash", color: "#22b8c9", color2: "#ffffff" }, bottom: { style: "shorts", color: "#ff8a3d", stripe: "#ffffff", short: 0.44 }, shoes: { style: "bare" },
    back: SURF,
    lines: {
      hello: ["Salut ! La vague de la motivation arrive.", "Hey ! Bonnes ondes aujourd'hui ?"],
      tap: ["Hé ! Doucement, je cherche mon équilibre.", "Reste cool, la vague arrive.", "Aloha… enfin, salut !"],
      pr: ["Record ! Vague parfaite !", "Quelle vague ! Tu l'as surfée jusqu'au bout !"],
      rest: ["On attend la prochaine vague. Respire.", "Pause : laisse-toi flotter."],
      sleep: ["Zzz… bercé par les vagues…"],
    },
  }),
  person({
    id: "amina", name: "Amina", group: G, travel: "walk", fx: { color: "#8bc34a", trail: "leaves" },
    bio: "Randonneuse infatigable : elle te guide pas à pas, des sentiers aux plus hauts sommets.",
    persona: "Randonneuse curieuse et chaleureuse, amoureuse de la nature, qui parle de sentiers, de paysages et d'endurance, et rappelle de profiter du chemin.",
    aliases: ["randonneuse", "rando"],
    skin: 6, build: "fit", hair: { style: "curly", color: "black" }, hat: { style: "bucket", color: "#c9b37e", color2: "#a8925c" }, brows: "soft", mouth: "grin", eyes: { lash: true },
    face: { earrings: { style: "stud" } },
    top: { style: "tee", color: "#2bb3a8", print: "mountain", color2: "#ffffff" }, bottom: { style: "shorts", color: "#8a7a52" },
    socks: "#9aa0ad", shoes: { style: "boot", color: "#8a5a34", sole: "#3a2a1a" }, extras: ["backpack", "straps"], packColor: "#ff8a3d",
    lines: {
      hello: ["Salut ! Sac sur le dos, on part en balade ?", "Le chemin est beau aujourd'hui. On y va ?"],
      tap: ["Hé ! Regarde la vue d'ici.", "Un pas après l'autre, on arrive toujours.", "J'ai des fruits secs, tu en veux ?"],
      pr: ["Sommet ! Nouveau record !", "Quel panorama, ce record !"],
      rest: ["Pause pique-nique : respire l'air pur.", "On s'assoit sur un rocher deux minutes."],
      sleep: ["Zzz… sous les étoiles…"],
    },
  }),
  person({
    id: "erik", name: "Erik", group: G, travel: "walk", fx: { color: "#7cc4ff", trail: "snow" },
    bio: "Moniteur de ski au rire tonitruant : il adore le froid, la neige et les gros efforts.",
    persona: "Skieur jovial et chaleureux, venu des montagnes, qui parle de neige, de descentes et de cuisses en feu, avec un grand rire.",
    aliases: ["skieur", "ski"],
    skin: 1, build: "fit", hair: { style: "short", color: "blond" }, hat: { style: "beanie", color: "#e8283b", color2: "#f4f5f8" }, beard: { style: "full", color: "blond" }, brows: "soft", mouth: "grin",
    top: { style: "puffer", color: "#2f6fed", color2: "#ffffff" }, bottom: { style: "pants", color: "#2a2d38" }, shoes: { style: "boot", color: "#8a5a34", sole: "#3a2a1a" },
    lines: {
      hello: ["Salut ! Les pistes sont parfaites aujourd'hui.", "Brrr ! Rien de tel qu'une séance pour se réchauffer."],
      tap: ["Ho ho ! Attention, je glisse !", "Tu sens tes cuisses ? C'est le ski !", "Un chocolat chaud après la séance ?"],
      pr: ["Record ! Descente express !", "Médaille d'or en slalom !"],
      rest: ["Télésiège : on souffle en montant.", "Pause au chalet : respire et hydrate-toi."],
      sleep: ["Zzz… sous la couette en plumes…"],
    },
  }),
];
