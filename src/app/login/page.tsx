import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";
import { LoginForm } from "./login-form";
import { Wordmark } from "@/components/brand";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; denied?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f5f7fa] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b1b2b] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(900px 500px at 90% -10%, rgba(215,25,32,.35), transparent 60%), radial-gradient(600px 400px at 0% 100%, rgba(29,78,216,.18), transparent 65%)",
          }}
        />
        <div className="relative">
          <Wordmark light subtitle="Internal Audit & Control" />
          <div className="mt-20 max-w-xl">
            <p className="eyebrow !text-white/50">Enterprise assurance platform</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.12] tracking-tight xl:text-[44px]">
              One command centre for every outlet, control and audit finding.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/65">
              Plan audits, conduct digital checklists, assess risk, investigate fraud, track corrective
              actions and give executive management live visibility across the entire network.
            </p>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            {[
              ["24", "Outlets under assurance"],
              ["8", "Audit disciplines"],
              ["1,600+", "Control tests and checks"],
              ["100%", "Traceable decisions"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-2xl font-semibold tracking-tight">{value}</p>
                <p className="mt-1 text-[11px] text-white/55">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-12 flex items-center gap-3 text-[11px] text-white/40">
          <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
          Demonstration environment · Confidential data is fictional
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] sm:p-8">
            <p className="eyebrow">Secure access</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Sign in to your workspace</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use your Crunchies audit account. Access is role-based and activity is logged.
            </p>
            {params.denied ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You do not have permission to open that module with your current role.
              </p>
            ) : null}
            <LoginForm next={params.next} />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
            <p className="eyebrow mb-3">Demo accounts · password {DEMO_PASSWORD}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  data-demo-email={account.email}
                  data-demo-password={DEMO_PASSWORD}
                  className="demo-fill flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="text-[11px] font-semibold text-slate-800">{account.role}</span>
                  <span className="truncate text-[10px] text-slate-500">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
            Protected by role-based access, session controls and a tamper-evident activity trail.
          </p>
        </div>
      </section>
    </main>
  );
}
