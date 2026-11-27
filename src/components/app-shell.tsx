"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Flag,
  FolderLock,
  Gauge,
  History,
  LayoutList,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { BrandMark, Wordmark } from "./brand";

const ICONS = {
  gauge: Gauge,
  calendar: CalendarClock,
  clipboard: ClipboardCheck,
  list: LayoutList,
  flag: Flag,
  shield: ShieldCheck,
  lock: LockKeyhole,
  sliders: SlidersHorizontal,
  check: CheckCircle2,
  building: Building2,
  users: Users,
  file: FileText,
  folder: FolderLock,
  bell: Bell,
  settings: Settings,
  history: History,
} as const;

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

type ShellUser = {
  name: string;
  email: string;
  initials: string;
  title: string;
  roleLabel: string;
};

export function AppShell({
  user,
  groups,
  notificationCount,
  children,
}: {
  user: ShellUser;
  groups: NavGroup[];
  notificationCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    return all
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
  }, [groups, pathname]);

  return (
    <div className="min-h-screen bg-[#f5f7fa] lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#0b1b2b] text-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <Wordmark light subtitle="Audit & Control" />
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-[#d71920] text-[10px] font-bold">
              {user.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-white/50">{user.roleLabel}</p>
            </div>
          </div>
        </div>

        <nav className="audit-nav scrollbar-thin flex-1 overflow-y-auto px-3 pb-5">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon as keyof typeof ICONS] ?? LayoutList;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn("nav-link", active && "nav-link-active")}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <p className="flex items-center gap-2 text-[10px] text-white/40">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Demo data · {new Date().getFullYear()} fiscal year
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="app-header sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:block">
                Internal Audit & Internal Control
              </p>
              <h1 className="truncate text-sm font-semibold text-slate-900">{current?.label ?? "Dashboard"}</h1>
            </div>

            <form action="/audits" className="hidden w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
              <Search className="size-3.5 text-slate-400" />
              <input
                name="q"
                placeholder="Search audits, outlets, references…"
                className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
              />
            </form>

            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}
            >
              <Bell className="size-[18px]" />
              {notificationCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[#d71920] px-1 text-[9px] font-bold leading-4 text-white">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              ) : null}
            </Link>

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
                <span className="grid size-8 place-items-center rounded-full bg-[#0b1b2b] text-[10px] font-bold text-white">
                  {user.initials}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[11px] font-semibold text-slate-800">{user.name.split(" ")[0]}</span>
                  <span className="block text-[9px] text-slate-500">{user.roleLabel}</span>
                </span>
                <ChevronDown className="size-3 text-slate-400" />
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{user.email}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-400">{user.title}</p>
                </div>
                <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                  <Settings className="size-3.5" /> Account & security
                </Link>
                <Link href="/notifications" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                  <Bell className="size-3.5" /> Notifications
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50">
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 text-[10px] text-slate-400 sm:px-6">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <BrandMark className="size-5 rounded" /> Crunchies Internal Audit & Internal Control
            </span>
            <span>Confidential · Access and changes are logged</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
