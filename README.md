# GREATNESS 🕷️

App d'entraînement avec **Spider-Man comme coach** : il se balade sur l'écran, te donne les consignes et ajuste ta séance **en temps réel**. Design sombre et épuré, avec des touches Spider-Man (fines toiles, emblème, accents rouge/bleu).

👉 **https://raykatsu.github.io/GREATNESS/** — à ajouter à l'écran d'accueil du téléphone.

## Le coach Spider-Man

- **Animé** : il marche sur les bords de l'écran, se balance d'un côté à l'autre au bout de sa toile, pend la tête en bas pendant tes repos, fait un salto quand tu bats un record. Tu peux le toucher ou le faire glisser (il relance une toile vers le bord le plus proche).
- **Parle** via des bulles et en voix française.
- **Gratuit et hors ligne** : tout le coaching tourne sur le téléphone, sans IA payante.

| Moment | Ce que fait le coach |
|---|---|
| Avant la séance | Check-in (sommeil, énergie, courbatures) → charges et volume adaptés à ta forme |
| Début d'exercice | Objectif calculé depuis ton historique (double progression), consigne technique, charges d'échauffement |
| Après chaque série | Reps + ressenti (RPE) → charge, objectif et repos de la série suivante ajustés |
| Fatigue | Retire des séries si la fatigue monte, conseille d'arrêter si le réservoir est vide |
| Douleur | Arrêt immédiat + exercice de remplacement |
| Fin | Débrief, progrès par exercice vs dernière fois, records, XP et rangs |
| Chat | Répond sur la technique de chaque exercice, la nutrition, le sommeil, les plateaux, ton bilan… en utilisant tes vraies stats |

## Comptes

Chaque personne crée son compte avec un **pseudo** et un **code secret de 4 à 6 chiffres**, à taper à chaque ouverture de l'app (pavé numérique). Chaque compte a ses propres séances, stats, programme et réglages.

- **Par défaut** : comptes enregistrés sur l'appareil (plusieurs personnes peuvent partager un téléphone).
- **En ligne** : avec un projet Supabase gratuit, chacun retrouve son compte sur n'importe quel téléphone. Mise en place : voir [SUPABASE.md](SUPABASE.md).

## IA en ligne

Avec les comptes en ligne, le coach répond grâce à **Gemini** (Google, gratuit) via une fonction Supabase : réponses en flux, recherche Google, et il connaît tout ton compte (séances, records, programme, mensurations, notes). Il fait aussi le débrief de fin de séance. Mise en place : SUPABASE.md, section « IA en ligne » (GitHub Actions déploie la fonction et vérifie que Gemini répond).

## IA intelligente locale

Dans l'onglet Coach (ou Profil), **« Activer l'IA »** télécharge une fois un modèle **Qwen** qui tourne directement dans le navigateur (WebGPU) : gratuit, privé, hors ligne. Il répond à n'importe quelle question en s'appuyant sur le profil, le programme, les records et les dernières séances de l'utilisateur, et écrit le débrief de fin de séance. Trois tailles : Léger (≈ 0,6 Go, conseillé sur téléphone), Équilibré (≈ 1,4 Go, téléphone très récent), Puissant (≈ 2,6 Go, ordinateur). Si un chargement plante (mémoire du téléphone), l'app ne relance pas en boucle et propose le modèle plus petit. Sans WebGPU, le coach simple prend le relais.

## Nutrition (onglet Repas)

