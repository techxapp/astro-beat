// SPDX-License-Identifier: AGPL-3.0-or-later
export type ImportErrorCode =
  | "too_large" | "invalid_json" | "too_deep" | "unsafe_keys" | "unsupported_version" | "invalid_schema"
  | "checksum_mismatch" | "needs_passphrase" | "decrypt_failed" | "sanity_failed";

export class ImportError extends Error {
  constructor(readonly code: ImportErrorCode, message: string) {
    super(message);
    this.name = "ImportError";
  }
}
