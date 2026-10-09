"use client";

import { useEffect } from "react";
import { readPlatform } from "@/lib/pwa";
import { countOnce } from "@/lib/stats-client";

/**
 * Two anonymous tallies counted once per document load (`PLAN/DEKKA_PWA_APP.md` §5.4):
 * - `app_open`: a launch of the installed app, the only install signal iPhones give.
 * - `qr_scan`: an arrival from the table poster (`/get-app?from=qr`). The marker is then
 *   removed from the address, so a reload or a shared link doesn't count again.
 */
export function UsageBeacon() {
  useEffect(() => {
    if (readPlatform() === "standalone") countOnce("app_open");
    const url = new URL(window.location.href);
    if (url.pathname === "/get-app" && url.searchParams.get("from") === "qr") {
      countOnce("qr_scan");
      url.searchParams.delete("from");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);
  return null;
}
