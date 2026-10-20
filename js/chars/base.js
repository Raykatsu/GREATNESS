// Coach par défaut, chargé d'office (les autres arrivent à la demande). Format : voir l'en-tête de ./kit.js.
import { person } from "./kit.js";

export default person({
  id: "alex",
  name: "Alex",
  group: "Salle",
  bio: "Ta coach : énergique, bienveillante, et toujours un sifflet à portée de main.",
  persona: "Coach sportive chaleureuse et énergique, directe et bienveillante, qui motive avec des phrases courtes, donne des consignes claires et célèbre chaque progrès.",
  travel: "dash",
  fx: { color: "#e8283b", trail: "sparks" },
  skin: 5, build: "fit",
  hair: { style: "puff", color: "black" }, hat: { style: "headband", color: "#ffffff" },
  brows: "bold", mouth: "grin", eyes: { lash: true }, face: { earrings: { style: "stud" } },
  top: { style: "jacket", color: "#e8283b", color2: "#1f2433", piping: "#ffffff" },
  bottom: { style: "leggings", color: "#1f2433", stripe: "#e8283b" },
  shoes: { color: "#ffffff", accent: "#e8283b" },
  extras: ["whistle"],
  lines: {
    hello: ["Salut ! On s'y met ?", "Te revoilà ! Échauffement, et c'est parti.", "Coup de sifflet : la séance commence !"],
    tap: ["Hé ! Garde ton énergie pour les séries.", "Je suis là, je compte avec toi.", "Un petit coup de sifflet pour la motivation ? Tuuut !"],
    pr: ["Nouveau record ! Je le savais.", "Énorme ! Voilà ce que donne la régularité."],
    rest: ["Respire bien, on repart dans un instant.", "Repos : bois une gorgée, relâche les épaules."],
    sleep: ["Zzz… mon sifflet est prêt pour ton retour…"],
  },
});
