/**
 * Guards the one thing `withSentryConfig` could silently break.
 *
 * `next.config.ts` pins `serverExternalPackages: ["@sparticuz/chromium",
 * "puppeteer-core"]`, and the admin event-report PDF route depends on it — those ship a
 * native Chromium binary that must never be traced into the bundle
 * (`developer-guide.md` §7). Sentry wraps the whole config, so an upgrade that changed
 * how it merges that array would break PDF generation in production only, with a build
 * that passes. This asserts the invariant instead of trusting it.
 *
 * It also asserts the `/sw.js` no-cache header (PLAN/DEKKA_PWA_APP.md §2) survives the
 * wrapper, for the same reason: a stale-cached service worker fails silently. And that
 * the `compiler.define` flags stripping Sentry's tracing and debug code survive too:
 * losing them just quietly puts that code back into every phone's first download.
 *
 * Note what it does *not* assert: that the list is unchanged. Sentry legitimately
 * *appends* the packages it instruments (mongoose, mongodb, redis, ...). Ours surviving
 * is the requirement; exclusivity is not.
 *
 *   npm run check:config
 */
const REQUIRED = ["@sparticuz/chromium", "puppeteer-core"];

async function load(): Promise<Record<string, unknown>> {
  const mod = await import(`../next.config.ts?t=${Date.now()}`);
  return mod.default as Record<string, unknown>;
}

async function main() {
  delete process.env.SENTRY_ORG;
  delete process.env.SENTRY_PROJECT;
  const plain = await load();

  process.env.SENTRY_ORG = "check-org";
  process.env.SENTRY_PROJECT = "check-project";
  const wrapped = await load();

  const failures: string[] = [];

  for (const [label, config] of [
    ["without Sentry vars", plain],
    ["with Sentry vars", wrapped],
  ] as const) {
    const pkgs = config.serverExternalPackages;
    if (!Array.isArray(pkgs)) {
      failures.push(`${label}: serverExternalPackages is not an array (${typeof pkgs})`);
      continue;
    }
    for (const required of REQUIRED) {
      if (!pkgs.includes(required)) {
        failures.push(`${label}: serverExternalPackages lost ${required}`);
      }
    }

    // Sentry's wrapper rewrites `compiler` (it installs runAfterProductionCompile),
    // and these flags are what keep the SDK's tracing out of every phone's download.
    const define = (config.compiler as { define?: Record<string, unknown> })?.define;
    for (const flag of ["__SENTRY_DEBUG__", "__SENTRY_TRACING__"]) {
      if (define?.[flag] !== false) {
        failures.push(`${label}: compiler.define lost ${flag}: false`);
      }
    }

    const patterns = (config.images as { remotePatterns?: unknown[] })?.remotePatterns;
    if (!Array.isArray(patterns) || patterns.length < 2) {
      failures.push(`${label}: images.remotePatterns did not survive`);
    }

    // The service worker must be served uncached (PLAN/DEKKA_PWA_APP.md §2):
    // losing this would let an old worker's caching rules outlive a deploy.
    const headersFn = config.headers;
    if (typeof headersFn !== "function") {
      failures.push(`${label}: headers() is missing`);
    } else {
      const rules = (await headersFn()) as {
        source: string;
        headers: { key: string; value: string }[];
      }[];
      const sw = rules.find((r) => r.source === "/sw.js");
      const cacheControl = sw?.headers.find((h) => h.key.toLowerCase() === "cache-control");
      if (!cacheControl || !/no-cache/.test(cacheControl.value)) {
        failures.push(`${label}: /sw.js lost its no-cache header`);
      }
    }
  }

  // The unwrapped config must be exactly what this repo had before Sentry existed.
  if (Object.keys(plain).some((k) => /sentry/i.test(k))) {
    failures.push("without Sentry vars: config was wrapped anyway");
  }

  if (failures.length) {
    for (const f of failures) console.error(`FAIL  ${f}`);
    process.exit(1);
  }

  const wrappedPkgs = wrapped.serverExternalPackages as string[];
  console.log(
    `next.config: OK — ${REQUIRED.join(", ")} present in both configs ` +
      `(Sentry appends ${wrappedPkgs.length - REQUIRED.length} more); ` +
      `remotePatterns intact; /sw.js served no-cache; Sentry tree-shaking flags kept; ` +
      `unwrapped config untouched without SENTRY_ORG/PROJECT.`
  );
}

main();
