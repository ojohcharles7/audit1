import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0b1b2b] px-5 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Wordmark light subtitle="Audit & Control" />
        </div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10">
          <WifiOff className="size-6" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Checklist drafts and queued evidence are stored securely on this device. Reconnect to
          synchronise and submit audits for validation.
        </p>
        <Link href="/dashboard" className="btn-primary mt-8">
          Try again
        </Link>
      </div>
    </main>
  );
}
