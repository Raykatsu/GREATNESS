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

## 2 ter. Activer les vraies notifications de rappel (facultatif)

Les rappels arrivent sur le téléphone les jours de séance (même app fermée), à l'heure choisie dans Moi → Réglages → Rappels.

1. **SQL Editor** → New query → colle tout le contenu de [`supabase/003_push.sql`](supabase/003_push.sql) → **Run**.
2. **Edge Functions** → *Deploy a new function* → *Via Editor*. Nom : `reminders`. Remplace le code par celui de [`supabase/functions/reminders/index.ts`](supabase/functions/reminders/index.ts) → **Deploy**.
   Puis dans les *Details* de la fonction, **désactive « Verify JWT »** et enregistre (la fonction n'envoie que les rappels dus, une seule fois par jour : l'appeler en trop ne fait rien).
3. **Edge Functions → Secrets** → ajoute trois secrets :
   - `VAPID_PUBLIC_KEY` : la valeur de `VAPID_PUBLIC_KEY` dans `js/config.js`
   - `VAPID_PRIVATE_KEY` : la clé privée qui va avec (donnée à part, **ne la mets jamais dans le code**)
   - `VAPID_SUBJECT` : `mailto:ton.adresse@mail.com`
4. **Integrations → Cron** → active-le → *Create job* : nom `greatness-reminders`, planning `*/15 * * * *` (toutes les 15 min), type *Supabase Edge Function*, méthode POST, fonction `reminders`.
5. Dans l'app : **Moi → Réglages → Rappels → Notifications de rappel**. Sur iPhone (iOS 16.4 ou plus), il faut d'abord ajouter l'app à l'écran d'accueil et l'ouvrir depuis l'icône.

Pour tester sans attendre : *Edge Functions → reminders → Test* doit répondre `{"due":0,"sent":0,"gone":0}` (aucun rappel dû à cet instant) et pas une erreur.

> Pour changer de paire de clés VAPID : `npx web-push generate-vapid-keys`, mets la publique dans `js/config.js` et dans le secret, la privée seulement dans le secret. Les téléphones devront réactiver les rappels.

## 2 quater. Brancher l'IA en ligne du coach (Gemini, gratuit)

Le coach répond alors avec une vraie IA en ligne (Google Gemini, avec la recherche Google), en s'appuyant sur tout le compte : profil, objectif, séances, records, mensurations, notes. La clé reste cachée sur le serveur ; chaque compte a une limite de messages par jour (80 par défaut) pour rester dans le quota gratuit. Si l'IA en ligne ne répond pas, le coach repasse tout seul en mode simple.

1. **Clé gratuite** : va sur [aistudio.google.com](https://aistudio.google.com), connecte-toi avec un compte Google → **Get API key** → **Create API key**. Copie la clé (elle commence souvent par `AIza`).
2. **SQL Editor** → New query → colle tout le contenu de [`supabase/004_ai.sql`](supabase/004_ai.sql) → **Run**.
3. **Edge Functions** → *Deploy a new function* → *Via Editor*. Nom : `coach` (attention : l'adresse de la fonction peut garder une majuscule, par exemple `…/functions/v1/Coach` ; si c'est le cas, change `AI_FUNCTION` dans `js/config.js` pour que ça corresponde exactement). Remplace le code par celui de [`supabase/functions/coach/index.ts`](supabase/functions/coach/index.ts) → **Deploy**. Puis dans les *Details* de la fonction, **désactive « Verify JWT »** et enregistre (la fonction vérifie elle-même le compte avec le jeton de connexion).
4. **Edge Functions → Secrets** → ajoute `GEMINI_API_KEY` = ta clé. Facultatif : `AI_DAILY_LIMIT` (messages par jour et par compte, 80 par défaut) et `GEMINI_MODELS` (par défaut `gemini-flash-latest,gemini-flash-lite-latest` : le dernier Flash de Google, et Flash-Lite en secours quand le quota est épuisé).
5. Dans l'app, onglet **Coach** : l'en-tête indique « IA en ligne » et le nombre de messages restants.

> Version gratuite : Google limite le nombre de requêtes par minute et par jour, et peut utiliser les échanges pour améliorer ses modèles. Pour plus de quota, active la facturation sur le projet Google (payant à l'usage) — rien à changer dans l'app.

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
