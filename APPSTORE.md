# Publier GREATNESS sur l'App Store (sans Mac)

L'app iPhone est la même que le site, emballée avec [Capacitor](https://capacitorjs.com) (dossier [`app-store/`](app-store/)). Elle ajoute ce que seul le natif permet :
- **Apple Santé lu directement** (sommeil, VFC, fréquence au repos, pas, poids, énergie active), sans Raccourci.
- **Face ID / Touch ID** pour déverrouiller l'app à la place du code secret.
- **Le repos dans la Dynamic Island et sur l'écran verrouillé** (Live Activity) : le compte à rebours et l'exercice qui suit, sans ouvrir l'app.
- **Widget « Séance du jour »** sur l'écran d'accueil et l'écran verrouillé : la séance prévue, ta série de jours et ta semaine.
- **Fin du repos en notification locale**, même sans réseau, et **rappels de séance** programmés sur le téléphone.
- **Vibrations** natives.

Tout se construit sur un Mac de GitHub. Tu fais tout depuis ton iPhone, dans Safari.

## 0. Ce qu'il faut

- Un **compte Apple Developer** : 99 € par an, sur [developer.apple.com/programs](https://developer.apple.com/programs/). Inscris-toi avec ton identifiant Apple. La validation prend de quelques heures à 2 jours.
- Ce dépôt GitHub (c'est déjà le cas).

Sans compte développeur, tu peux quand même vérifier que l'app compile : **Actions → « App iPhone (TestFlight) » → Run workflow**. L'étape « Construction de vérification » doit finir en vert.

## 1. Réserver l'identifiant de l'app (une fois)

1. Ouvre [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list), puis **+** → *App IDs* → *App*.
2. Renseigne :
   - Description : `GREATNESS` ;
   - Bundle ID **Explicit** : `io.github.raykatsu.greatness`.
3. Dans *Capabilities*, coche **HealthKit** et **App Groups**, puis *Continue* → *Register*.
4. Le groupe partagé avec le widget : **+** → *App Groups* → Description `GREATNESS`, identifiant `group.io.github.raykatsu.greatness` → *Register*. Rouvre l'App ID de l'étape 2 → *App Groups* → *Configure* → coche ce groupe → *Save*.
5. L'identifiant du widget : **+** → *App IDs* → *App*, Description `GREATNESS Widgets`, Bundle ID **Explicit** `io.github.raykatsu.greatness.widgets`, coche **App Groups** (même groupe) → *Register*.

> GitHub crée ensuite tout seul les profils de signature (l'app et son widget) au moment de l'envoi.

## 2. Créer la fiche de l'app dans App Store Connect (une fois)

1. Ouvre [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → *Nouvelle app*.
2. Renseigne :
   - Plateforme **iOS** ;
   - Nom `GREATNESS` (s'il est pris, par exemple « GREATNESS Coach ») ;
   - Langue principale **Français** ;
   - Bundle ID `io.github.raykatsu.greatness` ;
   - SKU `greatness`.

## 3. Donner à GitHub le droit d'envoyer l'app (une fois)

1. Dans App Store Connect : **Utilisateurs et accès** → onglet **Intégrations** → **Clés API App Store Connect** → **+**.
   - Nom `github`, accès **Admin**.
   - Télécharge la clé `AuthKey_XXXX.p8`. Elle ne se télécharge qu'une seule fois.
   - Note l'**ID de la clé** (10 caractères) et l'**Issuer ID**, affiché en haut de la page.
2. Ton **Team ID** : [developer.apple.com/account](https://developer.apple.com/account) → *Détails de l'abonnement* → *ID d'équipe* (10 caractères).
3. Le contenu de la clé :
   - dans l'app **Fichiers**, renomme `AuthKey_XXXX.p8` en `AuthKey_XXXX.txt` ;
   - ouvre-le, sélectionne tout et copie (du `-----BEGIN PRIVATE KEY-----` au `-----END PRIVATE KEY-----`).
4. Sur GitHub, ouvre le dépôt → **Settings → Secrets and variables → Actions → New repository secret**. Crée ces 4 secrets :

| Nom | Valeur |
| --- | --- |
| `APPLE_TEAM_ID` | ton Team ID |
| `ASC_KEY_ID` | l'ID de la clé |
| `ASC_ISSUER_ID` | l'Issuer ID |
| `ASC_KEY_P8` | tout le texte de la clé |

> Ne colle jamais ces valeurs dans une discussion : seulement dans les secrets GitHub.

## 4. Construire et envoyer sur TestFlight (à chaque nouvelle version)

1. **Actions → « App iPhone (TestFlight) » → Run workflow**.
   - Version : `1.0.0` la première fois, puis `1.0.1`, `1.1.0`… Le numéro de build augmente tout seul.
2. Compte 15 à 30 minutes. L'étape « Archive signée et envoi sur TestFlight » doit finir en vert.
3. Après le traitement d'Apple (10 à 30 min), la version apparaît dans App Store Connect → ton app → **TestFlight**.
4. Installe l'app **TestFlight** sur ton iPhone. Ajoute-toi comme testeur interne (TestFlight → *Testeurs internes* → **+**), puis installe GREATNESS depuis TestFlight.

## 5. Publier sur l'App Store

Dans App Store Connect → ton app → la version **1.0** :

**Captures d'écran**
- Format 6,9 pouces : 1320 × 2868 px. Fais-les sur ton iPhone dans l'app installée par TestFlight.
- Montre l'accueil, une séance en direct, le coach, la nutrition et les progrès.

**Textes**
- Description, mots-clés (`musculation, coach, entraînement, programme, nutrition, fitness`) et URL d'assistance (la page du dépôt).
- **URL de confidentialité** : `https://raykatsu.github.io/GREATNESS/privacy.html`.

**Confidentialité de l'app** : *Données collectées* :
- **Santé et forme** (Santé, Forme physique) : liées à l'utilisateur, utilisées pour les fonctionnalités de l'app, pas de traçage.
- **Identifiants** (identifiant utilisateur) : liés à l'utilisateur, utilisés pour les fonctionnalités de l'app.
- **Contenu utilisateur** (photos ou vidéos envoyées à l'analyse) : liées à l'utilisateur, utilisées pour les fonctionnalités de l'app.

**Classification** : 4+.

**Build** : choisis celui envoyé par GitHub, puis **Soumettre pour vérification**.

**Compte de test pour Apple** (*Informations sur la vérification de l'app*) : crée un compte en ligne de démonstration dans l'app (par exemple `apple.review`, code `2468`), ajoute quelques séances, et donne ce pseudo et ce code.

Apple répond en général en 24 à 48 h.

## Points de vigilance (déjà gérés dans l'app)

- **Propriété intellectuelle** (règle 5.2) : tous les personnages sont des créations originales de l'app (aucun héros, manga ou mascotte sous licence), les rangs et les textes aussi.
- **Suppression du compte** (règle 5.1.1) : Moi → Réglages → Compte → *Supprimer définitivement mon compte*.
- **Apple Santé** : l'app lit seulement, et l'explique avant de demander l'accès. Les mesures ne servent qu'au coaching (règle 5.1.3).
- **Plus qu'un site** (règle 4.2) : Santé natif, Face ID, notifications locales, vibrations, caméra (compteur, vitesse de barre), coach IA.
- **Notifications des amis** (duel, ligue) : dans l'app App Store, seuls les rappels de séance et la fin du repos arrivent en notification ; le reste s'affiche à l'ouverture.

## En local, avec un Mac (facultatif)

```bash
cd app-store
npm install
npm run ios        # copie le site, crée le projet Xcode, règle les autorisations, Santé, le widget (Ruby + gem xcodeproj)
npm run icons      # icônes et écran de lancement
npx cap open ios   # ouvre Xcode : choisis ton équipe, puis Product → Archive
```
