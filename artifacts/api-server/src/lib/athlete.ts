import { and, asc, eq } from "drizzle-orm";
import {
  athleteProfilesTable,
  bodyMetricsTable,
  db,
  recoveryEntriesTable,
  workoutSessionsTable,
} from "@workspace/db";

export async function ensureAthleteProfile(userId: string) {
  const existing = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkUserId, userId))
    .limit(1);

  if (existing[0]) return existing[0];

  const [profile] = await db
    .insert(athleteProfilesTable)
    .values({ clerkUserId: userId })
    .returning();
  return profile;
}

export async function getAthleteOverview(userId: string) {
  const profile = await ensureAthleteProfile(userId);
  const [sessions, bodyMetrics, recovery] = await Promise.all([
    db.select().from(workoutSessionsTable).where(eq(workoutSessionsTable.clerkUserId, userId)).orderBy(asc(workoutSessionsTable.sessionDate)),
    db.select().from(bodyMetricsTable).where(eq(bodyMetricsTable.clerkUserId, userId)).orderBy(asc(bodyMetricsTable.metricDate)),
    db.select().from(recoveryEntriesTable).where(eq(recoveryEntriesTable.clerkUserId, userId)).orderBy(asc(recoveryEntriesTable.entryDate)),
  ]);

  return {
    profile,
    sessions: sessions.map((session) => ({
      id: session.id,
      legacyId: session.legacyId,
      date: session.displayDate,
      dateISO: session.sessionDate,
      exercise: session.exercise,
      sets: session.sets,
    })),
    bodyMetrics: bodyMetrics.map((metric) => ({
      id: metric.id,
      date: metric.displayDate,
      dateISO: metric.metricDate,
      weight: metric.weight,
    })),
    recovery: recovery.map((entry) => ({
      id: entry.id,
      legacyId: entry.legacyId,
      date: entry.displayDate,
      dateISO: entry.entryDate,
      sleep: entry.sleep,
      fatigue: entry.fatigue,
      stress: entry.stress,
      protScore: entry.protScore,
      carbScore: entry.carbScore,
      hydration: entry.hydration,
    })),
    imported: sessions.length > 0 || bodyMetrics.length > 0 || recovery.length > 0,
  };
}

export async function ownsConversation(conversationId: number, userId: string) {
  const { coachConversationsTable } = await import("@workspace/db");
  const rows = await db
    .select()
    .from(coachConversationsTable)
    .where(and(eq(coachConversationsTable.id, conversationId), eq(coachConversationsTable.clerkUserId, userId)))
    .limit(1);
  return rows[0] ?? null;
}