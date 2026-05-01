// Token counting for tool definitions.
//
// Two modes:
//
//   local    — heuristic: bytes / 3.5. Fast, no network, no API key.
//              Within ~10–15% of Anthropic's count for English JSON tool
//              schemas. Good enough to answer "is this server costing me
//              500 tokens or 15,000?".
//
//   accurate — Anthropic's /v1/messages/count_tokens endpoint. Exact,
//              free, but requires ANTHROPIC_API_KEY and one HTTP call
//              per server. Use --accurate.
//
// Why bytes/3.5? BPE tokenizers on JSON text consistently land near this
// ratio. Claude 4-era tokenizers vary 1.0–1.35x by content type per
// Anthropic's migration notes, so we're roughly in the middle.

const HEURISTIC_BYTES_PER_TOKEN = 3.5;

// Serialize a tools array the same shape Anthropic's API expects, so byte
// count and accurate count operate on equivalent inputs. Each MCP tool has
// { name, description, inputSchema }; the API uses input_schema (snake_case).
function serializeForCounting(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema ?? { type: "object", properties: {} },
  }));
}

export function countLocal(tools) {
  if (!tools.length) return 0;
  const bytes = Buffer.byteLength(JSON.stringify(serializeForCounting(tools)), "utf8");
  return Math.round(bytes / HEURISTIC_BYTES_PER_TOKEN);
}

export async function countAccurate(tools, { model = "claude-sonnet-4-6", apiKey } = {}) {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set (needed for --accurate)");
  if (!tools.length) return 0;

  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      tools: serializeForCounting(tools),
      // count_tokens requires a messages array; a single empty user turn
      // gives us the tools cost without polluting the count meaningfully.
      messages: [{ role: "user", content: "." }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`count_tokens HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  // Subtract the 1-token user message floor so we report just the tool cost.
  // (Imperfect, but consistent across servers.)
  return Math.max(0, (json.input_tokens ?? 0) - 4);
}
