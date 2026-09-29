// SPDX-License-Identifier: AGPL-3.0-or-later
// Licence gate: every production dependency must be AGPL-3.0-compatible.
// Uses `pnpm licenses list --prod --json` (pnpm ≥ 8).
import { execFileSync } from "node:child_process";

const ALLOWED = new Set([
  "MIT", "MIT-0", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Apache-2.0", "CC0-1.0", "Unlicense",
  "BlueOak-1.0.0", "Python-2.0", "CC-BY-4.0", "LGPL-3.0-or-later", "GPL-3.0-or-later", "AGPL-3.0-or-later", "AGPL-3.0-only",
]);

const out = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], { encoding: "utf8" });
const byLicense = JSON.parse(out);
const problems = [];
for (const [license, pkgs] of Object.entries(byLicense)) {
  // SPDX expressions like "(MIT OR Apache-2.0)": accept if any alternative is allowed.
  const alternatives = license.replace(/[()]/g, "").split(/\s+OR\s+/);
  if (alternatives.some((l) => ALLOWED.has(l.trim()))) continue;
  for (const p of pkgs) {
    if (p.name.startsWith("@astro/")) continue;
    problems.push(`${p.name}@${(p.versions ?? [p.version]).join(",")}: ${license}`);
  }
}
if (problems.length > 0) {
  console.error("Dependencies with licences not on the AGPL-compatible allowlist:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Licence gate passed (${Object.values(byLicense).flat().length} packages).`);