Un journal alimentaire façon MyFitnessPal, relié au coach :
- **Objectifs du jour calculés** pour toi (métabolisme de base Mifflin-St Jeor × activité + tes séances, ajusté à ton objectif : sèche, prise de muscle…), ou fixés à la main ; calories, protéines, glucides, lipides, fibres et eau.
- **Scanner de code-barres** : la caméra lit le code (détecteur natif, ou la bibliothèque libre ZXing sur iPhone) et va chercher le produit dans **Open Food Facts** (plus de 3 millions de produits, Nutri-Score compris). Produit inconnu : on recopie l'étiquette une fois, il est reconnu ensuite.
- **Recherche** : 365 aliments courants disponibles hors ligne (plats du monde compris), tolérante aux fautes de frappe et aux pluriels (« bananne », « yogourt »), plus les produits de marque d'Open Food Facts ; portions intelligentes (« 2 œufs », « 1 bol »).
- **N'importe quel aliment avec l'IA** : « Demander à l'IA » donne les valeurs pour 100 g d'un aliment, d'un plat ou d'une boisson introuvable (et ses variantes) ; l'app le retient pour la prochaine fois. Les estimations de repas (texte, photo) s'appuient sur les valeurs de référence de la base quand l'aliment y est.
- **Décrire ou photographier son assiette** : l'IA en ligne estime les aliments, les quantités et les calories ; tu vérifies avant d'ajouter. Hors ligne, la description est lue par l'app (« 200 g de poulet, du riz et 2 œufs »).
- Repas du jour, eau, « comme hier », repas enregistrés, ajout rapide, historique sur 7 jours, carte sur l'accueil.
- Le coach connaît ta nutrition (objectifs, aujourd'hui, moyenne de la semaine) et peut en tenir compte dans ses conseils ; « combien de calories dans… » répond même hors ligne.
- **Calories adaptatives** : un poids visé et un rythme (−1 à +0,5 kg par semaine). La tendance du poids est lissée (les variations d'eau ne comptent pas) ; avec tes repas notés, l'app en déduit ta **vraie dépense** (1 kg ≈ 7 700 kcal) et recalcule ton objectif chaque lundi, avec des garde-fous (jamais sous le métabolisme de base). Carte « Poids et dépense » : courbe, pesée du jour, semaines restantes.
- **Hydratation** : objectif d'eau selon ton poids (+0,5 L les jours d'entraînement), verres et bouteille d'un geste, **rappels pour boire** en notification si tu es en retard (plage horaire et fréquence au choix, silencieux une fois l'objectif atteint).
- **Plan de repas et liste de courses** : de 1 à 7 jours, à tes calories et protéines, selon ton régime (végétarien, sans porc, sans lactose, sans gluten, petit budget, rapide) et tes goûts. L'IA en ligne compose des repas variés ; hors ligne, l'app assemble des repas simples ajustés au gramme près. Chaque repas s'ajoute au journal d'un geste ; la liste de courses (quantités crues, par rayon) se coche, se complète et se partage.

## Le coach IA agit, retient et fait le bilan

