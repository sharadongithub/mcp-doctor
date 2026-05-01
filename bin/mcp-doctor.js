#!/usr/bin/env node
// mcp-doctor — see how much context your Claude Desktop MCP servers eat.

import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig, getConfigPath } from "../src/config.js";
import { probeAll } from "../src/probe.js";
import { countLocal, countAccurate } from "../src/tokens.js";
import { renderReport } from "../src/render.js";

const args = process.argv.slice(2);
const accurate = args.includes("--accurate");
const verbose = args.includes("--verbose");
const snapshot = args.includes("--snapshot");
const configIdx = args.indexOf("--config");
const configPath = configIdx >= 0 ? args[configIdx + 1] : undefined;

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  mcp-doctor — measure Claude Desktop MCP context cost

  Usage:
    mcp-doctor                  Probe all servers, count tokens locally
    mcp-doctor --accurate       Use Anthropic's count_tokens API (needs ANTHROPIC_API_KEY)
    mcp-doctor --snapshot       Save results for later comparison with mcp-diff
    mcp-doctor --config <path>  Use a different config file
    mcp-doctor --verbose        Show error details
`);
  process.exit(0);
}

(async () => {
  let servers;
  try {
    servers = loadConfig(configPath);
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  }

  const names = Object.keys(servers);
  if (!names.length) {
    console.log(`\n  No MCP servers configured in ${configPath ?? getConfigPath()}\n`);
    process.exit(0);
  }

  process.stderr.write(`  Probing ${names.length} server${names.length === 1 ? "" : "s"}...\n`);
  const results = await probeAll(servers);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mode = accurate ? "accurate" : "local";
  if (accurate && !apiKey) {
    console.error("\n  --accurate requires ANTHROPIC_API_KEY in your environment.\n");
    process.exit(1);
  }

  for (const r of results) {
    if (r.status !== "ok") { r.tokens = 0; continue; }
    try {
      r.tokens = accurate
        ? await countAccurate(r.tools, { apiKey })
        : countLocal(r.tools);
    } catch (e) {
      r.status = "error";
      r.reason = `count failed: ${e.message}`;
      r.tokens = 0;
    }
  }

  console.log(renderReport(results, { mode }));

  if (verbose) {
    const errs = results.filter((r) => r.status === "error");
    if (errs.length) {
      console.log("  Errors:");
      for (const e of errs) console.log(`    ${e.name}: ${e.reason}`);
      console.log("");
    }
  }

  if (snapshot) {
    const dir = join(homedir(), ".mcp-doctor");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode,
      servers: results.map((r) => ({
        name: r.name,
        status: r.status,
        toolCount: r.tools?.length ?? 0,
        tokens: r.tokens ?? 0,
        toolNames: r.tools?.map((t) => t.name) ?? [],
      })),
    }, null, 2));
    console.log(`  Snapshot saved: ${file}`);
    console.log(`  Compare later with: mcp-diff\n`);
  }
})();
