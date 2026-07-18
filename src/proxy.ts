import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { aj, ajAuth, ajWrite } from "@/lib/server/arcjet";

export async function proxy(request: NextRequest) {
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

  return handleAuthRedirect(request);
}

/**
 * Optimistic auth-based redirects using only the presence of the Better Auth
 * session cookie (no DB call — edge-safe). Real session validation happens in
 * (app)/layout.tsx and in every API route via getAuthUserId().
 */
function handleAuthRedirect(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // API routes authenticate themselves
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const hasSession = getSessionCookie(request) != null;

  // Redirect unauthenticated users to landing (except auth + landing + legal pages)
  if (
    !hasSession &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/landing") &&
    !pathname.startsWith("/legal") &&
    pathname !== "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/landing";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (hasSession && pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasSession ? "/dashboard" : "/landing";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