- **Il agit dans l'app** : avec l'IA en ligne, le coach peut créer une séance sur mesure, refaire ton programme de la semaine, changer ton objectif, fixer la charge d'un exercice pour la prochaine séance ou noter un repas. Il le propose en boutons sous sa réponse, tu valides d'un geste (« Tout appliquer » fait tout dans l'ordre).
- **Il se souvient de toi** : blessures, matériel, préférences, contraintes. Il retient tout seul ce qui compte, ou quand tu lui dis « retiens que… » (même hors ligne). Tout est visible et effaçable dans Moi → Réglages → « Ce que le coach sait de toi ».
- **Bilan de la semaine** : le dimanche soir et le lundi, une carte sur l'accueil te donne ta note sur 100, tes séances, ton volume, tes records, les muscles travaillés, ta nutrition et ton poids, tes points forts et ce qu'il faut travailler. L'IA en ligne écrit une analyse détaillée et propose les ajustements (programme, charges) en boutons. Les derniers bilans restent dans Progrès.
- **Coach pendant la séance** : bouton « Coach » entre deux séries. « Trop facile », « Trop dur » ajustent la charge de la série suivante tout de suite ; « Gêne ou douleur », « Machine prise » proposent une alternative ; une question libre part à l'IA en ligne, qui connaît ta séance en cours et peut changer la charge d'un geste.

## La caméra corrige ta posture

Bouton **Caméra** en séance (et « Vérifier ma technique » dans chaque démo) : pose le téléphone à 2-3 m, de profil. En plus de compter les reps, elle surveille ta technique et le coach te le dit à voix haute, avec le segment fautif en rouge et la ligne à retrouver en pointillés :
- **dos rond** (soulevé de terre, roumain, good morning, rowing penché), **buste trop penché** (squat, fentes), **genoux trop pliés** au roumain ;
- **bassin qui s'affaisse ou fesses trop hautes** (pompes, gainage), **coudes qui bougent** et **élan du buste** (curls, extensions, élévations, tirages), **dos cambré** au développé militaire ;
- **amplitude incomplète** (conseil propre à chaque mouvement) et **reps trop rapides**.

À la fin : « Technique 80 % (8/10 reps propres) » et le conseil principal. Le gainage et la chaise sont chronométrés seulement quand tu es en position, avec le temps passé en bonne posture. Tout est calculé sur le téléphone (MediaPipe), rien n'est envoyé.

## Progrès en images

- **Courbes de force** : 1RM estimé de tes exercices principaux (et le total squat + développé couché + soulevé de terre), records en doré, tendance en kg par mois, sur 3 mois, 6 mois, 1 an ou tout.
- **Mur des records** : une carte par exercice avec ta meilleure charge, ton 1RM estimé, ta progression depuis le début, ton **niveau de force** (Débutant → Élite, repères selon ton poids de corps) et le prochain palier ; « 2 plaques » au-delà de 100 kg à la barre.
- **Photos avant / après** : face, profil, dos. Le **cadrage fantôme** affiche ta photo précédente en transparence avec un retardateur, pour refaire exactement la même. Comparaison au curseur ou côte à côte, avec l'évolution du poids et du tour de taille, et une image avant/après à partager. Les photos restent sur le téléphone, jamais en ligne.

## Défis entre amis

Moi → **Amis & défis** :
- **Duels 1 contre 1** à la semaine : volume, séances, minutes ou records. Ton ami reçoit l'invitation, la relève, et vous suivez le score en direct jusqu'au dimanche soir ; ton palmarès (victoires, défaites) se remplit.
- **Fil d'actus** : un ami te dépasse au classement, bat un record, te défie, accepte ton duel ; résultats de ton duel et du défi de la semaine passée. Pastille sur l'onglet Moi et carte sur l'accueil.
- **Notifications**, même app fermée : « Léo te défie en duel », « Léo t'a dépassé », « Dernières heures du duel » (jamais la nuit, 3 par jour au plus). À activer dans Moi → Réglages → Notifications.
- **Ligues et saisons** : une saison dure 4 semaines. Chaque semaine rapporte des points, les mêmes pour tous quel que soit l'entraînement (20 par séance, 1 par tranche de 2 minutes, 15 par record, 25 pour le défi de la semaine réussi). En fin de saison, le premier tiers du classement entre amis monte d'une division (Bronze, Argent, Or, Platine, Diamant, Légende), le dernier tiers descend, sauf avec un minimum d'activité. Seul, on monte en atteignant le palier de sa division. Notifications : « Léo te passe devant en ligue », et le dernier jour de la saison si tu es en zone de descente ou juste derrière la montée.

## Démos des exercices

Un petit bouton **▶ Démo** à côté de chaque exercice (aperçu des séances, création, sélecteur, séance en cours, fiche exercice) ouvre une démonstration pour débutants : animation en grand, l'étape en cours écrite en direct, ralenti et pause, mise en place, respiration, points clés et erreurs à éviter.

Chacun des **183 exercices a son propre dessin**, pas un bonhomme en bâton :

- **un vrai corps** aux proportions humaines (os de longueur fixe : le corps ne se déforme jamais), animé de profil, de face, de dos ou de dessus selon ce qui montre le mieux le geste ;
- **le matériel** : barre et disques, haltères, kettlebell, bancs plats ou inclinés, machines (presse, leg extension, leg curl, pec deck, poulies et câbles), barre de traction, barres de dips, box, élastiques, rouleau, tapis, vélo, rameur, tapis de course… ;
- **les muscles** qui travaillent dessinés sur le corps (rouge : principaux, orange : secondaires), et une **carte du corps face / dos** avec la légende ;
- **des repères** : trajectoire de la barre, « cuisses parallèles », dos plat, angle du genou ou du coude, articulation qui reste fixe, flèche du mouvement ;
- les mouvements en boucle (course, corde à sauter, burpees, rameur…) déroulent leurs étapes une à une.

Des **mouvements humains et fidèles** : chaque articulation suit une courbe douce et plie toujours dans le bon sens (des tests vérifient les amplitudes d'un vrai corps sur tout le mouvement), le corps garde son **équilibre** (centre de gravité au-dessus du milieu du pied, barre de soulevé de terre sur une trajectoire verticale), et le **tempo** est celui d'une vraie répétition : la phase d'effort va plus vite que la phase freinée.

## Minuteur d'intervalles

Onglet Séances → **Minuteur d'intervalles** : **Tabata** (20 s / 10 s × 8), **EMOM** (tes répétitions au début de chaque minute), **AMRAP** (le plus de tours possible dans le temps donné) et **circuits** (chaque exercice en temps, repos entre les tours), avec des préréglages et tes propres exercices.
- Écran plein écran : grand compte à rebours, couleur selon la phase (préparation, effort, repos), **démo animée** de l'exercice en cours, exercice suivant, compteur de tours en AMRAP.
- **Guidé à la voix** : annonce de chaque exercice et du repos, bips 3-2-1, mi-temps et dernière minute ; vibrations.
- Le temps se lit sur l'horloge : rien ne dérive si le téléphone se met en veille. Pause, passer (le temps passé ne compte pas comme du travail fait), recommencer le segment.
- La séance rejoint l'historique (temps d'effort, XP, succès) sans fausser tes records ; la carte de récupération et le coach en tiennent compte.

## Objectifs chiffrés (8 à 12 semaines)

Onglet Séances → **Objectif chiffré** : « Développé couché : 100 kg », « Tractions : 15 reps », « Gainage : 3 min ».
- Ton niveau actuel est mesuré d'après tes séances (1RM estimé avec le ressenti), et l'app te conseille un objectif **réaliste** pour la durée choisie (8, 10 ou 12 semaines) ; ambitieux ou très ambitieux, elle te le dit.
- Le programme se construit semaine par semaine : volume, force, intensité, une semaine allégée toutes les 4, affûtage, puis le **test final**.
- Les charges prescrites s'appliquent **dans tes séances habituelles** dès que l'exercice y figure, ou dans la séance de la semaine proposée par l'objectif (avec des exercices d'appoint adaptés à ton matériel). Elles se recalent toutes seules : séries manquées, elles baissent un peu ; réussies avec de la marge, elles montent.
- **Test final** : montée en charge préparée (50, 70, 80, 90 %) puis la tentative, et un deuxième essai plus lourd si c'est réussi ; pour les répétitions ou le temps, une série d'échauffement puis le maximum. Résultat en fin de séance, succès « Objectif atteint ».
- Suivi : carte sur l'accueil (semaine, prescription, avance ou retard), courbe prévue et niveau mesuré à chaque séance.

