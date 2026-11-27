"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Check,
  Cloud,
  CloudOff,
  FileText,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { DocumentRow, QuestionRow, ResponseRow } from "@/lib/types";
import {
  clearLocalDraft,
  clearQueue,
  deleteQueuedSave,
  getQueuedSaves,
  loadLocalDraft,
  queueSave,
  saveLocalDraft,
} from "@/lib/offline";

type LocalResponse = {
  result: string | null;
  numericValue: string;
  textValue: string;
  amount: string;
  comment: string;
  documentIds: string[];
  updatedAt: string;
};

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const COMPLIANCE = [
  { value: "compliant", label: "Compliant" },
  { value: "partial", label: "Partially" },
  { value: "noncompliant", label: "Non-compliant" },
  { value: "na", label: "N/A" },
  { value: "investigation", label: "Investigate" },
];
const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "na", label: "N/A" },
];

function initialResponse(response: ResponseRow | undefined, documentIds: string[] = []): LocalResponse {
  return {
    result: response?.result ?? null,
    numericValue: response?.numeric_value != null ? String(response.numeric_value) : "",
    textValue: response?.text_value ?? "",
    amount: response?.amount_kobo != null ? String(response.amount_kobo / 100) : "",
    comment: response?.comment ?? "",
    documentIds,
    updatedAt: response?.updated_at ?? "",
  };
}

function answered(question: QuestionRow, response: LocalResponse) {
  if (question.response_type === "numeric") return response.numericValue !== "" || Boolean(response.result);
  if (question.response_type === "financial") return response.amount !== "" || Boolean(response.result);
  if (question.response_type === "text" || question.response_type === "date") return response.textValue.trim() !== "" || Boolean(response.result);
  return Boolean(response.result);
}

function payloadFor(auditId: string, questionId: string, response: LocalResponse) {
  return {
    auditId,
    questionId,
    result: response.result,
    numericValue: response.numericValue === "" ? null : Number(response.numericValue),
    textValue: response.textValue || null,
    amountKobo: response.amount === "" ? null : Math.round(Number(response.amount) * 100),
    comment: response.comment || null,
    documentIds: response.documentIds,
  };
}

