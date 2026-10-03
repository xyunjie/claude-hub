import * as fs from 'node:fs';
import * as path from 'node:path';
import { claudeConfigDir, claudeJsonPath } from './paths.js';
const MAX_RULE_ENTRIES = 10_000;
function readJson(file) {
    try {
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
    }
    catch {
        return null;
    }
}
const keysOf = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
const stringsOf = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
const realPath = (p) => {
    try {
        return fs.realpathSync.native(p);
    }
    catch {
        return null;
    }
};
// Counts .md files recursively, following each symlink once and bounded so a loop or a
// huge tree can't stall the statusline.
function countRules(dir, state = { visited: new Set(), entries: 0 }) {
    const root = realPath(dir);
    if (!root || state.visited.has(root))
        return 0;
    state.visited.add(root);
    let total = 0;
    try {
        for (const entry of fs.readdirSync(root)) {
            if (++state.entries > MAX_RULE_ENTRIES)
                break;
            const target = realPath(path.join(root, entry));
            if (!target || state.visited.has(target))
                continue;
            const stat = fs.statSync(target);
            if (stat.isDirectory())
                total += countRules(target, state);
            else if (stat.isFile() && entry.endsWith('.md')) {
                state.visited.add(target);
                total += 1;
            }
        }
    }
    catch {
        // Unreadable rules count as none.
    }
    return total;
}
const sameDir = (a, b) => (realPath(a) ?? path.resolve(a)) === (realPath(b) ?? path.resolve(b));
export function countConfigs(cwd) {
    const claudeDir = claudeConfigDir();
    const exists = (...parts) => fs.existsSync(path.join(...parts));
    const userSettings = readJson(path.join(claudeDir, 'settings.json'));
    const claudeJson = readJson(claudeJsonPath());
    const userMcp = new Set([...keysOf(userSettings?.mcpServers), ...keysOf(claudeJson?.mcpServers)]);
    for (const name of stringsOf(claudeJson?.disabledMcpServers))
        userMcp.delete(name);
    let claudeMd = exists(claudeDir, 'CLAUDE.md') ? 1 : 0;
    let rules = countRules(path.join(claudeDir, 'rules'));
    let hooks = keysOf(userSettings?.hooks).length;
    const projectMcp = new Set();
    if (cwd) {
        const projectDir = path.join(cwd, '.claude');
        // When the project's .claude is the user config dir, its files were counted above.
        const isUserDir = sameDir(projectDir, claudeDir);
        claudeMd += [
            exists(cwd, 'CLAUDE.md'),
            exists(cwd, 'CLAUDE.local.md'),
            !isUserDir && exists(projectDir, 'CLAUDE.md'),
            exists(projectDir, 'CLAUDE.local.md'),
        ].filter(Boolean).length;
        if (!isUserDir) {
            rules += countRules(path.join(projectDir, 'rules'));
            const projectSettings = readJson(path.join(projectDir, 'settings.json'));
            for (const name of keysOf(projectSettings?.mcpServers))
                projectMcp.add(name);
            hooks += keysOf(projectSettings?.hooks).length;
        }
        const local = readJson(path.join(projectDir, 'settings.local.json'));
        for (const name of keysOf(local?.mcpServers))
            projectMcp.add(name);
        hooks += keysOf(local?.hooks).length;
        const disabled = new Set(stringsOf(local?.disabledMcpjsonServers));
        for (const name of keysOf(readJson(path.join(cwd, '.mcp.json'))?.mcpServers)) {
            if (!disabled.has(name))
                projectMcp.add(name);
        }
    }
    return { claudeMd, rules, mcps: userMcp.size + projectMcp.size, hooks };
}
//# sourceMappingURL=config-counts.js.map