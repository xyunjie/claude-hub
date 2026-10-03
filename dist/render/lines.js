import * as fs from 'node:fs';
import * as path from 'node:path';
import { t } from '../i18n/index.js';
import { formatBytes } from '../utils/format.js';
import { fileHref, hyperlink } from '../utils/hyperlinks.js';
import { cleanText, sanitize } from '../utils/sanitize.js';
import { barLabel } from './bars.js';
import { usageRole } from './colors.js';
import { configCountParts } from './parts.js';
import { formatAgo, formatClock } from './time.js';
/** Config counts, output style, and failing MCP servers. */
export function environmentLine(f) {
    const d = f.config.display;
    const parts = configCountParts(f);
    const style = d.showOutputStyle ? cleanText(f.stdin.output_style?.name, 40) : undefined;
    if (style)
        parts.push(f.paint.label(`${t('label.style')}: ${style}`));
    const failing = d.showConfigCounts || d.showMcp ? f.transcript.mcpErrors : [];
    if (failing.length > 0) {
        const overflow = failing.length > 3 ? ` +${failing.length - 3}` : '';
        parts.push(f.paint.critical(`⚠ ${failing.slice(0, 3).join(', ')}${overflow}`));
    }
    return parts.length > 0 ? parts.join(' | ') : null;
}
const TTL_SECONDS = { '5m': 300, '1h': 3600 };
// Shows the expiry time rather than a countdown: between turns the statusline isn't
// repainted, so a countdown would freeze.
export function promptCacheLine(f) {
    const cache = f.stdin.prompt_cache;
    if (!f.config.display.showPromptCache || !cache?.caching_observed)
        return null;
    const expiresAt = typeof cache.expires_at === 'number' ? cache.expires_at * 1000 : 0;
    const remaining = cache.warm ? expiresAt - f.now : 0;
    let value;
    if (remaining <= 0) {
        value = f.paint.label(`⏱ ${t('status.expired')}`);
    }
    else {
        const warnMs = Math.max(60, Math.floor((TTL_SECONDS[cache.ttl ?? ''] ?? 300) / 5)) * 1000;
        const until = `⏱ ${formatClock(new Date(expiresAt), new Date(f.now), 'format.until')}`;
        value = remaining <= warnMs ? f.paint.warning(until) : f.paint.context(until);
    }
    return `${f.paint.label(t('label.promptCache'))} ${value}`;
}
export function cacheHitRateLine(f) {
    const ratio = f.stdin.prompt_cache?.hit_ratio;
    if (!f.config.display.showCacheHitRate || typeof ratio !== 'number' || !Number.isFinite(ratio))
        return null;
    return `${f.paint.label(t('label.cacheHit'))} ${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;
}
const pad = (n) => String(n).padStart(2, '0');
/** `Started: 2026-10-01 11:00 │ Last reply: 1m ago`. */
export function sessionTimeLine(f) {
    const d = f.config.display;
    const parts = [];
    const start = f.transcript.sessionStart;
    if (d.showSessionStartDate && start) {
        const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}`;
        parts.push(`${f.paint.label(`${t('label.started')}:`)} ${date}`);
    }
    const last = f.transcript.lastResponseAt;
    if (d.showLastResponseAt && last)
        parts.push(`${f.paint.label(`${t('label.lastReply')}:`)} ${formatAgo(f.now - last.getTime())}`);
    return parts.length > 0 ? parts.join(' │ ') : null;
}
/** Approximate system RAM. */
export function memoryLine(f, align = false) {
    const memory = f.memory;
    if (!f.config.display.showMemoryUsage || !memory)
        return null;
    const role = usageRole(memory.usedPercent);
    return `${barLabel(f, 'label.ram', align)} ${f.paint.bar(memory.usedPercent, f.barWidth, role)} `
        + `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)} (${f.paint[role](`${memory.usedPercent}%`)})`;
}
function insideCwd(cwd, candidate) {
    const resolved = path.resolve(cwd, candidate);
    const relative = path.relative(path.resolve(cwd), resolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) ? resolved : null;
}
const MAX_FILES = 6;
/** Recently changed files, newest first, with line diffs (expanded, gitStatus.showFileStats). */
export function gitFilesLine(f) {
    const files = f.git?.files;
    if (!f.config.gitStatus.showFileStats || !files || (f.width !== null && f.width < 60))
        return null;
    if (files.changed.length === 0 && files.untracked === 0)
        return null;
    const { paint } = f;
    const cwd = f.stdin.cwd;
    const mtime = (file) => {
        try {
            const resolved = cwd ? insideCwd(cwd, file) : null;
            return resolved ? fs.statSync(resolved).mtimeMs : 0;
        }
        catch {
            return 0;
        }
    };
    const sorted = [...files.changed].sort((a, b) => mtime(b.path) - mtime(a.path));
    const style = {
        added: { color: paint.success, prefix: '+' },
        deleted: { color: paint.critical, prefix: '-' },
        modified: { color: paint.warning, prefix: '~' },
    };
    const entries = sorted.slice(0, MAX_FILES).map((file) => {
        const { color, prefix } = style[file.type];
        const resolved = cwd ? insideCwd(cwd, file.path) : null;
        const name = color(sanitize(file.basename));
        let entry = `${color(prefix)}${resolved ? hyperlink(fileHref(resolved), name) : name}`;
        const diff = file.lineDiff;
        const diffParts = diff ? [diff.added > 0 ? paint.success(`+${diff.added}`) : '', diff.deleted > 0 ? paint.critical(`-${diff.deleted}`) : ''].filter(Boolean) : [];
        if (diffParts.length > 0)
            entry += paint.label('(') + diffParts.join(' ') + paint.label(')');
        return entry;
    });
    if (sorted.length > MAX_FILES)
        entries.push(paint.label(t('format.more', { count: sorted.length - MAX_FILES })));
    if (files.untracked > 0)
        entries.push(paint.label(`?${files.untracked}`));
    return entries.join('  ');
}
//# sourceMappingURL=lines.js.map