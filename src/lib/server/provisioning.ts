import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";
import { user as authUser } from "./auth-schema";
import { TRIAL_DAYS } from "@/lib/plan";

/**
 * User provisioning helpers.
 *
 * Kept separate from `auth.ts` (getAuthUserId) to avoid an import cycle:
 * `lib/auth.ts` (Better Auth instance) → this module, while
 * `lib/server/auth.ts` → `lib/auth.ts`.
 */

/**
 * Ensures an app profile row exists in our `users` table for a Better Auth user.
 * Called from the Better Auth `user.create.after` hook, with the same id as
 * Better Auth's `user.id`.
 *
 * Deleting an account removes its profile row entirely (Art. 17), so there is
 * no tombstone to check against: a previously deleted email can register again
 * and gets a fresh trial.
 */
export async function ensureUserRecord(id: string, email: string) {
  const [existing] = await db.select().from(users).where(eq(users.id, id));
  if (existing) return existing;

  // New accounts get a TRIAL_DAYS full-access trial; the stored plan stays
  // "free" (the effective plan is "trial" while trialEndsAt is in the future).
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const [created] = await db
    .insert(users)
    .values({
      id,
      email,
      plan: "free",
      trialEndsAt,
    })
    .returning();
  return created;
}

/**
 * Wie `ensureUserRecord`, holt die E-Mail aber selbst aus der Better-Auth-
 * Tabelle. Für den `session.create.before`-Hook, der nur die userId sicher
 * kennt: schlägt der Hook nach der Registrierung fehl, ist das hier die zweite
 * und letzte Gelegenheit, das Profil anzulegen, bevor der Nutzer in einer
 * Sitzung landet, in der jeder API-Aufruf mit 401 endet.
 *
 * Existiert keine Auth-Zeile (gelöschtes Konto), passiert nichts — ein
 * gelöschtes Profil darf nicht über ein altes Cookie zurückkommen.
 */
export async function ensureUserRecordById(id: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (existing) return;

  const [identity] = await db
    .select({ email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, id));
  if (!identity?.email) return;

  await ensureUserRecord(id, identity.email);
}
