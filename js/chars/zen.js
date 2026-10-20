// Coachs « Zen » : yoga, danse, tai-chi, mobilité.
import { person } from "./kit.js";

const G = "Zen";
export default [
  person({
    id: "priya", name: "Priya", group: G, travel: "fly", fx: { color: "#c26cf0", trail: "aura" },
    bio: "Professeure de yoga lumineuse : elle flotte au-dessus de son tapis et t'apprend à respirer.",
    persona: "Professeure de yoga douce et lumineuse, qui parle de souffle, d'ancrage et de bienveillance envers soi, avec des phrases calmes et poétiques.",
    aliases: ["yoga"],
    skin: 5, build: "slim", hair: { style: "bun", color: "black" }, brows: "soft", mouth: "calm", eyes: { lash: true, lid: true },
    top: { style: "crop", color: "#c26cf0", color2: "#8f3fd0" }, bottom: { style: "leggings", color: "#3b2a5c" }, shoes: { style: "bare" },
    extras: ["mat"], matColor: "#2bb3a8",
    lines: {
      hello: ["Namasté. Prenons un instant pour respirer.", "Bienvenue sur le tapis. Inspire, expire."],
      tap: ["Oh ! Tu as interrompu ma méditation… ce n'est rien.", "Inspire… et souris.", "Chaque respiration est un nouveau départ."],
      pr: ["Record ! Ton corps te remercie.", "Magnifique. Accueille cette fierté."],
      rest: ["Ferme les yeux. Respire profondément.", "Le calme est une force."],
      sleep: ["Zzz… relaxation profonde…"],
    },
  }),
  person({
    id: "elif", name: "Elif", group: G, travel: "hop", fx: { color: "#ff6b8b", trail: "hearts" },
    bio: "Danseuse rayonnante : avec elle, chaque échauffement devient une chorégraphie.",
    persona: "Danseuse rayonnante et expressive, qui parle de rythme, de musique et de liberté de mouvement, et transforme l'effort en plaisir.",
    aliases: ["danseuse", "danse"],
    skin: 2, build: "curvy", hair: { style: "wavy", color: "auburn" }, brows: "soft", mouth: "grin", eyes: { lash: true }, face: { earrings: { style: "hoop" } },
    top: { style: "crop", color: "#ff6b8b", color2: "#e04870" }, bottom: { style: "joggers", color: "#f1e6d6" }, shoes: { color: "#ffffff", accent: "#ff6b8b" },
    lines: {
      hello: ["Salut ! On met la musique et on bouge ?", "Cinq, six, sept, huit… c'est parti !"],
      tap: ["Un petit pas de danse avec moi ?", "Suis le rythme, tout devient plus facile.", "Tourne, tourne ! Ha ha !"],
      pr: ["Record ! Ça mérite une pirouette !", "Bravo ! Tu as le rythme dans la peau !"],
      rest: ["Pause musique : on respire en rythme.", "Relâche les épaules, ondule doucement."],
      sleep: ["Zzz… je rêve en musique…"],
    },
  }),
  person({
    id: "jeanne", name: "Jeanne", group: G, travel: "walk", fx: { color: "#b49cff", trail: "hearts" },
    bio: "Mamie pleine d'entrain : tai-chi le matin, marche l'après-midi et conseils en or toute la journée.",
    persona: "Grand-mère sportive pleine d'entrain et d'humour, douce et sage, qui pratique le tai-chi et la marche, rappelle de bouger chaque jour et appelle l'utilisateur « mon petit ».",
    aliases: ["mamie"],
    skin: 6, build: "curvy", hair: { style: "curly", color: "white" }, brows: "soft", mouth: "smile",
    face: { glasses: { style: "round", color: "#8d6cf0" }, wrinkles: true, earrings: { style: "stud", color: "#f4f1ea" } },
    top: { style: "jacket", color: "#b49cff", color2: "#8d6cf0", piping: "#ffffff" }, bottom: { style: "joggers", color: "#8d6cf0" },
    shoes: { color: "#ffffff", accent: "#b49cff" },
    lines: {
      hello: ["Bonjour, mon petit ! On bouge un peu ?", "Ah, te voilà ! Mes articulations et moi, on est prêtes."],
      tap: ["Oh ! Tu m'as fait sursauter, coquin !", "Bouger un peu chaque jour, c'est mon secret.", "Tu as bien mangé, au moins ?"],
      pr: ["Record ! Je vais le raconter à toute la famille !", "Bravo, mon petit ! Je suis fière de toi."],
      rest: ["Respire tranquillement, comme au tai-chi.", "Une petite pause, ça ne fait jamais de mal."],
      sleep: ["Zzz… une petite sieste, et je suis à toi…"],
    },
  }),
  person({
    id: "hugo", name: "Hugo", group: G, travel: "walk", fx: { color: "#6ccf8e", trail: "leaves" },
    bio: "Pro de la mobilité : il dénoue les tensions et t'apprend à bouger sans douleur.",
    persona: "Coach de mobilité posé et attentionné, qui parle d'articulations, d'étirements et d'écoute du corps, avec une voix calme et des conseils précis.",
    aliases: ["mobilite", "etirements"],
    skin: 8, build: "fit", hair: { style: "locsbun", color: "black" }, beard: { style: "short", color: "black" }, brows: "soft", mouth: "calm",
    top: { style: "vest", color: "#6b8e4e", color2: "#ffffff" }, bottom: { style: "joggers", color: "#8e96a8" }, shoes: { style: "bare" },
    lines: {
      hello: ["Salut. On commence par délier le corps ?", "Bienvenue. Doucement, sans forcer."],
      tap: ["Hé, relâche ces épaules.", "La souplesse, c'est de la patience.", "Écoute ton corps, il te parle."],
      pr: ["Record ! Et tout en contrôle, bravo.", "Belle amplitude, beau travail."],
      rest: ["On étire doucement pendant la pause.", "Respire dans la tension, elle s'en va."],
      sleep: ["Zzz… détente totale…"],
    },
  }),
];
