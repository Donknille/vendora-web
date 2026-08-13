# Vendora — Refactoring-Plan (verhaltensneutral)

> **Zweck:** Vollständiger Arbeitsauftrag für ein ausführliches Refactoring des Bestandscodes.
> **Harte Randbedingung:** Keine einzige Funktion, kein Statuscode, kein Text, kein Pixel ändert sich.
> Erstellt am 2026-08-12 auf Basis einer Vermessung des Ist-Zustands (Zahlen unten sind gemessen, nicht geschätzt).
>
> Abgrenzung zu [`REBUILD-PLAN.md`](./REBUILD-PLAN.md): Der Rebuild-Plan ändert *was* die App tut.
> Dieser Plan ändert *wie der Code aussieht* — und nichts sonst.

---

## Fortschritt

Stand 2026-08-13. Die Ist-Vermessung in Abschnitt 1 bleibt als Momentaufnahme vom 2026-08-12 stehen;
was seither erledigt ist, steht hier.

| Schritt | Stand | Commit |
|---|---|---|
| 0.1 Baseline grün | ✅ | `e48342e` |
| 0.2 Vitest-Config bereinigt | ✅ | `4e1ea40`, `de76a5e` |
| 0.3 Quelltext-Guards gehärtet | ✅ | `7113b84` |
| 0.4 UI-Testharness | ✅ | `e103ffe` |
| 0.5 Charakterisierungs-Snapshots | ✅ | `e75b17a` |
| 0.6 API-Vertragstests | ✅ | `b555e15` |
| **Phase-0-Gate** | **erreicht** | |
| 0.5b Auth-Seiten nachgezogen | ✅ | `985ce6b` |
| 1.1 `date.ts` | ✅ | `5abf55a` |
| 1.2 `pickDefined` | ✅ | `f080851` |
| 1.3 Styling-Inventar | ✅ | `5c48ae8` |
| 1.4 Toter Code | ✅ | siehe unten |
| **Phase 1** | **abgeschlossen** | |
| 2.1 Route-Gerüst (`withAuth`) | ✅ | `bae2235` |
| 2.2 Zod-Schemas zentral | ✅ | `d4c8291` |
| **Phase 2** | **abgeschlossen** | |
| 3–6 | offen | |

Testbestand: **508 Tests in 45 Dateien** (452 node + 56 dom), vorher 349 in 35 Dateien.
15 DOM-Snapshots. Alle vier Verifikationsschritte grün.

Gerüst-Bilanz nach Phase 2 (`src/app/api`, −478 Zeilen):

| | vorher | nachher |
|---|---:|---:|
| 401-Block mit `"Unauthorized"` | 38 | 0 |
| 500-Fang mit `"Internal server error"` | 37 | 0 |
| 400-Block mit `flatten().fieldErrors` | 10 | 0 |
| `console.error` in Routen | 50 | 7 |

### Was Phase 0 nebenbei zutage gefördert hat

Drei Abweichungen, die vorher niemand festgehalten hatte. Alle drei sind **unverändert geblieben** —
sie sind jetzt begründet notiert und mit einem Stolperdraht versehen:

1. **`Sidebar.tsx` ruft `useQuery` direkt auf.** Es stand in keiner der hartkodierten Guard-Listen und
   war deshalb nie aufgefallen — der Fall „grün, bewacht aber nichts" aus Risiko R1, live im Bestand.
   Zulässig ist es, weil die Sidebar nur `data` liest und nie `isLoading`; der Phantom-Leer-Bug kann
   dort also nicht auftreten. Ein Test hält genau das fest: sobald sie `isLoading` anfasst, fällt die Ausnahme.
2. **`/api/admin/check` antwortet ohne Sitzung 200 statt 401** (`{isAdmin:false}`), weil die Sidebar
   daran den Admin-Link entscheidet. Gewollt, aber nirgends dokumentiert. Ein eigener Test pinnt fest,
   dass die Antwort genau ein Feld trägt — ein später ergänztes Feld wäre eine Preisgabe an jede
   anonyme Anfrage.
3. **Der Better-Auth-Browser-Client entkommt `vi.stubGlobal`**, weil er `fetch` beim Import festhält.
   Die Einstellungsseite baute im Test eine echte Verbindung nach `localhost:3000` auf. Der Lauf blieb
   grün und endete mit Exit-Code 1 — also *nach* den Zusicherungen, wo es leicht zu übersehen ist.
4. **Vier Eingabefeld-Looks und zwei Label-Abstände** (Phase 1.3). Über 20 Dateien verteilt fiel das
   nicht auf; in `styles.ts` nebeneinander schon. Unverändert gelassen, per Test festgehalten.
5. **Die UI reichte an drei Stellen einen rohen `string` durch, wo der Server ein Enum erwartet**
   (Marktstatus, Zahlungsart) — aufgedeckt in 2.2 durch die aus Zod abgeleiteten Hook-Typen.
   Der Server hat solche Werte immer schon mit 400 abgelehnt; jetzt sagt es der Typ vorher.

### Neue Werkzeuge, auf die die Phasen 1–5 aufsetzen

- `src/test-utils/sourceScan.ts` — `readSource` / `readUnit` / `readRoute`. Guards hängen ab jetzt an
  der Regel, nicht am Dateipfad. `readUnit("lib/server/storage")` liest heute die Datei und nach
  Phase 3 das Verzeichnis; `readRoute` liest Seite **plus eigenes `_components/`**, überlebt also die
  Zerlegung in Phase 4. Beides wurde durch vorweggenommene Umbauten geprüft.
- `src/test-utils/renderWithProviders.tsx` + `setupDom.ts` + `fixtures.ts` — Oberflächentests unter jsdom.
- `src/__tests__/ui/__snapshots__/` — **11 DOM-Snapshots. Das ist der Vertrag für Phase 1.3 und Phase 4.**
  Ändert sich einer, ist der Umbau nicht verhaltensneutral gewesen. Nicht „aktualisieren".
