// Comptes en ligne (Supabase). Laisse vide pour des comptes uniquement sur l'appareil.
// Voir SUPABASE.md pour créer le projet et récupérer ces deux valeurs.
// La clé "anon" est publique par conception : la sécurité est assurée par les
// fonctions SQL (code haché, verrouillage après 5 essais, accès direct aux tables bloqué).
export const SUPABASE_URL = "https://kahzhwslhstsnkcdciyt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_QXGwpXit7dx-N2xEkcx2Zw_3V30TXwU";

// Notifications de rappel (Web Push) : clé publique VAPID. La clé privée va UNIQUEMENT
// dans les secrets Supabase (voir SUPABASE.md), jamais ici.
export const VAPID_PUBLIC_KEY = "BM_ye3bkSLsUqAQjW6iip9LXIqxTnrn7bu0h6BlYvEpqoXy1AcbjYOhr175DkfM0sEAWb-6t_DcFuja9DRQw0Mw";

// Nom (slug) de la fonction Supabase de l'IA en ligne : visible dans l'adresse de la fonction
// (…/functions/v1/<nom>). Sensible aux majuscules. « coach » est déployée par GitHub Actions (voir SUPABASE.md).
export const AI_FUNCTION = "coach";
