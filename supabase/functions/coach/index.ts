// GREATNESS : le coach en ligne. Reçoit la question et le contexte du compte (profil, séances,
// records, programme…), appelle Gemini (avec la recherche Google) et renvoie la réponse en flux (SSE).
// Déployée automatiquement par GitHub Actions (.github/workflows/supabase.yml) : voir SUPABASE.md.
// Secrets (Edge Functions → Secrets) : GEMINI_API_KEY (obligatoire, gratuite sur aistudio.google.com),
// GEMINI_MODELS (facultatif, liste séparée par des virgules), AI_DAILY_LIMIT (facultatif, 80 par défaut).
// L'adresse du projet et la clé secrète Supabase sont fournies automatiquement par la plateforme.
const VERSION = "coach-3";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const KEY = env("GEMINI_API_KEY");
// Alias « latest » : suivent le dernier modèle de Google. Flash-Lite puis Gemma prennent le relais
// quand le quota gratuit du modèle précédent est épuisé (Gemma : quota large, mais sans recherche Google).
const MODELS = (env("GEMINI_MODELS") || "gemini-flash-latest,gemini-flash-lite-latest,gemma-3-27b-it")
  .split(",").map(s => s.trim()).filter(Boolean);
const LIMIT = Number(env("AI_DAILY_LIMIT") || 80);
const SB = env("SUPABASE_URL").replace(/\/$/, "");
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";

// Clé serveur Supabase : nouveau format (sb_secret_…) ou ancien (JWT service_role), selon le projet.
function serverKeys(): { key: string; source: string }[] {
  const out: { key: string; source: string }[] = [];
  try {
    const o = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}");
    for (const k of [o.default, ...Object.values(o)]) if (k && !out.some(x => x.key === k)) out.push({ key: String(k), source: "SUPABASE_SECRET_KEYS" });
  } catch { /* variable absente ou illisible */ }
  for (const name of ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) if (env(name)) out.push({ key: env(name), source: name });
  return out;
}

// Règles posées par le serveur, prioritaires sur le contexte envoyé par l'app.
const GUARD = `Tu es le coach sportif de l'app GREATNESS. Réponds toujours en français, en tutoyant.
Tu es un vrai expert : entraînement de force et d'hypertrophie, programmation, technique, mobilité, nutrition sportive, sommeil et récupération. Tes réponses sont précises, chiffrées et personnalisées avec les données de l'athlète (charges, reps, records, objectif, poids de corps, historique). Réponds d'abord exactement à la question posée, puis donne le conseil concret à appliquer à la prochaine séance.
Si le message décrit une performance (ex. « 4×5 à 100 kg à l'échec »), analyse-la : effort (RPE, reps en réserve), 1RM estimé, comparaison avec ses records, puis la charge et les reps à viser la prochaine fois.
Sécurité : en cas de douleur ou de blessure, conseille d'arrêter l'exercice et de consulter un professionnel de santé ; ne pose pas de diagnostic médical ; ne donne jamais de dosage de médicament ni de produit dopant ; pas de conseils de régime extrême.
Tu peux utiliser la recherche Google quand une question demande une info factuelle récente ou précise (études, actualité, produits, lieux), pas pour les questions d'entraînement que les données de l'athlète suffisent à traiter.`;

type Msg = { role: "user" | "assistant"; content: string };
type Attempt = { model: string; search: boolean };
const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const clip = (t: unknown, n = 220) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const SSE_HEADERS = { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o, null, 1), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
function reply(events: unknown[]) {
  return new Response(new ReadableStream({ start(c) { events.forEach(e => c.enqueue(sse(e))); c.close(); } }), { headers: SSE_HEADERS });
}

// Appel d'une fonction SQL avec la clé serveur (on essaie la suivante si une clé est refusée).
async function rpc(fn: string, args: unknown): Promise<Response> {
  let res: Response | null = null;
  for (const { key } of serverKeys()) {
    res = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (res.status !== 401 && res.status !== 403) return res;
  }
  if (!res) throw new Error("aucune clé serveur Supabase dans l'environnement");
  return res;
}

