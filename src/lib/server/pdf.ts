import "server-only";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type Color,
} from "pdf-lib";

// Shared server-side PDF primitives for invoice and EÜR documents. Uses the
// StandardFonts (no embedded font asset) — those only encode WinAnsi/CP1252, so
// all free text is run through `sanitizeWinAnsi` before drawing.

export const A4: [number, number] = [595.28, 841.89];

export const PDF_COLORS = {
  ink: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.42, 0.45, 0.5),
  green: rgb(0.02, 0.47, 0.34),
  red: rgb(0.86, 0.15, 0.15),
  line: rgb(0.85, 0.86, 0.88),
  brand: rgb(0, 0.71, 0.65),
} as const;

// Transliterate common typographic characters that fall outside CP1252 (or that
// we prefer to normalise) to safe equivalents.
const TRANSLITERATE: Record<string, string> = {
  "‘": "'", "’": "'", "‚": ",", "‛": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "–": "-", "—": "-", "―": "-", "−": "-",
  "…": "...", " ": " ", "•": "-", "‹": "<", "›": ">",
};

/**
 * Make an arbitrary string safe to draw with a WinAnsi StandardFont. Keeps
 * printable ASCII, the Latin-1 supplement (CP1252 0xA0–0xFF) and the euro sign;
 * transliterates common punctuation; replaces anything else with '?'. This means
 * user free text (customer names, item labels, notes) never throws at draw time.
 */
export function sanitizeWinAnsi(input: string): string {
  let out = "";
  for (const ch of input) {
    const mapped = TRANSLITERATE[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (ch === "€") {
      out += ch; // € (CP1252 0x80)
      continue;
    }
    const code = ch.codePointAt(0)!;
    if (code === 9 || code === 10 || code === 13) {
      out += ch; // tab / newline / carriage return (callers split on these)
      continue;
    }
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
      continue;
    }
    out += "?";
  }
  return out;
}

export interface DrawOpts {
  bold?: boolean;
  color?: Color;
  /** Set false only for strings already known to be WinAnsi-safe. */
  sanitize?: boolean;
}

/**
 * A4 page with a downward text cursor (`y`) and left/right margins. Mirrors the
 * closure style previously inlined in euerExport, extracted so the invoice and
 * EÜR PDFs share one implementation.
 */
export class PdfCanvas {
  y: number;
  readonly left = 50;
  readonly right = 545;

  constructor(
    public doc: PDFDocument,
    public page: PDFPage,
    public font: PDFFont,
    public bold: PDFFont,
    startY: number
  ) {
    this.y = startY;
  }

  private prep(s: string, opts: DrawOpts): string {
    return opts.sanitize === false ? s : sanitizeWinAnsi(s);
  }

  /** Draw left-aligned at `x` on the current line. */
  text(s: string, x: number, size: number, opts: DrawOpts = {}): void {
    const font = opts.bold ? this.bold : this.font;
    this.page.drawText(this.prep(s, opts), {
      x,
      y: this.y,
      size,
      font,
      color: opts.color ?? PDF_COLORS.ink,
    });
  }

  /** Draw right-aligned so the text ends at `x` on the current line. */
  textRight(s: string, x: number, size: number, opts: DrawOpts = {}): void {
    const font = opts.bold ? this.bold : this.font;
    const str = this.prep(s, opts);
    this.page.drawText(str, {
      x: x - font.widthOfTextAtSize(str, size),
      y: this.y,
      size,
      font,
      color: opts.color ?? PDF_COLORS.ink,
    });
  }

  /** Horizontal rule at the current cursor. */
  hr(color: Color = PDF_COLORS.line, thickness = 1): void {
    this.page.drawLine({
      start: { x: this.left, y: this.y },
      end: { x: this.right, y: this.y },
      thickness,
      color,
    });
  }

  /** Move the cursor down by `n` points. */
  down(n: number): void {
    this.y -= n;
  }

  /** Append a fresh A4 page and reset the cursor to the top. */
  newPage(startY = 800): void {
    this.page = this.doc.addPage(A4);
    this.y = startY;
  }

  save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export async function createA4Canvas(startY = 800): Promise<PdfCanvas> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return new PdfCanvas(doc, page, font, bold, startY);
}
