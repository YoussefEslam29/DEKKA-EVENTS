"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Opens the browser's print dialog; the page's print styles do the rest. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="lightPrimary" className="min-h-11 print:hidden" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
