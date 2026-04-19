import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { aj, ajAuth, ajWrite } from "@/lib/server/arcjet";

export async function middleware(request: NextRequest) {
  // Rate limiting — fail-closed in production
  if (process.env.ARCJET_KEY) {
    const { pathname } = request.nextUrl;

    // Pick the appropriate rate limiter
    let arcjetClient = aj;
    if (pathname.startsWith("/api/auth") || pathname.startsWith("/auth")) {
      arcjetClient = ajAuth; // 5 req/min for auth endpoints
    } else if (request.method !== "GET" && pathname.startsWith("/api")) {
      arcjetClient = ajWrite; // 20 req/min for API writes
    }

    const decision = await arcjetClient.protect(request);
    if (decision.isDenied()) {
      return NextResponse.json(
        { message: "Too many requests" },
        { status: 429 }
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail-closed: reject all requests in production if rate limiting is not configured
    console.error("ARCJET_KEY is not configured — rejecting request in production");
    return NextResponse.json(
      { message: "Service temporarily unavailable" },
      { status: 503 }
    );
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
