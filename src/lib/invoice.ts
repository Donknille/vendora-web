// Pure invoice snapshot construction, shared by the issuance/storno storage logic
// and tests. No DB or server imports — this module is deterministic and testable.
//
// GoBD model: an invoice is an immutable snapshot frozen at issuance. Corrections
// are never edits — they are a `cancellation` invoice (negative amounts, its own
// number, a reference to the original) followed by a fresh re-issuance.
//
// All money fields are integer cents (no float arithmetic).

export type InvoiceType = "invoice" | "cancellation";

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  price: number; // cents (unit price)
}

export interface InvoiceSeller {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface InvoiceCustomer {
  name: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export interface InvoiceSnapshot {
  type: InvoiceType;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD (Rechnungsdatum)
  serviceDate: string | null; // Leistungsdatum
  cancelsInvoiceId: string | null;
  seller: InvoiceSeller;
  customer: InvoiceCustomer;
  items: InvoiceLineItem[];
  subtotal: number; // cents
  shippingCost: number; // cents
  total: number; // cents (negative for a cancellation)
  taxNote: string;
  isSmallBusiness: boolean;
  notes: string;
}

export interface InvoiceOrderInput {
  customerName: string;
  customerEmail: string;
  customerStreet: string;
  customerZip: string;
  customerCity: string;
  customerCountry: string;
  serviceDate: string | null;
  shippingCost: number | null;
  notes: string;
}

export interface InvoiceProfileInput {
  name: string;
  address: string;
  email: string;
  phone: string;
  taxNote: string;
  smallBusinessNote: string | null;
  isSmallBusiness: boolean;
}

/** Sum line items and add shipping — pure integer-cent arithmetic. */
export function computeInvoiceTotals(
  items: InvoiceLineItem[],
  shippingCost: number
): { subtotal: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return { subtotal, total: subtotal + shippingCost };
}

/**
 * Compose the frozen tax notice. §19 UStG is German law, so the small-business
 * hint is emitted in German; profile-specific notes are appended verbatim.
 */
export function buildInvoiceTaxNote(
  profile: Pick<InvoiceProfileInput, "isSmallBusiness" | "taxNote" | "smallBusinessNote"> | null
): string {
  const parts: string[] = [];
  if (profile?.isSmallBusiness) {
    parts.push("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
  }
  if (profile?.taxNote) parts.push(profile.taxNote);
  if (profile?.smallBusinessNote) parts.push(profile.smallBusinessNote);
  return parts.join("\n");
}

/** Build the immutable snapshot for a freshly issued invoice from an order + profile. */
export function buildInvoiceSnapshot(params: {
  invoiceNumber: string;
  issueDate: string;
  order: InvoiceOrderInput;
  items: InvoiceLineItem[];
  profile: InvoiceProfileInput | null;
}): InvoiceSnapshot {
  const { invoiceNumber, issueDate, order, items, profile } = params;
  const shippingCost = order.shippingCost ?? 0;
  const { subtotal, total } = computeInvoiceTotals(items, shippingCost);
  return {
    type: "invoice",
    invoiceNumber,
    issueDate,
    serviceDate: order.serviceDate ?? null,
    cancelsInvoiceId: null,
    seller: {
      name: profile?.name ?? "",
      address: profile?.address ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
    },
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      street: order.customerStreet,
      zip: order.customerZip,
      city: order.customerCity,
      country: order.customerCountry,
    },
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    subtotal,
    shippingCost,
    total,
    taxNote: buildInvoiceTaxNote(profile),
    isSmallBusiness: profile?.isSmallBusiness ?? true,
    notes: order.notes ?? "",
  };
}

/**
 * Build a cancellation (Storno) snapshot that reverses an original invoice:
 * same parties/positions, all amounts negated, its own number, and a reference
 * back to the original.
 */
export function buildCancellationSnapshot(params: {
  invoiceNumber: string;
  issueDate: string;
  cancelsInvoiceId: string;
  original: InvoiceSnapshot;
}): InvoiceSnapshot {
  const { invoiceNumber, issueDate, cancelsInvoiceId, original } = params;
  const reference = `Stornorechnung zu Rechnung ${original.invoiceNumber}`;
  return {
    ...original,
    type: "cancellation",
    invoiceNumber,
    issueDate,
    cancelsInvoiceId,
    items: original.items.map((i) => ({ ...i, price: -i.price })),
    subtotal: -original.subtotal,
    shippingCost: -original.shippingCost,
    total: -original.total,
    notes: original.notes ? `${reference}\n${original.notes}` : reference,
  };
}
