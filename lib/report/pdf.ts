import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Turns the report HTML into an A4 PDF buffer.
 *
 * PDF-generation decision (Admin_Event_PDF.md §10): a real headless Chromium,
 * not a browser-free PDF library. The report's people list carries real guest
 * names, which at Dekka are overwhelmingly Arabic — pdfkit / pdf-lib /
 * react-pdf do no Arabic glyph shaping or bidi and would render those names as
 * broken, reversed letters, making the door list useless. Chromium shapes
 * Arabic (and mixed RTL/LTR) natively. `puppeteer-core` was already a
 * dependency (the `scripts/shoot.mjs` screenshot tool); this only swaps the
 * browser binary source:
 *   - on Vercel / AWS Lambda: `@sparticuz/chromium`'s Linux build
 *   - locally (Windows/macOS): the Chrome already installed on the machine,
 *     the same one `scripts/shoot.mjs` drives — path via `LOCAL_CHROME_PATH`
 *     or the common per-OS default.
 * The route is admin-only and rarely hit, so Chromium's cold-start / bundle
 * cost never touches a guest path.
 */

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV
);

const LOCAL_CHROME_DEFAULTS: Record<string, string> = {
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
};

async function launch(): Promise<Browser> {
  if (isServerless) {
    // Imported lazily so local dev never loads the Linux-only binary wrapper.
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath =
    process.env.LOCAL_CHROME_PATH || LOCAL_CHROME_DEFAULTS[process.platform];
  if (!executablePath) {
    throw new Error(
      `No local Chrome path for platform "${process.platform}" — set LOCAL_CHROME_PATH.`
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--hide-scrollbars"],
  });
}

export async function renderReportPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    // The font is an inlined data URI, so "load" is enough — there are no
    // network requests to idle-wait on.
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
