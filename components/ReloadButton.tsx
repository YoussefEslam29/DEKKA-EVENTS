"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Reloads the URL the visitor actually asked for. On `/offline` that matters:
 * the service worker serves the offline page *in place of* whatever page was
 * requested, so the address bar still holds the real destination and a reload
 * is the retry.
 */
export function ReloadButton({ label }: { label: string }) {
  return (
    <Button type="button" size="lg" className="h-12" onClick={() => window.location.reload()}>
      <RotateCw className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
