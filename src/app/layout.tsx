import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import {
  DARK_COOKIE,
  LANGUAGE_COOKIE,
  THEME_COOKIE,
  isLanguage,
  isTheme,
  languageFromAcceptHeader,
  resolveDark,
} from "@/lib/prefs";
import { APP_CLAIM, APP_DESCRIPTION, APP_NAME, APP_URL, BRAND_GOLD, OG_IMAGE } from "@/lib/brand";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  // metadataBase macht relative Bildpfade absolut — ohne sie taucht das
  // OG-Bild beim Teilen als relativer Pfad auf und wird nirgends geladen.
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_CLAIM,
    locale: "de_DE",
    url: APP_URL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${APP_NAME} — ${APP_CLAIM}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_CLAIM,
    images: [OG_IMAGE],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_GOLD,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce-based CSP requires every page to render per request — a page
  // prerendered at build time could only ever carry a stale nonce.
  // Next.js reads the nonce out of the CSP header set in src/proxy.ts and
  // applies it to its own script tags, so nothing needs to be passed down
  // by hand (doing so causes a hydration mismatch: browsers strip the nonce
  // attribute from the DOM, so the client would compare against an empty one).
  await connection();

  // Theme and language come from cookies, so the first paint is already the
  // final one: no blocking script, no flash, and — most importantly — server
  // and client render the same markup. The blocking theme script that used to
  // sit here was the cause of React #418 on every single page load.
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  const language = cookieStore.get(LANGUAGE_COOKIE)?.value;

  const initialTheme = isTheme(theme) ? theme : "system";
  const systemPrefersDark = cookieStore.get(DARK_COOKIE)?.value === "1";
  const isDark = resolveDark(initialTheme, systemPrefersDark);

  // Before the first visit has set a cookie, Accept-Language is a better guess
  // than a hardcoded "de" — and it is available on the server, unlike
  // navigator.language.
  const initialLanguage = isLanguage(language)
    ? language
    : languageFromAcceptHeader((await headers()).get("accept-language"));

  return (
    // suppressHydrationWarning covers the one case the server cannot know:
    // a "system" theme whose OS preference changed since the last visit, which
    // the client corrects on the html element after mount.
    <html lang={initialLanguage} className={isDark ? "dark" : undefined} suppressHydrationWarning>
      <body className="font-body antialiased">
        <ServiceWorkerRegistrar />
        <Providers
          initialTheme={initialTheme}
          initialDark={isDark}
          initialLanguage={initialLanguage}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
