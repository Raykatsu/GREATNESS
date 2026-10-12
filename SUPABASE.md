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
