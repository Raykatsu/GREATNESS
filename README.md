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

## Fonctionnalités

- **22 programmes** (Push/Pull/Legs, Haut/Bas, Full body, Bras, Fessiers, Abdos, Maison, Haltères, HIIT, Corde, Mobilité) et **65 exercices**.
- **Programme de la semaine** généré selon ton objectif (force, muscle, sèche, forme), tes jours dispo et ton matériel. Chaque jour est modifiable.
- **Mes séances** : crée tes propres séances, ou modifie un programme et enregistre-le.
- **Séance en direct** : tableau des séries (précédent / kg / reps), steppers, choix libre de l'exercice, annuler, ajouter une série, remplacer, minuteur de repos compact.
- **Progrès** : calendrier, volume par semaine, courbe de progression par exercice, historique.
- **Claude (optionnel, payant)** : dans Profil → « IA Claude », une clé API Anthropic ajoute des ajustements IA, briefing, débrief et chat libre.

## Lancer en local

```bash
npx serve .          # ou : python3 -m http.server 8080
```

## Structure

```
index.html        squelette, barre d'onglets, emblème
css/style.css     design + animations de Spider-Man
js/app.js         routeur, Accueil, Progrès, Profil, première ouverture
js/train.js       Séances : liste, aperçu modifiable, check-in, création
js/live.js        séance en direct, repos, fin de séance
js/coach.js       chat avec le coach
js/spidey.js      Spider-Man animé (déplacements, toile, poses, bulles)
js/engine.js      moteur de coaching temps réel
js/brain.js       réponses et débriefs du coach (gratuit, hors ligne)
js/planner.js     programme de la semaine, adaptation à l'objectif
js/data.js        exercices, programmes, rangs
js/store.js       données locales, stats, records
js/ai.js          intégration Claude (optionnelle)
js/fx.js          voix, sons, petits effets
sw.js             cache hors ligne
```
