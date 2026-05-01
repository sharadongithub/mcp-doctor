// Find and read the Claude Desktop config file.
// Paths per Anthropic's docs:
//   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
//   Windows: %APPDATA%\Claude\claude_desktop_config.json
//   Linux:   ~/.config/Claude/claude_desktop_config.json

import { readFileSync, existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export function getConfigPath() {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

export function loadConfig(path = getConfigPath()) {
  if (!existsSync(path)) {
    throw new Error(`Claude Desktop config not found at ${path}\n\nIs Claude Desktop installed? You can also pass --config <path>.`);
  }
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(`Couldn't read ${path}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${path} isn't valid JSON: ${e.message}`);
  }
  return parsed.mcpServers ?? {};
}
