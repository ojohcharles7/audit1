"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel = "Saving…",
  confirm,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(className)}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
