# GREATNESS 💪

App d'entraînement avec **un coach animé** à choisir parmi **37 personnages originaux** : il se balade sur l'écran, te donne les consignes et ajuste ta séance **en temps réel**. Design sombre et épuré, accents rouge et bleu.

👉 **https://raykatsu.github.io/GREATNESS/** — à ajouter à l'écran d'accueil du téléphone.

## Le coach animé

- **Animé** : il se déplace à sa façon (il court, sautille, vole, marche, roule en fauteuil ou en skate, grimpe aux murs), se pose pendant tes repos, fait un salto (ou une roue arrière) quand tu bats un record. Tu peux le toucher ou le faire glisser.
- **Parle** via des bulles et à voix haute, en français ou en anglais.
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

## Découvrir GREATNESS (le guide des nouveaux)

- **Carte « Bien démarrer »** sur l'Accueil des comptes récents : cinq premières étapes (première séance, démo d'un exercice, un repas noté, une question au coach, les rappels), cochées d'après ce que l'utilisateur fait vraiment ; masquable, et fêtée une fois tout fait.
- **Le guide** (Moi → Réglages → Découvrir GREATNESS, ou le bouton **?** en haut de chaque onglet, qui l'ouvre sur cet onglet) : 74 fonctions rangées par partie (Accueil, Séances, En séance, Créer, Repas, Coach, Progrès, Amis, Réglages), chacune expliquée en deux phrases avec l'endroit où la trouver. **Essayer** ouvre la fonction (manuel, corps 3D, minuteur, démo…) ; **Me montrer où** ouvre l'écran et fait briller l'élément quelques secondes. Recherche tolérante (« scanner », « 3D », « Face ID »), compteur des fonctions découvertes, gardé sur le compte et réuni entre appareils.
- Le coach y renvoie (« comment marche l'app ? », « ce que tu peux faire pour moi ») et la visite guidée lui laisse la place s'il s'ouvre. Données : `js/guide-data.js` (testées : chaque bouton mène à un écran ou une fonction qui existe) ; affichage : `js/guide.js`.

## Surcharge progressive expliquée

D'une séance à l'autre, chaque exercice progresse tout seul (`progressionOf` dans `js/engine.js`) : double progression
(une rep de plus dans la fourchette, puis de la charge en haut de la fourchette), ajustée au ressenti de la meilleure
série de la dernière fois (facile : on monte de deux crans ; à fond : on consolide ; sous la fourchette : on allège).
Au poids du corps, on ajoute des reps (des secondes), puis l'app propose une variante plus dure (pompes → pompes pieds
surélevés → pompes diamant, rowing inversé → tractions supination → tractions…). Le plateau (3 séances sans progrès)
et les muscles pas encore remis passent avant.
- **Aperçu de la séance** : la charge vraiment prévue d'après ton historique, avec la raison (« Haut de la fourchette
  atteint (10 reps) : +2,5 kg, on repart à 6 reps »).
