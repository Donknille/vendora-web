import { NextResponse } from "next/server";
import { withRoute } from "@/lib/server/route";
import { requireAdmin } from "@/lib/server/admin";
import {
  getActivity,
  getConversion,
  getFeatureAdoption,
  getGrowth,
  getPlatformOverview,
  getPlatformRevenue,
} from "@/lib/server/adminData";

export const GET = withRoute("GET /api/admin/stats", async () => {
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
});
