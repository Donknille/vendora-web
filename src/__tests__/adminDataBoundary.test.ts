import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural guarantee that the platform operator cannot read a user's business
 * figures through the admin area.
 *
 * The product rule is: an admin administers ACCOUNTS (plan, block, delete) and
 * sees AGGREGATES, but never what an individual user earns or spends. Enforcing
 * that by review alone does not survive the first person in a hurry, so the
 * boundary is enforced here: every admin route must go through
 * `src/lib/server/adminData.ts`, which is the only module allowed to touch the
 * business tables — and which never returns a monetary figure taken from them.
 *
 * If this test fails, do not widen the allowlist. Add the aggregate you need to
 * adminData.ts instead.
 */

const ADMIN_API_DIR = join(process.cwd(), "src", "app", "api", "admin");

const FORBIDDEN_IMPORTS = [
  "@/lib/server/db",
  "@/lib/server/schema",
  "@/lib/server/storage",
  "@/lib/server/auth-schema",
  "drizzle-orm",
];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("admin data boundary", () => {
  const files = collectFiles(ADMIN_API_DIR);

  it("finds admin routes to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.replace(process.cwd(), "").replace(/\\/g, "/"), f]))(
    "%s does not reach past adminData into the business tables",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const offenders = FORBIDDEN_IMPORTS.filter((mod) =>
        new RegExp(`from\\s+["']${mod.replace(/[/@]/g, "\\$&")}["']`).test(source)
      );

      expect(
        offenders,
        `Admin routes must read through src/lib/server/adminData.ts. ` +
          `Move the query there (aggregates only) instead of importing: ${offenders.join(", ")}`
      ).toEqual([]);
    }
  );

  it("adminData never sums a monetary column of user data", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "server", "adminData.ts"),
      "utf8"
    );

    // Heuristic backstop for the rule the module documents: counting rows is
    // allowed, adding up what they are worth is not. Only SQL is inspected —
    // plain JS arithmetic such as Math.max() is not a database aggregate.
    const sqlBlocks = source.match(/sql<[^>]*>`[\s\S]*?`|sql`[\s\S]*?`/g) ?? [];

    const moneyColumns = [
      "total", "amount", "price",
      "standFee", "stand_fee",
      "travelCost", "travel_cost",
      "shippingCost", "shipping_cost",
    ];

    const offenders = sqlBlocks.flatMap((block) => {
      const aggregates = block.match(/\b(sum|avg|min|max)\s*\(([^)]*)\)/gi) ?? [];
      return aggregates.filter((expr) =>
        moneyColumns.some((col) => new RegExp(`\\b${col}\\b`, "i").test(expr))
      );
    });

    expect(
      offenders,
      `adminData.ts must not aggregate user money columns: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