- **En séance** : la même raison sous « Dernière fois », avant la première série.
- **Fin de séance** : « La prochaine fois », la cible de chaque exercice fait.

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
- **Objectif qui s'adapte au jour le jour** : ton corps fait le bilan sur plusieurs jours, pas sur un repas. En **sèche**, un excès de plus de 100 kcal est réparti sur les 3 jours suivants (ton déficit de la semaine reste intact) ; en **prise de masse**, un manque est rattrapé de la même façon ; en **maintien**, la moitié de l'écart compte. Garde-fous : au plus 350 kcal (et 15 %) par jour, jamais sous le minimum sûr (métabolisme de base + 5 %), protéines inchangées (glucides 75 %, lipides 25 % de l'écart), journée notée à moins de 60 % ignorée (sans doute incomplète). Carte « Objectif du jour ajusté » dans le journal, anneau et macros à jour, accueil, conseils d'avant-séance et coach IA aussi ; désactivable dans Mes objectifs.
- **Le plan de repas suit** : le jour du plan qui tombe aujourd'hui (point sur J1, J2…) est recalculé à l'objectif du jour : féculents, fruits et matières grasses à l'échelle de l'écart, protéines et légumes inchangés, portions servies arrondies (à l'unité, par 5 ou 10 g) au plus juste.
- **Onglet « Comprendre »** (Journal | Comprendre) : **pourquoi tu manges autant**, le calcul pas à pas avec tes chiffres (métabolisme de base avec ta formule, activité, séances, objectif, calories adaptatives, minimum sûr, ajustement du jour) ; pourquoi l'objectif change chaque jour (tes jours d'écart, la règle de ton objectif, les garde-fous) ; à quoi servent **protéines, glucides, lipides, fibres et eau** (ton objectif en g/kg et en %, pourquoi autant, où en trouver) ; **minéraux et vitamines** (calcium, fer, magnésium, potassium, sel, zinc, vitamines D, B12 et C, oméga-3) avec les repères de l'EFSA et de l'OMS selon ton sexe. Chaque affirmation renvoie à son étude (Mifflin 1990, Morton 2018, Helms 2014, Garthe 2011, Schoenfeld 2018, Reynolds 2019, ACSM, ISSN, CIO 2018…) : un nom d'étude ouvre la liste des **24 sources** avec leur DOI. Toucher une barre de macro du journal ouvre son explication. Données : `js/nutri-refs.js` ; calcul : `js/nutriadapt.js` ; écran : `js/nutrilearn.js`.
- **Hydratation** : objectif d'eau selon ton poids (+0,5 L les jours d'entraînement), verres et bouteille d'un geste, **rappels pour boire** en notification si tu es en retard (plage horaire et fréquence au choix, silencieux une fois l'objectif atteint).
- **Plan de repas et liste de courses** : de 1 à 7 jours, à tes calories et protéines, selon ton régime (végétarien, sans porc, sans lactose, sans gluten, petit budget, rapide) et tes goûts. L'IA en ligne compose des repas variés ; hors ligne, l'app assemble des repas simples ajustés au gramme près. Chaque repas s'ajoute au journal d'un geste ; la liste de courses (quantités crues, par rayon) se coche, se complète et se partage.

## Musique : l'app prend les couleurs de ta pochette

- **Ce que joue ton téléphone, tout seul** (Moi → Réglages → Musique, « Ton téléphone ») : c'est le mode par défaut. L'app suit le morceau qui joue, d'où qu'il vienne, et passe de l'un à l'autre sans réglage ; dans l'app iPhone, l'accès à l'app Musique est demandé tout seul, une fois, à l'arrivée sur l'accueil (ou d'un geste depuis la carte « Ta musique, tes couleurs »). Elle lit :
  - **Apple Music** : l'app iPhone lit directement l'app Musique (une autorisation, une fois) ;
  - **stats.fm** : Spotify et Apple Music, par ton profil stats.fm (pseudo ou lien du profil), s'il laisse voir l'écoute en cours ;
  - **Last.fm**, le pont universel : Spotify, Deezer, YouTube Music, Tidal… y envoient ce que tu écoutes ; il suffit de ton pseudo ;
  - **Spotify en direct** : en temps réel, avec lecture, pause et morceau suivant depuis l'app (Premium). Spotify limite cette connexion à 5 comptes par app.

  Le morceau qui joue gagne (sinon le dernier en pause). Apple Music et Spotify en direct sont relus toutes les 5 secondes, stats.fm et Last.fm toutes les 15 secondes.
