import type { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
