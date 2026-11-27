import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center",
        light && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        className,
      )}
      aria-hidden
    >
      <Image
        src="/logo.png"
        alt=""
        width={512}
        height={372}
        priority
        className="size-full object-contain"
      />
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