- **Choix manuel** : un morceau cherché dans le catalogue iTunes, pour l'ambiance.
- **Les couleurs suivent la pochette** : à chaque morceau, l'app tire de la pochette un accent (boutons, anneaux, liens), un deuxième accent pour les dégradés et une couleur d'ambiance pour les lueurs du fond. Une pochette en noir et blanc ne change que l'ambiance. Le texte reste lisible quelle que soit la couleur.
- **L'ambiance du morceau** : au-delà des couleurs, tout le thème suit l'énergie de la musique. Cinq ambiances, d'après le genre du morceau (l'app Musique de l'iPhone le donne, sinon le catalogue iTunes), son tempo (catalogue Deezer) et sa pochette (claire ou sombre, vive ou douce, chaude ou froide) :
  - **Intense** (rock, rap, metal) : angles vifs, titres massifs, mouvements secs, rayures de lumière ;
  - **Festive** (dance, électro, pop, latino) : arrondis généreux, lueurs néon, rebonds, pluie de points lumineux ;
  - **Chill** (soul, R&B, jazz, lo-fi) : formes douces, titres légers, mouvements lents, halos qui flottent ;
  - **Mélancolique** (folk, indie, ballades, ou une pochette sombre sur un tempo lent) : couleurs voilées, lumière tamisée ;
  - **Épique** (musiques de film, classique) : titres espacés, rayons dorés, mouvements amples.

  Pendant que le morceau joue, sa pochette sur la carte « En écoute » et les lueurs du fond battent au tempo. Réglage « Ambiance du morceau » ; l'ambiance est gardée avec les couleurs quand la musique s'arrête.
