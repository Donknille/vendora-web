/**
 * Wiederkehrende Klassenketten der Oberfläche.
 *
 * ## Was hier steht und was nicht
 *
 * Aufgenommen sind nur die **langen, bedeutungstragenden** Ketten — ein
 * Eingabefeld, ein Label, ein Knopf. Kurze Utility-Kombinationen wie
 * `h-4 w-4` oder `space-y-4` bleiben bewusst im JSX: sie hierher zu ziehen
 * würde eine Indirektion einführen, ohne etwas zu erklären, und ist das
 * Gegenteil dessen, wofür Tailwind gedacht ist.
 *
 * ## Achtung: das sind Varianten, keine Duplikate
 *
 * Die App hat heute **vier** verschiedene Eingabefeld-Looks und **zwei**
 * Label-Abstände. Das sieht nach Versehen aus, ist aber der Bestand — und
 * jede Zusammenlegung wäre eine sichtbare Änderung:
 *
 * | Konstante       | Rundung      | Fläche       | Polsterung |
 * |-----------------|--------------|--------------|------------|
 * | `inputClass`    | `rounded-xl` | `bg-input`   | `px-3 py-2.5` |
 * | `inputSurface`  | `rounded-lg` | `bg-surface` | `px-3 py-2.5` |
 * | `inputNested`   | `rounded-lg` | `bg-page`    | `px-3 py-2`   |
 * | `inputAuth`     | `rounded-lg` | `bg-surface` | `px-4 py-3`   |
 *
 * `labelClass` endet auf `mb-1.5`, `labelTight` auf `mb-1`.
 *
 * Diese Datei führt die Ketten zusammen, damit die Unterschiede **sichtbar**
 * sind statt über 20 Dateien verteilt. Sie zu vereinheitlichen ist eine
 * Designentscheidung und steht als eigener Punkt in
 * `docs/REFACTORING-PLAN.md` — sie hier nebenbei zu treffen hieße, eine
 * Optikänderung als Aufräumen zu tarnen.
 */

// ── Eingabefelder ──────────────────────────────────────────

/** Das gerundete Feld mit eigener Eingabefläche. Märkte, Einstellungen, Ausgaben. */
export const inputClass =
  "w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors";

/** Das Standardfeld der Formularseiten (Aufträge). */
export const inputSurface =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-colors";

/** Feld **innerhalb** einer Karte — dunklerer Grund, engere Polsterung. */
export const inputNested =
  "w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-primary placeholder-holder focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-colors";

/** Feld der Anmelde-/Registrierungsseiten — größer, ohne Fokusring. */
export const inputAuth =
  "w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-primary transition";

// ── Beschriftungen ─────────────────────────────────────────

/** Feldbeschriftung mit `mb-1.5`. */
export const labelClass = "block text-sm font-medium text-secondary mb-1.5";

/** Feldbeschriftung mit `mb-1` — enger, sonst identisch. */
export const labelTight = "mb-1 block text-sm font-medium text-secondary";

// ── Schaltflächen ──────────────────────────────────────────

/** Runder Symbolknopf, hebt auf Vordergrundfarbe. Zurück-Pfeile, Aktionen. */
export const iconButton =
  "rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors";

/** Wie `iconButton`, hebt aber nur auf die Sekundärfarbe. */
export const iconButtonMuted =
  "rounded-lg p-2 text-faint hover:bg-elevated hover:text-secondary transition-colors";

/** Flacher Markenknopf für Nebenaktionen („Artikel hinzufügen"). */
export const ghostBrandButton =
  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/10 transition-colors";

/** Absendeknopf der Auth-Seiten. */
export const authSubmit =
  "w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition";

/** Blätterknopf in Tabellen. */
export const pagerButton =
  "px-3 py-1.5 rounded-lg border border-line text-primary disabled:opacity-40";

// ── Meldungen ──────────────────────────────────────────────

/** Rot hinterlegter Fehlerkasten über einem Formular. */
export const errorBox =
  "bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm";
