import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, athleteProfilesTable, bodyMetricsTable, recoveryEntriesTable, workoutSessionsTable } from "@workspace/db";
import {
  GetMyOverviewResponse,
  ImportMyLocalDataBody,
  ImportMyLocalDataResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { ensureAthleteProfile, getAthleteOverview } from "../lib/athlete";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/me/overview", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const overview = await getAthleteOverview(userId);
  res.json(GetMyOverviewResponse.parse(overview));
});

router.patch("/me/profile", async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  await ensureAthleteProfile(userId);
  const [profile] = await db
    .update(athleteProfilesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(athleteProfilesTable.clerkUserId, userId))
    .returning();
  res.json(UpdateMyProfileResponse.parse(profile));
});

router.post("/me/import", async (req, res): Promise<void> => {
  const parsed = ImportMyLocalDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  await ensureAthleteProfile(userId);
  const existingSessions = await db
    .select({ legacyId: workoutSessionsTable.legacyId })
    .from(workoutSessionsTable)
    .where(eq(workoutSessionsTable.clerkUserId, userId));
  const existingRecovery = await db
    .select({ legacyId: recoveryEntriesTable.legacyId })
    .from(recoveryEntriesTable)
    .where(eq(recoveryEntriesTable.clerkUserId, userId));
  const existingMetrics = await db
    .select({ metricDate: bodyMetricsTable.metricDate, weight: bodyMetricsTable.weight })
    .from(bodyMetricsTable)
    .where(eq(bodyMetricsTable.clerkUserId, userId));

  const sessionIds = new Set(existingSessions.map((row) => row.legacyId).filter((id): id is number => id !== null));
  const recoveryIds = new Set(existingRecovery.map((row) => row.legacyId).filter((id): id is number => id !== null));
  const metricKeys = new Set(existingMetrics.map((row) => `${row.metricDate}:${row.weight}`));

  const sessions = parsed.data.sessions.filter((session) => !sessionIds.has(session.id));
  const recovery = parsed.data.recovery.filter((entry) => !recoveryIds.has(entry.id));
  const bodyMetrics = parsed.data.bodyMetrics.filter((metric) => !metricKeys.has(`${metric.dateISO.toISOString().slice(0, 10)}:${metric.weight}`));

  if (sessions.length) {
    await db.insert(workoutSessionsTable).values(sessions.map((session) => ({
      clerkUserId: userId,
      legacyId: session.id,
      sessionDate: session.dateISO.toISOString().slice(0, 10),
      displayDate: session.date,
      exercise: session.exercise,
      sets: session.sets,
    })));
  }
  if (bodyMetrics.length) {
    await db.insert(bodyMetricsTable).values(bodyMetrics.map((metric) => ({
      clerkUserId: userId,
      metricDate: metric.dateISO.toISOString().slice(0, 10),
      displayDate: metric.date,
      weight: metric.weight,
    })));
  }
  if (recovery.length) {
    await db.insert(recoveryEntriesTable).values(recovery.map((entry) => ({
      clerkUserId: userId,
      legacyId: entry.id,
      entryDate: entry.dateISO.toISOString().slice(0, 10),
      displayDate: entry.date,
      sleep: entry.sleep,
      fatigue: entry.fatigue,
      stress: entry.stress,
      protScore: entry.protScore,
      carbScore: entry.carbScore,
      hydration: entry.hydration,
    })));
  }

  res.json(ImportMyLocalDataResponse.parse({
    sessionsImported: sessions.length,
    bodyMetricsImported: bodyMetrics.length,
    recoveryImported: recovery.length,
  }));
});

export default router;