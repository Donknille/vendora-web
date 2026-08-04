import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vendora",
  description: "Business Management Tool für Kleinunternehmer",
  applicationName: "Vendora",
  appleWebApp: {
    capable: true,
    title: "Vendora",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4AF37",
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

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body className="font-body antialiased">
        <ServiceWorkerRegistrar />
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
