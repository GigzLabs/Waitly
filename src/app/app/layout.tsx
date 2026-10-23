import type { Metadata } from "next";
import { WaitlyProvider } from "@/lib/client";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Floor" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaitlyProvider>
      <AppShell>{children}</AppShell>
    </WaitlyProvider>
  );
}