- **Le décor** : la pochette floutée derrière l'écran, en fondu d'un morceau à l'autre. Couleurs et décor se désactivent chacun.
- **Les couleurs restent** : quand la musique s'arrête, l'app garde la pochette floutée et les couleurs du dernier morceau, y compris à la prochaine ouverture (réglage « Garder les couleurs »).
- **Le mannequin qui danse** : laisse l'app sur l'accueil pendant que ta musique joue ; au bout de 20 secondes sans toucher l'écran (avant le verrouillage automatique de l'iPhone), le corps musclé 3D des démos se lève et danse au tempo du morceau, la pochette floutée derrière lui. L'écran reste allumé pendant la danse, 10 minutes au plus. Ses muscles prennent la couleur de la pochette et pulsent sur chaque temps ; un nouveau pas toutes les deux mesures (balancé et poses de culturiste sur les morceaux lents, pas chassés et « raise the roof » au milieu, sauts sur les morceaux rapides), avec un fondu d'un pas à l'autre. Tempo : celui du morceau (catalogue Deezer, par la fonction `music`), ou **Tape en rythme** (gardé pour ce morceau sur l'appareil), sinon 100 BPM. Un toucher le renvoie. Aussi depuis le bouton de la carte « En écoute » (glisser pour tourner autour). Tout seul seulement sur l'accueil, jamais en séance, ni si le téléphone réduit les animations ; réglage « Le mannequin danse ».
- **Pourquoi relier des comptes** : iOS ne laisse aucune app lire ce que jouent les autres (Spotify, Deezer…). Seule l'app Musique d'Apple se lit directement ; pour Spotify, Deezer, YouTube Music ou Tidal, stats.fm ou Last.fm font le pont, à relier une seule fois.
- **Carte « En écoute »** sur l'accueil et **lecteur pendant la séance** (avec lecture, pause et morceau suivant si Spotify est connecté en direct).
- **Bande-son de la séance** : les morceaux écoutés s'affichent en fin de séance et restent dans l'historique ; chaque série retient le morceau qui passait.
- **Ta chanson de guerre** (Moi → Réglages → Musique) : le morceau qui te galvanise, choisi dans le catalogue ou pris parmi ce qui joue. Juste avant ta série la plus lourde (à 95 % de ton meilleur niveau ou plus) ou une tentative de record, une fois par séance, l'app te le propose : « Lancer » le joue dans Spotify (connecté en direct, Premium), sinon l'ouvre dans Apple Music ou Spotify.
- **Tes morceaux de records** (onglet Progrès) : avec quels sons tu soulèves le plus lourd. Pour chaque morceau, les records battus pendant qu'il passait et l'intensité de tes séries (charge × répétitions, rapportée à ton meilleur niveau sur l'exercice à ce moment-là) comparée à ta moyenne. **Ta playlist de records** : les morceaux qui te portent, à copier, partager ou écouter dans Spotify ou Apple Music.
- Mise en place (clé Last.fm, app Spotify) : [SUPABASE.md](SUPABASE.md), « Musique ». Fonction serveur : `supabase/functions/music` (morceau en cours Last.fm et stats.fm, relais des pochettes, tempo des morceaux).

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

- **Ton cycle** : les 7 semaines du cycle (Volume, Force, Pic, Récupération), la semaine en cours, ce que le bloc change (fourchette de reps, ressenti visé) et le prochain bloc (voir « Cycles de 7 semaines »).
- **Charge d'entraînement** : la charge de la semaine (séries dures pondérées par le ressenti, intervalles compris) face à la moyenne des 4 semaines d'avant, avec 8 semaines en barres. Idéale autour de la moyenne ; en hausse au-delà de 30 % ; **pic** au-delà de 50 %, où le risque de blessure monte (« reste à ce niveau ou allège ») ; en baisse sous 80 %. Il faut au moins 3 semaines d'entraînement sur les 4 d'avant pour comparer : avant, « en rodage ».
- **Équilibre musculaire** : les séries par muscle et par semaine sur 4 semaines (les muscles qui aident comptent pour moitié, les étirements pour rien), avec les repères peu (moins de 5), idéal (10 à 20) et beaucoup (plus de 20). Les déséquilibres sont expliqués en clair : pousser / tirer, quadriceps / ischios, haut / bas du corps. Les muscles en retard sont listés, et le bouton **Séance de rattrapage** construit une séance pour eux (générateur de séance, à ta durée habituelle).
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

**Le corps anatomique en 3D fait le mouvement** : dans la démo, le modèle anatomique (voir « Planche d'anatomie 3D ») exécute l'exercice à la place du dessin, avec son matériel (barre et disques, haltères, kettlebell, banc, barre de traction, barres parallèles, roue abdominale, poulies et câbles, tapis, sièges et dossiers de machine). Les mains sont vraies : poings fermés sur la barre, l'haltère ou la poignée (pouce refermé par-dessus), en pronation, supination ou prise neutre selon l'exercice, à plat au sol aux pompes et au gainage, réunies sur un kettlebell ou un haltère tenu à deux mains. On tourne autour au doigt, on pince pour zoomer, double-toucher pour recadrer. Les muscles ont la couleur de leur rôle, et le muscle moteur s'allume pendant l'effort. Le bouton cube repasse au dessin (choix gardé sur l'appareil) ; sans WebGL ou en mode « économie de données », le dessin reste. Voir plus bas.

Chacun des **183 exercices a son propre dessin**, pas un bonhomme en bâton :

- **un vrai corps en volume** aux proportions humaines (os de longueur fixe : le corps ne se déforme jamais), **ombré en relief** (chaque membre et le tronc reçoivent un dégradé « cylindre » éclairé du haut, qui suit le mouvement image par image), animé de profil, de face, de dos ou de dessus selon ce qui montre le mieux le geste ;
- **le matériel** : barre et disques, haltères, kettlebell, bancs plats ou inclinés, machines (presse, leg extension, leg curl, pec deck, poulies et câbles), barre de traction, barres de dips, box, élastiques, rouleau, tapis, vélo, rameur, tapis de course… ;
- **les muscles** qui travaillent dessinés sur le corps (rouge : principaux, orange : secondaires), qui **s'allument (halo)** pendant l'effort, et une **planche d'anatomie réaliste face / dos** avec la légende : de vrais **rendus 3D** d'un modèle anatomique médical libre (460 muscles, fibres, tendons, os), où chaque groupe musculaire s'allume dans la couleur de son rôle (voir plus bas) ;
- **la biomécanique du mouvement** : la planche colore chaque muscle selon son rôle — **agoniste** (moteur, rouge), **synergiste** (aide, orange), **stabilisateur** (gainage, bleu), **antagoniste** (s'étire et freine, turquoise) —, avec une explication « comment ça marche » (concentrique / excentrique). Pendant l'animation, le muscle agoniste **se contracte en direct** (il s'illumine à l'effort). Voir `js/biomech.js` ;
- **des repères** : trajectoire de la barre, « cuisses parallèles », dos plat, angle du genou ou du coude, articulation qui reste fixe, flèche du mouvement ;
- les mouvements en boucle (course, corde à sauter, burpees, rameur…) déroulent leurs étapes une à une.

Des **mouvements humains et fidèles** : chaque articulation suit une courbe douce et plie toujours dans le bon sens (des tests vérifient les amplitudes d'un vrai corps sur tout le mouvement), le corps garde son **équilibre** (centre de gravité au-dessus du milieu du pied, barre de soulevé de terre sur une trajectoire verticale), et le **tempo** est celui d'une vraie répétition : la phase d'effort va plus vite que la phase freinée.

## Manuel des exercices

Dans **Séances → Manuel des exercices** : toute la bibliothèque des 183 mouvements, à parcourir **par muscle**. Une grille montre chaque muscle sur une **planche d'anatomie réaliste** (face et dos) qui s'éclaire sur le muscle visé ; on touche un muscle pour voir ses exercices (ceux qui le travaillent en premier, puis ceux qui l'aident), et chaque exercice ouvre sa **démo animée** avec la fiche complète (mise en place, mouvement, respiration, points clés, erreurs). Une **recherche** fouille tous les exercices par nom, muscle ou matériel. Tout fonctionne hors ligne et suit la langue de l'app.

## Planche d'anatomie 3D

La planche des muscles (manuel, démos, récupération) vient de **rendus 3D réalistes** d'un modèle anatomique libre :
460 muscles, tendons et os, avec les fibres orientées dans le sens de chaque muscle. Deux vues (face, dos), un corps en
gris et **un masque par groupe musculaire** : l'app allume n'importe quel groupe dans la couleur de son rôle (principal,
aide, stabilisateur, antagoniste, niveau de récupération) en gardant le relief. Images WebP légères (≈ 380 Ko en
tout), mises en cache hors ligne. Les scripts de fabrication (Blender) sont dans `tools/anatomy/`.

**Le corps en 3D** : depuis le manuel, une démo d'exercice ou la carte de récupération, le bouton **Voir en 3D** ouvre
le corps entier qu'on **fait tourner au doigt** (pincer pour zoomer, boutons Face / Profil / Dos, double-toucher pour
recadrer), aux mêmes couleurs que la planche. **Toucher un muscle** le nomme, avec un lien vers ses exercices. WebGL
sans bibliothèque (`js/body3d.js`), ≈ 170 000 triangles, fichier de 3 Mo chargé à la première ouverture puis gardé
hors ligne ; sans WebGL, la planche en images prend le relais.

**Démos animées en 3D** (`js/demo3d.js`) : le corps a un squelette de 31 os (bassin, ventre, poitrine, cou, tête, clavicules, bras, avant-bras, paumes, pouces en trois segments, rangées de phalanges, cuisses, jambes, pieds) placés sur les vrais os du modèle (tête du fémur par ajustement de sphère, genou entre fémur et tibia, articulations des doigts là où deux phalanges se touchent…), et chaque sommet suit deux os avec un poids (les os du squelette d'un seul bloc, les muscles en douceur près des articulations, les tendons de la main au plus près de leur phalange), calculés par `tools/anatomy/export_web.py` et rangés à la fin de `body.bin`. Chaque doigt plie autour de ses propres articulations (les quatre doigts d'un même angle, 24 phalanges « virtuelles » qui partagent la rotation de leur rangée) ; pour une prise, les phalanges plient degré par degré jusqu'à toucher la barre, et le pouce est cherché sur une grille (écart, opposition, rotation, flexions) pour passer par-dessus la barre et se poser sur l'index. L'avant-bras tourne (pronation, supination) pour que les jointures suivent la barre : la vrille se répartit du coude au poignet dans la carte graphique, sans écraser l'avant-bras, et ne dépasse jamais ce que le bras peut faire. Les os passent à la carte graphique en quaternions (moins de 128 vecteurs, le minimum garanti partout). À chaque image, la position dessinée de la démo (angles des os, de profil ou de face) est relevée en 3D (un os raccourci dans le dessin sort du plan), le squelette prend ces directions (bassin et buste d'un bloc, bras et jambes pliés dans leur plan, sans vrille), le corps est posé là où le dessin le pose (chevilles, hanches sur le banc, mains sur la barre…), et la carte graphique déforme les 93 000 sommets. Les 183 mouvements sont vérifiés dans Node : valeurs finies, os de longueur fixe, positions clés (squat, développé couché, pompes, élévations, vue de dessus), mains fermées autour de la barre ou de la poignée (bout des doigts et du pouce contre la barre), à plat au sol aux pompes, prise pronation au soulevé de terre, supination au curl, neutre au farmer.

Modèle : **BodyParts3D** (The Database Center for Life Science, CC BY-SA 2.1 Japan) et **Z-Anatomy** (CC BY-SA 4.0) ;
les images dérivées sont sous CC BY-SA 4.0 (`assets/anatomy/LICENSE.md`), créditées dans l'app.

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

## Version anglaise

L'app s'affiche **en anglais** si le téléphone est en anglais, ou au choix (écran de bienvenue, ou Moi → Réglages → Apparence → Langue). Tout suit : écrans, coach vocal, commandes à la voix, IA (en ligne et locale), recherche d'exercices et d'aliments, carte à partager, notifications du serveur, textes iOS (autorisations caméra, Santé…). Le dictionnaire `js/lang/en.js` traduit les textes français du code (`node scripts/i18n.mjs` dit ce qui manque ; un test vérifie qu'il ne manque rien, un autre ouvre l'app dans un iPhone réglé en anglais).

## Une idée ? Un souci ?

**Moi → Réglages → Une idée ? Un souci ?** : idée, souci ou autre, envoyé directement depuis l'app avec la version et l'écran ouvert, signé de ton pseudo si tu veux une réponse. Hors réseau, il part tout seul au retour de la connexion. L'administrateur de l'app lit les messages **et les plantages** dans **Moi → Réglages → Retours reçus** (voir SUPABASE.md pour devenir administrateur) ; le dépôt étant public, GitHub n'en affiche que le nombre.

## Récupération musculaire

Une **carte du corps** (face et dos) sur l'accueil montre chaque muscle travaillé cette semaine, de rouge (à reposer) à vert (récupéré). Elle est calculée d'après tes séances : chaque série laisse une fatigue sur ses muscles (plus forte quand la série est dure), qui s'efface avec le temps, plus vite pour les petits muscles que pour les gros. Le détail donne, muscle par muscle, le pourcentage de récupération, le délai avant d'être prêt et les séries de la semaine (repère : 10 à 20).

Le coach s'en sert : une séance qui tombe sur un muscle pas encore remis est **allégée automatiquement** (une série de moins, charge un peu réduite) et il te prévient ; le coach IA connaît aussi ta récupération.

## Semaine qui s'adapte

Sur l'accueil, la carte **Le coach adapte ta semaine** propose d'ajuster la semaine en cours, d'un geste (ou « Non merci », qui ne revient pas de la semaine) :

- **Séance manquée** hier ou avant-hier : la faire aujourd'hui si c'est un jour libre, sinon la placer sur le prochain jour libre ; le jour manqué passe en repos.
- **Muscles pas encore remis** pour la séance du jour (au moins deux sous 50 %) : l'échanger avec la prochaine séance de la semaine dont les muscles sont prêts.
- **Grosse semaine** (pic de charge, voir « Charge d'entraînement ») : la séance du jour est allégée, une série de moins par exercice et des charges 5 % plus légères (« Séance allégée » sur la mission et en séance).
- **Jour libre** avec des muscles en retard (voir « Équilibre musculaire ») : une séance de rattrapage de 25 minutes.

Les déplacements ne valent que pour la semaine en cours (`state.weekAdapt`, synchronisé) : le programme type ne change pas. Calcul : `js/weekadapt.js` (testé dans Node).

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
- **Cycles de 7 semaines (périodisation)** : trois blocs de 2 semaines, puis une semaine allégée, en boucle depuis ta première séance.
  - **Volume** : plus de répétitions (le haut de la fourchette de ton objectif, +2), ressenti visé un demi-point plus bas.
  - **Force** : la fourchette de ton objectif.
  - **Pic** : moins de répétitions (le bas de la fourchette, −2), ressenti un demi-point plus haut, 30 s de repos en plus sur les mouvements principaux.
  - **Récupération** : charges et volume réduits.

  La double progression fait monter les charges toute seule quand la fourchette descend. Le bloc est indiqué sur la mission du jour et dans l'aperçu de la séance ; la carte « Ton cycle » (onglet Progrès) montre les 7 semaines, ce qui change cette semaine et le prochain bloc. Réglage : Moi → Réglages → Cycles de 7 semaines. Les programmes célèbres et tes séances perso gardent leurs propres séries.
- **Plateau** : détecté après 3 séances sans progrès → recul de 10 % pour relancer.
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
- **Progrès** : calendrier, volume par semaine, charge d'entraînement, équilibre musculaire, courbes de force, mur des records, photos avant/après, historique.
- **Claude (optionnel, payant)** : dans Moi → Réglages → « IA Claude », une clé API Anthropic ajoute des ajustements IA, briefing, débrief et chat libre.

## Tests

```bash
npm install
npm test               # moteur, coach, voix, fusion, compteur et posture, vitesse de barre, records, duels, ligues, objectifs, minuteur, planning, nutrition, objectif ajusté au jour le jour et onglet « Comprendre », plans de repas, musique (sources, couleurs des pochettes, mannequin qui danse), Apple Santé, import/export, notifications, mode histoire, plantages, préchargement, Face ID, carte à partager, SQL (PGlite)
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
js/balance.js     équilibre musculaire (séries par muscle) et charge d'entraînement (semaine / 4 précédentes)
js/balance-ui.js  cartes « Charge d'entraînement » et « Équilibre musculaire » de l'onglet Progrès
js/weekadapt.js   semaine qui s'adapte : séance manquée, échange, séance allégée, rattrapage (carte de l'accueil)
js/cycle-ui.js    carte « Ton cycle » (périodisation) et note du bloc dans l'aperçu de séance
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
js/biomech.js     biomécanique : rôle de chaque muscle (agoniste/antagoniste/synergiste/stabilisateur) par exercice
js/manual.js      manuel des exercices : bibliothèque par muscle (silhouette) + recherche
js/cam.js         compteur de reps à la caméra (MediaPipe)
js/push.js        abonnement aux notifications de rappel
js/recovery.js    récupération musculaire (+ recovery-ui.js : carte et fiche)
js/food.js        onglet Repas (journal, recherche, scanner, eau, poids)
js/nutrition.js   objectifs, journal, recherche tolérante, aliments appris de l'IA
js/foods.js       les 365 aliments courants
js/adaptive.js    calories adaptatives (tendance du poids, vraie dépense)
js/nutriadapt.js  objectif du jour ajusté aux écarts des 3 jours d'avant, jour du plan de repas recalculé
js/nutrilearn.js  onglet « Comprendre » (le calcul, l'adaptation, les nutriments) ; nutri-refs.js : les études citées
js/music.js       musique : ce que joue le téléphone (automatique : Apple Music, stats.fm, Last.fm, Spotify), choix manuel (+ music-ui.js : écrans)
js/musictheme.js  les couleurs de l'app suivent la pochette (palette.js : couleurs d'une image), décor, couleurs gardées
js/vibe.js        l'ambiance du morceau (genre, tempo, pochette) qui change tout le thème (+ trackinfo.js : genre et tempo)
js/songstats.js   tes morceaux de records : records et intensité par morceau, playlist (+ songs-ui.js : carte et feuille)
js/warsong.js     ta chanson de guerre : le moment (série lourde, record en vue), où l'écouter
js/dance.js       le mannequin qui danse : pas de danse calés sur le tempo, tempo tapé (+ dance-ui.js : écran, veille)
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
js/i18n.js        langue de l'app : français ou anglais (+ lang/en.js : le dictionnaire anglais)
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
