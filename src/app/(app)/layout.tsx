import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

// These pages are authenticated and read from the database per-request,
// so they must never be statically prerendered at build time (no DB then).
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
