# Changelog

## 0.1.0 — initial release

- `mcp-doctor` CLI: probe local MCP servers from `claude_desktop_config.json`, count tokens, render a table
- `mcp-diff` CLI: snapshot current state and compare against the last snapshot to surface added, removed, and changed servers
- Local heuristic token counting (no API key needed)
- Optional `--accurate` mode using Anthropic's `count_tokens` API
- Cross-platform config discovery (macOS, Windows, Linux)
