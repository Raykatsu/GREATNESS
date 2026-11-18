// Guide « Découvrir GREATNESS » : chaque fonction de l'app expliquée en une ou deux phrases, rangée par onglet, avec
// l'endroit où la trouver et un bouton pour l'essayer. Ce fichier ne contient que les données (testées dans Node) ;
// js/guide.js affiche le guide, la carte « Bien démarrer » de l'Accueil et les boutons « ? » des onglets.
//   go.to    : ouvre un écran (#/…) et fait briller l'élément go.spot ; go.click le touche en plus (un filtre, un
//              onglet) ; go.miss est le message affiché quand il n'existe pas encore (les records avant la 1re séance)
//   go.fn    : ouvre la fonction elle-même (une des clés de FNS, branchées dans js/guide.js)
//   go.start : ouvre la séance du jour (« today ») avant de la lancer
//   auto     : la fonction compte comme découverte d'après les données du compte (séances faites, repas notés…)

export const SECTIONS = [
  { id: "start", ic: "🚀", name: "Bien démarrer", sub: "Cinq étapes pour prendre l'app en main." },
  { id: "home", ic: "🏠", name: "Accueil", sub: "Ce que tu vois en ouvrant l'app." },
  { id: "train", ic: "🏋️", name: "Séances", sub: "Choisir et lancer une séance." },
  { id: "live", ic: "⏱️", name: "En séance", sub: "Ce qui se passe pendant l'entraînement." },
  { id: "create", ic: "🧩", name: "Créer", sub: "Fabriquer tes propres séances." },
  { id: "food", ic: "🍽️", name: "Repas", sub: "Manger en accord avec ton objectif." },
  { id: "coach", ic: "💬", name: "Coach", sub: "Ton coach répond, retient et agit." },
  { id: "progress", ic: "📈", name: "Progrès", sub: "Voir le chemin parcouru." },
  { id: "friends", ic: "🤝", name: "Amis", sub: "S'entraîner avec les autres." },
  { id: "settings", ic: "⚙️", name: "Réglages", sub: "Régler l'app à ta façon." },
];

// Fonctions que le guide sait ouvrir directement (go.fn)
export const FNS = ["manual", "body3d", "intervals", "goal", "recovery", "story", "health", "targets", "coaches", "feedback", "demo", "cam", "video"];

const did = s => (s.sessions || []).length > 0;
const ate = s => Object.values(s.food || {}).some(d => d?.items?.length);
const asked = s => (s.chat || []).some(m => m.role === "user");

// Bien démarrer : cinq étapes cochées d'après ce que l'utilisateur a vraiment fait
export const STARTER = [
  { id: "s-first", t: "Fais ta première séance", go: { start: "today" }, done: s => did(s),
    d: "Ta mission du jour t'attend sur l'Accueil : touche « Commencer », réponds au bilan de forme, puis laisse le coach te guider série après série." },
  { id: "s-demo", t: "Regarde la démo d'un exercice", go: { fn: "demo" }, done: (s, seen) => seen.has("used:demo"),
    d: "Le bouton ▶ à côté de chaque exercice montre le corps en 3D qui fait le mouvement, les muscles qui travaillent et les erreurs à éviter." },
  { id: "s-meal", t: "Note un repas", go: { to: "#/food", spot: ".nut-actions" }, done: s => ate(s),
    d: "Onglet Repas : scanne un code-barres, cherche un aliment ou décris ton assiette. L'app compare à tes besoins du jour." },
  { id: "s-coach", t: "Pose une question à ton coach", go: { to: "#/coach", spot: "#sugg" }, done: s => asked(s),
    d: "Technique, nutrition, sommeil, programme… Il peut aussi régler l'app pour toi : « passe à 4 séances par semaine »." },
  { id: "s-remind", t: "Active tes rappels", go: { to: "#/profile", spot: "#p-push" }, done: (s, seen) => seen.has("used:remind"),
    d: "Une notification avant chaque séance prévue, ou tes séances ajoutées à ton calendrier : la régularité fait tout." },
];

