import * as os from 'node:os';
import * as path from 'node:path';
export function expandHome(inputPath, homeDir = os.homedir()) {
    if (inputPath === '~')
        return homeDir;
    if (inputPath.startsWith('~/') || inputPath.startsWith('~\\'))
        return path.join(homeDir, inputPath.slice(2));
    return inputPath;
}
/** `$CLAUDE_CONFIG_DIR`, or `~/.claude`. */
export function claudeConfigDir(homeDir = os.homedir()) {
    const env = process.env.CLAUDE_CONFIG_DIR?.trim();
    return env ? path.resolve(expandHome(env, homeDir)) : path.join(homeDir, '.claude');
}
// Claude Code keeps .claude.json inside CLAUDE_CONFIG_DIR when it is set, otherwise in the home directory.
export function claudeJsonPath(homeDir = os.homedir()) {
    return process.env.CLAUDE_CONFIG_DIR?.trim()
        ? path.join(claudeConfigDir(homeDir), '.claude.json')
        : path.join(homeDir, '.claude.json');
}
/** Where claude-hub keeps its config and caches. */
export function hubDir(homeDir = os.homedir()) {
    return path.join(claudeConfigDir(homeDir), 'plugins', 'claude-hub');
}
//# sourceMappingURL=paths.js.map