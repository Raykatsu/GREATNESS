# GREATNESS 💪

App d'entraînement avec **un coach animé** à choisir parmi **37 personnages originaux** : il se balade sur l'écran, te donne les consignes et ajuste ta séance **en temps réel**. Design sombre et épuré, accents rouge et bleu.

👉 **https://raykatsu.github.io/GREATNESS/** — à ajouter à l'écran d'accueil du téléphone.

## Le coach animé

- **Animé** : il se déplace à sa façon (il court, sautille, vole, marche, roule en fauteuil ou en skate, grimpe aux murs), se pose pendant tes repos, fait un salto (ou une roue arrière) quand tu bats un record. Tu peux le toucher ou le faire glisser.
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

## Caméra : vitesse de barre et coach vidéo IA

- **Vitesse de barre** : en comptant tes reps à la caméra, l'app mesure la vitesse de chaque poussée (en m/s, comme les capteurs des salles de force), à partir de ta taille et des longueurs de tes segments. Elle affiche la **perte de vitesse** dans la série, te prévient quand il vaut mieux t'arrêter (20 % en force, 35 % en prise de muscle) et **propose ton ressenti (RPE)** d'après la vitesse de la dernière rep. Tout reste sur le téléphone.
- **Coach vidéo IA** (fiche Démo ou bouton « Vidéo IA » en séance) : filme une série ou choisis une vidéo. L'app en extrait une douzaine d'images et l'IA en ligne te donne une note de technique, ce qui est bien, les corrections avec l'image où ça se voit, la consigne à te dire et un exercice correctif. Seules ces images partent à l'analyse ; l'historique des notes est gardé par exercice.

## Fin du repos sur l'écran verrouillé

Tu verrouilles le téléphone pendant un repos : à la seconde où il finit, une notification « Repos terminé : c'est reparti ! » te dit la série suivante (charge et reps). Si tu reviens avant, elle est annulée. Réglage : Moi → Réglages → Rappels. Avec les notifications activées (iPhone : app ajoutée à l'écran d'accueil) ; dans l'app App Store, c'est une notification locale, même sans réseau.

## Version App Store

Le dossier [`app-store/`](app-store/) emballe l'app avec Capacitor et ajoute le natif : Apple Santé lu directement (sans Raccourci), notifications locales (fin du repos, rappels de séance), vibrations. GitHub la construit sur un Mac et l'envoie sur TestFlight, sans Mac chez toi : voir **[APPSTORE.md](APPSTORE.md)**. Suppression définitive du compte dans Moi → Réglages → Compte ; politique de confidentialité : [`privacy.html`](privacy.html).

## Mode histoire et costumes

