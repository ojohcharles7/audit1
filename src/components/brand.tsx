import { cn } from "@/lib/utils";

export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-[#d71920] text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path
          d="M12 2.8 20 5.8v6.1c0 5.2-3.3 8.7-8 10.5-4.7-1.8-8-5.3-8-10.5V5.8l8-3Z"
          fill="currentColor"
          opacity={light ? 0.24 : 0.16}
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="m8.5 11.8 2.2 2.3 4.9-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Wordmark({ light = false, subtitle = "Audit & Control" }: { light?: boolean; subtitle?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BrandMark light={light} />
      <span className="min-w-0 leading-tight">
        <span className={cn("block truncate text-[15px] font-bold tracking-tight", light ? "text-white" : "text-slate-900")}>
          Crunchies
        </span>
        <span className={cn("block truncate text-[10px] font-medium uppercase tracking-[0.16em]", light ? "text-white/60" : "text-slate-500")}>
          {subtitle}
        </span>
      </span>
    </span>
  );
}
