// Runs every `check:*` script in package.json, one after another, and stops at the
// first failure. Discovered rather than listed, so a new check joins CI the moment its
// script entry exists — nobody has to remember to add it here too.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const checks = Object.keys(pkg.scripts)
  .filter((name) => name.startsWith("check:") && name !== "check:all")
  .sort();

for (const name of checks) {
  console.log(`\n▶ npm run ${name}`);
  const result = spawnSync("npm", ["run", "--silent", name], { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\n✗ ${name} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\n✓ all ${checks.length} checks passed: ${checks.join(", ")}`);