export function ChecklistForm({
  audit,
  questions,
  responses,
  documents,
  responseDocuments,
}: {
  audit: { id: string; ref: string; title: string; status: string; template_name: string };
  questions: QuestionRow[];
  responses: ResponseRow[];
  documents: DocumentRow[];
  responseDocuments: { response_id: string; document_id: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, LocalResponse>>(() => {
    const initial: Record<string, LocalResponse> = {};
    for (const question of questions) {
      const response = responses.find((item) => item.question_id === question.id);
      const docs = response ? responseDocuments.filter((item) => item.response_id === response.id).map((item) => item.document_id) : [];
      initial[question.id] = initialResponse(response, docs);
    }
    return initial;
  });
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  const [documentsById, setDocumentsById] = useState<Record<string, { name: string; ref: string }>>(() =>
    Object.fromEntries(documents.map((document) => [document.id, { name: document.original_name, ref: document.ref }])),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [online, setOnline] = useState(true);
  const [recovered, setRecovered] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitIssues, setSubmitIssues] = useState<{ question: string; reason: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const loadedDraft = useRef(false);

  const sections = useMemo(() => {
    const map = new Map<string, QuestionRow[]>();
    for (const question of questions) {
      const list = map.get(question.section) ?? [];
      list.push(question);
      map.set(question.section, list);
    }
    return [...map.entries()];
  }, [questions]);

  const progress = useMemo(() => {
    let done = 0;
    let mandatoryMissing = 0;
    let evidenceMissing = 0;
    for (const question of questions) {
      const response = values[question.id];
      if (!response) continue;
      const ok = answered(question, response);
      if (ok) done++;
      if (question.mandatory && !ok) mandatoryMissing++;
      if (question.evidence_required !== "none" && ok && response.result !== "na" && response.documentIds.length === 0) evidenceMissing++;
    }
    return { done, mandatoryMissing, evidenceMissing, percent: questions.length ? Math.round((done / questions.length) * 100) : 0 };
  }, [questions, values]);

  useEffect(() => {
    const initial = window.setTimeout(() => setOnline(navigator.onLine), 0);
    const onOnline = () => setOnline(true);
    const onOffline = () => {
      setOnline(false);
      setSaveState("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (loadedDraft.current) return;
    loadedDraft.current = true;
    let cancelled = false;
    loadLocalDraft(audit.id)
      .then((draft) => {
        if (cancelled || !draft) return;
        const merged: Record<string, LocalResponse> = { ...valuesRef.current };
        let count = 0;
        for (const [questionId, raw] of Object.entries(draft.responses)) {
          const local = raw as LocalResponse;
          if (!local || !merged[questionId]) continue;
          if (local.updatedAt && local.updatedAt > (merged[questionId]!.updatedAt || "")) {
            merged[questionId] = local;
            count++;
          }
        }
        if (count > 0) {
          setValues(merged);
          setRecovered(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [audit.id]);

  useEffect(() => {
    const flush = async () => {
      if (!navigator.onLine) return;
      const queued = await getQueuedSaves();
      if (!queued.length) return;
      setSaveState("saving");
      for (const item of queued) {
        try {
          const res = await fetch("/api/checklist/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          if (res.ok || res.status === 409) {
            if (item.id != null) await deleteQueuedSave(item.id);
          }
        } catch {
          return;
        }
      }
      setSaveState("saved");
    };
    window.addEventListener("online", flush);
    if (navigator.onLine) flush();
    return () => window.removeEventListener("online", flush);
  }, []);

  function persist(next: Record<string, LocalResponse>) {
    saveLocalDraft(audit.id, next).catch(() => undefined);
  }

  function scheduleSave(questionId: string) {
    const existing = timers.current.get(questionId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      questionId,
      setTimeout(() => {
        void saveQuestion(questionId);
      }, 800),
    );
  }

  async function saveQuestion(questionId: string) {
    const response = valuesRef.current[questionId];
    if (!response) return;
    const payload = payloadFor(audit.id, questionId, response);
    setSaveState("saving");
    if (!navigator.onLine) {
      await queueSave({ auditId: audit.id, questionId, payload, createdAt: new Date().toISOString() });
      setSaveState("offline");
      return;
    }
    try {
      const res = await fetch("/api/checklist/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        setSaveState("error");
        setSubmitError("This audit has been submitted and locked. Reload the page.");
        return;
      }
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
    } catch {
      await queueSave({ auditId: audit.id, questionId, payload, createdAt: new Date().toISOString() });
      setSaveState("offline");
    }
  }

  function update(questionId: string, patch: Partial<LocalResponse>) {
    setValues((previous) => {
      const current = previous[questionId] ?? initialResponse(undefined);
      const next = { ...previous, [questionId]: { ...current, ...patch, updatedAt: new Date().toISOString() } };
      persist(next);
      return next;
    });
    scheduleSave(questionId);
  }

  function discardDraft() {
    clearLocalDraft(audit.id).catch(() => undefined);
    window.location.reload();
  }

  async function upload(questionId: string, file: File) {
    if (!navigator.onLine) {
      setSubmitError("Evidence upload requires an internet connection. Your checklist answers are saved locally.");
      return;
    }
    setUploading((previous) => ({ ...previous, [questionId]: true }));
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("auditId", audit.id);
      form.set("category", "audit_evidence");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json()) as { id?: string; name?: string; ref?: string; error?: string };
      if (!res.ok || !json.id) {
        setSubmitError(json.error ?? "Upload failed.");
        return;
      }
      setDocumentsById((previous) => ({ ...previous, [json.id!]: { name: json.name ?? file.name, ref: json.ref ?? "" } }));
      const current = valuesRef.current[questionId]!;
      update(questionId, { documentIds: [...current.documentIds, json.id] });
    } catch {
      setSubmitError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading((previous) => ({ ...previous, [questionId]: false }));
    }
  }

  async function submit() {
    setSubmitError(null);
    setSubmitIssues([]);
    if (!navigator.onLine) {
      setSubmitError("Submission requires an internet connection. Your draft is safe on this device.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/audits/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId: audit.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
        issues?: { question: string; reason: string }[];
      };
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? "Submission failed.");
        setSubmitIssues(json.issues ?? []);
        return;
      }
      await clearLocalDraft(audit.id);
      await clearQueue(audit.id);
      router.push(json.redirect ?? `/audits/${audit.id}`);
      router.refresh();
    } catch {
      setSubmitError("Could not submit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "All changes saved"
        : saveState === "offline"
          ? "Offline draft saved"
          : saveState === "error"
            ? "Save failed"
            : "Autosave enabled";

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-3">
          <div className="card p-3">
            <p className="eyebrow">Sections</p>
            <ul className="mt-2 space-y-0.5">
              {sections.map(([section, list], index) => {
                const done = list.filter((question) => answered(question, values[question.id]!) && values[question.id]!.result !== "na").length;
                return (
                  <li key={section}>
                    <a href={`#section-${index}`} className="flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-[11px] text-slate-600 hover:bg-slate-100">
                      <span className="truncate">{section}</span>
                      <span className="shrink-0 text-[9px] text-slate-400">{done}/{list.length}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card p-3">
            <p className="eyebrow">Audit</p>
            <p className="mt-1 font-mono text-[11px] text-slate-700">{audit.ref}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{audit.title}</p>
            <Link href={`/audits/${audit.id}`} className="mt-2 inline-block text-[11px] font-semibold text-slate-600 hover:underline">
              Audit overview →
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-14 z-20 mb-4 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-40 flex-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{progress.done} of {questions.length} answered</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#d71928] transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {progress.mandatoryMissing > 0 ? <span className="rounded-full bg-red-50 px-2 py-1 font-medium text-red-700">{progress.mandatoryMissing} mandatory</span> : null}
              {progress.evidenceMissing > 0 ? <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">{progress.evidenceMissing} evidence</span> : null}
              <span className="hidden items-center gap-1 text-slate-500 sm:flex">
                {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5 text-amber-600" />}
                {statusLabel}
              </span>
            </div>
            <button type="button" onClick={submit} disabled={submitting} className="btn-primary btn-sm">
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {submitting ? "Submitting…" : "Submit & lock"}
            </button>
          </div>
          {recovered ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] text-amber-800">
              <span>Recovered an offline draft saved on this device.</span>
              <button type="button" onClick={discardDraft} className="font-semibold underline">Discard local draft</button>
            </div>
          ) : null}
          {!online ? (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-700">
              <CloudOff className="size-3.5" /> You are offline. Answers are saved locally and will sync when you reconnect.
            </p>
          ) : null}
        </div>

        {submitError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{submitError}</p>
              <button type="button" onClick={() => setSubmitError(null)} aria-label="Dismiss"><X className="size-3.5" /></button>
            </div>
            {submitIssues.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {submitIssues.map((issue, index) => (
                  <li key={index}>{issue.question} — {issue.reason === "evidence" ? "evidence required" : "answer required"}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-5">
          {sections.map(([section, list], sectionIndex) => (
            <section key={section} id={`section-${sectionIndex}`} className="scroll-mt-36">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">{section}</h2>
                <span className="text-[10px] text-slate-400">{list.length} checks</span>
              </div>
              <div className="space-y-3">
                {list.map((question) => {
                  const response = values[question.id]!;
                  const done = answered(question, response);
                  const evidenceMissing = question.evidence_required !== "none" && done && response.result !== "na" && response.documentIds.length === 0;
                  const options = question.response_type === "yes_no" ? YES_NO : question.response_type === "compliance" ? COMPLIANCE : [];
                  return (
                    <article
                      key={question.id}
                      id={`q-${question.id}`}
                      className={cn(
                        "card scroll-mt-36 p-4",
                        question.mandatory && !done ? "border-l-4 border-l-amber-400" : done ? "border-l-4 border-l-emerald-500" : "",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-6 text-slate-800">
                            <span className="mr-1 font-mono text-[10px] text-slate-400">{question.code}</span>
                            {question.text}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Control objective: {question.control_objective ?? question.expected_control ?? "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className={cn("badge", question.risk_level === "critical" ? "bg-red-600 text-white ring-red-600" : question.risk_level === "high" ? "bg-orange-50 text-orange-700 ring-orange-200" : "bg-slate-50 text-slate-500 ring-slate-200")}>
                            {question.risk_level}
                          </span>
                          <span className="badge bg-slate-50 text-slate-500 ring-slate-200">W{question.weight}</span>
                          {question.mandatory ? <span className="badge bg-slate-900 text-white ring-slate-900">Required</span> : null}
                        </div>
                      </div>

                      {options.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {options.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => update(question.id, { result: response.result === option.value ? null : option.value })}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition",
                                response.result === option.value
                                  ? option.value === "compliant" || option.value === "yes"
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : option.value === "partial"
                                      ? "border-amber-500 bg-amber-500 text-white"
                                      : option.value === "noncompliant" || option.value === "no" || option.value === "investigation"
                                        ? "border-red-600 bg-red-600 text-white"
                                        : "border-slate-600 bg-slate-600 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {question.response_type === "numeric" ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="label">Numeric value</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={response.numericValue}
                              onChange={(event) => update(question.id, { numericValue: event.target.value })}
                              placeholder="e.g. 12"
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label">Explanation</label>
                            <input
                              value={response.textValue}
                              onChange={(event) => update(question.id, { textValue: event.target.value })}
                              placeholder="Variance explanation"
                              className="input"
                            />
                          </div>
                        </div>
                      ) : null}

                      {question.response_type === "financial" ? (
                        <div className="mt-3">
                          <label className="label">Financial amount (₦)</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={response.amount}
                            onChange={(event) => update(question.id, { amount: event.target.value })}
                            placeholder="0.00"
                            className="input max-w-56"
                          />
                        </div>
                      ) : null}

                      {question.response_type === "text" || question.response_type === "date" ? (
                        <div className="mt-3">
                          <label className="label">{question.response_type === "date" ? "Date" : "Details"}</label>
                          <input
                            type={question.response_type === "date" ? "date" : "text"}
                            value={response.textValue}
                            onChange={(event) => update(question.id, { textValue: event.target.value })}
                            className="input"
                          />
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <label className="label">Auditor comment</label>
                        <textarea
                          value={response.comment}
                          onChange={(event) => update(question.id, { comment: event.target.value })}
                          rows={2}
                          placeholder="Record the observation, discussion with management and any context…"
                          className="textarea min-h-16"
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium", question.evidence_required === "none" ? "bg-slate-50 text-slate-400" : evidenceMissing ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                          {question.evidence_required === "none" ? <Paperclip className="size-3" /> : evidenceMissing ? <AlertTriangle className="size-3" /> : <Check className="size-3" />}
                          {question.evidence_required === "none" ? "No evidence required" : evidenceMissing ? `${question.evidence_required} evidence required` : "Evidence attached"}
                        </span>
                        {response.documentIds.map((id) => (
                          <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                            <FileText className="size-3 shrink-0" />
                            <Link href={`/api/files/${id}`} target="_blank" className="max-w-36 truncate hover:underline">
                              {documentsById[id]?.name ?? "Evidence"}
                            </Link>
                            <button type="button" onClick={() => update(question.id, { documentIds: response.documentIds.filter((docId) => docId !== id) })} aria-label="Remove evidence">
                              <X className="size-3 text-slate-400 hover:text-red-600" />
                            </button>
                          </span>
                        ))}
                        <label className={cn("btn-secondary btn-sm cursor-pointer", !online && "opacity-50")}>
                          {uploading[question.id] ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                          {uploading[question.id] ? "Uploading…" : "Add evidence"}
                          <input
                            type="file"
                            className="sr-only"
                            accept="image/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            disabled={uploading[question.id]}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void upload(question.id, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <span className="ml-auto text-[10px] text-slate-400">{done ? "Answered" : "Not answered"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5 card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Ready to submit?</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Submitting locks this audit and its responses. Corrections require a documented amendment.
              </p>
            </div>
            <button type="button" onClick={submit} disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {submitting ? "Submitting…" : "Submit audit for review"}
            </button>
          </div>
          <p className="mt-3 text-[10px] text-slate-400">Audit period ends {formatDate(new Date().toISOString())} · Conducted by the assigned auditor.</p>
        </div>
      </div>
    </div>
  );
}
