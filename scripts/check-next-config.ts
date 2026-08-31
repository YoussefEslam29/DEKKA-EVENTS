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

    const patterns = (config.images as { remotePatterns?: unknown[] })?.remotePatterns;
    if (!Array.isArray(patterns) || patterns.length < 2) {
      failures.push(`${label}: images.remotePatterns did not survive`);
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
      `remotePatterns intact; unwrapped config untouched without SENTRY_ORG/PROJECT.`
  );
}

main();
