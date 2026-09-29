// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure `from → to` migration chain. The app only ever writes FILE_VERSION. Each migration gets a
// fixture in test/fixtures when it is added.
import { FILE_VERSION } from "@astro/schema/file";
import { ImportError } from "./errors.ts";

export type Migration = (file: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a version-n file to version n+1. None exist yet: v1 is the first format. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function migrate(raw: unknown, migrations: Readonly<Record<number, Migration>> = MIGRATIONS, target: number = FILE_VERSION): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ImportError("invalid_schema", "File is not a JSON object.");
  let file = raw as Record<string, unknown>;
  if (file.format !== "astro-beat") throw new ImportError("invalid_schema", "Not an Astro-Beat file.");
  const version = file.fileVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) throw new ImportError("unsupported_version", "Missing or invalid file version.");
  let v: number = version;
  if (v > target) throw new ImportError("unsupported_version", `File version ${v} is newer than this app supports (${target}).`);
  while (v < target) {
    const m = migrations[v];
    if (!m) throw new ImportError("unsupported_version", `No migration from file version ${v}.`);
    file = m(file);
    const nv = file.fileVersion;
    if (typeof nv !== "number" || nv !== v + 1) throw new Error(`migration from ${v} produced version ${String(nv)}`);
    v = nv;
  }
  return file;
}
