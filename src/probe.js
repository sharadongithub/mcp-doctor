// Launch each stdio MCP server the same way Claude Desktop does
// (same command + args + env), perform the JSON-RPC handshake, and
// return its tools/list response. Times out after 10s per server.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TIMEOUT_MS = 10_000;

export async function probeServer(name, serverConfig) {
  // Remote (HTTP/SSE) servers — defined by `url` instead of `command`.
  // Skip for now; covered by Claude Desktop's connector UI not the local config.
  if (serverConfig.url || serverConfig.type === "http" || serverConfig.type === "sse") {
    return { name, status: "skipped", reason: "remote server (HTTP/SSE) — not yet supported", tools: [] };
  }
  if (!serverConfig.command) {
    return { name, status: "error", reason: "no `command` field in config", tools: [] };
  }

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args ?? [],
    env: { ...process.env, ...(serverConfig.env ?? {}) },
    stderr: "ignore",
  });

  const client = new Client({ name: "mcp-doctor", version: "0.1.0" }, { capabilities: {} });

  try {
    const result = await withTimeout(
      (async () => {
        await client.connect(transport);
        const { tools } = await client.listTools();
        return tools ?? [];
      })(),
      TIMEOUT_MS,
      `timed out after ${TIMEOUT_MS / 1000}s`,
    );
    await client.close().catch(() => {});
    return { name, status: "ok", tools: result };
  } catch (err) {
    await client.close().catch(() => {});
    return { name, status: "error", reason: err.message, tools: [] };
  }
}

export async function probeAll(servers) {
  const names = Object.keys(servers);
  // Parallel — most servers are bound by their own startup time, not by us.
  return Promise.all(names.map((n) => probeServer(n, servers[n])));
}

function withTimeout(promise, ms, msg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
