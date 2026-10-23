import type { Metadata } from "next";
import { WaitlistView } from "@/components/waitlist-view";

export const metadata: Metadata = { title: "Waitlist" };

export default function WaitlistPage() {
  return <WaitlistView />;
}
