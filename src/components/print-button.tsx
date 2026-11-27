"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      <Printer className="size-4" /> Print report
    </button>
  );
}
