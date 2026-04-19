import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vendora",
  description: "Business Management Tool für Kleinunternehmer",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
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
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
