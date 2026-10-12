// GREATNESS : le coach en ligne. Reçoit la question et le contexte du compte (profil, séances,
// records, programme…), appelle Gemini avec la recherche Google, et renvoie la réponse en flux (SSE).
// Secrets (Edge Functions → Secrets) : GEMINI_API_KEY (obligatoire, gratuite sur aistudio.google.com),
// GEMINI_MODELS (facultatif, liste séparée par des virgules), AI_DAILY_LIMIT (facultatif, 80 par défaut).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
// alias « latest » : suivent automatiquement le dernier modèle Flash de Google ; Flash-Lite en secours (quota plus large)
const MODELS = (Deno.env.get("GEMINI_MODELS") || "gemini-flash-latest,gemini-flash-lite-latest").split(",").map(s => s.trim()).filter(Boolean);
const LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") || 80);
const SB = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Règles posées par le serveur, prioritaires sur le contexte envoyé par l'app.
const GUARD = `Tu es le coach sportif de l'app GREATNESS. Réponds toujours en français, en tutoyant.
Sécurité : en cas de douleur ou de blessure, conseille d'arrêter l'exercice et de consulter un professionnel de santé ; ne pose pas de diagnostic médical ; ne donne jamais de dosage de médicament ni de produit dopant ; pas de conseils de régime extrême.
Tu as accès à la recherche Google : utilise-la quand une question demande une info factuelle récente ou précise (études, actualité, produits, lieux), pas pour les questions d'entraînement que les données de l'athlète suffisent à traiter.`;

type Msg = { role: "user" | "assistant"; content: string };
const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);

const clip = (t: string) => String(t).replace(/\s+/g, " ").slice(0, 200);
function reply(events: unknown[]) {
  return new Response(new ReadableStream({ start(c) { events.forEach(e => c.enqueue(sse(e))); c.close(); } }),
    { headers: { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
}

async function take(token: string) {
  const r = await fetch(`${SB}/rest/v1/rpc/gt_ai_take`, {
    method: "POST",
    headers: { apikey: SR, ...(SR.startsWith("eyJ") ? { Authorization: `Bearer ${SR}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_limit: LIMIT }),
  });
  if (!r.ok) throw new Error(`gt_ai_take ${r.status} ${await r.text()}`);
  return await r.json();
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

async function callGemini(model: string, body: unknown) {
  return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("POST seulement", { status: 405, headers: CORS });
  if (!KEY) return reply([{ error: "NO_KEY" }]);

  let input: { token?: string; system?: string; messages?: Msg[]; search?: boolean };
  try { input = await req.json(); } catch { return reply([{ error: "BAD_REQUEST" }]); }
  const token = String(input.token || "").slice(0, 200);
  const system = String(input.system || "").slice(0, 24000);
  const messages = (Array.isArray(input.messages) ? input.messages : []).slice(-24)
    .filter(m => m && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content.slice(0, 6000) } as Msg));
  if (!token || !messages.length || messages[messages.length - 1].role !== "user") return reply([{ error: "BAD_REQUEST" }]);

  let quota;
  try { quota = await take(token); } catch (e) { console.error(e); return reply([{ error: "DOWN", detail: `compteur : ${clip((e as Error).message)}` }]); }
  if (quota.error) return reply([{ error: quota.error }]);

  const base = {
    systemInstruction: { parts: [{ text: `${GUARD}\n\n${system}` }] },
    contents: contents(messages),
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };
  const attempts: { model: string; search: boolean }[] = [];
  for (const model of MODELS) {
    if (input.search !== false) attempts.push({ model, search: true });
    attempts.push({ model, search: false });
  }

  let upstream: Response | null = null, used = "", lastErr = "";
  const skip = new Set<string>();
  for (const a of attempts) {
    if (skip.has(a.model)) continue;
    const res = await callGemini(a.model, a.search ? { ...base, tools: [{ google_search: {} }] } : base);
    if (res.ok && res.body) { upstream = res; used = a.model; break; }
    const errText = (await res.text()).slice(0, 300);
    console.error("gemini", a.model, a.search, res.status, errText);
    lastErr = `Gemini ${a.model} HTTP ${res.status} ${clip(errText)}`;
    // quota épuisé ou modèle introuvable : inutile de réessayer ce modèle sans la recherche
    if (res.status === 429 || res.status === 404) skip.add(a.model);
  }
  if (!upstream) return reply([{ error: "DOWN", detail: lastErr }]);

  // On relaie le texte au fil de l'eau, puis les sources de la recherche Google.
  const reader = upstream.body!.getReader();
  const dec = new TextDecoder();
  const sources = new Map<string, string>();
  const stream = new ReadableStream({
    async start(c) {
      let buf = "", blocked = false;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            let chunk;
            try { chunk = JSON.parse(line.slice(5)); } catch { continue; }
            const cand = chunk.candidates?.[0];
            for (const part of cand?.content?.parts ?? []) if (part.text && !part.thought) c.enqueue(sse({ t: part.text }));
            for (const g of cand?.groundingMetadata?.groundingChunks ?? []) if (g.web?.uri) sources.set(g.web.uri, g.web.title || g.web.uri);
            if (cand?.finishReason === "SAFETY" || chunk.promptFeedback?.blockReason) blocked = true;
          }
        }
        c.enqueue(sse({ done: true, model: used, remaining: quota.remaining, blocked, sources: [...sources].slice(0, 5).map(([url, title]) => ({ url, title })) }));
      } catch (e) {
        console.error(e);
        c.enqueue(sse({ error: "DOWN" }));
      }
      c.close();
    },
  });
  return new Response(stream, { headers: { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
});
