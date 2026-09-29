// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Chart } from "@astro/schema/chart";
import type { StoredPrediction } from "@astro/schema/file";
import type { BirthInput, ChartTemporal } from "@astro/schema/identifying";

/** A profile as kept in the vault. Chart-only imports have no birth data. */
export interface ProfileRecord {
  profileId: string;
  label: string;
  birth?: BirthInput;
  temporal?: ChartTemporal;
  chart: Chart;
  predictions: StoredPrediction[];
  createdAt: string;
}

export interface ProfileSummary {
  profileId: string;
  label: string;
}