## Apple Santé

**Moi → Réglages → Données → Apple Santé** : un Raccourci iOS (créé en 5 minutes grâce au pas-à-pas de l'app, puis lancé tout seul chaque matin et chaque soir) envoie ton **sommeil**, ta **variabilité cardiaque (VFC)**, ta **fréquence cardiaque au repos**, tes **pas**, ton **poids** et ton **énergie active**.
- Le **bilan de forme** avant chaque séance est prérempli : sommeil d'après la nuit, énergie d'après la VFC et la fréquence au repos comparées à **tes** valeurs habituelles (médiane des 30 derniers jours). Tu peux toujours ajuster.
- Carte **« Forme du jour »** sur l'accueil ; tes pesées rejoignent la courbe de poids (les calories adaptatives deviennent plus justes) ; le coach IA en tient compte (« VFC basse, on allège »).
- Adresse personnelle secrète (stockée hachée), à renouveler ou délier à tout moment ; délier efface les mesures reçues.

## Importer et exporter

**Moi → Réglages → Données** :
- **Importer depuis une autre app** : exports CSV de **Strong**, **Hevy**, **Fitbod** (séances, séries, charges, RPE, durées), **MyFitnessPal** (repas et pesées) ou une sauvegarde GREATNESS. Les exercices anglais sont reconnus avec leur matériel (« Bench Press (Dumbbell) » → Développé haltères) ; un exercice inconnu devient un exercice perso. Livres converties en kilos, échauffements ignorés, records recalculés, et réimporter le même fichier ne crée aucun doublon. Les séances importées comptent pour ton historique, tes records et ton rang, pas pour la ligue ni les défis entre amis.
- **Exporter mes données** : sauvegarde complète (.json, à réimporter), séances en CSV au format Strong (lisible par Hevy, Strong, Excel, Numbers) et journal alimentaire en CSV. Sur iPhone : « Enregistrer dans Fichiers », mail, AirDrop…

## Récupération musculaire

Une **carte du corps** (face et dos) sur l'accueil montre chaque muscle travaillé cette semaine, de rouge (à reposer) à vert (récupéré). Elle est calculée d'après tes séances : chaque série laisse une fatigue sur ses muscles (plus forte quand la série est dure), qui s'efface avec le temps, plus vite pour les petits muscles que pour les gros. Le détail donne, muscle par muscle, le pourcentage de récupération, le délai avant d'être prêt et les séries de la semaine (repère : 10 à 20).

Le coach s'en sert : une séance qui tombe sur un muscle pas encore remis est **allégée automatiquement** (une série de moins, charge un peu réduite) et il te prévient ; le coach IA connaît aussi ta récupération.

## Personnages

22 coachs à choisir (Héros, Manga, Mignons, Animaux), dont **Harley Quinn**. Pour une app sobre : **Moi → Réglages → Personnages** (ou « Aucun personnage » dans la galerie) masque la mascotte et les visages ; le choix est gardé sur le compte et sur l'appareil, même avant la connexion.

## Onglet Créer

L'atelier pour ses propres séances : **183 exercices** (barres, haltères, machines, poulies, Smith, kettlebell, élastiques, cardio, mobilité), filtres par muscle et matériel, réglage de chaque exercice (séries, reps, poids, repos), générateur automatique (groupes musculaires + durée + matériel), « Mes séances » (commencer, modifier, dupliquer, supprimer) et création de ses propres exercices.

## Le coach agit sur l'app

En plus de répondre aux questions, le coach exécute les demandes, même sans IA :
« Crée une séance pecs triceps de 45 min », « … pour samedi », « Mets Legs le mercredi », « Passe à 4 séances par semaine », « Change mon objectif en sèche », « Passe l'app en bleu », « Mode clair », « Agrandis le texte », « Désactive la voix », « Lance la séance du jour », « Ajoute curl marteau à ma séance … »…

Apparence réglable aussi dans Profil : 8 couleurs, fond sombre / noir / clair, 3 tailles de texte.

## Entraînement avancé

- **Superséries et circuits** : lie deux exercices dans l'onglet Créer (« Superset avec le suivant ») ou passe toute la séance « en circuit » ; le coach enchaîne sans repos et met le repos à la fin du tour. HIIT et Corde sont en circuit.
- **Séance libre** : démarre sans programme et ajoute les exercices au fur et à mesure.
- **Sauvegarde continue** : si le téléphone ferme l'app, la séance est proposée à la reprise.
- **Calculateur de disques** sous le poids (barre de 20 kg).
- **Notes** par exercice (réglages de machine…) et par séance.
- **Corps** : poids et mensurations avec courbe (onglet Progrès).
- **Cycles** : semaine allégée automatique toutes les 7 semaines ; plateau détecté après 3 séances sans progrès → recul de 10 % pour relancer.
- **Succès** : 20 badges à débloquer.
- **Rappels** : vraies notifications les jours de séance et pour les défis entre amis (Web Push via Supabase, voir SUPABASE.md), ou ajout au calendrier du téléphone (.ics).
- **Mains libres** : touche le micro en séance et dis « 8 reps, difficile », « 10 à 60 kilos », « annule », « passe », « go ».
- **Caméra** : compte tes reps et corrige ta posture (voir plus haut).
- **Animations** : chaque exercice est montré par un petit bonhomme animé (technique en séance, fiche exercice, onglet Créer).
- **Synchro sans perte** : un compte utilisé sur deux téléphones fusionne les séances des deux côtés.

## Social (comptes en ligne)

Moi → **Amis**  : ajouter un ami par son pseudo, classement de la semaine (volume, séances, série, XP), défi de la semaine commun, fiche de chaque ami (records, dernières séances). Un ami ne voit que ton résumé public, et seulement une fois l'amitié acceptée des deux côtés. **Partager** une séance perso crée un lien : la personne qui l'ouvre l'ajoute à ses séances en un clic. Nécessite `supabase/002_social.sql` (voir SUPABASE.md).

## Fonctionnalités

- **22 coachs animés au choix** (Héros, Manga, Mignons, Animaux), chacun avec sa façon de se déplacer (toile, vol, sauts, ninja, marche) : Moi → Réglages → Ton coach. Ou aucun personnage, pour une app sobre.
- **41 programmes** (Push/Pull/Legs, Haut/Bas, Full body, Bras, Fessiers, Abdos, Maison, Haltères, HIIT, Corde, Mobilité…) et **183 exercices**.
- **Mobilité par zone** : nuque, épaules, dos, hanches, jambes et chevilles, poignets, réveil du matin.
- **Échauffement & souplesse** : échauffement adapté proposé avant chaque séance (haut, bas ou complet) puis enchaîné automatiquement, retour au calme proposé à la fin, souplesse complète, objectif grand écart.
- **Soulager** : séances douces pour le mal de dos, la nuque, les épaules, les genoux, les hanches raides et les poignets (pas un avis médical).
- **Programme de la semaine** généré selon ton objectif (force, muscle, sèche, forme), tes jours dispo et ton matériel. Chaque jour est modifiable.
- **Mes séances** : crée tes propres séances, ou modifie un programme et enregistre-le.
- **Séance en direct** : tableau des séries (précédent / kg / reps), steppers, choix libre de l'exercice, annuler, ajouter une série, remplacer, minuteur de repos compact.
- **Progrès** : calendrier, volume par semaine, courbes de force, mur des records, photos avant/après, historique.
- **Claude (optionnel, payant)** : dans Moi → Réglages → « IA Claude », une clé API Anthropic ajoute des ajustements IA, briefing, débrief et chat libre.

## Tests

```bash
npm install
npm test   # moteur, coach, voix, fusion, compteur et posture, records, duels, ligues, objectifs, minuteur, planning, nutrition, plans de repas, Apple Santé, import/export, SQL (PGlite)
```

Ils tournent aussi automatiquement sur GitHub à chaque modification (`.github/workflows/tests.yml`).

## Lancer en local

```bash
npx serve .          # ou : python3 -m http.server 8080
```

## Structure

```
index.html        squelette, barre d'onglets, emblème
css/style.css     design + animations de Spider-Man
js/app.js         routeur, Accueil, Progrès, Profil, première ouverture
js/train.js       Séances : liste, aperçu modifiable, check-in, sélecteur d'exercices
js/create.js      onglet Créer (atelier de séances, exercices perso)
js/actions.js     actions du coach sur l'app + apparence
js/live.js        séance en direct, repos, fin de séance
js/coach.js       chat avec le coach
js/spidey.js      Spider-Man animé (déplacements, toile, poses, bulles)
js/engine.js      moteur de coaching temps réel
js/brain.js       réponses et débriefs du coach (gratuit, hors ligne)
js/planner.js     programme de la semaine, adaptation à l'objectif
js/data.js        exercices, programmes, rangs
js/store.js       données locales, stats, records
js/auth.js        écran de connexion (comptes, pavé numérique)
js/cloud.js       comptes et synchronisation (Supabase ou appareil)
js/config.js      adresse et clé publique Supabase
js/llm.js         IA locale (WebLLM / Qwen) + llm-worker.js
js/ai.js          intégration Claude (optionnelle)
js/fx.js          voix, sons, petits effets
js/badges.js      succès
js/social.js      amis, classement, défis, partage de séance
js/merge.js       fusion des données entre appareils
js/voice.js       mains libres (reconnaissance vocale)
js/motion.js      types de mouvement + compteur de reps par angles
js/body.js        démos dessinées : corps, matériel, muscles, repères, carte du corps
js/moves.js       les 183 mouvements (positions clés) et leurs consignes
js/anim.js        petites démos animées (vignettes)
js/demo.js        fiche Démo des exercices
js/cam.js         compteur de reps à la caméra (MediaPipe)
js/push.js        abonnement aux notifications de rappel
js/recovery.js    récupération musculaire (+ recovery-ui.js : carte et fiche)
js/food.js        onglet Repas (journal, recherche, scanner, eau, poids)
js/nutrition.js   objectifs, journal, recherche tolérante, aliments appris de l'IA
js/foods.js       les 365 aliments courants
js/adaptive.js    calories adaptatives (tendance du poids, vraie dépense)
js/mealplan.js    plan de repas et liste de courses (+ mealplan-ui.js : écrans)
js/intervals.js   minuteur d'intervalles (+ intervals-ui.js : réglages et écran)
js/goals.js       objectifs chiffrés sur 8 à 12 semaines (+ goals-ui.js : écrans)
js/league.js      ligues et saisons entre amis
js/health.js      Apple Santé : bilan de forme, pesées, contexte du coach (+ health-ui.js : liaison et carte)
js/importer.js    import Strong / Hevy / Fitbod / MyFitnessPal et export CSV (+ import-ui.js : écrans)
sw.js             cache hors ligne + réception des notifications
supabase/schema.sql      comptes en ligne
supabase/002_social.sql  amis, classement, défis
supabase/003_push.sql    notifications de rappel
supabase/functions/reminders/  fonction qui envoie les rappels
supabase/004_ai.sql      limite de messages de l'IA en ligne
supabase/functions/coach/      IA en ligne (Gemini + recherche Google), aliments, plans de repas
supabase/006_water_push.sql    rappels pour boire
supabase/007_league_push.sql   notifications de la ligue entre amis
supabase/008_health.sql        mesures Apple Santé (clé personnelle hachée)
supabase/functions/health/     fonction appelée par le Raccourci iOS
supabase/009_ai_models.sql     état des modèles Gemini partagé (IA plus rapide)
js/online.js      client de l'IA en ligne
tests/                   tests automatiques
```