Carte **« Mode histoire »** sur l'accueil : dix chapitres où ton coach défend la ville contre la Flemme. Chaque chapitre a un objectif tiré de tes vraies séances, à remplir depuis le début du chapitre : 2 séances, 5 000 kg soulevés, un record, une séance au minuteur d'intervalles, 3 jours de repas notés, 2 h d'entraînement, une analyse vidéo de ta technique, 2 séances de mobilité, 3 records, puis 6 séances pour le sommet.
- Chaque chapitre réussi est fêté et débloque un **costume** pour ton coach : bandeau du guerrier, tenue néon, lunettes de star, tenue glace, casquette, tenue de feu, cape de héros, tenue symbiote, médaille d'or, puis la couronne de légende et la tenue en or. « Le porter » l'enfile aussitôt, sur la mascotte comme sur les visages du coach.
- La **garde-robe** (dans le livre de l'histoire) garde tous les costumes gagnés. L'histoire suit ton compte d'un téléphone à l'autre ; les séances importées d'une autre app ne comptent pas.

## Duo à distance

En séance, bouton **Duo** (compte en ligne) : crée un duo et envoie le code de 6 caractères à un ami, ou tape le sien. Chacun s'entraîne chez soi et voit en haut de l'écran où en est l'autre (exercice, série, charge, repos), est prévenu quand il valide une série ou bat un record, et peut l'encourager d'un émoji (🔥 💪 👏). À la fin, l'autre voit ta durée et ton volume. Un duo dure 4 heures au plus ; mise à jour toutes les 4 secondes, seulement pendant la séance.

## Rapide, accessible et surveillé

- **Ouverture plus rapide** : les modules de démarrage sont annoncés au navigateur dès la première ligne de la page (`scripts/preload.mjs` tient la liste à jour, un test vérifie qu'elle l'est) ; les écrans rares (import, coach vidéo) ne se chargent qu'à l'ouverture.
- **Accessibilité** : chaque écran passe l'audit axe-core (WCAG 2.1 AA) en thème sombre, noir et clair : contrastes, noms des boutons et des barres de progression, feuilles utilisables au clavier et au lecteur d'écran, animations coupées avec « Réduire les animations ».
- **Plantages signalés** : une erreur JavaScript sur un téléphone remonte, anonyme (message, fichier et ligne, version, type de navigateur ; aucune donnée d'entraînement), au plus 10 par jour et une seule fois chacune. Elles s'affichent dans le déploiement Supabase (étape « Erreurs signalées par l'app ») et dans l'app pour l'administrateur.
- **Tests dans un iPhone simulé** : à chaque modification, GitHub ouvre l'app dans un iPhone simulé (Chromium) et refait un parcours complet (compte, tous les onglets, une séance jusqu'à la carte à partager, Face ID), le compte en ligne (retours, administrateur, plantages) et l'audit d'accessibilité de chaque écran en thème sombre et clair (`tests/browser/`, `npm run test:browser`).

## Face ID

**Moi → Réglages → Compte → Déverrouiller avec Face ID** (ou Touch ID), proposé aussi après avoir tapé ton code : l'app s'ouvre d'un regard, plus besoin de retaper ton code. Sur le site, c'est une clé d'accès (WebAuthn) créée pour ton compte sur ce téléphone ; dans l'app App Store, la biométrie de l'iPhone. Rien ne quitte le téléphone et le code marche toujours. Avec « Code à chaque ouverture », c'est Face ID qui est demandé à chaque retour dans l'app.

## Carte de séance à partager

À la fin d'une séance (ou depuis l'historique), **Partager ma séance** crée une image au format story : ton coach avec son costume, la séance, la durée, le volume, les séries, tes records et ton XP. Aperçu, puis la feuille de partage de l'iPhone (Instagram, WhatsApp, Messages, Photos…).

## Programmes célèbres

Onglet **Séances → Programmes célèbres** : **5/3/1 de Wendler**, **GZCLP**, **nSuns 5/3/1** et **Starting Strength**, avec leurs vraies règles.
- Tu donnes tes maximums (estimés d'après tes séances, modifiables) ; l'app calcule **chaque série** : charge et reps, « 5+ » pour la série au maximum, annoncée par le coach.
- La séance faite fait **avancer le programme** : semaines du cycle et +2,5 / +5 kg au nouveau cycle (5/3/1), paliers 5×3 → 6×2 → 10×1 (GZCLP), max d'entraînement selon la série « 1+ » (nSuns), +2,5 kg et −10 % après 3 échecs (Starting Strength).
- Ta semaine suit le programme (jours d'entraînement, séance du jour sur l'accueil) ; carte de suivi avec tes maximums ; synchronisé sur tous tes appareils.

## Parler au coach pendant la séance

En séance, **Demander au coach** a un **micro** : pose ta question à voix haute (« J'ai mal à l'épaule, je remplace par quoi ? »), la réponse s'affiche **et se lit à voix haute**. En mode mains libres, commence simplement par « Coach, … » ou par une question (« Combien de repos ? ») : plus besoin de toucher l'écran. Avec l'IA en ligne, le coach connaît la séance en cours et peut proposer une nouvelle charge.

## Dynamic Island et widget (app App Store)

- **Repos dans la Dynamic Island et sur l'écran verrouillé** : le compte à rebours et l'exercice qui suit (série, charge, reps), même téléphone verrouillé ; « C'est reparti ! » à la fin.
- **Widget « Séance du jour »** (écran d'accueil et écran verrouillé) : la séance prévue, ta série de jours, ta semaine ; il change de jour tout seul à minuit.
- Code natif dans [`app-store/native/`](app-store/native/) (Swift), ajouté au projet Xcode par `app-store/ios-widgets.rb`.

## Une idée ? Un souci ?

**Moi → Réglages → Une idée ? Un souci ?** : idée, souci ou autre, envoyé directement depuis l'app avec la version et l'écran ouvert, signé de ton pseudo si tu veux une réponse. Hors réseau, il part tout seul au retour de la connexion. L'administrateur de l'app lit les messages **et les plantages** dans **Moi → Réglages → Retours reçus** (voir SUPABASE.md pour devenir administrateur) ; le dépôt étant public, GitHub n'en affiche que le nombre.

## Récupération musculaire

Une **carte du corps** (face et dos) sur l'accueil montre chaque muscle travaillé cette semaine, de rouge (à reposer) à vert (récupéré). Elle est calculée d'après tes séances : chaque série laisse une fatigue sur ses muscles (plus forte quand la série est dure), qui s'efface avec le temps, plus vite pour les petits muscles que pour les gros. Le détail donne, muscle par muscle, le pourcentage de récupération, le délai avant d'être prêt et les séries de la semaine (repère : 10 à 20).

Le coach s'en sert : une séance qui tombe sur un muscle pas encore remis est **allégée automatiquement** (une série de moins, charge un peu réduite) et il te prévient ; le coach IA connaît aussi ta récupération.

## Personnages

**37 coachs originaux**, tous créés pour l'app (aucun personnage sous licence), qui représentent plein de gens différents : toutes les couleurs de peau, femmes et hommes, jeunes et seniors, toutes les silhouettes, hijab et turban, une sprinteuse sur lame, une basketteuse en fauteuil… et 9 compagnons (robot, bébé dragon, chiot, chat, paresseux, tortue, axolotl, yéti, hibou). Cinq familles : **Salle, Sports, Nature, Zen, Compagnons**. Ils sont dessinés par un petit générateur (`js/chars/kit.js` : peau, silhouette, coiffure, tenue, accessoires). Les anciens choix de coach sont redirigés automatiquement vers le nouveau le plus proche. Pour une app sobre : **Moi → Réglages → Personnages** (ou « Aucun personnage » dans la galerie) masque la mascotte et les visages ; le choix est gardé sur le compte et sur l'appareil, même avant la connexion.

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

- **37 coachs animés originaux** (Salle, Sports, Nature, Zen, Compagnons), chacun avec sa façon de se déplacer (course, vol, sauts, marche, roues, escalade) : Moi → Réglages → Ton coach. Ou aucun personnage, pour une app sobre.
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
npm test               # moteur, coach, voix, fusion, compteur et posture, vitesse de barre, records, duels, ligues, objectifs, minuteur, planning, nutrition, plans de repas, Apple Santé, import/export, notifications, mode histoire, plantages, préchargement, Face ID, carte à partager, SQL (PGlite)
npx playwright install chromium
npm run test:browser   # l'app dans un iPhone simulé : parcours complet, compte en ligne, accessibilité, programmes célèbres, coach vocal
```

Ils tournent aussi automatiquement sur GitHub à chaque modification (`.github/workflows/tests.yml`).

## Lancer en local

```bash
npx serve .          # ou : python3 -m http.server 8080
```

## Structure

```
index.html        squelette, barre d'onglets, icône du coach
css/style.css     design + animations du coach
js/app.js         routeur, Accueil, Progrès, Profil, première ouverture
js/train.js       Séances : liste, aperçu modifiable, check-in, sélecteur d'exercices
js/create.js      onglet Créer (atelier de séances, exercices perso)
js/actions.js     actions du coach sur l'app + apparence
js/live.js        séance en direct, repos, fin de séance
js/coach.js       chat avec le coach
js/mascot.js      coach animé (déplacements, poses, bulles)
js/chars/         les 37 personnages (kit.js : le générateur de dessins ; base.js : Alex, le coach par défaut)
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
js/vbt.js         vitesse de barre à la caméra : vitesse de chaque poussée, perte de vitesse, RPE estimé
js/videocoach.js  coach vidéo IA : images d'une vidéo, analyse de technique, corrections
js/resttimer.js   fin du repos sur l'écran verrouillé (Web Push ou notification locale)
js/native.js      app App Store (Capacitor) : notifications locales, vibrations, Apple Santé direct
js/story.js       mode histoire : chapitres, objectifs, costumes gagnés (+ story-ui.js : carte, livre, fête)
js/costumes.js    les costumes du coach (teintes et accessoires)
js/duo.js         duo à distance : salle, code, état de l'autre, encouragements
js/errors.js      remontée anonyme des plantages
js/version.js     version de l'app (la même que le cache de sw.js)
js/bio.js         Face ID / Touch ID : clé d'accès (WebAuthn) ou biométrie native
js/sharecard.js   carte de séance à partager (image au format story)
js/feedback.js    « Une idée ? Un souci ? » et boîte « Retours reçus » de l'administrateur
js/classics.js    programmes célèbres : séances prescrites et règles de progression (+ classics-ui.js : écrans)
js/widgetdata.js  données du widget « Séance du jour » (app App Store)
app-store/        projet Capacitor (copie du site, réglages iPhone, icônes) ; APPSTORE.md pour publier
app-store/native/ Swift : pont natif, Live Activity du repos, widget (ajoutés par ios-widgets.rb)
scripts/preload.mjs  liste des modules préchargés dans index.html (--check pour vérifier)
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
supabase/010_rest_timer.sql    alertes de fin de repos (écran verrouillé)
supabase/011_account_delete.sql  suppression définitive du compte depuis l'app
supabase/012_duo.sql           salles du duo à distance
supabase/013_errors.sql        plantages signalés par l'app
supabase/014_feedback.sql      retours des utilisateurs, administrateurs de l'app
tests/browser/           tests dans un iPhone simulé (Playwright)
js/online.js      client de l'IA en ligne
tests/                   tests automatiques
```
