// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AnalysisConventions } from "@astro/schema/analysis";
import type { Chart, EngineSettings } from "@astro/schema/chart";
import type { BirthInput, ChartTemporal } from "@astro/schema/identifying";
import type { Analysis } from "@astro/schema/local";

export interface CuspSensitivity {
  cusp: number;
  /** minutes of birth-time change (earlier / later) before this cusp's sub-lord changes; null = > 60 */
  earlier: number | null;
  later: number | null;
}

export type WorkerRequest =
  | { type: "compute"; birth: BirthInput; settings: EngineSettings; conventions: AnalysisConventions; asOf: string }
  | { type: "analyze"; chart: Chart; conventions: AnalysisConventions; asOf: string }
  | { type: "sensitivity"; birth: BirthInput; settings: EngineSettings };

export type WorkerResponse =
  | { type: "compute"; chart: Chart; temporal: ChartTemporal; analysis: Analysis }
  | { type: "analyze"; analysis: Analysis }
  | { type: "sensitivity"; cusps: CuspSensitivity[] | null };

export type Envelope<T> = { id: number } & ({ ok: true; result: T } | { ok: false; error: string });
