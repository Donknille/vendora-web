import type { Order, Customer, CompanyProfile, MarketEvent, MarketSale, Expense } from "@/lib/types";

/**
 * Feste Testdaten fuer die Charakterisierungstests (Refactoring-Plan 0.5).
 *
 * Alle Betraege sind ganzzahlige Cent, alle Datumsangaben liegen fest. Nichts
 * hier wird aus `new Date()` abgeleitet — ein Snapshot, der am Monatswechsel
 * kippt, waere als Vertrag wertlos.
 */

export const FIXED_NOW = new Date("2026-03-15T10:00:00.000Z");

export const profileFixture: CompanyProfile = {
  id: "profile-1",
  userId: "test-user",
  name: "Keramik Krug",
  address: "Töpferweg 3, 12345 Musterstadt",
  email: "hallo@keramik-krug.de",
  phone: "0123 456789",
  taxNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  smallBusinessNote: null,
  isSmallBusiness: true,
  defaultShippingCost: 450,
};

export const customersFixture: Customer[] = [
  {
    id: "cust-1",
    name: "Anna Beispiel",
    email: "anna@example.org",
    street: "Musterstraße 1",
    zip: "10115",
    city: "Berlin",
    country: "Deutschland",
  },
  {
    id: "cust-2",
    name: "Bernd Muster",
    email: "bernd@example.org",
    street: "Hauptweg 7",
    zip: "20095",
    city: "Hamburg",
    country: "",
  },
];

export const orderFixture: Order = {
  id: "order-1",
  userId: "test-user",
  customerName: "Anna Beispiel",
  customerEmail: "anna@example.org",
  customerStreet: "Musterstraße 1",
  customerZip: "10115",
  customerCity: "Berlin",
  customerCountry: "Deutschland",
  status: "open",
  invoiceNumber: "",
  notes: "Bitte in Geschenkpapier einpacken.",
  orderDate: "2026-03-01",
  serviceDate: "2026-03-05",
  paidAt: null,
  paymentMethod: null,
  shippingCost: 450,
  total: 3450,
  processingStatus: null,
  comment: null,
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
  items: [
    {
      id: "item-1",
      orderId: "order-1",
      name: "Vase groß",
      quantity: 1,
      price: 2500,
      processingStatus: null,
      comment: null,
    },
    {
      id: "item-2",
      orderId: "order-1",
      name: "Untersetzer",
      quantity: 2,
      price: 250,
      processingStatus: null,
      comment: null,
    },
  ],
};

export const paidOrderFixture: Order = {
  ...orderFixture,
  id: "order-2",
  status: "paid",
  paidAt: "2026-03-10",
  paymentMethod: "cash",
  notes: "",
  serviceDate: null,
};

export const marketFixture: MarketEvent = {
  id: "market-1",
  userId: "test-user",
  name: "Frühlingsmarkt",
  date: "2026-03-14",
  location: "Marktplatz Musterstadt",
  standFee: 4500,
  travelCost: 1200,
  notes: "Stand 14, Aufbau ab 7 Uhr.",
  status: "confirmed",
  applicationDeadline: "2026-02-01",
  quickItems: [
    { name: "Tasse", price: 1500 },
    { name: "Schale", price: 2200 },
  ],
  createdAt: "2026-02-01T08:00:00.000Z",
};

export const marketSalesFixture: MarketSale[] = [
  {
    id: "sale-1",
    userId: "test-user",
    marketId: "market-1",
    clientId: null,
    description: "Tasse",
    amount: 1500,
    quantity: 2,
    paymentMethod: "cash",
    createdAt: "2026-03-14T11:00:00.000Z",
  },
  {
    id: "sale-2",
    userId: "test-user",
    marketId: "market-1",
    clientId: null,
    description: "Schale",
    amount: 2200,
    quantity: 1,
    paymentMethod: "card",
    createdAt: "2026-03-14T12:30:00.000Z",
  },
];

export const expensesFixture: Expense[] = [
  {
    id: "exp-1",
    userId: "test-user",
    marketId: null,
    description: "Ton, 25 kg",
    amount: 3200,
    category: "Materials",
    source: "manual",
    expenseDate: "2026-03-02",
    createdAt: "2026-03-02T09:00:00.000Z",
  },
  {
    id: "exp-2",
    userId: "test-user",
    marketId: "market-1",
    description: "Standgebühr – Frühlingsmarkt",
    amount: 4500,
    category: "standgebuehren_raumkosten",
    source: "market_fee",
    expenseDate: "2026-03-14",
    createdAt: "2026-03-14T08:00:00.000Z",
  },
];

export const subscriptionFixture = {
  plan: "pro" as const,
  canCreate: true,
  proActive: true,
  trialEndsAt: null,
  trialDaysLeft: null,
  expiresAt: "2026-12-31T00:00:00.000Z",
};
