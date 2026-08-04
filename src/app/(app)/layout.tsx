import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
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

  return (
    <div className="flex h-screen">
      <OfflineBanner />
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
