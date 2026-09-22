import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const athleteProfilesTable = pgTable(
  "athlete_profiles",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    displayName: text("display_name"),
    email: text("email"),
    goals: text("goals"),
    constraints: text("constraints"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex("athlete_profiles_clerk_user_id_idx").on(table.clerkUserId),
  }),
);

export const workoutSessionsTable = pgTable(
  "workout_sessions",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    legacyId: integer("legacy_id"),
    sessionDate: text("session_date").notNull(),
    displayDate: text("display_date").notNull(),
    exercise: text("exercise").notNull(),
    sets: jsonb("sets").$type<Array<{ reps: string; weight: string; rpe: string | null }>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const bodyMetricsTable = pgTable("body_metrics", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  metricDate: text("metric_date").notNull(),
  displayDate: text("display_date").notNull(),
  weight: real("weight").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recoveryEntriesTable = pgTable("recovery_entries", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  legacyId: integer("legacy_id"),
  entryDate: text("entry_date").notNull(),
  displayDate: text("display_date").notNull(),
  sleep: real("sleep"),
  fatigue: integer("fatigue").notNull(),
  stress: integer("stress").notNull(),
  protScore: text("prot_score"),
  carbScore: text("carb_score"),
  hydration: integer("hydration").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAthleteProfileSchema = createInsertSchema(athleteProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertWorkoutSessionSchema = createInsertSchema(workoutSessionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertBodyMetricSchema = createInsertSchema(bodyMetricsTable).omit({
  id: true,
  createdAt: true,
});
export const insertRecoveryEntrySchema = createInsertSchema(recoveryEntriesTable).omit({
  id: true,
  createdAt: true,
});

export type AthleteProfile = typeof athleteProfilesTable.$inferSelect;
export type WorkoutSession = typeof workoutSessionsTable.$inferSelect;
export type BodyMetric = typeof bodyMetricsTable.$inferSelect;
export type RecoveryEntry = typeof recoveryEntriesTable.$inferSelect;
export type InsertAthleteProfile = z.infer<typeof insertAthleteProfileSchema>;
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type InsertBodyMetric = z.infer<typeof insertBodyMetricSchema>;
export type InsertRecoveryEntry = z.infer<typeof insertRecoveryEntrySchema>;