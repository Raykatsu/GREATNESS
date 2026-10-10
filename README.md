# GREATNESS 🕷️

App d'entraînement pilotée par **KAREN**, un coach IA qui donne les consignes et optimise la séance **en temps réel**. Thème sombre façon Spider-Verse : toile animée, titres glitch rouge/bleu, onomatopées comics (THWIP!), check-in « sens d'araignée ».

## Ce que fait KAREN

| Moment | Ce que fait le coach |
|---|---|
| **Avant la séance** | Check-in *sens d'araignée* (sommeil, énergie, courbatures) → ajuste charges et volume du jour (de −15 % à +3 %, séries en moins si besoin). |
| **Début d'exercice** | Annonce l'objectif (charge × reps) calculé depuis ton historique (double progression) + une consigne technique, à voix haute. |
| **Après chaque série** | Tu saisis reps faites + RPE. KAREN ajuste instantanément la **prochaine série** (charge ↑/↓, objectif reps) et le **temps de repos**. |
| **Fatigue** | Jauge de fatigue cumulée : à 65 % elle retire des séries à venir, à 90 % elle conseille d'arrêter. |
| **Douleur** | Case « douleur » → arrêt immédiat de l'exercice + alternative proposée. |
| **Records** | Détection des PR en direct (1RM estimé Epley). |
| **Fin** | Débrief, XP, rangs (*Étudiant de Midtown → … → Maître du Spider-Verse*). |

Deux niveaux d'intelligence :

1. **Moteur local** (`js/engine.js`) — toujours actif, hors ligne, décisions instantanées.
2. **Claude** (`js/ai.js`, optionnel) — dans *Profil*, active « KAREN connectée » et colle une clé API Anthropic. Claude valide/corrige chaque décision du moteur local (réponse JSON structurée, bornée côté app pour rester sûre), fait le briefing, le débrief et le chat libre en streaming. La clé reste sur l'appareil.

## Lancer

Aucun build. Il faut juste servir le dossier en HTTP (modules ES) :

```bash
npx serve .          # ou : python3 -m http.server 8080
```

Puis ouvrir l'URL sur le téléphone → « Ajouter à l'écran d'accueil » (PWA, fonctionne hors ligne). Déployable tel quel sur GitHub Pages / Netlify / Vercel.

## Structure

```
index.html            shell + barre d'onglets + emblème SVG
css/style.css         thème sombre, animations
js/app.js             routeur et écrans (QG, Séances, séance live, repos, KAREN, Journal, Profil)
js/engine.js          moteur de coaching temps réel
js/ai.js              intégration Claude (SDK Anthropic)
js/fx.js              voix FR, sons, vibrations, toile animée, effets comics
js/data.js            exercices, programmes, rangs, citations
js/store.js           persistance localStorage, XP, séries, records
sw.js                 cache hors ligne
```
