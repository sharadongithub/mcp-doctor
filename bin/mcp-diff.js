#!/usr/bin/env node
// mcp-diff — what changed since last snapshot?
// Catches "npx -y" servers silently bumping their tool count overnight.

import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { probeAll } from "../src/probe.js";
import { countLocal } from "../src/tokens.js";

const RESET = "\x1b[0m", BOLD = "\x1b[1m", DIM = "\x1b[2m";
const RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", CYAN = "\x1b[36m";

function loadLatestSnapshot() {
  const dir = join(homedir(), ".mcp-doctor");
  let entries;
  try {
    entries = readdirSync(dir).filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"));
  } catch {
    return null;
  }
  if (!entries.length) return null;
  entries.sort();
  return JSON.parse(readFileSync(join(dir, entries[entries.length - 1]), "utf8"));
}

(async () => {
  const prev = loadLatestSnapshot();
  if (!prev) {
    console.error("\n  No snapshot found. Run `mcp-doctor --snapshot` first.\n");
    process.exit(1);
  }

  const servers = loadConfig();
  process.stderr.write("  Probing current state...\n");
  const results = await probeAll(servers);
  for (const r of results) r.tokens = r.status === "ok" ? countLocal(r.tools) : 0;

  const prevByName = new Map(prev.servers.map((s) => [s.name, s]));
  const nowByName = new Map(results.map((r) => [r.name, r]));

  const added = [...nowByName.keys()].filter((n) => !prevByName.has(n));
  const removed = [...prevByName.keys()].filter((n) => !nowByName.has(n));
  const common = [...nowByName.keys()].filter((n) => prevByName.has(n));

  console.log("");
  console.log(`  ${BOLD}MCP changes since${RESET} ${DIM}${prev.timestamp}${RESET}`);
  console.log("");

  let anyChange = false;

  for (const name of added) {
    const r = nowByName.get(name);
    console.log(`  ${GREEN}+ ${name}${RESET}  ${DIM}new server, ${r.tools.length} tools, ${r.tokens.toLocaleString()} tokens${RESET}`);
    anyChange = true;
  }
  for (const name of removed) {
    const p = prevByName.get(name);
    console.log(`  ${RED}- ${name}${RESET}  ${DIM}removed (was ${p.toolCount} tools, ${p.tokens.toLocaleString()} tokens)${RESET}`);
    anyChange = true;
  }

  for (const name of common) {
    const p = prevByName.get(name);
    const r = nowByName.get(name);
    const tokDelta = (r.tokens ?? 0) - (p.tokens ?? 0);
    const toolDelta = (r.tools?.length ?? 0) - (p.toolCount ?? 0);

    // Tool list changes — find names that came/went.
    const prevTools = new Set(p.toolNames ?? []);
    const nowTools = new Set((r.tools ?? []).map((t) => t.name));
    const newTools = [...nowTools].filter((t) => !prevTools.has(t));
    const goneTools = [...prevTools].filter((t) => !nowTools.has(t));

    if (tokDelta === 0 && newTools.length === 0 && goneTools.length === 0) continue;
    anyChange = true;

    const sign = tokDelta > 0 ? `${YELLOW}+${tokDelta.toLocaleString()}${RESET}` : `${GREEN}${tokDelta.toLocaleString()}${RESET}`;
    console.log(`  ${CYAN}~ ${name}${RESET}  ${sign} tokens, ${toolDelta >= 0 ? "+" : ""}${toolDelta} tools`);
    if (newTools.length) console.log(`      ${GREEN}+ ${newTools.join(", ")}${RESET}`);
    if (goneTools.length) console.log(`      ${RED}- ${goneTools.join(", ")}${RESET}`);
  }

  if (!anyChange) console.log(`  ${DIM}No changes.${RESET}`);

  const prevTotal = prev.servers.reduce((s, r) => s + (r.tokens ?? 0), 0);
  const nowTotal = results.reduce((s, r) => s + (r.tokens ?? 0), 0);
  const totalDelta = nowTotal - prevTotal;
  console.log("");
  const totalSign = totalDelta > 0 ? `${YELLOW}+${totalDelta.toLocaleString()}${RESET}` : totalDelta < 0 ? `${GREEN}${totalDelta.toLocaleString()}${RESET}` : "0";
  console.log(`  ${BOLD}Total context delta:${RESET} ${totalSign} tokens  ${DIM}(was ${prevTotal.toLocaleString()}, now ${nowTotal.toLocaleString()})${RESET}`);
  console.log("");
})();
