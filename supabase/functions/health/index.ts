// GREATNESS : reçoit les mesures Apple Santé envoyées par un Raccourci iOS et les range au jour (table gt_health).
// Le Raccourci appelle une adresse préparée par l'app (onglet Moi → Apple Santé), par exemple :
//   …/functions/v1/health?k=PSEUDO.SECRET&tz=Europe/Paris&steps=8432&sleep=7,5&hrv=58&rhr=54&weight=72,4&kcal=420
// (GET ou POST, paramètres dans l'adresse ou en JSON). Les valeurs viennent telles qu'iOS les écrit (« 7,5 »,
// « 72,4 kg », « 8 432 ») ; une valeur absente, vide ou invraisemblable est ignorée. Sommeil en heures (des minutes
// ou des secondes sont reconnues). Déployée automatiquement par GitHub Actions (voir SUPABASE.md).
const VERSION = "health-1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const SB = env("SUPABASE_URL").replace(/\/$/, "");
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

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
    const res = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (res.ok) return await res.json();
    last = `${fn} : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 401 && res.status !== 403) break;
  }
  throw new Error(last || `${fn} : aucune clé serveur`);
}

// « 72,4 kg » → 72.4 ; « 8 432 » → 8432 ; vide → null
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/[\s  ]/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return s ? Number(s[0]) : null;
}
// Durée de sommeil en heures : « 7,5 », « 7:30 », « 7:30:00 », « 7 h 30 min », « 7h30 », « 450 min », « 27000 s »,
// ou un nombre seul (minutes au-delà de 24, secondes au-delà de 1000)
export function sleepHours(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? (v > 1000 ? v / 3600 : v > 24 ? v / 60 : v) : null;
  const t = String(v ?? "").toLowerCase().replace(/[\s  ]+/g, " ").replace(/,/g, ".").trim();
  if (!t) return null;
  let m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return +m[1] + +m[2] / 60 + (m[3] ? +m[3] / 3600 : 0);
  m = t.match(/(\d+(?:\.\d+)?) ?h(?:eures?|rs?)?(?: ?(\d+) ?(?:min|mn|m)?)?/);
  if (m) return +m[1] + (m[2] ? +m[2] / 60 : 0);
  m = t.match(/(\d+(?:\.\d+)?) ?(?:min|mn|m)\b/);
  if (m) return +m[1] / 60;
  m = t.match(/(\d+(?:\.\d+)?) ?(?:s|sec|secondes?)\b/);
  if (m) return +m[1] / 3600;
  const n = num(t);
  return n == null ? null : sleepHours(n);
}
const within = (v: number | null, lo: number, hi: number) => (v != null && v >= lo && v <= hi ? v : null);
const r1 = (v: number) => Math.round(v * 10) / 10;
// Valeurs gardées (bornes d'un humain) ; le sommeil arrive en heures, minutes ou secondes selon le Raccourci
export function clean(q: Record<string, unknown>) {
  const out: Record<string, number> = {};
  const steps = within(num(q.steps ?? q.pas), 0, 150000);
  if (steps != null) out.steps = Math.round(steps);
  const sleep = within(sleepHours(q.sleep ?? q.sommeil), 0.5, 16);
  if (sleep != null) out.sleep = r1(sleep);
  const hrv = within(num(q.hrv ?? q.vfc), 5, 300);
  if (hrv != null) out.hrv = Math.round(hrv);
  const rhr = within(num(q.rhr ?? q.fc), 25, 150);
  if (rhr != null) out.rhr = Math.round(rhr);
  const wRaw = q.weight ?? q.poids, lb = /lb/i.test(String(wRaw ?? "")); // Santé réglé en livres : « 160 lb »
  const weight = within(lb ? (num(wRaw) ?? 0) * 0.45359237 : num(wRaw), 25, 300);
  if (weight != null) out.weight = r1(weight);
  const kcal = within(num(q.kcal ?? q.energy ?? q.energie), 0, 8000);
  if (kcal != null) out.kcal = Math.round(kcal);
  return out;
}
// Jour local de l'envoi (fuseau envoyé par l'adresse de l'app), ou le jour donné (d=AAAA-MM-JJ)
export function dayOf(q: Record<string, unknown>, now = new Date()) {
  const d = String(q.d ?? q.day ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  let tz = String(q.tz || "Europe/Paris");
  try { new Intl.DateTimeFormat("fr", { timeZone: tz }); } catch { tz = "Europe/Paris"; }
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const q: Record<string, unknown> = Object.fromEntries(url.searchParams);
  if (req.method === "POST") {
    try { Object.assign(q, await req.json()); } catch { /* pas de corps JSON : les paramètres de l'adresse suffisent */ }
  }
  const key = String(q.k ?? q.key ?? "").trim().slice(0, 120);
  if (!key) {
    return new Response(`GREATNESS : fonction santé en ligne (${VERSION}).`, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
  }
  const data = clean(q);
  if (!Object.keys(data).length) return json({ error: "NO_DATA", message: "Aucune mesure reçue : vérifie les variables du Raccourci." }, 400);
  try {
    const r = await rpc("gt_health_put", { p_key: key, p_day: dayOf(q), p_data: { ...data, src: "apple" } });
    if (r?.error === "BAD_KEY") return json({ error: "BAD_KEY", message: "Clé inconnue : recopie l'adresse depuis l'app (Moi → Apple Santé)." }, 403);
    if (r?.error) return json({ error: r.error }, 400);
    const parts = [data.steps != null && `${data.steps} pas`, data.sleep != null && `${String(data.sleep).replace(".", ",")} h de sommeil`, data.hrv != null && `VFC ${data.hrv} ms`,
      data.rhr != null && `FC repos ${data.rhr}`, data.weight != null && `${String(data.weight).replace(".", ",")} kg`, data.kcal != null && `${data.kcal} kcal actives`].filter(Boolean);
    return json({ ok: true, day: r.day, saved: data, message: `Reçu par GREATNESS : ${parts.join(", ")}.` });
  } catch (e) {
    console.error(e);
    return json({ error: "DOWN", message: "Serveur indisponible, réessaie plus tard." }, 503);
  }
});
