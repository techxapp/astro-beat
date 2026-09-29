// SPDX-License-Identifier: AGPL-3.0-or-later
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const API_ORIGIN = process.env.VITE_API_ORIGIN ?? "https://api.astro-beat.example";
const SOURCE_URL = process.env.VITE_SOURCE_URL ?? "https://github.com/techxapp/astro-beat";
const PLACEHOLDER_API = "https://api.astro-beat.example";

function commitSha(): string {
  if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

/** Files copied from public/ (except server config), as absolute URLs. */
function publicFiles(dir = resolve(import.meta.dirname, "public"), prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) return publicFiles(full, `${prefix}/${name}`);
    if (name === "_headers" || name.endsWith(".txt")) return [];
    return [`${prefix}/${name}`];
  });
}

/**
 * Service worker: src/sw.ts is emitted as /sw.js with the list of built assets injected.
 * It precaches static assets only; there is no runtime caching and no network handler for the API.
 */
function serviceWorker(): Plugin {
  let refId = "";
  return {
    name: "astro-beat-sw",
    apply: "build",
    buildStart() {
      refId = this.emitFile({ type: "chunk", id: resolve(import.meta.dirname, "src/sw.ts"), fileName: "sw.js" });
    },
    generateBundle(_opts, bundle) {
      const swName = this.getFileName(refId);
      const assets = Object.keys(bundle).filter((f) => f !== swName && !f.endsWith(".map") && f !== "_headers");
      const urls = ["/", ...assets.map((f) => `/${f}`), ...publicFiles()].sort();
      const version = createHash("sha256").update(urls.join("\n")).digest("hex").slice(0, 16);
      const sw = bundle[swName];
      if (sw && sw.type === "chunk") {
        const re = /(["'`])__PRECACHE_MANIFEST__\1/;
        if (!re.test(sw.code)) this.error("service worker manifest placeholder not found");
        sw.code = sw.code.replace(re, JSON.stringify({ version, urls }));
      }
    },
  };
}

/** Parse public/_headers (Cloudflare Pages format) so `vite preview` serves the production CSP. */
function productionHeaders(): Plugin {
  const parse = (): Record<string, string> => {
    const text = readFileSync(resolve(import.meta.dirname, "public/_headers"), "utf8").replaceAll(PLACEHOLDER_API, API_ORIGIN);
    const out: Record<string, string> = {};
    let inAll = false;
    for (const line of text.split("\n")) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!line.startsWith(" ")) {
        inAll = line.trim() === "/*";
        continue;
      }
      if (!inAll) continue;
      const i = line.indexOf(":");
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    delete out["Strict-Transport-Security"];
    return out;
  };
  return {
    name: "astro-beat-headers",
    configurePreviewServer(server) {
      const headers = parse();
      server.middlewares.use((_req, res, next) => {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        next();
      });
    },
    writeBundle(opts) {
      // public/ files are copied verbatim: point the copied _headers at the configured API origin.
      const file = resolve(opts.dir ?? "dist", "_headers");
      if (existsSync(file)) writeFileSync(file, readFileSync(file, "utf8").replaceAll(PLACEHOLDER_API, API_ORIGIN));
    },
  };
}

export default defineConfig({
  plugins: [svelte(), serviceWorker(), productionHeaders()],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
    __SOURCE_URL__: JSON.stringify(SOURCE_URL),
    __API_ORIGIN__: JSON.stringify(API_ORIGIN),
  },
  worker: { format: "es" },
  build: { target: "es2022", sourcemap: true },
});
