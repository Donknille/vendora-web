import { APP_NAME, APP_NAME_PRO } from "@/lib/brand";
import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import { getEffectivePlan, canCreate, canExportYear } from "@/lib/plan";
import * as storage from "@/lib/server/storage";
import { computeEuerReport } from "@/lib/euerReport";
import { buildEuerCsv, buildEuerPdf, type EuerExportMeta } from "@/lib/server/euerExport";
import type { Order, MarketEvent, MarketSale, Expense } from "@/lib/types";
import { isoDay } from "@/lib/date";

export const GET = withAuth(
  "GET /api/euer/export",
  async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const parsedYear = Number(searchParams.get("year"));
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : now.getFullYear();
  const format = searchParams.get("format") === "pdf" ? "pdf" : "csv";

  // Generating the EÜR/GuV year overview is a paid action ("erstellen") →
  // TRIAL/PRO may export any year. A FREE (read-only) account may still
  // re-export a year it already generated while it had access, but not a new
  // year. (Invoice PDFs and the DSGVO data export stay open regardless.)
  const user = await storage.getUser(userId);
  if (!user) {
    return fail(404, "User not found");
  }
  const plan = getEffectivePlan(user);
  const alreadyExported = await storage.hasEuerExport(userId, year);
  if (!canExportYear(plan, alreadyExported)) {
    return NextResponse.json(
      {
        message: `Für einen neuen Jahresreport wird ${APP_NAME_PRO} benötigt.`,
        code: "PRO_REQUIRED",
      },
      { status: 403 }
    );
  }
  // Unlock this year on generation so it stays re-exportable after the plan lapses.
  if (canCreate(plan)) {
    await storage.recordEuerExport(userId, year);
  }

  const [orders, markets, marketSales, expenses, profile] = await Promise.all([
    storage.getOrders(userId),
    storage.getMarkets(userId),
    storage.getAllMarketSales(userId),
    storage.getExpenses(userId), // reporting path: alle Quellen, unpaginiert
    storage.getProfile(userId),
  ]);

  const report = computeEuerReport({
    year,
    orders: orders as unknown as Order[],
    markets: markets as unknown as MarketEvent[],
    marketSales: marketSales as unknown as MarketSale[],
    expenses: expenses as unknown as Expense[],
  });

  const meta: EuerExportMeta = {
    companyName: profile.name || APP_NAME,
    isSmallBusiness: profile.isSmallBusiness,
    generatedOn: isoDay(now),
  };

  if (format === "pdf") {
    const bytes = await buildEuerPdf(report, meta);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="EUER_${year}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = buildEuerCsv(report, meta);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="EUER_${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
  },
  { errorMessage: "Export failed" }
);
