-- A3.3: Standgebühr und Fahrtkosten eines Markts werden nur noch als Ausgabe
-- gebucht, wenn der Markt 'confirmed' oder 'completed' ist.
--
-- Zwei einmalige Datenkorrekturen, beide idempotent (delete-and-reinsert, wie
-- storage.syncMarketExpenses):
--   (1) vergangene Märkte, deren Status nie gepflegt wurde -> 'completed'
--   (2) alle abgeleiteten Ausgabenzeilen nach der neuen Regel neu berechnen
--
-- Die Ableitung in (3)/(4) spiegelt src/lib/marketCosts.ts (Beschreibungstexte
-- mit Halbgeviertstrich, 200 Zeichen gekappt, Kategorien, nur Beträge > 0).
-- Beide Stellen müssen synchron bleiben; ein Test in
-- src/__tests__/marketCostGate.test.ts hält sie zusammen.
--
-- Reihenfolge im Betrieb: erst den Code deployen, dann migrieren. Umgekehrt
-- würde ein Markt-Edit im Zwischenfenster mit dem alten, ungegateten Code
-- wieder ungefiltert buchen.

-- (1) Backfill: ein Markt, der stattgefunden hat, hat stattgefunden. Das
-- Marktformular hat 'open' als Vorgabe, deshalb stehen viele bereits gelaufene
-- Märkte noch auf "Geplant" — ohne diesen Schritt würden ihre Kosten aus der
-- EÜR verschwinden. 'applied' bleibt unangetastet: dort ist "nicht gebucht"
-- genau richtig.
UPDATE "market_events"
SET "status" = 'completed'
WHERE "date" < CURRENT_DATE
  AND ("status" IS NULL OR "status" = 'open');
--> statement-breakpoint

-- (2) Abgeleitete Zeilen entfernen; manuelle Ausgaben bleiben unberührt.
DELETE FROM "expenses"
WHERE "source" IN ('market_fee', 'market_travel');
--> statement-breakpoint

-- (3) Standgebühren neu buchen.
INSERT INTO "expenses"
  ("id", "user_id", "market_id", "description", "amount", "category", "source", "expense_date", "created_at")
SELECT
  gen_random_uuid(),
  m."user_id",
  m."id",
  left('Standgebühr – ' || m."name", 200),
  m."stand_fee",
  'standgebuehren_raumkosten',
  'market_fee',
  m."date",
  now()
FROM "market_events" m
WHERE m."stand_fee" > 0
  AND m."status" IN ('confirmed', 'completed');
--> statement-breakpoint

-- (4) Fahrtkosten neu buchen.
INSERT INTO "expenses"
  ("id", "user_id", "market_id", "description", "amount", "category", "source", "expense_date", "created_at")
SELECT
  gen_random_uuid(),
  m."user_id",
  m."id",
  left('Fahrtkosten – ' || m."name", 200),
  m."travel_cost",
  'fahrtkosten',
  'market_travel',
  m."date",
  now()
FROM "market_events" m
WHERE m."travel_cost" > 0
  AND m."status" IN ('confirmed', 'completed');