- `src/__tests__/routeContract.test.ts` — scannt alle Routen, prüft 401 samt wörtlicher Meldung.
  Der Wächter für Phase 2.1.

---

## 0. Arbeitsregeln (verbindlich)

1. **Verhaltensgleichheit ist das einzige Abnahmekriterium.** Jeder Schritt muss so beschaffen sein, dass
   ein Nutzer den Unterschied nicht bemerken kann: gleiche Statuscodes, gleiche Fehlermeldungen (wörtlich),
   gleiches gerendertes DOM, gleiche SQL-Semantik.
2. **Verifikationskette nach *jedem* Schritt** — alle vier grün, erst dann committen:
   `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build`
3. **Ein Schritt = ein Commit.** Kein Sammelcommit. Ein Schritt, der nicht in einen reviewbaren Commit passt,
   ist zu groß und wird geteilt. Rollback ist damit immer `git revert <sha>`.
4. **Keine gemischten Commits.** Ein Commit enthält entweder eine Verschiebung *oder* eine Änderung, nie beides.
   Umbenennen/Verschieben zuerst, inhaltliche Anpassung im Folge-Commit — sonst ist das Diff nicht lesbar.
5. **Die Security-Regeln aus `CLAUDE.md` bleiben unverändert gültig.** Ein Refactoring darf keinen
   `getAuthUserId()`-Aufruf, keinen `WHERE user_id`, keine Zod-Validierung und keine Transaktion entfernen —
   auch nicht „vorübergehend".
6. **Bei Zweifel: nicht anfassen.** Code, dessen Verhalten sich nicht durch einen Test absichern lässt,
   bleibt in diesem Refactoring, wie er ist. Lieber eine Baustelle offen lassen als eine stille Regression.

### Nicht-Ziele (ausdrücklich ausgeschlossen)

