// GREATNESS : envoie les notifications (Web Push), appelée toutes les 15 min par la planification Supabase :
// rappels de séance (gt_push_due), défis entre amis (gt_push_social : dépassé au classement, duel…), rappels
// pour boire (gt_push_water) et ligue entre amis (gt_push_league).
// Appelée aussi par l'app quand le téléphone se verrouille pendant un repos ({ token, timer }) : elle attend la fin
// du repos et envoie « Repos terminé » à ce téléphone (010_rest_timer.sql), sauf si l'app l'a annulé entre-temps.
// Secrets : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT ; CRON_KEY (posé par le déploiement GitHub)
// pour que seule la planification puisse lancer la tournée. Les clés serveur Supabase sont fournies automatiquement.
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
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const sleep = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));
// Une exécution ne dure pas plus de 150 s (offre gratuite) : au-delà de MAX_WAIT, on passe le relais à une nouvelle
export const MAX_WAIT = +(env("TIMER_MAX_WAIT_MS") || 110_000);
// deno-lint-ignore no-explicit-any
const later = (p: Promise<unknown>) => { const rt = (globalThis as any).EdgeRuntime; if (rt?.waitUntil) rt.waitUntil(p); else p.catch(() => {}); };

// Attend l'heure d'envoi, puis envoie l'alerte de fin de repos (une seule fois, si elle n'a pas été annulée)
export async function waitAndSend(id: string, fireAt?: number) {
  if (!fireAt) {
    const g = (await rpc("gt_timer_get", { p_id: id })) as { fire_at?: number } | null;
    if (!g?.fire_at) return "gone";
    fireAt = g.fire_at;
  }
  const wait = fireAt - Date.now();
  if (wait > MAX_WAIT) {
    await sleep(MAX_WAIT * 0.9);
    await fetch(`${URL_}/functions/v1/reminders`, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-key": CRON_KEY }, body: JSON.stringify({ relay: id }) });
    return "relay";
  }
  await sleep(wait);
  const d = (await rpc("gt_timer_take", { p_id: id })) as Due | null;
  if (!d?.sub) return "cancelled";
  try {
    await webpush.sendNotification(d.sub, JSON.stringify({ title: d.title || "Repos terminé", body: d.body, url: "./#/", tag: "rest" }), { TTL: 90, urgency: "high" });
    return "sent";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await rpc("gt_push_gone", { p_endpoints: [d.endpoint] });
    else console.error("repos", code, (e as Error).message);
    return "failed";
  }
}

// L'app programme ({ token, timer: { id, endpoint, in, title, body } }) ou annule ({ token, timer: { id, cancel: true } })
// deno-lint-ignore no-explicit-any
async function restTimer(input: any) {
  const t = input.timer || {}, token = String(input.token || "").slice(0, 200), id = String(t.id || "").slice(0, 64);
  if (!token || !id) return Response.json({ error: "BAD_REQUEST" }, { status: 400, headers: CORS });
  if (t.cancel) return Response.json(await rpc("gt_timer_cancel", { p_token: token, p_id: id }), { headers: CORS });
  const r = (await rpc("gt_timer_set", {
    p_token: token, p_id: id, p_endpoint: String(t.endpoint || "").slice(0, 600), p_in_ms: Math.round(+t.in || 0),
    p_title: String(t.title || "Repos terminé").slice(0, 80), p_body: String(t.body || "").slice(0, 160),
  })) as { ok?: boolean; error?: string; fire_at?: number };
  if (!r?.ok) return Response.json({ error: r?.error || "DOWN" }, { status: 400, headers: CORS });
  later(waitAndSend(id, r.fire_at));
  return Response.json({ ok: true, fire_at: r.fire_at }, { headers: CORS });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // GET : la clé publique VAPID, pour que l'app s'abonne avec la bonne clé (rien de secret)
  if (req.method === "GET") return Response.json({ publicKey: env("VAPID_PUBLIC_KEY") }, { headers: { ...CORS, "Cache-Control": "max-age=300" } });
  // corps JSON (envoyé en texte par l'app, sans vérification préalable du navigateur)
  // deno-lint-ignore no-explicit-any
  let input: any = {};
  try { input = JSON.parse((await req.text()) || "{}"); } catch { /* corps vide */ }
  if (input?.timer) {
    try { return await restTimer(input); } catch (e) { console.error(e); return Response.json({ error: "DOWN" }, { status: 503, headers: CORS }); }
  }
  if (CRON_KEY && req.headers.get("x-cron-key") !== CRON_KEY) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  if (input?.relay) { later(waitAndSend(String(input.relay).slice(0, 64))); return Response.json({ ok: true }); }
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
