// ANSI table output, intentionally evocative of Claude Code's /context.

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";

const CONTEXT_WINDOW = 200_000;

function pct(n) {
  return `${((n / CONTEXT_WINDOW) * 100).toFixed(1)}%`;
}

function fmtTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function color(pctNum) {
  if (pctNum < 5) return GREEN;
  if (pctNum < 15) return YELLOW;
  return RED;
}

function pad(s, w, align = "left") {
  // ANSI-aware padding: strip codes for length calc.
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  const space = " ".repeat(Math.max(0, w - visible.length));
  return align === "right" ? space + s : s + space;
}

export function renderReport(results, { mode }) {
  const total = results.reduce((s, r) => s + (r.tokens ?? 0), 0);
  const totalPct = (total / CONTEXT_WINDOW) * 100;

  const lines = [];
  lines.push("");
  lines.push(`  ${BOLD}MCP context cost${RESET}  ${DIM}(Claude Desktop, ${mode} mode)${RESET}`);
  lines.push("");

  const W = { name: 26, tools: 7, tokens: 9, pct: 9, status: 14 };
  const rule = "  " + "─".repeat(W.name + W.tools + W.tokens + W.pct + W.status + 4);

  lines.push(
    "  " +
      pad(`${BOLD}Server${RESET}`, W.name) +
      pad(`${BOLD}Tools${RESET}`, W.tools, "right") +
      "  " +
      pad(`${BOLD}Tokens${RESET}`, W.tokens, "right") +
      "  " +
      pad(`${BOLD}% of 200k${RESET}`, W.pct, "right") +
      "  " +
      pad(`${BOLD}Status${RESET}`, W.status),
  );
  lines.push(rule);

  // Sort heaviest first — that's what the user wants to see.
  const sorted = [...results].sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0));

  for (const r of sorted) {
    const toolCount = r.tools?.length ?? 0;
    const tokens = r.tokens ?? 0;
    const p = (tokens / CONTEXT_WINDOW) * 100;
    const c = color(p);

    const statusCell =
      r.status === "ok" ? `${GREEN}✓ ok${RESET}` :
      r.status === "skipped" ? `${DIM}— skipped${RESET}` :
      `${RED}✗ ${r.reason?.slice(0, 30) ?? "failed"}${RESET}`;

    lines.push(
      "  " +
        pad(r.name, W.name) +
        pad(r.status === "ok" ? String(toolCount) : "—", W.tools, "right") +
        "  " +
        pad(r.status === "ok" ? `${c}${fmtTokens(tokens)}${RESET}` : `${DIM}—${RESET}`, W.tokens, "right") +
        "  " +
        pad(r.status === "ok" ? `${c}${p.toFixed(1)}%${RESET}` : `${DIM}—${RESET}`, W.pct, "right") +
        "  " +
        statusCell,
    );
  }

  lines.push(rule);
  const totalC = color(totalPct);
  lines.push(
    "  " +
      pad(`${BOLD}Total${RESET}`, W.name) +
      pad("", W.tools, "right") +
      "  " +
      pad(`${totalC}${BOLD}${fmtTokens(total)}${RESET}`, W.tokens, "right") +
      "  " +
      pad(`${totalC}${BOLD}${totalPct.toFixed(1)}%${RESET}`, W.pct, "right"),
  );
  lines.push("");

  // Suggestions
  const heavy = sorted.filter((r) => r.status === "ok" && (r.tokens / CONTEXT_WINDOW) > 0.05);
  if (heavy.length) {
    lines.push(`  ${DIM}Heaviest:${RESET} ${heavy.map((r) => `${r.name} (${pct(r.tokens)})`).join(", ")}`);
  }
  const failed = results.filter((r) => r.status === "error");
  if (failed.length) {
    lines.push(`  ${YELLOW}${failed.length} server(s) failed to start.${RESET} Run with --verbose for details.`);
  }
  if (mode === "local") {
    lines.push(`  ${DIM}Counts are heuristic (~10–15% margin). Use --accurate for exact numbers.${RESET}`);
  }
  lines.push("");

  return lines.join("\n");
}
