import { exec } from 'node:child_process';
import { cleanText } from './utils/sanitize.js';
// --extra-cmd runs an arbitrary shell command, so it needs an explicit opt-in in the environment.
export function parseExtraCmdArg(argv = process.argv, env = process.env) {
    const index = argv.findIndex((arg) => arg === '--extra-cmd' || arg.startsWith('--extra-cmd='));
    if (index === -1)
        return null;
    if (!['1', 'true', 'yes', 'on'].includes(env.CLAUDE_HUB_ALLOW_EXTRA_CMD?.trim().toLowerCase() ?? ''))
        return null;
    const arg = argv[index];
    return (arg === '--extra-cmd' ? argv[index + 1] : arg.slice('--extra-cmd='.length)) || null;
}
// The command prints JSON `{ "label": "..." }`, or text whose last non-empty line is the label.
function toLabel(output) {
    let label;
    try {
        const data = JSON.parse(output);
        label = data !== null && typeof data === 'object' ? data.label : undefined;
    }
    catch {
        label = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);
    }
    return cleanText(label, 50) ?? null;
}
export function runExtraCmd(cmd, timeout = 3000) {
    return new Promise((resolve) => {
        exec(cmd, { timeout, maxBuffer: 10 * 1024, windowsHide: true }, (error, stdout) => {
            const output = error ? '' : String(stdout).trim();
            resolve(output ? toLabel(output) : null);
        });
    });
}
//# sourceMappingURL=extra-cmd.js.map