import Image from "next/image";
import type { ReportSnapshot } from "@/lib/types";

export function ReportView({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <article className="print-page mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <header className="border-b-2 border-[#0b1b2b] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Crunchies" width={512} height={372} className="h-11 w-auto object-contain" />
            <div><p className="text-lg font-bold tracking-tight text-slate-900">Crunchies</p><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">{snapshot.meta.department}</p></div>
          </div>
          <div className="text-right"><p className="text-[9px] font-semibold uppercase tracking-widest text-red-600">{snapshot.meta.confidentiality}</p><p className="mt-1 text-[10px] text-slate-400">{snapshot.meta.reference}</p></div>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">{snapshot.meta.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{snapshot.meta.subtitle} · {snapshot.meta.period}</p>
      </header>
      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {snapshot.summary.map((item) => (<div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[9px] uppercase tracking-wide text-slate-400">{item.label}</p><p className="mt-0.5 text-sm font-semibold text-slate-900">{item.value}</p></div>))}
      </section>
      <div className="mt-6 space-y-5">
        {snapshot.sections.map((section) => (
          <section key={section.heading} className="print-break">
            <h2 className="border-l-4 border-[#d71920] pl-2 text-sm font-bold text-slate-900">{section.heading}</h2>
            {section.body ? <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{section.body}</p> : null}
            {section.columns && section.rows ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[480px] border-collapse text-left text-[10px]">
                  <thead><tr className="bg-slate-50">{section.columns.map((column) => <th key={column} className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-500">{column}</th>)}</tr></thead>
                  <tbody>{section.rows.length ? section.rows.map((row, rowIndex) => (<tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-slate-100 px-2 py-1.5 align-top text-slate-600">{String(cell)}</td>)}</tr>)) : <tr><td colSpan={section.columns.length} className="px-2 py-3 text-center text-slate-400">No records.</td></tr>}</tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}
      </div>
      {snapshot.approval ? (
        <footer className="mt-8 border-t border-slate-200 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">{snapshot.approval.map((item) => (<div key={item.role}><p className="text-[9px] uppercase tracking-wide text-slate-400">{item.role}</p><p className="mt-6 border-t border-slate-300 pt-1 text-[10px] font-medium text-slate-700">{item.name}</p><p className="text-[9px] text-slate-400">{item.date}</p></div>))}</div>
          <p className="mt-6 text-[8px] leading-4 text-slate-400">This report is confidential and prepared for internal management use. Generated {snapshot.meta.generatedAt} by {snapshot.meta.preparedBy}. Unauthorised distribution is prohibited.</p>
        </footer>
      ) : null}
    </article>
  );
}
