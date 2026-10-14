// GREATNESS : envoie les notifications (Web Push), appelée toutes les 15 min par la planification Supabase :
// rappels de séance (gt_push_due), défis entre amis (gt_push_social : dépassé au classement, duel…), rappels
// pour boire (gt_push_water) et ligue entre amis (gt_push_league).
// Secrets : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT ; CRON_KEY (posé par le déploiement GitHub)
// pour que seule la planification puisse l'appeler. Les clés serveur Supabase sont fournies automatiquement.
import webpush from "npm:web-push@3.6.7";

const env = (k: string) => Deno.env.get(k) || "";
const URL_ = env("SUPABASE_URL");
const CRON_KEY = env("CRON_KEY");
webpush.setVapidDetails(env("VAPID_SUBJECT") || "https://raykatsu.github.io/GREATNESS/", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

// Clés serveur : nouvelles (SUPABASE_SECRET_KEYS) puis anciennes ; on essaie la suivante si une clé est refusée
function serverKeys(): string[] {
  const out: string[] = [];
  try {
    const o = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}");
    for (const k of [o.default, ...Object.values(o)]) if (k && !out.includes(String(k))) out.push(String(k));
  } catch { /* absente */ }
  for (const n of ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) if (env(n) && !out.includes(env(n))) out.push(env(n));
  return out;
}
async function rpc(fn: string, args: unknown) {
  let last = "";
  for (const key of serverKeys()) {
    const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (res.ok) return res.status === 204 ? null : res.json();
    last = `${fn}: ${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 401 && res.status !== 403) break;
  }
  throw new Error(last || `${fn}: aucune clé serveur`);
}

type Due = { endpoint: string; sub: webpush.PushSubscription; title: string; body: string };

Deno.serve(async req => {
  // GET : la clé publique VAPID, pour que l'app s'abonne avec la bonne clé (rien de secret)
  if (req.method === "GET") return Response.json({ publicKey: env("VAPID_PUBLIC_KEY") }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=300" } });
  if (CRON_KEY && req.headers.get("x-cron-key") !== CRON_KEY) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const due: (Due & { url: string })[] = ((await rpc("gt_push_due", {})) as Due[]).map(d => ({ ...d, url: "./#/" }));
    let social = 0;
    try {
      const s = (await rpc("gt_push_social", {})) as Due[];
      social = s.length;
      due.push(...s.map(d => ({ ...d, url: "./#/progress?t=friends" })));
    } catch (e) { console.error("social", (e as Error).message); } // 005_social_push.sql pas encore installé
    let water = 0;
    try {
      const w = (await rpc("gt_push_water", {})) as Due[];
      water = w.length;
      due.push(...w.map(d => ({ ...d, url: "./#/food" })));
    } catch (e) { console.error("water", (e as Error).message); } // 006_water_push.sql pas encore installé
    let league = 0;
    try {
      const l = (await rpc("gt_push_league", {})) as Due[];
      league = l.length;
      due.push(...l.map(d => ({ ...d, url: "./#/progress?t=friends" })));
    } catch (e) { console.error("league", (e as Error).message); } // 007_league_push.sql pas encore installé
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(due.map(async d => {
      try {
        await webpush.sendNotification(d.sub, JSON.stringify({ title: d.title, body: d.body, url: d.url }), { TTL: 3 * 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(d.endpoint);
        else console.error("push", code, (e as Error).message);
      }
    }));
    if (gone.length) await rpc("gt_push_gone", { p_endpoints: gone });
    return Response.json({ due: due.length - social - water - league, social, water, league, sent, gone: gone.length });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
