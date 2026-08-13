import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AuthUserSeed } from "@/lib/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real server-side session validation (defense in depth beyond the
  // cookie-only middleware check).
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // Nicht direkt nach /landing: hierher kommt nur, wer ein Session-Cookie
    // MITBRINGT (ohne eines hätte der Proxy schon vorher umgeleitet) — es aber
    // ist ungültig. Bliebe es stehen, hielte der Proxy die Person weiter für
    // angemeldet und würfe sie von /auth/login erneut auf /dashboard, von wo
    // sie hier wieder landet. Die Anmeldeseite wäre unerreichbar. Der Endpunkt
    // löscht das Cookie und leitet dann auf /landing.
    redirect("/api/session/expired");
  }

  // The session is already validated here, so hand the user id to the client
  // tree instead of making it re-fetch /api/auth/get-session before any data
  // query may start. See AuthUserSeed for why that waterfall was harmful.
  return (
    <AuthUserSeed userId={session.user.id}>
      <div className="flex h-screen">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
    </AuthUserSeed>
  );
}
