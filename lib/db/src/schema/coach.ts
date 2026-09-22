import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const coachConversationsTable = pgTable("coach_conversations", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const coachMessagesTable = pgTable("coach_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoachConversationSchema = createInsertSchema(coachConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCoachMessageSchema = createInsertSchema(coachMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type CoachConversation = typeof coachConversationsTable.$inferSelect;
export type CoachMessage = typeof coachMessagesTable.$inferSelect;
export type InsertCoachConversation = z.infer<typeof insertCoachConversationSchema>;
export type InsertCoachMessage = z.infer<typeof insertCoachMessageSchema>;