export const ITEMS = [
  // — Accueil —
  { id: "mission", sec: "home", ic: "🎯", t: "Mission du jour", w: "Accueil", go: { to: "#/", spot: ".mission" }, auto: did,
    d: "La séance du jour, choisie dans ton programme et adaptée à ton objectif. « Commencer » ouvre l'aperçu, le bouton ⇄ en propose une autre." },
  { id: "week", sec: "home", ic: "📅", t: "Ta semaine", w: "Accueil → Ta semaine", go: { to: "#/", spot: ".week-card" },
    d: "Ton programme sur sept jours. Touche un jour pour changer sa séance ou le passer en repos." },
  { id: "weekadapt", sec: "home", ic: "🔄", t: "Semaine qui s'adapte", w: "Accueil", auto: s => (s.weekAdapt?.skip || []).length > 0,
    go: { to: "#/", spot: "#wa-card", miss: "Rien à adapter aujourd'hui : le coach propose quand c'est utile (séance manquée, muscles pas remis, grosse semaine, jour libre)." },
    d: "Séance manquée, muscles pas remis, grosse semaine, jour libre : le coach propose d'ajuster ta semaine en un geste (pour cette semaine seulement)." },
  { id: "recovery", sec: "home", ic: "🫀", t: "Récupération musculaire", w: "Accueil → Récupération", go: { fn: "recovery" },
    d: "Chaque muscle de rouge (à reposer) à vert (récupéré), d'après tes séances. Une séance qui tombe sur un muscle pas remis est allégée toute seule." },
  { id: "review", sec: "home", ic: "📝", t: "Bilan de la semaine", w: "Accueil, puis Moi → Stats", auto: s => Object.keys(s.reviews || {}).length > 0,
    go: { to: "#/progress?t=me", spot: ".rv-week", miss: "Ton premier bilan arrive à la fin de ta première semaine d'entraînement." },
    d: "Le dimanche soir : ta note sur 100, tes séances, tes records, tes points forts et ce qu'il faut ajuster." },
  { id: "rank", sec: "home", ic: "🏆", t: "Niveaux, rangs et succès", w: "Moi → Stats", go: { to: "#/progress?t=me", spot: ".me-hero" }, auto: did,
    d: "Chaque séance rapporte de l'XP : monte de niveau, change de rang et débloque des succès. Tes jours d'affilée s'affichent en haut de l'Accueil." },
  { id: "story", sec: "home", ic: "📖", t: "Mode histoire", w: "Accueil → Mode histoire", go: { fn: "story" }, auto: s => Object.keys(s.story?.done || {}).length > 0,
    d: "Dix chapitres où ton coach défend la ville contre la Flemme. Chaque chapitre réussi grâce à tes vraies séances débloque un costume." },
  { id: "health", sec: "home", ic: "❤️", t: "Forme du jour avec Apple Santé", w: "Moi → Réglages → Apple Santé", tag: "iPhone", go: { fn: "health" }, auto: s => !!s.health?.linked,
    d: "Relie Apple Santé : ton sommeil, ta variabilité cardiaque, tes pas et ton poids préremplissent le bilan de forme avant chaque séance." },

  // — Séances —
  { id: "library", sec: "train", ic: "📚", t: "Programmes prêts à lancer", w: "Séances", go: { to: "#/train", spot: ".tr-filters" }, auto: did,
    d: "Salle, maison, cardio, mobilité, échauffement et souplesse : filtre par catégorie, touche une séance pour la voir, l'ajuster puis la lancer." },
  { id: "free", sec: "train", ic: "⚡", t: "Séance libre", w: "Séances, ou Accueil", go: { to: "#/train", spot: "#free-start" },
    d: "Sans programme : tu ajoutes les exercices au fur et à mesure, et le coach suit et ajuste quand même." },
  { id: "care", sec: "train", ic: "🌿", t: "Soulager et assouplir", w: "Séances → Soulager", go: { to: "#/train", spot: '[data-f="care"]', click: true },
    d: "Des séances douces pour le dos, la nuque, les épaules, les genoux, les hanches et les poignets, plus la mobilité et la souplesse. Ce n'est pas un avis médical." },
  { id: "manual", sec: "train", ic: "📕", t: "Manuel des exercices", w: "Séances → Manuel des exercices", go: { fn: "manual" },
    d: "Tous les mouvements rangés par muscle sur une vraie planche d'anatomie, avec une recherche et la démo animée de chacun." },
  { id: "body3d", sec: "train", ic: "🧍", t: "Le corps en 3D", w: "Séances → Manuel → Voir en 3D", go: { fn: "body3d" },
    d: "Fais tourner le corps humain au doigt, zoome, et touche un muscle pour le nommer et voir ses exercices." },
  { id: "intervals", sec: "train", ic: "⏲️", t: "Minuteur d'intervalles", w: "Séances → Minuteur d'intervalles", go: { fn: "intervals" },
    d: "Tabata, EMOM, AMRAP et circuits, guidés à la voix avec la démo de chaque exercice. Rien ne dérive si l'écran se met en veille." },
  { id: "goal", sec: "train", ic: "🎯", t: "Objectif chiffré", w: "Séances → Objectif chiffré", go: { fn: "goal" }, auto: s => (s.goals || []).length > 0,
    d: "« 100 kg au développé couché », « 15 tractions » : l'app vérifie que c'est réaliste et prépare 8 à 12 semaines jusqu'au test final." },
  { id: "classics", sec: "train", ic: "🏛️", t: "Programmes célèbres", w: "Séances → Programmes célèbres", go: { to: "#/train", spot: ".classics" }, auto: s => !!s.classic,
    d: "5/3/1, GZCLP, nSuns et Starting Strength avec leurs vraies règles : chaque série est calculée et le programme avance tout seul." },

  // — En séance —
  { id: "checkin", sec: "live", ic: "😴", t: "Bilan de forme", w: "Au début de chaque séance", go: { start: "today" }, auto: did,
    d: "Sommeil, énergie, courbatures : le coach adapte les charges et le volume à ta forme du jour." },
  { id: "warmup", sec: "live", ic: "🔥", t: "Échauffement et retour au calme", w: "Au début et à la fin de chaque séance",
    d: "Un échauffement adapté à la séance (haut du corps, bas ou complet) est proposé avant de commencer, et un retour au calme à la fin." },
  { id: "overload", sec: "live", ic: "📈", t: "Surcharge progressive expliquée", w: "Aperçu de la séance, en séance et à la fin", auto: did,
    d: "Une rep de plus, puis de la charge quand tu le mérites, selon ton ressenti. L'app dit pourquoi : « haut de la fourchette atteint : +2,5 kg »." },
  { id: "sets", sec: "live", ic: "✅", t: "Valider une série", w: "En séance", auto: did,
    d: "Ajuste les kilos et les reps, valide, puis dis si c'était facile ou dur : la charge et le repos de la série suivante sont recalculés." },
  { id: "rest", sec: "live", ic: "⏳", t: "Minuteur de repos", w: "En séance",
    d: "Le repos se lance tout seul après chaque série. Téléphone verrouillé, une notification te prévient quand c'est reparti." },
  { id: "demo", sec: "live", ic: "▶️", t: "Démos animées en 3D", w: "Bouton ▶ à côté de chaque exercice", go: { fn: "demo" },
    d: "Le corps anatomique fait le mouvement : tourne autour au doigt, ralentis-le, et vois le muscle moteur s'allumer pendant l'effort." },
  { id: "swap", sec: "live", ic: "🔁", t: "Remplacer un exercice", w: "En séance → Coach",
    d: "Machine prise, gêne ou douleur : le coach propose un autre exercice qui travaille les mêmes muscles." },
  { id: "voice", sec: "live", ic: "🎙️", t: "Mains libres", w: "En séance → micro",
    d: "Touche le micro et dis « 8 reps, difficile » ou « Coach, combien de repos ? » : plus besoin de toucher l'écran." },
  { id: "cam", sec: "live", ic: "📷", t: "Caméra : reps et posture", w: "En séance → Caméra, ou Démo → Vérifier ma technique", go: { fn: "cam" },
    d: "Pose le téléphone à 2 ou 3 mètres : il compte tes reps et te signale à voix haute un dos rond ou un bassin qui s'affaisse. Rien n'est envoyé." },
  { id: "video", sec: "live", ic: "🎬", t: "Coach vidéo IA", w: "Démo → Analyse vidéo par l'IA", tag: "IA en ligne", go: { fn: "video" }, auto: s => (s.formChecks || []).length > 0,
    d: "Filme une série : l'IA te donne une note de technique, les corrections image par image et un exercice correctif." },
  { id: "duo", sec: "live", ic: "👯", t: "Duo à distance", w: "En séance → Duo", tag: "Compte en ligne",
    d: "Entraîne-toi avec un ami, chacun chez soi : vous voyez la série de l'autre en direct et pouvez vous encourager." },
  { id: "end", sec: "live", ic: "🎉", t: "Débrief de fin de séance", w: "À la fin de chaque séance", auto: did,
    d: "Tes progrès exercice par exercice, tes records et ton XP, avec les conseils du coach pour la prochaine fois." },

  // — Créer —
  { id: "gen", sec: "create", ic: "✨", t: "Générer en deux touches", w: "Créer → Nouvelle", go: { to: "#/create", spot: "#gen, #g-open" },
    d: "Choisis les muscles, la durée et ton matériel : la séance se compose toute seule, et tu la modifies si tu veux." },
  { id: "compose", sec: "create", ic: "🧱", t: "Composer ta séance", w: "Créer → Nouvelle", go: { to: "#/create", spot: "#tabs" },
    d: "Ajoute des exercices filtrés par muscle et par matériel, puis règle les séries, les reps, le poids et le repos de chacun." },
  { id: "superset", sec: "create", ic: "🔗", t: "Superséries et circuits", w: "Créer → Nouvelle",
    d: "Le bouton « Superset » lie un exercice au suivant, « Circuit » enchaîne toute la séance : le repos tombe à la fin du tour." },
  { id: "mine", sec: "create", ic: "🗂️", t: "Mes séances", w: "Créer → Mes séances", go: { to: "#/create", spot: '#tabs [data-t="mine"]', click: true },
    auto: s => (s.customPrograms || []).length > 0,
    d: "Tes séances enregistrées : les commencer, les modifier, les dupliquer ou les partager avec un ami." },
  { id: "myex", sec: "create", ic: "➕", t: "Tes propres exercices", w: "Créer → Exercices", go: { to: "#/create", spot: '#tabs [data-t="ex"]', click: true },
    auto: s => Object.keys(s.customExercises || {}).length > 0,
    d: "Un mouvement manque ? Crée-le avec son muscle et son matériel : il rejoint la bibliothèque." },

  // — Repas —
  { id: "log", sec: "food", ic: "🥗", t: "Journal des repas", w: "Repas", go: { to: "#/food", spot: ".nut-actions" }, auto: ate,
    d: "Scanne un code-barres, cherche parmi les aliments courants (même hors ligne) ou reprends un repas d'hier en un geste." },
  { id: "describe", sec: "food", ic: "📸", t: "Décrire ou photographier ton assiette", w: "Repas → Décrire, ou Photo", go: { to: "#/food", spot: '.nut-act[data-act="text"]' },
    d: "« 200 g de poulet, du riz et 2 œufs », ou une photo : les aliments et les calories sont estimés, tu vérifies avant d'ajouter." },
  { id: "targets", sec: "food", ic: "🎯", t: "Objectifs nutrition", w: "Repas → Mes objectifs", go: { fn: "targets" },
    d: "Calories, protéines, glucides, lipides, fibres et eau calculés pour ton corps, ton activité et ton objectif. Ou fixés à la main." },
  { id: "dailyadapt", sec: "food", ic: "⚖️", t: "Objectif qui s'adapte chaque jour", w: "Repas → Objectif du jour ajusté", go: { to: "#/food", spot: ".nut-sum" },
    d: "Trop mangé en sèche, ou pas assez en prise de masse ? L'écart est réparti sur les 3 jours suivants, protéines inchangées, et ton plan de repas suit." },
  { id: "learn", sec: "food", ic: "🔬", t: "Comprendre ta nutrition", w: "Repas → Comprendre", go: { to: "#/food", spot: '#nut-tabs [data-tab="learn"]', click: true },
    d: "Ton calcul de calories pas à pas, à quoi servent protéines, glucides, lipides, minéraux et vitamines, et les études sur lesquelles tout repose." },
  { id: "adaptive", sec: "food", ic: "📉", t: "Calories adaptatives", w: "Repas → Poids et dépense", go: { to: "#/food", spot: ".adapt" },
    d: "Donne un poids visé et un rythme : avec tes pesées et tes repas, l'app trouve ta vraie dépense et recalcule ton objectif chaque lundi." },
  { id: "water", sec: "food", ic: "💧", t: "Eau et rappels pour boire", w: "Repas → Eau", go: { to: "#/food", spot: ".water" },
    d: "Un verre ou une bouteille d'un geste, un objectif selon ton poids, et des rappels si tu es en retard." },
  { id: "plan", sec: "food", ic: "🛒", t: "Plan de repas et courses", w: "Repas → Plan de repas", go: { to: "#/food", spot: ".plan-card" }, auto: s => !!s.mealPlan,
    d: "De 1 à 7 jours à tes calories et protéines, selon ton régime et tes goûts, avec la liste de courses rangée par rayon." },

  // — Coach —
  { id: "chat", sec: "coach", ic: "💬", t: "Discuter avec ton coach", w: "Coach", go: { to: "#/coach", spot: "#composer" }, auto: asked,
    d: "Pose n'importe quelle question : il répond avec tes vraies stats (séances, records, programme, repas)." },
  { id: "commands", sec: "coach", ic: "🪄", t: "Il règle l'app pour toi", w: "Coach", go: { to: "#/coach", spot: "#sugg" },
    d: "« Crée une séance pecs de 45 min », « Mets Legs le mercredi », « Passe l'app en bleu » : il le fait, même sans IA." },
  { id: "memory", sec: "coach", ic: "🧠", t: "Il se souvient de toi", w: "Moi → Réglages → Ce que le coach sait de toi", go: { to: "#/profile", spot: "#p-memory" },
    d: "Blessures, matériel, préférences : dis-lui « retiens que… ». Tout reste visible et effaçable." },
  { id: "ai", sec: "coach", ic: "🤖", t: "IA en ligne ou sur ton téléphone", w: "Moi → Réglages → IA intelligente", go: { to: "#/profile", spot: "#llm-box" },
    d: "Avec un compte en ligne, l'IA en ligne répond à tout. Sinon, une IA peut tourner sur ton téléphone, gratuite et privée. Sans elle, le coach simple répond hors ligne." },
  { id: "coaches", sec: "coach", ic: "🦸", t: "Choisir ton coach", w: "Moi → Réglages → Ton coach", go: { fn: "coaches" },
    d: "Des dizaines de personnages originaux, chacun avec sa façon de bouger. Ou aucun personnage, pour une app sobre." },

  // — Progrès —
  { id: "calendar", sec: "progress", ic: "🗓️", t: "Calendrier et volume", w: "Moi → Stats", go: { to: "#/progress?t=me", spot: ".cal-card" },
    d: "Tes jours d'entraînement du mois, et ton volume semaine par semaine comparé à ta moyenne." },
  { id: "curves", sec: "progress", ic: "📈", t: "Courbes de force", w: "Moi → Stats",
    go: { to: "#/progress?t=me", spot: "#fc", miss: "Tes courbes de force apparaissent après quelques séances avec des charges." },
    d: "Ton 1RM estimé (la charge maximale sur une répétition) sur les grands mouvements, de 3 mois à tout ton historique." },
  { id: "records", sec: "progress", ic: "🥇", t: "Mur des records", w: "Moi → Stats",
    go: { to: "#/progress?t=me", spot: ".rw", miss: "Tes records apparaissent après ta première séance." },
    d: "Ta meilleure charge par exercice, ton niveau de force (de Débutant à Élite) et le prochain palier à viser." },
  { id: "cycle", sec: "progress", ic: "🔁", t: "Cycle de 7 semaines", w: "Moi → Stats",
    go: { to: "#/progress?t=me", spot: "#cycle-card", miss: "Ton premier cycle démarre avec ta première séance." },
    d: "Volume, force, pic, puis une semaine allégée : les répétitions et le ressenti visé suivent le bloc, et tes charges montent d'un bloc à l'autre." },
  { id: "load", sec: "progress", ic: "⚖️", t: "Charge d'entraînement", w: "Moi → Stats",
    go: { to: "#/progress?t=me", spot: ".load-card", miss: "Ta charge d'entraînement apparaît après ta première séance." },
    d: "Ta semaine comparée à tes 4 semaines d'avant, pour progresser sans monter trop vite : une hausse brutale augmente le risque de blessure." },
  { id: "balance", sec: "progress", ic: "🧭", t: "Équilibre musculaire", w: "Moi → Stats",
    go: { to: "#/progress?t=me", spot: "#bal-card", miss: "L'équilibre musculaire apparaît après ta première séance." },
    d: "Tes séries par muscle et par semaine, les muscles en retard, les déséquilibres (pousser / tirer, avant / arrière des cuisses) et une séance de rattrapage en un geste." },
  { id: "bodylog", sec: "progress", ic: "📏", t: "Poids et mensurations", w: "Moi → Stats → Corps", go: { to: "#/progress?t=me", spot: "#body-add" }, auto: s => (s.body || []).length > 0,
    d: "Note ton poids et tes tours (taille, poitrine, bras, cuisses) : la courbe montre ta transformation." },
  { id: "photos", sec: "progress", ic: "🤳", t: "Photos avant / après", w: "Moi → Stats → Corps", go: { to: "#/progress?t=me", spot: "#ph-card" },
    d: "Face, profil, dos : ta photo précédente s'affiche en transparence pour refaire la même, puis compare au curseur. Elles restent sur ton téléphone." },
  { id: "history", sec: "progress", ic: "🕑", t: "Historique des séances", w: "Moi → Stats → Historique", auto: did,
    go: { to: "#/progress?t=me", spot: "#hist", miss: "Ton historique se remplit dès ta première séance." },
    d: "Chaque séance avec ses séries, à rouvrir, partager en image ou supprimer." },

  // — Amis —
  { id: "friends", sec: "friends", ic: "👥", t: "Amis et classement", w: "Moi → Amis & défis", tag: "Compte en ligne", go: { to: "#/progress?t=friends", spot: "#friends" },
    d: "Ajoute un ami par son pseudo : classement de la semaine, défi commun et fiche de chacun. Un ami ne voit que ton résumé." },
  { id: "duels", sec: "friends", ic: "⚔️", t: "Duels", w: "Moi → Amis & défis", tag: "Compte en ligne", go: { to: "#/progress?t=friends", spot: "#friends" },
    auto: s => (s.duels || []).length > 0 || (s.duelLog || []).length > 0,
    d: "Défie un ami sur une semaine (volume, séances, minutes ou records) et suivez le score en direct jusqu'au dimanche soir." },
  { id: "league", sec: "friends", ic: "🏅", t: "Ligues et saisons", w: "Moi → Amis & défis", go: { to: "#/progress?t=friends", spot: "#friends" },
    d: "Des saisons de 4 semaines où chacun marque les mêmes points (séances, minutes, records) : monte de Bronze jusqu'à Légende." },
  { id: "sharecard", sec: "friends", ic: "📲", t: "Partager ta séance en image", w: "Fin de séance, ou Moi → Stats → Historique",
    d: "Une image au format story avec ton coach, ta séance, ton volume et tes records, prête pour Instagram, WhatsApp ou Messages." },
  { id: "sharelink", sec: "friends", ic: "🔗", t: "Envoyer une séance à un ami", w: "Créer → Mes séances", tag: "Compte en ligne",
    d: "Partage une de tes séances : la personne qui ouvre le lien l'ajoute à ses séances en un geste." },

  // — Réglages —
  { id: "program", sec: "settings", ic: "🗓️", t: "Ton programme", w: "Moi → Réglages → Mon programme", go: { to: "#/profile", spot: "#days" },
    d: "Objectif, séances par semaine, matériel et cycles de 7 semaines (avec la semaine allégée). Après un changement, « Régénérer mon programme » refait ta semaine." },
  { id: "quiz", sec: "settings", ic: "🧭", t: "Refaire le quiz", w: "Moi → Réglages", go: { to: "#/profile", spot: "#quiz-again" },
    d: "Niveau, durée de séance, zones à cibler, gênes : refais le quiz d'accueil pour un programme encore plus personnalisé." },
  { id: "remind", sec: "settings", ic: "🔔", t: "Rappels et notifications", w: "Moi → Réglages → Rappels", go: { to: "#/profile", spot: "#rem-time" },
    d: "Un rappel avant chaque séance, la fin du repos écran verrouillé, les défis de tes amis… ou tes séances dans ton calendrier." },
  { id: "look", sec: "settings", ic: "🎨", t: "Apparence", w: "Moi → Réglages → Apparence", go: { to: "#/profile", spot: ".swatches" },
    d: "Huit couleurs, un fond sombre, noir ou clair, et trois tailles de texte. Ou demande au coach « mode clair »." },
  { id: "lang", sec: "settings", ic: "🌍", t: "Langue", w: "Moi → Réglages → Apparence", go: { to: "#/profile", spot: "#lang" },
    d: "L'app en français ou en anglais : les écrans, la voix du coach et l'IA suivent." },
  { id: "sound", sec: "settings", ic: "🔊", t: "Voix, sons et personnages", w: "Moi → Réglages → Coach & sons", go: { to: "#/profile", spot: "#p-voice" },
    d: "Les consignes à voix haute, les bips de repos, et la mascotte que tu peux masquer pour une app plus sobre." },
  { id: "lock", sec: "settings", ic: "🔐", t: "Code et Face ID", w: "Moi → Réglages → Compte", go: { to: "#/profile", spot: "#p-pinlock" },
    d: "Ton code à chaque ouverture si tu veux, et Face ID ou Touch ID pour ouvrir l'app d'un regard." },
  { id: "data", sec: "settings", ic: "📦", t: "Importer et exporter", w: "Moi → Réglages → Données", go: { to: "#/profile", spot: "#imp" },
    d: "Récupère tes séances de Strong, Hevy ou Fitbod et tes repas de MyFitnessPal, et exporte une sauvegarde complète." },
  { id: "feedback", sec: "settings", ic: "💡", t: "Une idée ? Un souci ?", w: "Moi → Réglages", go: { fn: "feedback" },
    d: "Écris-nous directement depuis l'app : chaque message est lu." },
];

