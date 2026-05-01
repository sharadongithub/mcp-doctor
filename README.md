# mcp-doctor

> `/context` for Claude Desktop. See exactly how much your MCP servers are eating, before you start a conversation.

Claude Code has `/context`. Claude Desktop doesn't. If you have more than two or three MCP servers installed, a surprising chunk of your 200k context window is gone before you type anything — and there's no built-in way to find out how much.

This is that way.

```
$ npx @sharadongithub/mcp-doctor

  MCP context cost  (Claude Desktop, local mode)

  Server                      Tools     Tokens  % of 200k  Status
  ─────────────────────────────────────────────────────────────────
  internal-deploy-tools          21      13.6k       6.8%  ✓ ok
  company-jira-bridge            26      18.4k       9.2%  ✓ ok
  data-warehouse-mcp             20      14.1k       7.1%  ✓ ok
  team-wiki                      12       8.9k       4.4%  ✓ ok
  local-fs-sandbox                4       1.3k       0.6%  ✓ ok
  legacy-runbook-server          15      11.2k       5.6%  ⚠ never called
  ─────────────────────────────────────────────────────────────────
  Total                                  67.5k      33.7%
```

That's a third of your context window, gone, before "hello".

## Install

```bash
npx @sharadongithub/mcp-doctor          # nothing to install, just runs
```

Or globally:

```bash
npm install -g mcp-doctor
mcp-doctor
```

## How it works

1. Reads `claude_desktop_config.json` from the standard location for your OS.
2. Launches each `stdio` MCP server the same way Claude Desktop does (same `command`, `args`, `env`).
3. Performs the MCP `initialize` + `tools/list` handshake to fetch each server's tool definitions — the same JSON Claude Desktop receives at startup.
4. Counts tokens: locally by default (heuristic, ~10–15% margin), or via Anthropic's official `count_tokens` API with `--accurate`.
5. Prints a table.

No telemetry. No config writes. No OAuth. Read-only.

## Flags

| Flag | What it does |
|---|---|
| `--accurate` | Use Anthropic's `count_tokens` API. Requires `ANTHROPIC_API_KEY`. Free, but one HTTP call per server. |
| `--snapshot` | Save current state to `~/.mcp-doctor/` for later comparison with `mcp-diff`. |
| `--config <path>` | Use a non-standard config file. |
| `--verbose` | Show full error messages for failed servers. |

## `mcp-diff` — what changed since last time

```bash
mcp-doctor --snapshot   # Monday
# ...week passes, you add a server, npm bumps another...
mcp-diff                # Friday

  MCP changes since 2026-04-28T09:14:22Z

  + ops-paging-bridge       new server, 12 tools, 8,400 tokens
  ~ company-jira-bridge     +1,200 tokens, +3 tools
      + create_review, list_pipeline_runs, get_pipeline_run
  - legacy-runbook-server   removed (was 21 tools, 13,647 tokens)

  Total context delta: -3,847 tokens  (was 67,512, now 63,665)
```

Useful because `npx -y` servers update silently. A server you installed last month with 12 tools might be shipping 18 today, and nothing tells you.

## Limitations

**This tool measures local MCP servers only.** It reads `claude_desktop_config.json` — the file you (or an installer) edited by hand. It does not currently see official connectors added through Claude Desktop's UI (Atlassian, Notion, Asana, Gmail, Linear, etc.), because those live at the account level, not in any local file Anthropic exposes.

If you use the official connectors heavily, your real context cost is higher than what this tool reports. The number you see is honest for what it covers, but it is not your total.

Other limitations:

- Token counts in local mode are heuristic, within ~10–15% of Anthropic's exact figure. Use `--accurate` if you need precision.
- Tested on Claude Desktop's standard config schema. Custom forks may not work.
- `npx -y` servers that download on first run can exceed the 10-second probe timeout.

## Why not just have Claude Desktop add a `/context` command?

Yeah, they probably should. Until then, here's this.

## License

MIT
