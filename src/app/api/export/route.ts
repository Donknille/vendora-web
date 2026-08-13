import { NextResponse } from "next/server";
import { withAuth } from "@/lib/server/route";
import * as storage from "@/lib/server/storage";

export const GET = withAuth(
  "GET /api/export",
  async ({ userId }) => {
  const [orders, markets, marketSales, expenses, profile, invoiceCounter, invoices, customers, user] =
    await Promise.all([
      storage.getOrders(userId),
      storage.getMarkets(userId),
      storage.getAllMarketSales(userId),
      // Bewusst nur die manuellen Ausgaben: der Restore leitet die
      // Marktkosten aus den Maerkten neu ab (api/migrate/route.ts). Wuerde
      // das Backup sie mitfuehren, entstuenden beim Import Doppelbuchungen.
      storage.getExpenses(userId, { source: "manual" }),
      storage.getProfile(userId),
      storage.getInvoiceCounter(userId),
      storage.getInvoices(userId),
      // Kundenstamm und Kontodaten gehoeren zur Auskunft nach Art. 20 DSGVO.
      // Der Restore baut die Kunden zwar aus den Auftraegen neu auf und
      // ignoriert diese Felder — fuer den Datenexport zaehlt aber, was ueber
      // die Person gespeichert ist, nicht was der Import braucht.
      storage.getCustomers(userId),
      storage.getUser(userId),
    ]);

  return NextResponse.json({
    schemaVersion: 2, // money as integer cents
    exportedAt: new Date().toISOString(),
    account: user
      ? {
          email: user.email,
          createdAt: user.createdAt,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
        }
      : null,
    orders,
    customers,
    markets,
    marketSales,
    expenses,
    profile,
    invoiceCounter,
    invoices,
  });
  }
);