// Ce que l'utilisateur a déjà découvert : lu dans le guide (son identifiant), vraiment utilisé (« used:… », événement
// « greatness:used ») ou vu dans ses données. Les étapes de « Bien démarrer » ne se cochent que par un vrai usage.
export const seenSet = s => new Set(s.guide?.seen || []);
export const isFound = (it, s, seen = seenSet(s)) => seen.has(it.id) || seen.has(`used:${it.id}`) || !!it.auto?.(s);

// Les cinq étapes, cochées ou non, et la prochaine à faire
export function starter(s, seen = seenSet(s)) {
  const steps = STARTER.map(st => ({ ...st, ok: !!st.done(s, seen) }));
  const n = steps.filter(x => x.ok).length;
  return { steps, n, total: steps.length, next: steps.find(x => !x.ok) || null, all: n === steps.length };
}

// Fonctions découvertes sur tout le guide
export function found(s, seen = seenSet(s)) {
  return { n: ITEMS.filter(it => isFound(it, s, seen)).length, total: ITEMS.length };
}

// La carte « Bien démarrer » de l'Accueil : pour les comptes récents, tant que les étapes ne sont pas faites
export const showStarter = (s, st = starter(s)) => !s.guide?.hide && !st.all && (s.sessions || []).length < 20;

// Recherche tolérante (accents, majuscules) dans le titre, l'explication et l'emplacement ; tr traduit (version anglaise)
const fold = x => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// (« scanner » trouve « Scanne », « rappel » trouve « Rappels » : on cherche le radical du mot)
const stem = w => (w.length > 4 ? w.replace(/(ements?|ations?|ment|eurs?|euses?|ers?|ez|es|e|s)$/, "") : w);
// en début de mot (« eau » ne trouve pas « niveau »)
const starts = (hay, w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(hay);
export function search(q, tr = x => x) {
  const words = fold(q).split(/[\s,;.!?'’-]+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return ITEMS.filter(it => {
    const hay = fold([it.t, it.d, it.w, it.tag].filter(Boolean).flatMap(x => [x, tr(x)]).join(" "));
    return words.every(w => starts(hay, w) || (stem(w).length >= 3 && starts(hay, stem(w))));
  });
}
