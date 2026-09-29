// SPDX-License-Identifier: AGPL-3.0-or-later
// Chart file export/import. Import is strict and never trusts the file: analysis is recomputed by
// the caller, and encrypted profiles have their chart recomputed from BirthInput.
import type { Chart } from "@astro/schema/chart";
import {
  ChartOnlyFile, EncryptedProfileFile, EncryptedProfileHeader, FILE_VERSION, type StoredPrediction,
} from "@astro/schema/file";
import { ProfilePlain } from "@astro/schema/identifying";
import { decryptWithHeader, encryptWithHeader, PBKDF2_ITERATIONS } from "./crypto.ts";
import { canonicalJson, fromUtf8, sha256Hex, utf8 } from "./encoding.ts";
import { ImportError } from "./errors.ts";
import { migrate } from "./migrations.ts";
import { chartSanityProblems } from "./sanity.ts";

export { canonicalJson, sha256Hex, toBase64, fromBase64 } from "./encoding.ts";
export { PBKDF2_ITERATIONS, deriveKey } from "./crypto.ts";
export { chartSanityProblems } from "./sanity.ts";
export { MIGRATIONS, migrate, type Migration } from "./migrations.ts";
export { ImportError, type ImportErrorCode } from "./errors.ts";

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_JSON_DEPTH = 32;


// ---------------------------------------------------------------- export

async function checksumOf(fileWithoutChecksum: object): Promise<string> {
  return sha256Hex(canonicalJson(fileWithoutChecksum));
}

/** Chart-only file. It still reveals birth date and time (longitudes, dasha dates): the UI warns. */
export async function exportChartOnly(chart: Chart, predictions?: StoredPrediction[]): Promise<string> {
  const body = {
    format: "astro-beat" as const,
    fileVersion: FILE_VERSION,
    kind: "chart-only" as const,
    chart,
    ...(predictions && predictions.length > 0 ? { predictions } : {}),
  };
  const file: ChartOnlyFile = { ...body, checksum: { alg: "SHA-256", value: await checksumOf(body) } };
  return JSON.stringify(ChartOnlyFile.parse(file));
}

export async function exportEncryptedProfile(profile: ProfilePlain, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  if (passphrase.length < 8) throw new Error("passphrase must be at least 8 characters");
  const plain = JSON.stringify(ProfilePlain.parse(profile));
  const { header, ciphertext } = await encryptWithHeader(plain, passphrase, iterations);
  return JSON.stringify(EncryptedProfileFile.parse({ ...header, ciphertext }));
}

// ---------------------------------------------------------------- import

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Nesting depth of a JSON text, ignoring brackets inside strings. */
function jsonDepth(text: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 92) i++; // backslash
      else if (c === 34) inString = false;
    } else if (c === 34) inString = true;
    else if (c === 123 || c === 91) max = Math.max(max, ++depth);
    else if (c === 125 || c === 93) depth--;
  }
  return max;
}

export function safeJsonParse(text: string): unknown {
  if (jsonDepth(text) > MAX_JSON_DEPTH) throw new ImportError("too_deep", "File is nested too deeply.");
  let unsafe = false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text, (key, value: unknown) => {
      if (FORBIDDEN_KEYS.has(key)) unsafe = true;
      return value;
    });
  } catch {
    throw new ImportError("invalid_json", "File is not valid JSON.");
  }
  if (unsafe) throw new ImportError("unsafe_keys", "File contains forbidden keys.");
  return parsed;
}

export type ImportResult =
  | { kind: "chart-only"; chart: Chart; predictions: StoredPrediction[] }
  | { kind: "encrypted-profile"; profile: ProfilePlain };

export interface ImportOptions {
  passphrase?: string;
}

export async function importChartFile(input: string | Uint8Array, opts: ImportOptions = {}): Promise<ImportResult> {
  const bytes = typeof input === "string" ? utf8.encode(input) : input;
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ImportError("too_large", "File is larger than 1 MB.");
  let text: string;
  try {
    text = fromUtf8.decode(bytes);
  } catch {
    throw new ImportError("invalid_json", "File is not UTF-8 text.");
  }
  const raw = safeJsonParse(text);
  const migrated = migrate(raw);

  const kind = (migrated as { kind?: unknown }).kind;
  if (kind === "chart-only") {
    const parsed = ChartOnlyFile.safeParse(migrated);
    if (!parsed.success) throw new ImportError("invalid_schema", "File does not match the chart file format.");
    const { checksum, ...rest } = parsed.data;
    if ((await checksumOf(rest)) !== checksum.value) throw new ImportError("checksum_mismatch", "Checksum does not match: the file was changed or damaged.");
    const problems = chartSanityProblems(parsed.data.chart);
    if (problems.length > 0) throw new ImportError("sanity_failed", `Chart failed sanity checks: ${problems[0]}`);
    return { kind: "chart-only", chart: parsed.data.chart, predictions: parsed.data.predictions ?? [] };
  }
  if (kind === "encrypted-profile") {
    const parsed = EncryptedProfileFile.safeParse(migrated);
    if (!parsed.success) throw new ImportError("invalid_schema", "File does not match the profile file format.");
    if (opts.passphrase === undefined) throw new ImportError("needs_passphrase", "This profile is encrypted.");
    const { ciphertext, ...header } = parsed.data;
    let plain: Uint8Array;
    try {
      plain = await decryptWithHeader(EncryptedProfileHeader.parse(header), ciphertext, opts.passphrase);
    } catch {
      throw new ImportError("decrypt_failed", "Wrong passphrase, or the file was changed.");
    }
    const inner = ProfilePlain.safeParse(safeJsonParse(fromUtf8.decode(plain)));
    if (!inner.success) throw new ImportError("invalid_schema", "Decrypted profile does not match the expected format.");
    const problems = chartSanityProblems(inner.data.chart);
    if (problems.length > 0) throw new ImportError("sanity_failed", `Chart failed sanity checks: ${problems[0]}`);
    return { kind: "encrypted-profile", profile: inner.data };
  }
  throw new ImportError("invalid_schema", "Unknown file kind.");
}
