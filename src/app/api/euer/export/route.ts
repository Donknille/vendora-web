import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { computeEuerReport } from "@/lib/euerReport";
import { buildEuerCsv, buildEuerPdf, type EuerExportMeta } from "@/lib/server/euerExport";
import type { Order, MarketEvent, MarketSale, Expense } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const parsedYear = Number(searchParams.get("year"));
    const year =
      Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : now.getFullYear();
    const format = searchParams.get("format") === "pdf" ? "pdf" : "csv";

    const [orders, markets, marketSales, expenses, profile] = await Promise.all([
      storage.getOrders(userId),
      storage.getMarkets(userId),
      storage.getAllMarketSales(userId),
      storage.getReportingExpenses(userId),
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
      companyName: profile.name || "Vendora",
      isSmallBusiness: profile.isSmallBusiness,
      generatedOn: now.toISOString().slice(0, 10),
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
  } catch (error) {
    console.error("GET /api/euer/export error:", error);
    return NextResponse.json({ message: "Export failed" }, { status: 500 });
  }
}
