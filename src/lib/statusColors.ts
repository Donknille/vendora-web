/**
 * Farbtöne für kleine Status- und Kategorie-Abzeichen.
 *
 * Vorher gab es drei Systeme nebeneinander: `bg-green-100 text-green-800`
 * (nur hell — pastellige Blöcke auf Obsidian), `bg-green-500/10
 * text-green-600` (adaptiv) und `text-blue-400` auf 10-%-Tint (nur dunkel —
 * ausgewaschen auf Weiß). /orders und /markets sahen wie zwei Produkte aus.
 *
 * Ein Muster für alle: getönter Grund, kräftige Schrift im Hellen, hellere
 * Schrift im Dunkeln. Die Klassen stehen ausgeschrieben, weil Tailwind sie
 * im Quelltext finden muss.
 */
export type Tone =
  | "green"
  | "orange"
  | "amber"
  | "yellow"
  | "blue"
  | "teal"
  | "pink"
  | "purple"
  | "indigo"
  | "red"
  | "zinc"
  | "brand"
  | "neutral";

export const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  yellow: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  teal: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
  pink: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  purple: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  zinc: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
  brand: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
  neutral: "bg-elevated text-faint border-line",
};

export function toneClasses(tone: Tone): string {
  return TONE_CLASSES[tone];
}
