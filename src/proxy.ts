import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { aj, ajAuth, ajWrite } from "@/lib/server/arcjet";

/**
 * Builds the per-request Content-Security-Policy.
 *
 * The nonce is what makes a strict policy possible: Next.js ships the RSC
 * payload and its bootstrap in *inline* <script> tags, so a policy of plain
 * `script-src 'self'` blocks them — the page then renders as static HTML and
 * React never hydrates (no forms, no navigation, no login).
 *
 * `'strict-dynamic'` lets those nonced scripts load the remaining bundles.
 * In development `'unsafe-eval'` is additionally required because React uses
 * eval to rebuild server-side error stacks in the browser.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and Next inject inline <style> tags that carry no nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Next.js reads the nonce back out of the request's CSP header and applies
  // it to every script tag it renders, so this must be set on the *request*
  // as well as on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const withCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // Rate limiting — fail-closed in production
  if (process.env.ARCJET_KEY) {
    const { pathname } = request.nextUrl;

    // Pick the appropriate rate limiter.
    //
    // The strict auth bucket (5/min) is deliberately narrow: only credential
    // *mutations* belong in it. It must NOT cover
    //  - the /auth/* pages, whose documents and RSC prefetches (every <Link
    //    href="/auth/register"> on the landing page prefetches one) would eat
    //    the budget before the user even submits the form, and
    //  - GET /api/auth/get-session, which the Better Auth client fires on
    //    every page load, so throttling it logs the user out of a working app.
    // Both fall through to the global 100/min limiter instead.
    let arcjetClient = aj;
    if (request.method !== "GET") {
      if (pathname.startsWith("/api/auth")) {
        arcjetClient = ajAuth; // 5 req/min for login/signup/password reset
      } else if (pathname.startsWith("/api")) {
        arcjetClient = ajWrite; // 20 req/min for API writes
      }
    }

    const decision = await arcjetClient.protect(request);
    if (decision.isDenied()) {
      const response = NextResponse.json(
        { message: "Too many requests" },
        { status: 429 }
      );
      response.headers.set("Retry-After", "60");
      return withCsp(response);
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail-closed: reject all requests in production if rate limiting is not configured
    console.error("ARCJET_KEY is not configured — rejecting request in production");
    return withCsp(
      NextResponse.json(
        { message: "Service temporarily unavailable" },
        { status: 503 }
      )
    );
  }

  return withCsp(handleAuthRedirect(request, requestHeaders));
}

/**
 * Optimistic auth-based redirects using only the presence of the Better Auth
 * session cookie (no DB call — edge-safe). Real session validation happens in
 * (app)/layout.tsx and in every API route via getAuthUserId().
 */
function handleAuthRedirect(
  request: NextRequest,
  requestHeaders: Headers
): NextResponse {
  const { pathname } = request.nextUrl;
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // API routes authenticate themselves
  if (pathname.startsWith("/api")) {
    return next();
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

  return next();
}

export const config = {
  matcher: [
    // Exclude framework internals, images, and root-level static/PWA assets
    // (sw.js, the web manifest, the offline fallback, the theme init script) so
    // they are neither rate-limited nor auth-redirected for logged-out visitors.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|theme-init.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
