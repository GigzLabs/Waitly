import type { Metadata } from "next";
import { Suspense } from "react";
import { PartyStatus } from "@/components/join/party-status";

export const metadata: Metadata = { title: "Your place in line" };

async function Status({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartyStatus id={id} />;
}

export default function PartyStatusPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center p-6 text-sm font-semibold text-ink-3">Finding your place in line…</main>}>
      <Status params={params} />
    </Suspense>
  );
}
