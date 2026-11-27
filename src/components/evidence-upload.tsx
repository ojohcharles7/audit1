"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

export function EvidenceUpload({
  auditId,
  findingId,
  fraudCaseId,
  outletId,
  actionId,
  category = "general",
  label = "Upload evidence",
}: {
  auditId?: string;
  findingId?: string;
  fraudCaseId?: string;
  outletId?: string;
  actionId?: string;
  category?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Choose a file to upload.");
      return;
    }
    setPending(true);
    setError(null);
    setDone(false);
    try {
      if (auditId) data.set("auditId", auditId);
      if (findingId) data.set("findingId", findingId);
      if (fraudCaseId) data.set("fraudCaseId", fraudCaseId);
      if (outletId) data.set("outletId", outletId);
      if (actionId) data.set("actionId", actionId);
      data.set("category", category);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        return;
      }
      form.reset();
      setDone(true);
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="file"
          type="file"
          required
          className="block w-full max-w-xs text-[11px] text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-900 file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-white"
        />
        <button type="submit" disabled={pending} className="btn-secondary btn-sm">
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
          {pending ? "Uploading…" : label}
        </button>
      </div>
      <input name="description" placeholder="Optional description" className="input max-w-sm py-1.5 text-xs" />
      {error ? <p className="text-[10px] font-medium text-red-600">{error}</p> : null}
      {done ? <p className="text-[10px] font-medium text-emerald-600">Evidence uploaded and access logged.</p> : null}
    </form>
  );
}
