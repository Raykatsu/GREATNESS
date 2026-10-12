// GREATNESS : envoie les rappels de séance (Web Push). Appelée toutes les 15 min par Supabase Cron.
// Secrets à définir (Edge Functions → Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:greatness@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const rpc = async (fn: string, args: unknown) => {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

Deno.serve(async () => {
  try {
    const due: { endpoint: string; sub: webpush.PushSubscription; title: string; body: string }[] = await rpc("gt_push_due", {});
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(due.map(async d => {
      try {
        await webpush.sendNotification(d.sub, JSON.stringify({ title: d.title, body: d.body, url: "./#/" }), { TTL: 3 * 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(d.endpoint);
        else console.error("push", code, (e as Error).message);
      }
    }));
    if (gone.length) await rpc("gt_push_gone", { p_endpoints: gone });
    return Response.json({ due: due.length, sent, gone: gone.length });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
