import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import {
  getActivity,
  getConversion,
  getFeatureAdoption,
  getGrowth,
  getPlatformOverview,
  getPlatformRevenue,
} from "@/lib/server/adminData";

export async function GET() {
  try {
    const actor = await requireAdmin();
    if (actor instanceof NextResponse) return actor;

    const [overview, growth, conversion, activity, adoption, revenue] = await Promise.all([
      getPlatformOverview(),
      getGrowth(12),
      getConversion(),
      getActivity(),
      getFeatureAdoption(),
      getPlatformRevenue(),
    ]);

    return NextResponse.json({ overview, growth, conversion, activity, adoption, revenue });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
