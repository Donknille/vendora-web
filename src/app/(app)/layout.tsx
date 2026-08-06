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
  // cookie-only middleware check). Unauthenticated users go to the landing page.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/landing");
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
