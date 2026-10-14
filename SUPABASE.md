# Activer les comptes en ligne (Supabase)

Sans cette étape, les comptes marchent déjà, mais **seulement sur l'appareil où ils ont été créés**.
Avec Supabase (gratuit), chacun retrouve son compte et ses stats sur **n'importe quel téléphone** avec son pseudo et son code.

Compte environ 10 minutes.

## 1. Créer le projet

1. Va sur **https://supabase.com** → *Start your project* → connecte-toi (avec GitHub, c'est le plus simple).
2. *New project* :
   - **Name** : `greatness`
   - **Database Password** : clique sur *Generate* (tu n'en auras pas besoin ensuite)
   - **Region** : *West EU (Paris)* ou la plus proche de toi
3. Clique sur *Create new project* et attends 1 à 2 minutes.

## 2. Installer les tables

1. Dans le menu de gauche : **SQL Editor** → *New query*.
2. Ouvre le fichier [`supabase/schema.sql`](supabase/schema.sql) de ce dépôt, copie **tout** son contenu et colle-le.
3. Clique sur **Run**. Tu dois voir « Success. No rows returned ».

## 2 bis. Activer les amis et le classement

Même chose avec le fichier [`supabase/002_social.sql`](supabase/002_social.sql) : SQL Editor → New query → coller → **Run**. À faire une seule fois (le relancer ne casse rien).

## 2 ter. Notifications (rappels de séance et défis entre amis)

Avec le déploiement automatique (secret GitHub `SUPABASE_ACCESS_TOKEN`, voir « Déploiement automatique »), il n'y a rien à faire : à chaque modification de `supabase/`, GitHub installe [`003_push.sql`](supabase/003_push.sql), [`005_social_push.sql`](supabase/005_social_push.sql), [`006_water_push.sql`](supabase/006_water_push.sql) (rappels pour boire) et [`007_league_push.sql`](supabase/007_league_push.sql) (ligue entre amis), crée les clés VAPID si elles manquent (la privée reste dans les secrets Supabase), déploie la fonction `reminders` et la planifie toutes les 15 minutes (pg_cron + pg_net). L'app lit la clé publique auprès de la fonction : pas de clé à recopier.

Ce que la fonction envoie : le rappel les jours de séance (sauf si elle est déjà faite), et les défis entre amis (invitation à un duel, ami qui te dépasse au classement, dernières heures d'un duel le dimanche soir), jamais la nuit et 3 par jour au plus.

Dans l'app : **Moi → Réglages → Notifications**. Sur iPhone (iOS 16.4 ou plus), il faut d'abord ajouter l'app à l'écran d'accueil et l'ouvrir depuis l'icône.

La même fonction envoie aussi la **fin du repos sur l'écran verrouillé** ([`010_rest_timer.sql`](supabase/010_rest_timer.sql)) : quand le téléphone se verrouille pendant un repos, l'app lui confie l'alerte ; elle attend la fin du repos (en se relayant au-delà de 2 minutes, la limite d'une exécution) puis l'envoie à ce seul téléphone, sauf si l'app l'a annulée entre-temps.

Pour vérifier : onglet **Actions** → « Supabase (IA en ligne) » → étape « Notifications » : `Essai de la fonction : {"due":0,"social":0,"sent":0,"gone":0}` (rien de dû à cet instant), « Sans la clé de planification : HTTP 403 » et « Alerte de fin de repos (faux jeton) : … BAD_TOKEN ».

> Pour changer de paire de clés VAPID : supprime les secrets `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans Supabase puis relance le déploiement ; les téléphones se réabonnent tout seuls à la prochaine ouverture.

## 2 quater. Brancher l'IA en ligne du coach (Gemini, gratuit)

Le coach répond alors avec une vraie IA en ligne (Google Gemini, avec la recherche Google), en s'appuyant sur tout le compte : profil, objectif, séances, records, mensurations, notes. La clé reste cachée sur le serveur ; chaque compte a une limite de messages par jour (80 par défaut) pour rester dans le quota gratuit. Si l'IA en ligne ne répond pas, le coach repasse tout seul en mode simple et affiche la cause en bas de sa réponse.

1. **Clé gratuite** : va sur [aistudio.google.com](https://aistudio.google.com), connecte-toi avec un compte Google → **Get API key** → **Create API key**. Copie la clé.
2. **Edge Functions → Secrets** → ajoute `GEMINI_API_KEY` = ta clé. Réglages facultatifs (les valeurs par défaut conviennent) :
   - `AI_DAILY_LIMIT` : messages par jour et par compte (80).
   - `GEMINI_MODELS` : modèles dans l'ordre (`gemini-flash-latest,gemini-flash-lite-latest,gemini-3.7-flash,gemma-4-26b-a4b-it`). Le dernier Flash de Google répond ; s'il ne commence pas sa réponse en 7 s (`GEMINI_PRIMARY_MS`), s'il est surchargé ou si son quota gratuit est épuisé, les suivants prennent le relais. Un modèle surchargé est essayé en dernier pendant 5 min, puis 10, 20, 40, jusqu'à 1 h s'il reste en panne, et il reprend sa place dès qu'il répond à nouveau ; cet état est **partagé par toutes les instances** de la fonction (table `gt_ai_models`, [`009_ai_models.sql`](supabase/009_ai_models.sql)) : plus personne n'attend 7 s sur un modèle déjà repéré comme saturé. Un modèle retiré par Google est simplement sauté.
   - `GEMINI_SEARCH_MODELS` : modèles utilisés avec la recherche Google, seulement pour les questions qui demandent une info récente (actualité, prix, études…) (`gemini-flash-latest,gemini-flash-lite-latest`). Le quota gratuit de Google refuse souvent la recherche : le coach répond alors sans, et elle marche dès que la facturation est activée sur le projet Google.
   - `GEMINI_THINKING` : réflexion des modèles Gemini 3 et plus (`low` : réponse en quelques secondes ; `medium` ou `high` : plus poussée mais plus lente).
3. **Déploiement automatique** (une seule fois, ensuite tout est fait par GitHub) :
   1. Sur [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → **Generate new token** → nom `github` → copie le jeton (il commence par `sbp_`).
   2. Sur GitHub, dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**. Nom : `SUPABASE_ACCESS_TOKEN`, valeur : le jeton → **Add secret**.
   3. Onglet **Actions → Supabase (IA en ligne) → Run workflow**. GitHub installe les tables (scripts SQL, relançables sans risque), déploie la fonction `coach` (sans « Verify JWT » : elle vérifie elle-même le compte avec le jeton de connexion), puis teste de bout en bout que Gemini répond. Le rapport s'affiche dans l'étape « Vérifications de bout en bout ».
   
   Ensuite, chaque modification du dossier `supabase/` sur `main` est redéployée et retestée automatiquement.
4. Dans l'app, onglet **Coach** : l'en-tête indique « IA en ligne » et le nombre de messages restants.

> Sans GitHub : SQL Editor → colle [`supabase/004_ai.sql`](supabase/004_ai.sql) → Run ; puis Edge Functions → *Deploy a new function* → *Via Editor*, nom `coach`, remplace **tout** le code d'exemple par celui de [`supabase/functions/coach/index.ts`](supabase/functions/coach/index.ts) → Deploy, et désactive « Verify JWT ». L'adresse doit finir par `/functions/v1/coach` (sensible aux majuscules, voir `AI_FUNCTION` dans `js/config.js`). Ouvre cette adresse dans le navigateur : elle doit afficher « GREATNESS : fonction coach en ligne ».

### Rendre l'IA plus rapide et plus fiable (facultatif, payant à l'usage)

La version gratuite de Gemini passe après les comptes payants : aux heures de pointe, Google répond « surchargé » (erreurs 503 ou 429) ou lentement, refuse souvent la recherche Google, limite le nombre de requêtes par minute et par jour, et peut utiliser les échanges pour améliorer ses modèles. Le coach s'en accommode (modèles de secours, état partagé), mais c'est la facturation qui change vraiment la donne :

1. Sur [aistudio.google.com](https://aistudio.google.com) → **Get API key** : à côté du projet de ta clé, **Set up billing** (activer la facturation) et ajoute une carte. Le projet passe au palier payant en quelques minutes.
2. Fixe-toi une limite : [console.cloud.google.com](https://console.cloud.google.com) → **Facturation → Budgets et alertes** → un budget mensuel (par exemple 5 €) avec une alerte par mail à 50, 90 et 100 %.
3. Rien à changer dans l'app ni dans Supabase : la même clé obtient aussitôt des limites bien plus hautes, la recherche Google marche, et tes échanges ne servent plus à entraîner les modèles.

Ordre de grandeur (tarifs de Gemini Flash en 2025) : quelques dixièmes de centime par message du coach, soit quelques euros par mois pour un usage quotidien. Les tarifs à jour sont sur [ai.google.dev/pricing](https://ai.google.dev/pricing).

## 2 quinquies. Apple Santé (sommeil, cœur, pas, poids)

Avec le déploiement automatique, rien à faire : GitHub installe [`008_health.sql`](supabase/008_health.sql) et déploie la fonction `health` (sans « Verify JWT » : elle vérifie elle-même la clé personnelle). Pour vérifier : onglet **Actions** → « Supabase (IA en ligne) » → étape « Fonction Apple Santé » : « fonction santé en ligne », puis une clé inconnue refusée (`BAD_KEY`).

Dans l'app (compte en ligne) : **Moi → Réglages → Données → Apple Santé → Relier Apple Santé**. L'app donne une adresse personnelle et le pas-à-pas pour créer un **Raccourci iOS** (5 minutes, une seule fois) qui envoie chaque matin le sommeil, la VFC, la fréquence au repos, les pas, le poids et l'énergie active. Aucune app à installer : Apple ne laisse pas une web-app lire Santé directement, le Raccourci fait le pont.

Sécurité : la clé de l'adresse est stockée hachée (SHA-256) et ne permet que d'**envoyer** des mesures sur ce compte, jamais de les lire. « Nouvelle adresse » invalide l'ancienne ; « Délier » efface les mesures reçues. Les mesures de plus de 120 jours sont supprimées.

> Sans GitHub : SQL Editor → colle [`supabase/008_health.sql`](supabase/008_health.sql) → Run ; puis déploie [`supabase/functions/health/index.ts`](supabase/functions/health/index.ts) sous le nom `health` en désactivant « Verify JWT ». L'adresse `…/functions/v1/health` doit afficher « GREATNESS : fonction santé en ligne ».

## 3. Récupérer les deux valeurs

Dans **Project Settings** (roue dentée) → **API** (ou *Data API*) :

- **Project URL** : ressemble à `https://abcdefgh.supabase.co`
- **anon public key** : une longue clé qui commence par `eyJ…` (ou `sb_publishable_…`)

⚠️ Ne prends **pas** la clé `service_role` / `secret` : celle-là doit rester privée.

## 4. Les mettre dans l'app

Envoie-les-moi (Claude) et je mets à jour le site, ou modifie toi-même [`js/config.js`](js/config.js) :

```js
export const SUPABASE_URL = "https://abcdefgh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";
```

La clé *anon* est **faite pour être publique** : elle ne donne accès qu'aux fonctions de connexion. Les tables elles-mêmes sont fermées.

## 2 sexies. Suppression du compte

[`011_account_delete.sql`](supabase/011_account_delete.sql) (installé automatiquement) : dans l'app, **Moi → Réglages → Compte → Supprimer définitivement mon compte**. Le code est redemandé, puis le compte et tout ce qui en dépend sont effacés (données, amis, notifications, mesures Apple Santé, alertes). Exigé par l'App Store, et ton droit selon le RGPD.

## Sécurité

- Le code secret est **haché** (bcrypt) : même toi, tu ne peux pas le lire.
- **5 codes faux d'affilée** bloquent le compte 15 minutes.
- Après la connexion, le téléphone utilise un jeton aléatoire, pas le code.
- Changer son code (Profil → Compte) déconnecte les autres appareils.
- À chaque ouverture de l'app, et après 10 minutes en arrière-plan, il faut retaper son code.

## Administration

Dans **SQL Editor** :

**Voir les comptes**
```sql
select username, created_at, updated_at, jsonb_array_length(coalesce(data->'sessions', '[]')) as seances from gt_accounts order by created_at;
```

**Réinitialiser le code de quelqu'un qui l'a oublié** (ici à `0000`, il pourra le changer ensuite dans Profil)
```sql
update gt_accounts set pin_hash = extensions.crypt('0000', extensions.gen_salt('bf', 8)), failed = 0, locked_until = null where username = 'pseudo';
delete from gt_tokens where username = 'pseudo';
```

**Supprimer un compte**
```sql
delete from gt_accounts where username = 'pseudo';
```

## Bon à savoir

- Le plan gratuit de Supabase met le projet en pause après **7 jours sans aucune activité**. Il suffit de le relancer depuis le tableau de bord (*Restore project*). Tant que quelqu'un utilise l'app, ça n'arrive pas.
- Hors ligne, l'app continue de marcher avec la copie gardée sur le téléphone, et se resynchronise toute seule au retour du réseau.
