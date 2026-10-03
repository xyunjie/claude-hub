// Runs claude-hub. Setup copies this launcher to <config dir>/plugins/claude-hub/ so the
// statusLine command survives plugin updates. A `dev-path` file next to it (written by
// `setup.mjs install --dev`) points at a local checkout instead and wins when present.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Claude Code pads the status line by 2 columns on each side.
const columns = Number.parseInt(process.env.COLUMNS ?? '', 10);
if (columns > 0) process.env.COLUMNS = String(Math.max(1, columns - 4));

const envDir = process.env.CLAUDE_CONFIG_DIR?.trim();
const configDir = !envDir
  ? path.join(os.homedir(), '.claude')
  : envDir === '~' || envDir.startsWith('~/') ? path.join(os.homedir(), envDir.slice(1)) : envDir;
const hubDir = path.join(configDir, 'plugins', 'claude-hub');
const entry = path.join('dist', 'index.js');

const list = (dir) => {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
};
const parseVersion = (name) => /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(name)?.slice(1).map(Number);
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function devEntry() {
  try {
    const root = fs.readFileSync(path.join(hubDir, 'dev-path'), 'utf8').trim();
    const file = path.join(root, entry);
    return root && fs.existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

function newestInstalled() {
  const cacheDir = path.join(configDir, 'plugins', 'cache');
  let latest;
  for (const marketplace of list(cacheDir)) {
    const pluginDir = path.join(cacheDir, marketplace, 'claude-hub');
    for (const name of list(pluginDir)) {
      const version = parseVersion(name);
      const file = path.join(pluginDir, name, entry);
      if (version && (!latest || compare(version, latest.version) > 0) && fs.existsSync(file)) latest = { version, file };
    }
  }
  return latest?.file ?? null;
}

const file = devEntry() ?? newestInstalled();
if (file) {
  const hub = await import(pathToFileURL(file).href);
  await hub.main();
}