// Vérifie le jeton du compte et compte un message (quota gratuit partagé entre tous les comptes).
async function take(token: string): Promise<{ ok?: boolean; error?: string; remaining?: number | null; note?: string }> {
  const r = await rpc("gt_ai_take", { p_token: token, p_limit: LIMIT });
  if (r.ok) return await r.json();
  const body = await r.text();
  if (r.status === 404 || /PGRST202|Could not find the function/i.test(body)) {
    // 004_ai.sql pas encore lancé : on vérifie au moins le jeton
    const u = await rpc("gt_user", { p_token: token });
    if (!u.ok) throw new Error(`gt_user ${u.status} ${clip(await u.text())}`);
    if (!(await u.json())) return { error: "BAD_TOKEN" };
    return { ok: true, remaining: null, note: "compteur absent : lance supabase/004_ai.sql" };
  }
  throw new Error(`gt_ai_take ${r.status} ${clip(body)}`);
}

// Gemini veut une conversation qui commence par l'utilisateur et alterne les rôles.
function contents(messages: Msg[]) {
  const out: { role: string; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (!out.length && role === "model") continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n\n" + m.content;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

const isGemma = (model: string) => /gemma/i.test(model);
function requestBody(model: string, search: boolean, system: string, messages: Msg[]) {
  const sys = `${GUARD}\n\n${system}`.trim();
  const conv = contents(messages);
  // Gemma n'accepte ni consignes système ni recherche : les consignes passent dans le premier message.
  if (isGemma(model)) {
    conv[0].parts[0].text = `${sys}\n\n---\n\n${conv[0].parts[0].text}`;
    return { contents: conv, generationConfig: { maxOutputTokens: 8192 } };
  }
  return {
    systemInstruction: { parts: [{ text: sys }] },
    contents: conv,
    ...(search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { maxOutputTokens: 16384 },
  };
}

function plan(search: boolean): Attempt[] {
  const out: Attempt[] = [];
  for (const model of MODELS) {
    if (search && !isGemma(model)) out.push({ model, search: true });
    out.push({ model, search: false });
  }
  return out;
}

async function gemini(model: string, body: unknown, stream: boolean) {
  const url = `${GEMINI}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  return await fetch(url, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Lit le flux SSE de Gemini : un objet JSON par ligne « data: ».
async function* readGemini(res: Response) {
  const reader = res.body!.getReader(), dec = new TextDecoder();
  let buf = "";
  const parse = (line: string) => {
    line = line.trim();
    if (!line.startsWith("data:")) return null;
    try { return JSON.parse(line.slice(5)); } catch { return null; }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const chunk = parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (chunk) yield chunk;
    }
  }
  const chunk = parse(buf);
  if (chunk) yield chunk;
}

// deno-lint-ignore no-explicit-any
function chunkInfo(chunk: any) {
  if (chunk?.error) throw new Error(`${chunk.error.code ?? ""} ${clip(chunk.error.message, 160)}`);
  const cand = chunk?.candidates?.[0];
  // deno-lint-ignore no-explicit-any
  const parts: any[] = cand?.content?.parts ?? [];
  return {
    text: parts.filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join(""),
    // deno-lint-ignore no-explicit-any
    sources: (cand?.groundingMetadata?.groundingChunks ?? []).filter((g: any) => g.web?.uri).map((g: any) => [g.web.uri, g.web.title || g.web.uri] as [string, string]),
    blocked: ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"].includes(cand?.finishReason) || !!chunk?.promptFeedback?.blockReason,
    finish: String(cand?.finishReason || ""),
    version: String(chunk?.modelVersion || ""),
  };
}

// Le cœur : essaie les modèles dans l'ordre et relaie le texte au fil de l'eau.
// Quota épuisé, modèle absent, panne ou réponse vide : on passe à l'essai suivant.
type Run = { model: string; version: string; err: string; cut: boolean; blocked: boolean; sources: Map<string, string> };
async function* converse(system: string, messages: Msg[], search: boolean, run: Run) {
  const skip = new Set<string>();
  for (const a of plan(search)) {
    if (skip.has(a.model)) continue;
    const label = `Gemini ${a.model}${a.search ? " + recherche" : ""}`;
    let res: Response;
    try { res = await gemini(a.model, requestBody(a.model, a.search, system, messages), true); }
    catch (e) { run.err = `${label} : ${clip((e as Error).message)}`; continue; }
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      run.err = `${label} : HTTP ${res.status} ${clip(t, 240)}`;
      console.error(run.err);
      // 429 avec la recherche : c'est peut-être le quota de la recherche, on réessaie sans
      if ([401, 403, 404].includes(res.status) || (res.status === 400 && /API[_ ]KEY/i.test(t)) || (res.status === 429 && !a.search)) skip.add(a.model);
      continue;
    }
    let got = 0;
    try {
      for await (const chunk of readGemini(res)) {
        const info = chunkInfo(chunk);
        if (info.version) run.version = info.version;
        for (const [url, title] of info.sources) run.sources.set(url, title);
        if (info.blocked) run.blocked = true;
        if (info.text) { got += info.text.length; yield info.text; }
      }
    } catch (e) {
      run.err = `${label} : flux interrompu (${clip((e as Error).message)})`;
      console.error(run.err);
      if (got) run.cut = true;
    }
    if (got) { run.model = a.model; return; }
    if (!run.cut && !run.err.startsWith(label)) run.err = `${label} : réponse vide${run.blocked ? " (bloquée par le filtre de sécurité)" : ""}`;
  }
}

const newRun = (): Run => ({ model: "", version: "", err: "", cut: false, blocked: false, sources: new Map() });
const topSources = (run: Run) => [...run.sources].slice(0, 5).map(([url, title]) => ({ url, title }));

// Réponse en flux pour l'app. Un « ping » toutes les 8 s garde la connexion ouverte pendant que Gemini réfléchit.
function chat(system: string, messages: Msg[], search: boolean, quota: { remaining?: number | null; note?: string }) {
  let closed = false;
  return new Response(new ReadableStream({
    async start(c) {
      const send = (bytes: Uint8Array) => { if (!closed) try { c.enqueue(bytes); } catch { closed = true; } };
      const ping = setInterval(() => send(enc.encode(": ping\n\n")), 8000);
      const run = newRun();
      let sent = 0;
      try {
        for await (const t of converse(system, messages, search, run)) {
          if (closed) break; // l'app a fermé la connexion
          sent += t.length; send(sse({ t }));
        }
      } catch (e) {
        run.err = `erreur interne : ${clip((e as Error).message)}`;
        console.error(e);
      }
      clearInterval(ping);
      if (sent) send(sse({ done: true, model: run.model, version: run.version, cut: run.cut, remaining: quota.remaining ?? null, blocked: run.blocked, note: quota.note, sources: topSources(run) }));
      else send(sse({ error: "DOWN", detail: run.err || "aucun modèle Gemini n'a répondu" }));
      if (!closed) { closed = true; c.close(); }
    },
    cancel() { closed = true; },
  }), { headers: SSE_HEADERS });
}

// Diagnostic complet, appelé par GitHub Actions après chaque déploiement (en-tête x-diag-token).
// Ne renvoie aucun secret : seulement leur présence, leur format et les réponses des services.
async function diagnose() {
  const t0 = Date.now();
  const keys = serverKeys();
  const k = keys[0]?.key || "";
  const out: Record<string, unknown> = {
    version: VERSION,
    gemini_key: { present: !!KEY, length: KEY.length, prefix: KEY.slice(0, 3) },
    server_key: { sources: keys.map(x => x.source), format: k.startsWith("sb_secret_") ? "sb_secret" : k.startsWith("eyJ") ? "jwt" : k ? "autre" : "absente" },
    supabase_url: SB ? "présente" : "ABSENTE",
    models_config: MODELS,
    daily_limit: LIMIT,
  };
  try {
    const r = await rpc("gt_ai_take", { p_token: "diagnostic", p_limit: LIMIT });
    out.quota_rpc = `HTTP ${r.status} ${clip(await r.text(), 160)}`;
  } catch (e) { out.quota_rpc = `erreur : ${clip((e as Error).message)}`; }
  try {
    const r = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { "x-goog-api-key": KEY } });
    const t = await r.text();
    if (r.ok) {
      // deno-lint-ignore no-explicit-any
      const all: any[] = JSON.parse(t).models || [];
      out.models_available = all.filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => String(m.name).replace("models/", "")).filter(n => /flash|pro|gemma/i.test(n));
    } else out.models_available = `HTTP ${r.status} ${clip(t, 300)}`;
  } catch (e) { out.models_available = `erreur : ${clip((e as Error).message)}`; }
  // Un essai court par modèle, sans recherche
  const tests = [];
  for (const model of MODELS) {
    const s = Date.now();
    try {
      const r = await gemini(model, requestBody(model, false, "Test technique.", [{ role: "user", content: "Réponds seulement : OK" }]), false);
      const t = await r.text();
      let text = "", version = "";
      try { const j = JSON.parse(t); text = chunkInfo(j).text; version = j.modelVersion || ""; } catch { /* corps non JSON */ }
      tests.push({ model, status: r.status, ms: Date.now() - s, ...(r.ok ? { version, text: clip(text, 60) } : { error: clip(t, 300) }) });
    } catch (e) { tests.push({ model, error: clip((e as Error).message) }); }
  }
  out.tests = tests;
  // Le vrai chemin du chat : flux + recherche Google, avec une question type
  const s = Date.now(), run = newRun();
  let text = "", chunks = 0;
  try {
    for await (const t of converse("Athlète : Alex, 80 kg, objectif force. Développé couché : record 100 kg × 3.",
      [{ role: "user", content: "J'ai fait 4×5 au développé couché à 100 kg, la dernière série à l'échec. Je mets combien la prochaine fois ?" }], true, run)) { text += t; chunks++; }
  } catch (e) { run.err = `erreur interne : ${clip((e as Error).message)}`; }
  out.stream = { ok: !!text.trim(), model: run.model, version: run.version, chunks, chars: text.length, sources: run.sources.size, ms: Date.now() - s, ...(text ? { sample: clip(text, 160) } : { error: run.err }) };
  out.ok = !!text.trim();
  out.ms = Date.now() - t0;
  return out;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    return new Response(`GREATNESS : fonction coach en ligne (${VERSION}). Clé Gemini : ${KEY ? "présente" : "ABSENTE"}.`, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (req.method !== "POST") return new Response("POST seulement", { status: 405, headers: CORS });
  const diag = env("DIAG_TOKEN");
  if (diag.length >= 16 && req.headers.get("x-diag-token") === diag) return json(await diagnose());

  let input: { token?: string; system?: string; messages?: Msg[]; search?: boolean };
  try { input = await req.json(); } catch { return reply([{ error: "BAD_REQUEST", detail: "JSON invalide" }]); }
  const token = String(input?.token || "").slice(0, 200);
  const system = String(input?.system || "").slice(0, 30000);
  const raw = input?.messages;
  const messages = (Array.isArray(raw) ? raw : []).slice(-24)
    .filter(m => m && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content.slice(0, 6000) } as Msg));
  if (!token || !messages.length || messages[messages.length - 1].role !== "user") return reply([{ error: "BAD_REQUEST", detail: "jeton ou question manquants" }]);
  if (!KEY) return reply([{ error: "NO_KEY", detail: "secret GEMINI_API_KEY absent" }]);

  let quota;
  try { quota = await take(token); } catch (e) { console.error(e); return reply([{ error: "DOWN", detail: `compteur : ${clip((e as Error).message)}` }]); }
  if (quota.error) return reply([{ error: quota.error }]);
  return chat(system, messages, input.search !== false, quota);
});
