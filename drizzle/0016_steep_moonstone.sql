-- Kontoloeschung: Tombstone raus, Zeile wirklich weg (DSGVO Art. 17).
--
-- Bisher blieb die Profilzeile mit E-Mail als Soft-Delete stehen, damit die
-- Adresse nicht erneut registriert werden kann. Das widersprach der
-- Datenschutzerklaerung ("alle personenbezogenen Daten geloescht bzw.
-- anonymisiert") und sperrte zurueckkehrende Kund:innen dauerhaft aus.
--
-- Schritt 1 raeumt die vorhandenen Tombstones ab. Ihre Geschaeftsdaten wurden
-- bei der Loeschung bereits entfernt und ihre Rechnungen sind entkoppelt
-- archiviert (invoices.user_id = NULL), es haengt also nichts mehr daran.
-- Sollte doch eine Fremdschluessel-Referenz existieren, schlaegt die Migration
-- hier bewusst fehl, statt still Datenmuell zu hinterlassen.
DELETE FROM "users" WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "deleted_at";
