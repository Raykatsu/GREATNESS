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

## IA intelligente locale

Dans l'onglet Coach (ou Profil), **« Activer l'IA »** télécharge une fois un modèle **Qwen** qui tourne directement dans le navigateur (WebGPU) : gratuit, privé, hors ligne. Il répond à n'importe quelle question en s'appuyant sur le profil, le programme, les records et les dernières séances de l'utilisateur, et écrit le débrief de fin de séance. Trois tailles : Léger (≈ 0,6 Go, conseillé sur téléphone), Équilibré (≈ 1,4 Go, téléphone très récent), Puissant (≈ 2,6 Go, ordinateur). Si un chargement plante (mémoire du téléphone), l'app ne relance pas en boucle et propose le modèle plus petit. Sans WebGPU, le coach simple prend le relais.

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
- **Succès** : 18 badges à débloquer.
- **Rappels** : vraies notifications les jours de séance (Web Push via Supabase, voir SUPABASE.md), ou ajout au calendrier du téléphone (.ics).
- **Mains libres** : touche le micro en séance et dis « 8 reps, difficile », « 10 à 60 kilos », « annule », « passe », « go ».
- **Compteur caméra** : bouton « Compter » en séance ; le téléphone posé de profil compte tes reps et signale les amplitudes trop courtes (détection de pose MediaPipe, tout reste sur le téléphone).
- **Animations** : chaque exercice est montré par un petit bonhomme animé (technique en séance, fiche exercice, onglet Créer).
- **Synchro sans perte** : un compte utilisé sur deux téléphones fusionne les séances des deux côtés.

## Social (comptes en ligne)

Moi → **Amis**  : ajouter un ami par son pseudo, classement de la semaine (volume, séances, série, XP), défi de la semaine commun, fiche de chaque ami (records, dernières séances). Un ami ne voit que ton résumé public, et seulement une fois l'amitié acceptée des deux côtés. **Partager** une séance perso crée un lien : la personne qui l'ouvre l'ajoute à ses séances en un clic. Nécessite `supabase/002_social.sql` (voir SUPABASE.md).

## Fonctionnalités

- **21 coachs animés au choix** (Héros, Manga, Mignons, Animaux), chacun avec sa façon de se déplacer (toile, vol, sauts, ninja, marche) : Moi → Réglages → Ton coach.
- **41 programmes** (Push/Pull/Legs, Haut/Bas, Full body, Bras, Fessiers, Abdos, Maison, Haltères, HIIT, Corde, Mobilité…) et **183 exercices**.
- **Mobilité par zone** : nuque, épaules, dos, hanches, jambes et chevilles, poignets, réveil du matin.
- **Échauffement & souplesse** : échauffement adapté proposé avant chaque séance (haut, bas ou complet) puis enchaîné automatiquement, retour au calme proposé à la fin, souplesse complète, objectif grand écart.
- **Soulager** : séances douces pour le mal de dos, la nuque, les épaules, les genoux, les hanches raides et les poignets (pas un avis médical).
- **Programme de la semaine** généré selon ton objectif (force, muscle, sèche, forme), tes jours dispo et ton matériel. Chaque jour est modifiable.
- **Mes séances** : crée tes propres séances, ou modifie un programme et enregistre-le.
- **Séance en direct** : tableau des séries (précédent / kg / reps), steppers, choix libre de l'exercice, annuler, ajouter une série, remplacer, minuteur de repos compact.
- **Progrès** : calendrier, volume par semaine, courbe de progression par exercice, historique.
- **Claude (optionnel, payant)** : dans Moi → Réglages → « IA Claude », une clé API Anthropic ajoute des ajustements IA, briefing, débrief et chat libre.

## Tests

```bash
npm install
npm test   # moteur, demandes au coach, voix, fusion, compteur de reps, planning, SQL (PGlite)
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
js/motion.js      mouvements des exercices + compteur de reps par angles
js/anim.js        bonhomme animé des exercices
js/cam.js         compteur de reps à la caméra (MediaPipe)
js/push.js        abonnement aux notifications de rappel
sw.js             cache hors ligne + réception des notifications
supabase/schema.sql      comptes en ligne
supabase/002_social.sql  amis, classement, défis
supabase/003_push.sql    notifications de rappel
supabase/functions/reminders/  fonction qui envoie les rappels
tests/                   tests automatiques
```
