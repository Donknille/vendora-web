import { Sidebar } from "@/components/Sidebar";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
