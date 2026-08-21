/**
 * Screenshot helper for design review.
 *
 * Drives the Chrome already installed on the machine via puppeteer-core, so
 * there is no bundled-browser download. Used to check the auth screens at the
 * two breakpoints authorization-UI.md specifies (desktop >=1024, mobile <768).
 *
 *   node scripts/shoot.mjs <outDir> <name>:<path>[:w x h] ...
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.SHOOT_BASE ?? "http://localhost:3000";

const [outDir, ...targets] = process.argv.slice(2);
if (!outDir || targets.length === 0) {
  console.error("usage: node scripts/shoot.mjs <outDir> <name>:<path>[:WxH] ...");
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
});

// Optional sign-in, so back-office routes can be captured too.
//   SHOOT_LOGIN="admin@dekka.test:dekka1234" node scripts/shoot.mjs ...
if (process.env.SHOOT_LOGIN) {
  const [email, password] = process.env.SHOOT_LOGIN.split(":");
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type("#field-email", email);
  await page.type("#field-password", password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 800));
  console.log(`signed in as ${email}`);
  await page.close();
}

try {
  for (const target of targets) {
    const [name, urlPath, size, locale] = target.split("|");
    const [w, h] = (size ?? "1440x900").split("x").map(Number);

    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    if (locale) {
      // Language is a cookie, so set it before the first render.
      await browser.setCookie({
        name: "dekka_locale",
        value: locale,
        domain: "localhost",
        path: "/",
      });
    }
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle0", timeout: 60_000 });
    // Let webfonts settle so the wordmark and Cairo text aren't mid-swap.
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 400));

    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${name.padEnd(22)} ${w}x${h}  ${urlPath}${locale ? "  [" + locale + "]" : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
}
