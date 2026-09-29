// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Envelope, WorkerRequest, WorkerResponse } from "./protocol.ts";

type Result<T extends WorkerRequest["type"]> = Extract<WorkerResponse, { type: T }>;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./chart.worker.ts", import.meta.url), { type: "module", name: "chart" });
  worker.onmessage = (e: MessageEvent<Envelope<WorkerResponse>>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "chart worker failed"));
    pending.clear();
  };
  return worker;
}

export function callWorker<T extends WorkerRequest["type"]>(req: Extract<WorkerRequest, { type: T }>): Promise<Result<T>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: WorkerResponse) => void, reject });
    getWorker().postMessage({ id, req });
  });
}
