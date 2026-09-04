import { z } from "zod";

/**
 * Datumsfelder der Domäne sind `date`-Spalten und werden als `YYYY-MM-DD`
 * gelesen — die EÜR schneidet Jahr und Monat per String-Slice heraus. Ein
 * Wert wie „gestern" oder „31.12.2026" lief vorher als `z.string()` durch:
 * entweder ein 500 aus Postgres oder eine Zeile, die in jedem Report
 * unsichtbar blieb.
 */
export const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

/** Optionales Datum, das Formulare auch als leeren String schicken. */
export const isoDateOrEmpty = z.union([isoDateString, z.literal("")]);
