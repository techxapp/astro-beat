// SPDX-License-Identifier: AGPL-3.0-or-later
// OpenAI Responses API call with strict structured output and store:false.
// VERIFY AT BUILD TIME against current OpenAI docs: the `text.format` shape, whether the chosen
// model accepts `temperature`, and the `max_output_tokens` name.

export interface ModelCall {
  model: string;
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface ModelResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export class UpstreamError extends Error {
  constructor(readonly kind: "timeout" | "http" | "shape" | "refusal", message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export type ModelClient = (call: ModelCall) => Promise<ModelResult>;

interface ResponsesBody {
  model?: string;
  status?: string;
  output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function openAiClient(apiKey: string, fetchImpl: typeof fetch = fetch): ModelClient {
  return async (call) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), call.timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: ctrl.signal,
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: call.model,
          store: false,
          instructions: call.instructions,
          input: call.input,
          max_output_tokens: call.maxOutputTokens,
          text: { format: { type: "json_schema", name: "prediction", schema: call.schema, strict: true } },
        }),
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new UpstreamError("timeout", "upstream timed out");
      throw new UpstreamError("http", e instanceof Error ? e.name : "network error");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new UpstreamError("http", `upstream status ${res.status}`);
    const body = (await res.json()) as ResponsesBody;
    const parts = (body.output ?? []).flatMap((o) => (o.type === "message" ? (o.content ?? []) : []));
    if (parts.some((p) => p.type === "refusal")) throw new UpstreamError("refusal", "model refused");
    const text = parts.filter((p) => p.type === "output_text").map((p) => p.text ?? "").join("");
    if (!text) throw new UpstreamError("shape", "no output_text in response");
    return {
      text,
      model: body.model ?? call.model,
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
    };
  };
}
