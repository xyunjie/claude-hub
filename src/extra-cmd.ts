import { exec } from 'node:child_process';
import { cleanText } from './utils/sanitize.js';

// --extra-cmd runs an arbitrary shell command, so it needs an explicit opt-in in the environment.
export function parseExtraCmdArg(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): string | null {
  const index = argv.findIndex((arg) => arg === '--extra-cmd' || arg.startsWith('--extra-cmd='));
  if (index === -1) return null;
  if (!['1', 'true', 'yes', 'on'].includes(env.CLAUDE_HUB_ALLOW_EXTRA_CMD?.trim().toLowerCase() ?? '')) return null;
  const arg = argv[index];
  return (arg === '--extra-cmd' ? argv[index + 1] : arg.slice('--extra-cmd='.length)) || null;
}

// The command prints JSON `{ "label": "..." }`, or text whose last non-empty line is the label.
function toLabel(output: string): string | null {
  let label: unknown;
  try {
    const data: unknown = JSON.parse(output);
    label = data !== null && typeof data === 'object' ? (data as { label?: unknown }).label : undefined;
  } catch {
    label = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);
  }
  return cleanText(label, 50) ?? null;
}

export function runExtraCmd(cmd: string, timeout = 3000): Promise<string | null> {
  return new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 10 * 1024, windowsHide: true }, (error, stdout) => {
      const output = error ? '' : String(stdout).trim();
      resolve(output ? toLabel(output) : null);
    });
  });
}
