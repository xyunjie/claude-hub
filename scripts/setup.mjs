// Installs the claude-hub statusLine. Run it with the runtime the status line should use:
//   node setup.mjs inspect              report the current statusLine
//   node setup.mjs install [--dev]      install (--dev: run this checkout, not the plugin cache)
//   node setup.mjs import-hud           copy claude-hud display settings into claude-hub
//   node setup.mjs uninstall            restore the statusLine that was replaced
// Every action prints a JSON report on stdout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function configDir() {
  const dir = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (!dir) return path.join(os.homedir(), '.claude');
  return dir === '~' || dir.startsWith('~/') ? path.join(os.homedir(), dir.slice(1)) : dir;
}

const quote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;
const hubDir = path.join(configDir(), 'plugins', 'claude-hub');
const settingsPath = path.join(configDir(), 'settings.json');
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function buildCommand(launcher) {
  if (process.platform === 'win32') return `"${process.execPath}" "${launcher}"`;
  return `${quote(process.execPath)} ${quote(launcher)}`;
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  if (text.trim() === '') return {};
  const value = JSON.parse(text);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${file} does not contain a JSON object`);
  return value;
}

// settings.json is often a dotfiles symlink: write the real file and keep its permissions.
function writeJsonAtomic(file, value) {
  const target = fs.existsSync(file) ? fs.realpathSync(file) : file;
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o600;
  const temp = `${target}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.chmodSync(temp, mode);
  fs.renameSync(temp, target);
}

function redact(command) {
  const preview = command
    .replace(/\b(Bearer)\s+["']?[^"'\s]+/gi, '$1 [REDACTED]')
    .replace(/\b(token|api[_-]?key|secret|password|auth)(=|:)\s*["']?[^"'\s]+/gi, '$1$2[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
}

function kindOf(command) {
  if (!command) return 'none';
  if (command.includes('claude-hub')) return 'claude-hub';
  return command.includes('claude-hud') ? 'claude-hud' : 'other';
}

function inspect() {
  const settings = readJson(settingsPath);
  const existing = typeof settings.statusLine?.command === 'string' ? settings.statusLine.command : '';
  return {
    settingsPath,
    command: buildCommand(path.join(hubDir, 'statusline.mjs')),
    existing: kindOf(existing),
    existingPreview: existing ? redact(existing) : '',
    configPath: path.join(hubDir, 'config.json'),
    configExists: fs.existsSync(path.join(hubDir, 'config.json')),
  };
}

function install(dev) {
  const settings = readJson(settingsPath);
  const report = inspect();
  const launcher = path.join(hubDir, 'statusline.mjs');
  fs.mkdirSync(hubDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'scripts', 'statusline.mjs'), launcher);

  const devPath = path.join(hubDir, 'dev-path');
  if (dev) {
    if (!fs.existsSync(path.join(repoRoot, 'dist', 'index.js'))) throw new Error('dist/ is missing: run `npm run build` first');
    fs.writeFileSync(devPath, `${repoRoot}\n`);
    report.devPath = repoRoot;
  } else {
    fs.rmSync(devPath, { force: true });
  }

  if (fs.existsSync(settingsPath)) {
    report.backupPath = `${settingsPath}.bak.${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}`;
    fs.copyFileSync(settingsPath, report.backupPath);
  }
  // Keep whatever we replace so `uninstall` can put it back.
  if (report.existing !== 'none' && report.existing !== 'claude-hub') {
    report.previousPath = path.join(hubDir, 'previous-statusline.json');
    fs.writeFileSync(report.previousPath, JSON.stringify(settings.statusLine, null, 2), { mode: 0o600 });
  }

  const statusLine = { type: 'command', command: report.command };
  const refresh = settings.statusLine?.refreshInterval;
  if (typeof refresh === 'number') statusLine.refreshInterval = refresh;
  if (typeof settings.statusLine?.padding === 'number') statusLine.padding = settings.statusLine.padding;
  writeJsonAtomic(settingsPath, { ...settings, statusLine });
  report.installed = statusLine;
  return report;
}

function uninstall() {
  const settings = readJson(settingsPath);
  const previousPath = path.join(hubDir, 'previous-statusline.json');
  if (!fs.existsSync(previousPath)) {
    const { statusLine, ...rest } = settings;
    writeJsonAtomic(settingsPath, rest);
    return { settingsPath, restored: null };
  }
  const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
  writeJsonAtomic(settingsPath, { ...settings, statusLine: previous });
  return { settingsPath, restored: redact(String(previous?.command ?? '')) };
}

// claude-hub reads the same display keys as claude-hud; unknown keys are ignored when loaded.
function importHud() {
  const source = path.join(configDir(), 'plugins', 'claude-hud', 'config.json');
  const target = path.join(hubDir, 'config.json');
  if (!fs.existsSync(source)) throw new Error(`no claude-hud config at ${source}`);
  const hud = readJson(source);
  const { language, colors, ...rest } = hud;
  const current = readJson(target);
  const merged = { ...rest, ...current, display: { ...(rest.display ?? {}), ...(current.display ?? {}) } };
  writeJsonAtomic(target, merged);
  return { source, target, imported: Object.keys(rest.display ?? {}), skipped: ['language', 'colors'] };
}

function main([action, ...flags]) {
  switch (action) {
    case 'inspect': return inspect();
    case 'install': return install(flags.includes('--dev'));
    case 'uninstall': return uninstall();
    case 'import-hud': return importHud();
    default: throw new Error('usage: setup.mjs inspect | install [--dev] | uninstall | import-hud');
  }
}

try {
  process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`claude-hub setup: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
}