| Nicht Teil dieses Plans | Warum |
|---|---|
| Neue Features, geänderte Fachlogik | Refactoring per Definition |
| Abhängigkeits-Upgrades (Next, Drizzle, Better Auth …) | Eigenes Risiko, eigener Plan |
| Schemaänderungen / neue Migrationen | Würde Backup-Guard + Restore-Drill berühren |
| Visuelle Harmonisierung („einheitliche Rundungen") | Sichtbare Änderung — Designentscheidung, kein Refactoring. Siehe Risiko **R2** |
| Umformulierte UI-Texte | Sichtbare Änderung |
| Preis-/Plan-/Stripe-Logik | Geldfluss; nur mit eigenem Testplan anfassen |
| `script/backup/*`, `.github/workflows/backup.yml` | Läuft nachts produktiv, hängt an `assert-fresh-backup` — separat behandeln |

---

## 1. Ist-Zustand (gemessen am 2026-08-12)

**Umfang:** 24.223 Zeilen in `.ts/.tsx/.css/.sql` (versioniert), 36 API-Route-Dateien, 27 Seiten,
35 Testdateien mit 349 Tests.

### 1.1 Die größten Brocken

| Datei | Zeilen | Befund |
|---|---:|---|
| `src/lib/server/storage.ts` | 1177 | Neun Domänen in einem Modul (Users, Orders, Customers, Markets, Sales, Expenses, Profile, Invoices, Subscription, EÜR) |
| `src/app/(app)/settings/page.tsx` | 740 | Firmenprofil + Theme + Sprache + Export + Import + Abo + Kontolöschung in einer Komponente, ~14 `useState` |
| `src/lib/server/adminData.ts` | 594 | Admin-Aggregate; bewusst isoliert (Datenschutzgrenze), aber unstrukturiert |
| `src/app/(app)/markets/[id]/page.tsx` | 577 | Detailseite + Verkaufserfassung + zwei Löschdialoge |
| `src/app/(app)/orders/[id]/edit/page.tsx` | 501 | siehe 1.2 |
| `src/app/(app)/orders/[id]/page.tsx` | 451 | Detail + Rechnung + Storno + Statuswechsel |
| `src/app/(app)/markets/[id]/kasse/page.tsx` | 421 | Kassenmodus inkl. eigenem Inline-Modal |
| `src/app/(app)/orders/new/page.tsx` | 420 | siehe 1.2 |
| `src/app/(app)/expenses/page.tsx` | 378 | |
| `src/app/(app)/dashboard/page.tsx` | 371 | |

### 1.2 Copy-Paste zwischen „neu" und „bearbeiten"

Gemessen über zeilenweisen Vergleich (Einrückung normalisiert):

- `orders/new/page.tsx` ↔ `orders/[id]/edit/page.tsx`: **384 von 420 Zeilen identisch** (≈ 91 %).
  Beide deklarieren dieselben 11 State-Felder, dieselbe `handleCustomerNameChange`, `updateItem`, `addItem`,
  `removeItem`, dieselbe Subtotal-/Versand-/Summenrechnung und ~250 Zeilen identisches Formular-JSX.
  Unterschied: die Edit-Seite hat zusätzlich Status, `paidAt`, `paymentMethod` und einen Prefill-Effect.
- `markets/new/page.tsx` ↔ `markets/[id]/edit/page.tsx`: **160 von 300 Zeilen identisch** (≈ 53 %).

Konsequenz heute: Jede Änderung am Auftragsformular muss zweimal gemacht werden — und wurde es nicht immer
(die Neu-Seite validiert Straße/PLZ/Ort als Pflichtfeld, die Edit-Seite nur den Namen).

### 1.3 API-Routen: identisches Gerüst, 36 Mal abgeschrieben

| Muster | Vorkommen |
|---|---:|
| `getAuthUserId()` + `if (!userId) return 401` | 38 |
| `catch { console.error(...); return 500 "Internal server error" }` | 37 |
| `console.error` in Routen | 50 |
| `"Validation error"` + `parsed.error.flatten().fieldErrors` | 10 |

Der Rumpf jeder Route ist zu ~70 % Gerüst. Die eigentliche Fachlogik einer typischen Route sind 5–10 Zeilen.

### 1.4 Styling: `styles.ts` existiert, wird aber kaum benutzt

`src/lib/styles.ts` enthält **einen** Export (`inputClass`). Parallel dazu im JSX:

| Rohe Klassenkette | Vorkommen |
|---|---:|
| `rounded-lg border border-line bg-surface px-3 py-2.5 …` (Input) | 25 |
| `focus:ring-1 focus:ring-brand-primary` | 41 |
| `block text-sm font-medium text-secondary mb-1.5` (Label) | 20 |
| `bg-brand-primary px-4 py-…` (Primärbutton) | 17 |

**Achtung:** `inputClass` ist `rounded-xl … bg-input`, die Inline-Ketten sind `rounded-lg … bg-surface`.
Ein naives Ersetzen ändert das Aussehen. Siehe Risiko **R2**.

### 1.5 i18n: zwei parallele Wege

Neben dem `t`-Objekt aus `src/lib/i18n.ts` stehen **52 Inline-Ternaries** der Form
`language === "de" ? "…" : "…"` verteilt über 10 Dateien (Dashboard, Expenses, Markets ×3, Orders ×3, Settings).
Diese Texte sind nicht übersetzbar-zentral, tauchen in keinem Review als Textänderung auf und
existieren teils doppelt zu `t`-Einträgen.

`src/lib/i18n.ts` hat außerdem eine Zeile mit **2874 Zeichen** — der gesamte `orders`-Übersetzungsblock
steht auf einer Zeile. Diff-Rauschen bei jeder Textänderung, im Review faktisch nicht prüfbar.

### 1.6 Verstreute Datumsarithmetik

`new Date().toISOString().slice(0, 10)` bzw. `.split("T")[0]` steht **15 Mal in 9 Dateien**
(Storage, drei API-Routen, fünf Seiten). Es gibt kein `today()`. `src/lib/euerReport.ts` macht es
bewusst anders (String-Slice ohne `Date()`, Zeitzonenfalle) — diese Regel ist nirgends erzwungen,
außer im Guard-Test `euerSingleSource.test.ts`.

### 1.7 Testabdeckung: stark im Kern, blind in der UI

- **349 Tests, 35 Dateien.** Die reine Fachlogik (`euerReport`, `invoice`, `marketCosts`, `plan`,
  `formatCurrency`, `marketDay`) ist ordentlich abgedeckt, inklusive vier PGlite-Integrationstests.
- **Null UI-Tests.** `@testing-library/react` und `jest-dom` sind installiert, werden von keiner
  Testdatei importiert. `vitest.config.ts` setzt `environment: "node"` — es gibt kein jsdom-Setup.
  Die 3.000+ Zeilen TSX, die dieser Plan anfasst, haben **kein Sicherheitsnetz**.
- **9 Quelltext-Guards** (`readFileSync` + `toContain`): `security-phase1/2`, `adminDataBoundary`,
  `euerSingleSource`, `marketCostGate`, `appQuery`, `prefs`, `emailVerification`, `backupGuards`.
  Sie sind das Rückgrat der Architekturregeln — und gleichzeitig das größte Refactoring-Hindernis,
  weil sie auf **Dateipfade und Stringliterale** zeigen. Siehe Risiko **R1**.

### 1.8 Baseline ist nicht grün

`npm test` schlägt aktuell fehl:

```
FAIL src/__tests__/security-phase1.test.ts > 1.3 — rejects when STRIPE_WEBHOOK_SECRET is not set
Error: Test timed out in 5000ms.
```

Kein Logikfehler: Der Test importiert die Webhook-Route dynamisch, deren Modulgraph (Stripe + Storage +
Drizzle + Schema) beim Kaltstart länger als 5 s zum Laden braucht (Vitest meldet 31 s Importzeit über den
Gesamtlauf). Einzeln mit `--testTimeout=30000` laufen alle 11 Tests der Datei in 2,9 s durch.

Zusätzlich meldet Vitest bei jedem Lauf:
`ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1)`.

### 1.9 Kleinkram

- `AppSettings` in `src/lib/types.ts` wird nirgends verwendet (Rest der entfernten `app_settings`-Tabelle).
- `export const dynamic = "force-dynamic"` steht nur auf 2 von 27 Seiten, obwohl `CLAUDE.md` es für
  nutzerspezifische Seiten fordert. (Faktisch unkritisch, da fast alles Client-Komponenten sind —
  aber die Regel und der Code widersprechen sich.)
- Inline-Modal-Markup (`fixed inset-0`) in `kasse/page.tsx` und `WelcomeTour.tsx`, obwohl
  `components/ui/ConfirmDialog.tsx` existiert.
- Feldweises Update-Mapping (`if (x !== undefined) dbUpdates.x = x`) 14× in `updateOrder`,
  9× in `updateMarket`, 6× in `updateSubscription`.
- Nutzlast-Typen dreifach deklariert: einmal als Zod-Schema in der Route, einmal als Inline-Typ im
  React-Query-Hook, einmal als Parametertyp in `storage.ts`. Nichts hält sie synchron.

---

## 2. Zielbild

```
src/
├── lib/
│   ├── date.ts                  # NEU: today(), isoDay() — eine Quelle für Tagesdaten
│   ├── styles.ts                # ERWEITERT: alle Klassenketten, exakt die heutigen Werte
│   ├── schemas/                 # NEU: Zod-Schemas als einzige Quelle der Nutzlast-Typen
│   │   ├── order.ts  market.ts  expense.ts  profile.ts  …
│   └── server/
│       ├── route.ts             # NEU: withAuth(), ok(), fail() — das Routen-Gerüst
│       └── storage/             # storage.ts (1177 Z.) aufgeteilt
│           ├── index.ts         #   Barrel: re-exportiert alles → Aufrufer bleiben unverändert
│           ├── orders.ts  markets.ts  marketSales.ts  expenses.ts
│           ├── invoices.ts  profile.ts  customers.ts  subscription.ts  euer.ts  users.ts
│           └── shared.ts        #   toResponse-Mapper, pickDefined, PageOpts
├── components/
│   ├── forms/                   # NEU: OrderForm, MarketForm, ExpenseForm
│   └── ui/                      # ERWEITERT: Field, TextInput, MoneyInput, Modal
└── test-utils/
    └── renderWithProviders.tsx  # NEU: RTL-Harness (QueryClient + Language + Theme)
```

Messbare Ziele:

| Kennzahl | heute | Ziel |
|---|---:|---:|
| Größte Datei | 1177 Z. | < 300 Z. |
| Dateien > 400 Z. | 8 | 0 |
| Doppelte Zeilen `orders/new` ↔ `orders/edit` | 384 | < 30 |
| Route-Gerüst-Zeilen (401/500/catch) | ~280 | ~40 |
| Inline-`language === "de"`-Ternaries | 52 | 0 |
| UI-/Komponententests | 0 | ≥ 25 |
| Guard-Tests mit hartkodierter Dateiliste | 3 | 0 |

---

## 3. Risiken und wie sie entschärft werden

### R1 — Quelltext-Guards brechen beim Verschieben (hoch)

Neun Testdateien lesen Quelltext und prüfen auf Literale. Beispiele:

- `appQuery.test.ts` prüft **hartkodierte Listen** von 7 Hook- und 9 Seitenpfaden.
- `euerSingleSource.test.ts` prüft feste Pfade auf `computeEuerReports`, `aggregateEuerReports`, `isPaidLike`
  und auf die *Abwesenheit* von `function yearOf`, `new Date(...).getFullYear()`, `"shipped"`.
- `marketCostGate.test.ts` prüft, dass in `storage.ts` **vor** dem `planMarketCostRows`-Aufruf ein
  `eq(expenses.userId, userId)` steht — eine Reihenfolgeprüfung im Dateitext.
- `security-phase2.test.ts` prüft `requireWriteAccess` in `markets/[id]/copy/route.ts` und
  `PRO_REQUIRED` + `getEffectivePlan(user) !== "pro"` in `migrate/route.ts`.

Die gefährliche Variante ist nicht der rote Test — die ist harmlos. Gefährlich ist der Guard, der
nach dem Verschieben **grün bleibt, aber nichts mehr bewacht** (hartkodierte Liste, deren Datei
inzwischen anderswo liegt oder deren Regel jetzt im ausgelagerten Helfer steht).

**Gegenmaßnahme:** Phase 0.3 macht die Guards *vor* jeder Verschiebung verzeichnisbasiert
(Vorbild: `adminDataBoundary.test.ts` läuft mit `collectFiles()` über das Verzeichnis).
Jeder Guard bekommt zusätzlich einen Selbsttest `expect(files.length).toBeGreaterThan(n)`,
damit eine leergelaufene Liste auffällt. Erst danach darf Code umziehen.

### R2 — Styling-Konsolidierung ändert das Aussehen (hoch)

`inputClass` in `styles.ts` (`rounded-xl`, `bg-input`) unterscheidet sich von den 25 Inline-Ketten
(`rounded-lg`, `bg-surface`). Ein „Aufräumen" auf einen Wert ist eine **sichtbare Änderung**.

**Gegenmaßnahme:** Phase 1.3 inventarisiert zuerst alle vorkommenden Varianten und legt für **jede**
eine benannte Konstante an, die den heutigen String **zeichengenau** reproduziert
(`inputClass.surface`, `inputClass.page`, `inputClass.xl`). Die Vereinheitlichung ist ein separates
Designticket, nicht Teil dieses Plans. Absicherung: DOM-Snapshots aus Phase 0.4 müssen byte-identisch bleiben.

### R3 — UI-Refactoring ohne Netz (hoch)

Phase 4 fasst über 3.000 Zeilen TSX an, für die es heute keinen einzigen Test gibt.

**Gegenmaßnahme:** Phase 4 startet erst, wenn Phase 0.4 steht. Reihenfolge pro Seite ist strikt:
① Charakterisierungstest schreiben (rendert die *heutige* Seite, Snapshot des DOM) →
② Test grün gegen den unveränderten Code → ③ refactoren → ④ Snapshot muss unverändert sein.
Ein Snapshot, der sich ändert, ist ein Fehlschlag, kein „Snapshot aktualisieren".

### R4 — Textänderungen schleichen sich beim i18n-Umbau ein (mittel)

52 Ternaries in ein Objekt zu heben, heißt 104 Strings umzuziehen.

**Gegenmaßnahme:** Phase 5 verschiebt Strings ausschließlich per Copy-Paste, nie per Neuschreiben.
Zusätzlich ein Test, der eine stabile Prüfsumme über das gesamte Übersetzungsobjekt bildet:
Der Umbau darf sie nicht verändern (die Prüfsumme wird im selben Commit einmalig festgeschrieben,
danach ist sie ein Wächter gegen unbeabsichtigte Textänderungen).

### R5 — Barrel-Export ändert Ladeverhalten (niedrig)

`storage/index.ts` re-exportiert zehn Module. `import * as storage` lädt dann immer alle —
heute ist es ohnehin eine Datei, das Ladeverhalten wird also nicht schlechter. Relevant nur,
falls später gezielt einzeln importiert werden soll.

**Gegenmaßnahme:** Barrel beibehalten (0 Aufrufer-Änderungen), Direktimporte optional.
Nach Phase 3 einmal `npm run build` mit Bundle-Größenvergleich gegen den Stand davor.

### R6 — Route-Wrapper verschluckt einen Fehlerpfad (mittel)

`withAuth` muss exakt dieselben Statuscodes und **wörtlich dieselben** Meldungen liefern
(`"Unauthorized"`, `"Internal server error"`, `"Validation error"`), sonst brechen Client-Übersetzungen
in `apiError.ts` und die Guard-Tests.

**Gegenmaßnahme:** Phase 2.0 schreibt zuerst Vertragstests über **alle** 36 Routen
(401 ohne Session, 400 bei kaputtem Body, 404 bei fremder ID, 200 im Normalfall), gegen den
unveränderten Code. Erst dann kommt der Wrapper.

---

## Phase 0 — Sicherheitsnetz (kein Produktcode)

> Ohne diese Phase ist der Rest des Plans Raten. Sie ist die einzige Phase, die nicht optional ist.

### 0.1 Baseline grün machen

- `testTimeout: 20000` in der Vitest-Konfiguration setzen. Behebt den Kaltstart-Timeout aus 1.8
  (der Test ist inhaltlich in Ordnung, nur der Modulgraph ist langsam).
- Alternativ/ergänzend: den Webhook-Test auf `vi.mock` für `@/lib/server/storage` umstellen,
  damit der Drizzle-Graph gar nicht erst geladen wird. Vorzuziehen, weil es die Ursache trifft.
- **Abnahme:** `npm test` grün, drei Läufe hintereinander, ohne Flake.

### 0.2 Vitest-Konfiguration bereinigen

- `vitest.config.ts` → `vitest.config.mts` (behebt die ESM/CJS-Warnung, ohne `"type": "module"`
  in `package.json` zu setzen — das würde `drizzle.config`, `postcss.config` und `next.config` mitziehen).
- **Abnahme:** Testlauf ohne Warnung, gleiche Testanzahl (349).

### 0.3 Quelltext-Guards gegen Verschiebungen härten

Betrifft `appQuery.test.ts`, `euerSingleSource.test.ts`, `marketCostGate.test.ts`.

- Hartkodierte Pfadlisten durch Verzeichnisdurchlauf ersetzen (`collectFiles` aus
  `adminDataBoundary.test.ts` in `src/test-utils/sourceScan.ts` heben und von allen Guards nutzen).
- Jeder Guard bekommt eine Mindestzahl gefundener Dateien (`expect(files.length).toBeGreaterThanOrEqual(7)`),
  damit ein leergelaufener Scan rot wird statt still grün.
- `marketCostGate`s Reihenfolgeprüfung (`userId`-Filter vor `planMarketCostRows`) so umschreiben,
  dass sie über *alle* Dateien unter `lib/server/storage*` sucht statt über einen festen Pfad —
  sonst bricht sie in Phase 3.
- **Abnahme:** Guards grün. Gegenprobe: eine Datei testweise umbenennen → Guard wird rot (nicht still grün).
  Umbenennung zurücknehmen.

### 0.4 UI-Testharness aufbauen

- Vitest auf zwei Projekte umstellen: `node` (bestehende 35 Dateien, unverändert) und
  `jsdom` (neu, für `*.dom.test.tsx`). Kein bestehender Test ändert seine Umgebung.
- `src/test-utils/renderWithProviders.tsx`: rendert mit `QueryClientProvider` (frischer Client,
  `retry: false`), `LanguageProvider`, `ThemeProvider`, `AuthContext`-Stub mit fester `userId`.
- `fetch` per `vi.stubGlobal` gegen feste Fixtures — keine echten Requests, keine Zeitabhängigkeit.
  Datumsabhängige Ausgaben über `vi.setSystemTime` festnageln, sonst sind Snapshots am Monatswechsel rot.
- **Abnahme:** Ein Rauchtest rendert `orders/new` und findet das Kundennamensfeld.

### 0.5 Charakterisierungs-Snapshots für die Refactoring-Ziele

Für jede Seite, die Phase 4 anfasst, **vor** der Änderung:

| Seite | Was der Test festhält |
|---|---|
| `orders/new` | DOM-Snapshot leeres Formular; Positionen hinzufügen/entfernen; Summenrechnung; Validierungsfehler bei leerem Kundennamen |
| `orders/[id]/edit` | DOM-Snapshot mit Fixture-Auftrag; Prefill aller Felder; Zahlungsart-Auswahl |
| `markets/new`, `markets/[id]/edit` | dito |
| `settings` | Snapshot aller sechs Abschnitte; Profil speichern; Export-Klick |
| `dashboard`, `expenses`, `markets/[id]`, `kasse` | Snapshot mit Fixture-Daten; Leerzustand; Fehlerzustand |

- **Abnahme:** ≥ 25 UI-Tests grün gegen den **unveränderten** Code. Diese Snapshots sind ab jetzt
  der Vertrag: Phase 4 gilt nur als erfolgreich, wenn sie unverändert bleiben.

### 0.6 API-Vertragstests für alle Routen

- Pro Route: 401 ohne Session, 400 bei ungültigem Body, 404 bei fremder/unbekannter ID, Erfolgsfall.
  Vorlage existiert (`salesBatchRoute`, `expenseDeleteRoute`, `invoiceIssueRoute`, `onboardingRoute`).
- Meldungstexte **wörtlich** prüfen (`"Unauthorized"`, `"Internal server error"`, `"Validation error"`),
  nicht nur den Statuscode — genau das sichert Phase 2 ab.
- **Abnahme:** Alle 36 Routen abgedeckt, grün.

**Phase-0-Gate:** Erst wenn 0.1–0.6 grün sind und `npm test` dreimal hintereinander ohne Flake
durchläuft, beginnt Phase 1. Bis hierhin wurde **keine Zeile Produktcode** angefasst.

---

## Phase 1 — Konventionen und Werkzeuge (mechanisch)

### 1.1 `src/lib/date.ts`

- `today(): string` (ISO-Tag), `isoDay(d: Date): string`.
- Die 15 Vorkommen in 9 Dateien darauf umstellen. **Ausnahme:** `euerReport.ts` bleibt unangetastet —
  dort ist die `Date()`-Vermeidung fachliche Absicht und per Guard geschützt.
- Neuer Guard: außerhalb von `lib/date.ts` und `euerReport.ts` kein `toISOString().slice(0, 10)` mehr.
- **Abnahme:** Unit-Tests für `date.ts`; alle Bestandstests grün.

### 1.2 `pickDefined` in `storage/shared.ts`

- Ersetzt das feldweise `if (x !== undefined) dbUpdates.x = x` in `updateOrder` (14×),
  `updateMarket` (9×), `updateSubscription` (6×).
- **Wichtig:** Die Sonderfälle bleiben ausformuliert und dürfen *nicht* in den Helfer wandern —
  `serviceDate: "" → null`, `paidAt: "" → null`, `applicationDeadline: "" → null` und die
  automatische `paidAt`-Setzung bei Statuswechsel sind Fachlogik, kein Mapping.
- **Abnahme:** `storage.int.test.ts` (PGlite) unverändert grün — er deckt genau diese Pfade ab.

### 1.3 Styling-Inventar in `styles.ts`

- Schritt A (nur lesen): Alle vorkommenden Klassenketten auflisten und nach Varianten gruppieren.
- Schritt B: Für jede Variante eine Konstante mit **exakt dem heutigen String**
  (`inputClass.surface`, `inputClass.page`, `inputClass.xl`, `labelClass`, `buttonClass.primary`, …).
- Schritt C: Mechanisch ersetzen, Datei für Datei, ein Commit pro Datei.
- **Kein** Vereinheitlichen von `rounded-lg` vs. `rounded-xl` (siehe R2) — das ist ein Folgeticket.
- **Abnahme:** DOM-Snapshots aus 0.5 byte-identisch. Das ist hier das eigentliche Kriterium.

### 1.4 Toter Code

- `AppSettings` aus `src/lib/types.ts` entfernen (Rest der abgeschafften `app_settings`-Tabelle).
- **Abnahme:** `tsc` grün.

---

## Phase 2 — API-Schicht

### 2.1 `src/lib/server/route.ts`

```ts
withAuth(handler)              // 401 "Unauthorized" bei null — wörtlich wie heute
withAuth(handler, { params })  // Variante für [id]-Routen
parseBody(schema, body)        // 400 "Validation error" + flatten().fieldErrors — wörtlich wie heute
fail(status, message, code?)   // eine Stelle für Fehlerantworten
```

- Der `try/catch`-Rahmen inklusive `console.error("<METHOD> <pfad> error:", e)` zieht in den Wrapper.
  Das Logformat bleibt identisch (Betriebsverhalten ist auch Verhalten).
- **Nicht** in den Wrapper wandern: `requireWriteAccess`, `requireAdmin`, Quota-Gates.
  Die bleiben im Rumpf sichtbar — sie sind die Sicherheitsentscheidung der jeweiligen Route,
  und `security-phase2.test.ts` prüft ihre Anwesenheit dort.
- Umstellung route-für-route, ein Commit pro Route, Vertragstest aus 0.6 als Wächter.
- **Abnahme:** Alle 36 Vertragstests unverändert grün, kein Test angepasst.
  Ein Test, der angepasst werden *muss*, ist ein Beweis für eine Verhaltensänderung — dann zurückrollen.

### 2.2 Zod-Schemas nach `src/lib/schemas/`

- Schemas aus den Route-Dateien in `lib/schemas/{order,market,expense,profile,marketSale}.ts` heben.
- Nutzlast-Typen der Hooks (`useOrders`, `useMarkets`, …) über `z.infer<typeof …>` daraus ableiten,
  statt sie erneut inline zu deklarieren. Beseitigt die Dreifachdeklaration aus 1.9.
- **Reihenfolge beachten:** Schema verschieben (Commit 1) → Hook-Typ ableiten (Commit 2).
  Der Import in `orders/[id]/route.ts`, der heute `orderTotalWithinBounds` aus `../route.ts` zieht
  (Route importiert Route), wird dabei aufgelöst.
- **Abnahme:** `validation.test.ts` unverändert grün; `tsc` grün ohne neue `any`.

---

## Phase 3 — Storage-Schicht

### 3.1 `storage.ts` aufteilen

Aufteilung entlang der bereits vorhandenen Kommentarbanner (`// ── Orders ──` …):

| Neue Datei | Inhalt | ca. Z. |
|---|---|---:|
| `storage/users.ts` | `getUser`, Onboarding-Flags | 40 |
| `storage/orders.ts` | Orders inkl. `buildOrderWithItems` | 250 |
| `storage/customers.ts` | `getCustomers`, `upsertCustomerFromOrder` | 70 |
| `storage/markets.ts` | Markets + `syncMarketExpenses` | 130 |
| `storage/marketSales.ts` | Sales inkl. Batch-Upsert | 110 |
| `storage/expenses.ts` | Expenses + `deleteExpense`-Dreiwege-Ergebnis | 90 |
| `storage/profile.ts` | Firmenprofil | 40 |
| `storage/invoices.ts` | Rechnungen, Storno, Archivierung, Purge | 260 |
| `storage/subscription.ts` | Plan, `getPlanInfo` | 60 |
| `storage/euer.ts` | Export-Freischaltungen | 40 |
| `storage/accountData.ts` | `deleteAllUserData` | 30 |
| `storage/shared.ts` | Mapper, `PageOpts`, `pickDefined`, `DbTransaction` | 60 |
| `storage/index.ts` | Barrel — re-exportiert alles | 15 |

- **Nulländerung an den Aufrufern:** Alle 36 Routen nutzen `import * as storage from "@/lib/server/storage"`.
  Ein Verzeichnis mit `index.ts` löst denselben Spezifizierer auf.
- Ein Commit pro herausgelöstem Modul, jeweils mit vollem Verifikationslauf.
- `import "server-only"` in **jedes** neue Modul (Regel aus `CLAUDE.md`).
- `syncMarketExpenses` bleibt zusammen mit `createMarket`/`updateMarket` in `markets.ts` —
  der `userId`-Filter vor `planMarketCostRows` ist per Guard geschützt und darf nicht auseinandergerissen werden.
- **Abnahme:** `storage.int.test.ts`, `planGate.int.test.ts`, `restore.int.test.ts`, `marketCostGate.test.ts`
  unverändert grün; `npm run build` ohne relevanten Bundle-Zuwachs.

### 3.2 `adminData.ts` (594 Z.) strukturieren

- Aufteilen in `adminData/{stats,users,audit}.ts` + `index.ts`.
- **Kritisch:** `adminDataBoundary.test.ts` erlaubt Zugriff auf `db`/`schema`/`drizzle-orm`
  ausschließlich aus `src/lib/server/adminData.ts`. Der Guard prüft heute genau diesen Pfad.
  Er muss im selben Commit auf das Verzeichnis erweitert werden — und die zweite Prüfung
  („aggregiert keine Geldspalten") muss über **alle** neuen Dateien laufen, nicht nur über `index.ts`.
- **Wenn dieser Guard nicht sauber mitgezogen werden kann: Schritt streichen.** Die Datenschutzgrenze
  ist wichtiger als eine aufgeräumte Datei.

---

## Phase 4 — UI-Schicht

> Start erst nach grünem Phase-0-Gate. Pro Seite: Snapshot → refactoren → Snapshot unverändert.

### 4.1 Formular-Primitive in `components/ui/`

- `<Field label required>`, `<TextInput>`, `<MoneyInput>` (kapselt `parseAmount`/`formatAmountInput`),
  `<DateInput>`, `<SelectField>`.
- Verwenden die Konstanten aus 1.3 — erzeugen also **dasselbe** Markup wie heute.
- **Abnahme:** Snapshots byte-identisch.

### 4.2 `OrderForm` extrahieren (größter Einzelgewinn)

- Ein `components/forms/OrderForm.tsx` mit `mode: "create" | "edit"`.
- `orders/new/page.tsx` und `orders/[id]/edit/page.tsx` schrumpfen auf Datenbeschaffung,
  Mutation und Navigation (je < 80 Zeilen).
- **Der Unterschied in der Pflichtfeldprüfung ist erhalten zu lassen:** Die Neu-Seite prüft heute
  Straße/PLZ/Ort, die Edit-Seite nur den Namen. Das ist eine bestehende Inkonsistenz — sie
  in diesem Refactoring zu „reparieren" wäre eine Verhaltensänderung. Über `mode` abbilden,
  in einem eigenen Ticket entscheiden.
- **Abnahme:** Beide Snapshots unverändert; ~380 doppelte Zeilen entfallen.

### 4.3 `MarketForm` extrahieren

- Analog für `markets/new` und `markets/[id]/edit` (~160 doppelte Zeilen).

### 4.4 `settings/page.tsx` (740 Z.) zerlegen

In `settings/_components/`: `ProfileSection`, `AppearanceSection`, `LanguageSection`,
`SubscriptionSection`, `DataBackupSection`, `DangerZoneSection`.
Die Seite wird zur Komposition (< 100 Z.).
- Zustand bleibt, wo er hingehört: Profilfelder in `ProfileSection`, Export/Import in `DataBackupSection`.
  Kein neuer globaler Store.

### 4.5 Restliche Großseiten

`markets/[id]` (577) → Kopf, Verkaufsliste, Verkaufsformular, Löschdialoge.
`kasse` (421) → Artikelraster, Warenkorb, Tagesabschluss; Inline-Modal auf ein
`components/ui/Modal` umstellen (das `ConfirmDialog` bereits nutzt).
`orders/[id]` (451), `expenses` (378), `dashboard` (371), `admin/users/[id]` (294) analog.

### 4.6 `force-dynamic` vereinheitlichen

- Entweder die Regel aus `CLAUDE.md` auf alle nutzerspezifischen Seiten anwenden **oder**
  die Regel präzisieren („gilt für Server-Komponenten mit Nutzerdaten").
- Zweiteres ist wahrscheinlich richtig — dann ist es eine Doku-Änderung, kein Code-Refactoring.
- **Abnahme:** `npm run build` zeigt dieselben Render-Modi wie vorher (Build-Ausgabe vorher/nachher vergleichen).

---

## Phase 5 — i18n

### 5.1 Übersetzungsobjekt lesbar formatieren

- `i18n.ts`: die 2874-Zeichen-Zeile und ihre Geschwister mehrzeilig umbrechen.
- **Reine Formatierung, kein Zeichen am Textinhalt.**
- Im selben Commit: `i18nIntegrity.test.ts`, der eine Prüfsumme über das serialisierte
  Übersetzungsobjekt bildet und festschreibt.
- **Abnahme:** Prüfsumme vor und nach dem Umbruch identisch.

### 5.2 Die 52 Inline-Ternaries auflösen

- Pro Datei ein Commit. Strings ausschließlich per Copy-Paste in `t` übernehmen.
- Doppelungen zu bestehenden `t`-Einträgen zusammenführen — aber nur, wenn beide Strings
  **zeichengleich** sind. Sonst bleiben beide erhalten (unterschiedlicher Text = unterschiedliche Bedeutung,
  auch wenn er ähnlich aussieht).
- Prüfsumme aus 5.1 wird pro Commit neu festgeschrieben; die Differenz muss im Diff sichtbar
  genau die verschobenen Strings sein.
- Neuer Guard: kein `language === "de" ?` mehr außerhalb von `i18n.ts` und `payments.ts`
  (`PAYMENT_METHOD_LABELS` ist ein legitimer Sonderfall).
- **Abnahme:** DOM-Snapshots unverändert — das ist der eigentliche Beweis, dass kein Text gekippt ist.

---

## Phase 6 — Regeln festschreiben

1. **`CLAUDE.md` aktualisieren:** Projektstruktur (Storage-Verzeichnis, `lib/schemas/`, `components/forms/`),
   Route-Konvention (`withAuth`), Styling-Konvention (`styles.ts`), i18n-Konvention.
   Der Abschnitt „Bekannte Architektur-Entscheidungen" bekommt die neuen Grenzen.
2. **`docs/PROGRESS.md`** um den Refactoring-Stand ergänzen.
3. **Guards konsolidieren:** Alle Quelltext-Guards in `src/__tests__/guards/` sammeln,
   gemeinsamer `sourceScan`-Helfer, jeder mit Mindestanzahl-Selbsttest.
4. **Lint-Regeln**, wo billiger als ein Guard-Test: Verbot von `process.env` außerhalb `lib/server/env.ts`,
   Verbot von rohem `useQuery` außerhalb `useAppQuery`.

---

## 4. Reihenfolge und Abhängigkeiten

```
0.1 Baseline grün ──► 0.2 Vitest-Config ──► 0.3 Guards härten ──┐
                                                                 ├──► PHASE-0-GATE
                      0.4 UI-Harness ──► 0.5 Snapshots ──────────┤
                      0.6 API-Vertragstests ────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
   Phase 1 (Werkzeuge)       Phase 2 (API)              Phase 3 (Storage)
   1.1 date · 1.2 pickDefined   2.1 route.ts               3.1 storage/
   1.3 styles · 1.4 dead code   2.2 schemas/               3.2 adminData/
        │                           │                           │
        └───────────────────────────┴───────────┬───────────────┘
                                                ▼
                                    Phase 4 (UI) — braucht 1.3 + 0.5
                                                ▼
                                    Phase 5 (i18n) — braucht 0.5
                                                ▼
                                    Phase 6 (Regeln festschreiben)
```

**Parallelisierbar:** Phasen 1, 2 und 3 berühren getrennte Schichten und können in beliebiger
Reihenfolge laufen. Phase 4 braucht 1.3 (Styling-Konstanten) und die Snapshots aus 0.5.
Phase 5 braucht ebenfalls die Snapshots.

**Aufwand (grobe Hausnummer, Einzelperson):**

| Phase | Umfang | Anteil |
|---|---|---:|
| 0 — Sicherheitsnetz | ~25 neue Tests, Harness, Guard-Umbau | 35 % |
| 1 — Werkzeuge | 4 kleine Schritte | 5 % |
| 2 — API | 36 Routen, 2 Teilschritte | 15 % |
| 3 — Storage | 13 neue Module, Guards nachziehen | 15 % |
| 4 — UI | 10 Seiten, 2 Formulare, Primitive | 25 % |
| 5 — i18n | 52 Ternaries, 10 Dateien | 3 % |
| 6 — Regeln | Doku, Lint | 2 % |

Der Löwenanteil steckt in Phase 0. Das ist kein Planungsfehler — es ist der Preis dafür,
3.000 Zeilen UI ohne Testabdeckung anfassen zu wollen, ohne dabei etwas kaputtzumachen.
Wer Phase 0 kürzt, kürzt nicht Aufwand, sondern Gewissheit.

---

## 5. Abnahmekriterien (gesamt)

Ein Refactoring gilt als abgeschlossen, wenn **alle** Punkte gelten:

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` grün — dreimal hintereinander, ohne Flake
- [ ] Kein Test wurde angepasst, um grün zu werden — außer den in Phase 0.3 bewusst gehärteten Guards
      und den Pfadangaben in Guards, deren Zieldatei umgezogen ist
- [ ] Alle DOM-Snapshots aus 0.5 byte-identisch zum Stand vor Phase 1
- [ ] Alle 36 API-Vertragstests unverändert grün
- [ ] i18n-Prüfsumme entspricht dem in 5.1 festgeschriebenen Stand (bereinigt um die dokumentierten Verschiebungen)
- [ ] Keine Datei > 400 Zeilen (Ausnahme: `i18n.ts`, ist Daten, kein Code)
- [ ] `git log` zeigt einen Commit pro Schritt, jede Message benennt den Schritt aus diesem Plan
- [ ] `CLAUDE.md` beschreibt die neue Struktur korrekt
- [ ] Manueller Durchlauf gegen `npm run dev`: Auftrag anlegen → Rechnung ausstellen → stornieren;
      Markt anlegen → Kasse → Tagesabschluss; Ausgabe erfassen; EÜR-Export CSV + PDF;
      Backup exportieren → importieren. Alles wie vorher.

---

## 6. Was dieser Plan bewusst offenlässt

Diese Punkte sind aufgefallen, gehören aber **nicht** in ein verhaltensneutrales Refactoring.
Jeder ist ein eigenes Ticket:

1. **Pflichtfeldprüfung Auftrag:** `orders/new` verlangt Straße/PLZ/Ort, `orders/[id]/edit` nicht.
   Eine der beiden ist falsch — das ist eine fachliche Entscheidung.
   *(Seit 0.5 durch einen Test festgehalten, damit ihn niemand versehentlich einebnet.)*
2. **Rundungen und Flächenfarben:** `rounded-lg`/`bg-surface` vs. `rounded-xl`/`bg-input`.
   Designentscheidung.
3. **`force-dynamic`-Regel** in `CLAUDE.md` deckt sich nicht mit dem Code (2 von 27 Seiten).
   Vermutlich ist die Regel zu weit formuliert, nicht der Code falsch.
4. **`getExpenses` ohne Pagination** ist der Reporting-Pfad und bewusst unbegrenzt.
   Bei wachsenden Datenmengen wird das relevant — dann als Performance-Ticket, nicht hier.
5. **Modulgraph-Ladezeit:** 31 s Importzeit über den Testlauf deutet darauf hin, dass
   Routen mehr ziehen als sie brauchen. Eigenes Thema (Bundle-Analyse), nicht Teil dieses Plans.
6. **`today()` rechnet nach UTC** (`src/lib/date.ts`, seit 1.1). In Deutschland liefert es
   zwischen Mitternacht und 01:00/02:00 Ortszeit den **Vortag** — betrifft das automatisch
   gesetzte Zahldatum, Belegdaten und neue Markttage. Ein Test hält das Verhalten fest.
   Die Korrektur ändert Zahlen, die in die EÜR laufen, und braucht deshalb eine eigene
   Entscheidung samt Migrationsüberlegung für Bestandsdaten.
7. **Über-Exporte.** Ein grober Scan meldet ~70 Exporte ohne Importeur außerhalb ihres Moduls.
   Der größte Teil davon sind legitime Typ-Exporte oder modulintern genutzte Funktionen —
   die Liste taugt als Hinweis, nicht als Arbeitsauftrag. Ein sauberer Durchgang braucht ein
   Werkzeug, das Namespace-Importe (`storage.x`) und `import type` versteht.
