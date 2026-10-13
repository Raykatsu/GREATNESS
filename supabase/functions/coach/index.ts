// GREATNESS : le coach en ligne. Reçoit la question et le contexte du compte (profil, séances,
// records, programme…), appelle Gemini (avec la recherche Google) et renvoie la réponse en flux (SSE).
// Déployée automatiquement par GitHub Actions (.github/workflows/supabase.yml) : voir SUPABASE.md.
// Secrets (Edge Functions → Secrets) : GEMINI_API_KEY (obligatoire, gratuite sur aistudio.google.com).
// Facultatifs : AI_DAILY_LIMIT (80 messages par jour et par compte), GEMINI_MODELS, GEMINI_SEARCH_MODELS
// (listes séparées par des virgules) et GEMINI_THINKING (minimal, low, medium, high ou default).
// L'adresse du projet et la clé secrète Supabase sont fournies automatiquement par la plateforme.
const VERSION = "coach-7";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const KEY = env("GEMINI_API_KEY");
const list = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);
// Modèles, du meilleur au plus endurant. Les alias « latest » suivent le dernier Flash et Flash-Lite de
// Google. En période de forte demande, la version gratuite du dernier Flash peut rester muette : Flash-Lite
// (très rapide) prend alors le relais, puis le Flash précédent et Gemma. Un modèle retiré (404) est sauté.
const MODELS = list(env("GEMINI_MODELS") || "gemini-flash-latest,gemini-flash-lite-latest,gemini-3.7-flash,gemma-4-26b-a4b-it");
// Recherche Google, pour les questions qui demandent une info récente (actualité, prix, études…), essayée
// avant les modèles sans recherche. Le quota gratuit de Google la refuse souvent : le refus est retenu
// 15 min et la réponse vient alors sans recherche (elle marche dès que la facturation Google est activée).
const SEARCH_MODELS = list(env("GEMINI_SEARCH_MODELS") || "gemini-flash-latest,gemini-flash-lite-latest");
// Réflexion des modèles Gemini 3 et plus : « low » répond en quelques secondes au lieu d'une vingtaine.
const THINKING = env("GEMINI_THINKING") || "low";
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
Quand la recherche Google est disponible, utilise-la pour les infos factuelles récentes ou précises (études, actualité, produits, prix, lieux), pas pour les questions d'entraînement que les données de l'athlète suffisent à traiter. Sans recherche, réponds avec tes connaissances et signale simplement quand une info a pu changer.`;

type Msg = { role: "user" | "assistant"; content: string };
type Attempt = { model: string; search: boolean };
const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const clip = (t: unknown, n = 220) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const SSE_HEADERS = { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" };
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
// Mémoire de l'instance (elle sert plusieurs requêtes de suite) : modèles qui refusent le réglage de
// réflexion, et recherche refusée par le quota (on n'insiste pas pendant 15 min).
const noThinking = new Set<string>();
const searchBlocked = new Map<string, number>();
// Modèle surchargé (503) ou muet : passé en dernier pendant 10 min, pour ne pas le réattendre à chaque message.
const slowUntil = new Map<string, number>();
const isSlow = (model: string) => (slowUntil.get(model) ?? 0) > Date.now();
const thinks = (model: string) => THINKING !== "default" && !noThinking.has(model) && !/lite|gemma|gemini-[12]\./i.test(model);

// La question demande-t-elle une info récente ou introuvable dans les données de l'athlète ?
const WEB = /\b(actu|actus|actualites?|news|recemment|recente?s?|derni(er|ere|ers|eres) (etudes?|recherches?|nouvelles?|versions?|sorties?)|etudes?|meta-analyses?|selon (la science|les etudes|les chercheurs)|prix|couts?|coute|tarifs?|promos?|acheter|achat|ou trouver|magasins?|boutiques?|marques?|avis sur|comparatif|horaires?|adresse|pres de chez|meteo|match|tournoi|championnats?|jeux olympiques|record du monde|qui a gagne|transferts?|sites?|liens?|videos?|youtube|internet|google|cherche sur|20[2-9]\d)\b/;
const wantsWeb = (text: string) => WEB.test(text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

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
    generationConfig: { maxOutputTokens: 16384, ...(thinks(model) ? { thinkingConfig: { thinkingLevel: THINKING } } : {}) },
  };
}

// Ordre des essais : avec la recherche Google d'abord si la question en a besoin, puis sans.
function plan(web: boolean): Attempt[] {
  const now = Date.now(), out: Attempt[] = [];
  const order = (models: string[]) => [...models.filter(m => !isSlow(m)), ...models.filter(isSlow)];
  if (web) for (const model of order(SEARCH_MODELS)) if (!isGemma(model) && (searchBlocked.get(model) ?? 0) < now) out.push({ model, search: true });
  for (const model of order(MODELS)) out.push({ model, search: false });
  return out;
}
const errMsg = (t: string) => { try { return String(JSON.parse(t)?.error?.message ?? t); } catch { return t; } };

async function gemini(model: string, body: unknown, stream: boolean, signal?: AbortSignal) {
  const url = `${GEMINI}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  return await fetch(url, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
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
// Quota épuisé, modèle absent, panne, lenteur ou réponse vide : on passe à l'essai suivant.
// Délais avant le premier mot : 12 s pour le meilleur modèle (sinon un plus rapide prend le relais), 25 s
// pour les suivants ; puis 30 s sans nouvelles en cours de réponse, et une limite totale (la plateforme
// coupe une requête au bout de 150 s).
const PRIMARY_MS = Number(env("GEMINI_PRIMARY_MS") || 12_000), FIRST_MS = Number(env("GEMINI_FIRST_MS") || 25_000);
const STALL_MS = Number(env("GEMINI_STALL_MS") || 30_000);
type Run = { model: string; version: string; err: string; cut: boolean; blocked: boolean; ttft: number; tries: string[]; sources: Map<string, string> };
async function* converse(system: string, messages: Msg[], web: boolean, run: Run, budgetMs = 120_000) {
  const skip = new Set<string>();
  const t0 = Date.now(), deadline = t0 + budgetMs;
  const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  const queue = plan(web), retried = new Set<string>();
  while (queue.length) {
    const a = queue.shift()!;
    if (skip.has(a.model)) continue;
    if (deadline - Date.now() < 8_000) { run.err ||= "temps maximal dépassé"; return; }
    const label = `Gemini ${a.model}${a.search ? " + recherche" : ""}`;
    const ctrl = new AbortController(), s = Date.now();
    const firstMs = !a.search && a.model === MODELS[0] ? PRIMARY_MS : FIRST_MS;
    let timer = setTimeout(() => ctrl.abort(), Math.min(firstMs, deadline - Date.now()));
    let got = 0;
    try {
      let res: Response;
      try { res = await gemini(a.model, requestBody(a.model, a.search, system, messages), true, ctrl.signal); }
      catch (e) {
        run.err = `${label} : ${ctrl.signal.aborted ? `pas de réponse en ${secs(Date.now() - s)}` : clip((e as Error).message)}`;
        run.tries.push(`${label} → ${ctrl.signal.aborted ? "délai dépassé" : "erreur réseau"} (${secs(Date.now() - s)})`);
        console.error(run.err);
        if (ctrl.signal.aborted) { skip.add(a.model); slowUntil.set(a.model, Date.now() + 10 * 60e3); } // trop lent : modèle suivant
        continue;
      }
      if (!res.ok || !res.body) {
        const t = errMsg(await res.text().catch(() => ""));
        run.err = `${label} : HTTP ${res.status} ${clip(t, 240)}`;
        run.tries.push(`${label} → HTTP ${res.status} (${secs(Date.now() - s)}) ${clip(t, 140)}`);
        console.error(run.err);
        if (res.status === 400 && /thinking/i.test(t) && !noThinking.has(a.model)) {
          noThinking.add(a.model); // ce modèle ne connaît pas le réglage de réflexion : on réessaie sans
          queue.unshift(a);
        } else if (a.search && (res.status === 429 || (res.status === 400 && /search|grounding|tool/i.test(t)))) {
          searchBlocked.set(a.model, Date.now() + 15 * 60e3); // quota de la recherche : le modèle reste utilisable sans
        } else if ([401, 403, 404, 429].includes(res.status) || (res.status === 400 && /API[_ ]KEY/i.test(t))) {
          skip.add(a.model);
        } else if (res.status >= 500) {
          // surcharge chez Google (503) : on passe au modèle suivant ; s'il n'y en a plus, un nouvel essai 1 s plus tard
          slowUntil.set(a.model, Date.now() + 10 * 60e3);
          if (!queue.some(x => !skip.has(x.model)) && !retried.has(label) && deadline - Date.now() > 15_000) {
            retried.add(label);
            await new Promise(r => setTimeout(r, 1000));
            queue.unshift(a);
          }
        }
        continue;
      }
      try {
        for await (const chunk of readGemini(res)) {
          clearTimeout(timer);
          timer = setTimeout(() => ctrl.abort(), STALL_MS);
          const info = chunkInfo(chunk);
          if (info.version) run.version = info.version;
          for (const [url, title] of info.sources) run.sources.set(url, title);
          if (info.blocked) run.blocked = true;
          if (info.text) {
            if (!got) run.ttft = Date.now() - t0;
            got += info.text.length;
            yield info.text;
          }
        }
      } catch (e) {
        const silent = ctrl.signal.aborted;
        run.err = `${label} : ${got ? "flux interrompu" : "pas de réponse"} (${silent ? (got ? `plus rien pendant ${secs(STALL_MS)}` : `rien en ${secs(Date.now() - s)}`) : clip((e as Error).message)})`;
        console.error(run.err);
        if (got) run.cut = true;
        else if (silent) { skip.add(a.model); slowUntil.set(a.model, Date.now() + 10 * 60e3); }
      }
      run.tries.push(`${label} → ${got ? `${got} caractères` : "réponse vide"}${run.cut ? " (coupée)" : ""} (${secs(Date.now() - s)})`);
      if (got) { run.model = a.model; return; }
      if (!run.err.startsWith(label)) run.err = `${label} : réponse vide${run.blocked ? " (bloquée par le filtre de sécurité)" : ""}`;
    } finally {
      clearTimeout(timer);
      ctrl.abort(); // libère la connexion si la réponse n'a pas été lue jusqu'au bout
    }
  }
}

const newRun = (): Run => ({ model: "", version: "", err: "", cut: false, blocked: false, ttft: 0, tries: [], sources: new Map() });
const topSources = (run: Run) => [...run.sources].slice(0, 5).map(([url, title]) => ({ url, title }));

// Réponse en flux pour l'app. Un « ping » toutes les 8 s garde la connexion ouverte pendant que Gemini réfléchit.
function chat(system: string, messages: Msg[], web: boolean, quota: { remaining?: number | null; note?: string }) {
  let closed = false;
  return new Response(new ReadableStream({
    async start(c) {
      const send = (bytes: Uint8Array) => { if (!closed) try { c.enqueue(bytes); } catch { closed = true; } };
      const ping = setInterval(() => send(enc.encode(": ping\n\n")), 8000);
      const run = newRun();
      let sent = 0;
      try {
        for await (const t of converse(system, messages, web, run)) {
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
// Rapport ligne par ligne (une ligne JSON par étape, envoyée dès qu'elle est prête), avec des délais
// maximaux : il arrive toujours au bout. Ne contient aucun secret, seulement leur présence et leur format.
function diagnose() {
  let closed = false;
  return new Response(new ReadableStream({
    async start(c) {
      const write = (s: string) => { if (!closed) try { c.enqueue(enc.encode(s)); } catch { closed = true; } };
      const line = (o: unknown) => write(JSON.stringify(o) + "\n");
      const ping = setInterval(() => write("\n"), 5000);
      const t0 = Date.now();
      let ok = false;
      try {
        const keys = serverKeys(), k = keys[0]?.key || "";
        line({
          step: "configuration", version: VERSION,
          gemini_key: { present: !!KEY, length: KEY.length, prefix: KEY.slice(0, 3) },
          server_key: { sources: keys.map(x => x.source), format: k.startsWith("sb_secret_") ? "sb_secret" : k.startsWith("eyJ") ? "jwt" : k ? "autre" : "absente" },
          supabase_url: SB ? "présente" : "ABSENTE", models: MODELS, search_models: SEARCH_MODELS, thinking: THINKING, daily_limit: LIMIT,
        });
        try {
          const r = await rpc("gt_ai_take", { p_token: "diagnostic", p_limit: LIMIT });
          line({ step: "compteur", result: `HTTP ${r.status} ${clip(await r.text(), 160)}` });
        } catch (e) { line({ step: "compteur", error: clip((e as Error).message) }); }
        try {
          const s = Date.now();
          const r = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { "x-goog-api-key": KEY }, signal: AbortSignal.timeout(20_000) });
          const t = await r.text();
          if (r.ok) {
            // deno-lint-ignore no-explicit-any
            const all: any[] = JSON.parse(t).models || [];
            line({ step: "modèles disponibles", ms: Date.now() - s, models: all.filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
              .map(m => String(m.name).replace("models/", "")).filter(n => /flash|pro|gemma/i.test(n)) });
          } else line({ step: "modèles disponibles", error: `HTTP ${r.status} ${clip(t, 300)}` });
        } catch (e) { line({ step: "modèles disponibles", error: clip((e as Error).message) }); }
        // Le vrai chemin du chat, avec deux questions types : une d'entraînement (sans recherche)
        // et une d'actualité (recherche Google), en parallèle. On repart de zéro : refus retenus oubliés.
        searchBlocked.clear();
        noThinking.clear();
        slowUntil.clear();
        const probe = async (name: string, question: string) => {
          const s = Date.now(), run = newRun();
          let text = "", chunks = 0;
          try {
            const web = wantsWeb(question);
            for await (const t of converse("Athlète : Alex, 80 kg, objectif force. Développé couché : record 100 kg × 3.", [{ role: "user", content: question }], web, run, 65_000)) { text += t; chunks++; }
          } catch (e) { run.err = `erreur interne : ${clip((e as Error).message)}`; }
          const answered = !!text.trim();
          line({ step: name, answered, model: run.model, version: run.version, first_text_ms: run.ttft, ms: Date.now() - s, chunks, chars: text.length, sources: run.sources.size, tries: run.tries, ...(answered ? { sample: clip(text, 200) } : { error: run.err }) });
          return answered;
        };
        const [coach] = await Promise.all([
          probe("chat (entraînement)", "J'ai fait 4×5 au développé couché à 100 kg, la dernière série à l'échec. Je mets combien la prochaine fois ?"),
          probe("chat (actualité, recherche Google)", "Quelles sont les dernières études sur la créatine ? Cite tes sources."),
        ]);
        ok = coach;
        // Un essai court par modèle (sans recherche), en parallèle, 35 s maximum chacun ; plus deux candidats
        // et le meilleur modèle sans réglage de réflexion, pour comparer leur réactivité
        const probes = [...MODELS.map(model => ({ model, thinking: true })), { model: MODELS[0], thinking: false },
          ...["gemini-3.5-flash", "gemini-3.6-flash"].filter(m => !MODELS.includes(m)).map(model => ({ model, thinking: true }))];
        const tests = await Promise.all(probes.map(async ({ model, thinking }) => {
          const s = Date.now(), name = `essai ${model}${thinking ? "" : " (réflexion par défaut)"}`;
          try {
            const body = requestBody(model, false, "Test technique.", [{ role: "user", content: "Réponds seulement : OK" }]);
            // deno-lint-ignore no-explicit-any
            if (!thinking) delete (body.generationConfig as any).thinkingConfig;
            const r = await gemini(model, body, false, AbortSignal.timeout(35_000));
            const t = await r.text();
            let reply = "", version = "";
            try { const j = JSON.parse(t); reply = chunkInfo(j).text; version = j.modelVersion || ""; } catch { /* corps non JSON */ }
            return { step: name, status: r.status, ms: Date.now() - s, ...(r.ok ? { version, reply: clip(reply, 60) } : { error: clip(errMsg(t), 300) }) };
          } catch (e) {
            return { step: name, ms: Date.now() - s, error: (e as Error).name === "TimeoutError" ? "pas de réponse en 35 s" : clip((e as Error).message) };
          }
        }));
        tests.forEach(line);
      } catch (e) { line({ step: "erreur interne", error: clip((e as Error).message) }); }
      clearInterval(ping);
      line({ ok, ms: Date.now() - t0 });
      if (!closed) { closed = true; c.close(); }
    },
    cancel() { closed = true; },
  }), { headers: { ...CORS, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    return new Response(`GREATNESS : fonction coach en ligne (${VERSION}). Clé Gemini : ${KEY ? "présente" : "ABSENTE"}.`, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (req.method !== "POST") return new Response("POST seulement", { status: 405, headers: CORS });
  const diag = env("DIAG_TOKEN");
  if (diag.length >= 16 && req.headers.get("x-diag-token") === diag) return diagnose();

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
  // Recherche Google seulement si l'app l'autorise et si la question demande une info récente
  return chat(system, messages, input.search !== false && wantsWeb(messages[messages.length - 1].content), quota);
});
