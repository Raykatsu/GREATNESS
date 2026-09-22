import { and, asc, desc, eq } from "drizzle-orm";
import OpenAI from "openai";
import { Router, type IRouter, type Request } from "express";
import { db, coachConversationsTable, coachMessagesTable } from "@workspace/db";
import {
  CreateCoachConversationBody,
  GetCoachConversationParams,
  GetCoachConversationResponse,
  ListCoachConversationsResponse,
  SendCoachMessageBody,
  SendCoachMessageParams,
  SendCoachMessageResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { ensureAthleteProfile, getAthleteOverview } from "../lib/athlete";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(requireAuth);

const defaultCoachModel = "gpt-5-mini";

function userIdOf(req: Request): string {
  return (req as AuthenticatedRequest).userId;
}

function getCoachConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_COACH_MODEL?.trim() || defaultCoachModel;
  return apiKey ? { apiKey, model } : null;
}

function conversationShape(conversation: typeof coachConversationsTable.$inferSelect) {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

router.get("/coach/conversations", async (req, res): Promise<void> => {
  const userId = userIdOf(req);
  const conversations = await db
    .select()
    .from(coachConversationsTable)
    .where(eq(coachConversationsTable.clerkUserId, userId))
    .orderBy(desc(coachConversationsTable.updatedAt));
  res.json(ListCoachConversationsResponse.parse(conversations.map(conversationShape)));
});

router.post("/coach/conversations", async (req, res): Promise<void> => {
  const parsed = CreateCoachConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = userIdOf(req);
  const [conversation] = await db
    .insert(coachConversationsTable)
    .values({ clerkUserId: userId, title: parsed.data.title })
    .returning();
  res.status(201).json(conversationShape(conversation));
});

router.get("/coach/conversations/:id", async (req, res): Promise<void> => {
  const params = GetCoachConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conversation = await getOwnedConversation(params.data.id, userIdOf(req));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db
    .select()
    .from(coachMessagesTable)
    .where(and(eq(coachMessagesTable.conversationId, conversation.id), eq(coachMessagesTable.clerkUserId, userIdOf(req))))
    .orderBy(asc(coachMessagesTable.createdAt));
  res.json(GetCoachConversationResponse.parse({
    ...conversationShape(conversation),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
  }));
});

router.post("/coach/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendCoachMessageParams.safeParse(req.params);
  const body = SendCoachMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : body.error.message });
    return;
  }
  const userId = userIdOf(req);
  const conversation = await getOwnedConversation(params.data.id, userId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const coachConfig = getCoachConfig();
  if (!coachConfig) {
    res.status(503).json({ error: "Le coach IA est en attente de la clé OpenAI côté serveur." });
    return;
  }

  const overview = await getAthleteOverview(userId);
  const history = await db
    .select()
    .from(coachMessagesTable)
    .where(and(eq(coachMessagesTable.conversationId, conversation.id), eq(coachMessagesTable.clerkUserId, userId)))
    .orderBy(asc(coachMessagesTable.createdAt));
  await db.insert(coachMessagesTable).values({
    conversationId: conversation.id,
    clerkUserId: userId,
    role: "user",
    content: body.data.content,
  });

  const client = new OpenAI({ apiKey: coachConfig.apiKey });
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: coachConfig.model,
      max_completion_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Tu es le coach sportif IA d'un athlète hybride francophone. Tu dois être précis, prudent et actionnable. Tu analyses uniquement les données présentes et tu ne dois jamais inventer une performance. Tu ne poses pas de diagnostic médical. Réponds en JSON strict avec les clés "reply" (string en français) et "actions" (tableau d'objets avec type parmi recommendation, create_session, update_session, log_performance et payload objet). Les actions sont uniquement des propositions : aucune modification ne doit être considérée comme appliquée sans confirmation explicite de l'utilisateur.
Profil: ${JSON.stringify(overview.profile)}
Séances récentes: ${JSON.stringify(overview.sessions.slice(-20))}
Suivi corporel: ${JSON.stringify(overview.bodyMetrics.slice(-20))}
Récupération récente: ${JSON.stringify(overview.recovery.slice(-14))}`,
        },
        ...history.slice(-12).map((message) => ({
          role: message.role === "assistant" ? "assistant" as const : "user" as const,
          content: message.content,
        })),
        { role: "user" as const, content: body.data.content },
      ],
    });
  } catch (error) {
    logger.error({ err: error, model: coachConfig.model }, "Coach AI provider request failed");
    res.status(502).json({ error: "Le moteur IA n’a pas pu répondre. Réessaie dans un instant." });
    return;
  }

  const raw = completion.choices[0]?.message?.content ?? "";
  if (!raw.trim()) {
    logger.error({ model: coachConfig.model }, "Coach AI provider returned an empty response");
    res.status(502).json({ error: "Le moteur IA a renvoyé une réponse vide. Réessaie dans un instant." });
    return;
  }

  let reply: string;
  let actions: Array<{ type: "create_session" | "update_session" | "log_performance" | "recommendation"; label: string; payload: Record<string, unknown> }> = [];
  try {
    const parsed = JSON.parse(raw) as { reply?: unknown; actions?: unknown };
    if (typeof parsed.reply !== "string" || !parsed.reply.trim()) {
      throw new Error("Coach AI response did not contain a non-empty reply");
    }
    reply = parsed.reply;
    if (Array.isArray(parsed.actions)) {
      actions = parsed.actions.filter((action): action is typeof actions[number] => {
        if (!action || typeof action !== "object") return false;
        const value = action as Record<string, unknown>;
        return typeof value.label === "string" && typeof value.payload === "object" && value.payload !== null &&
          !Array.isArray(value.payload) &&
          ["create_session", "update_session", "log_performance", "recommendation"].includes(String(value.type));
      });
    }
  } catch (error) {
    logger.error({ err: error, model: coachConfig.model }, "Coach AI provider returned invalid JSON");
    res.status(502).json({ error: "Le moteur IA a renvoyé une réponse inexploitable. Réessaie dans un instant." });
    return;
  }

  const [assistantMessage] = await db.insert(coachMessagesTable).values({
    conversationId: conversation.id,
    clerkUserId: userId,
    role: "assistant",
    content: reply,
  }).returning();
  await db.update(coachConversationsTable).set({ updatedAt: new Date() }).where(eq(coachConversationsTable.id, conversation.id));
  res.json(SendCoachMessageResponse.parse({
    message: {
      id: assistantMessage.id,
      role: "assistant",
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt,
    },
    actions,
    aiAvailable: true,
  }));
});

async function getOwnedConversation(id: number, userId: string) {
  const conversations = await db
    .select()
    .from(coachConversationsTable)
    .where(and(eq(coachConversationsTable.id, id), eq(coachConversationsTable.clerkUserId, userId)))
    .limit(1);
  return conversations[0] ?? null;
}

export default router;