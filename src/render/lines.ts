import * as fs from 'node:fs';
import * as path from 'node:path';
import { t } from '../i18n/index.js';
import { formatBytes } from '../utils/format.js';
import { fileHref, hyperlink } from '../utils/hyperlinks.js';
import { cleanText, sanitize } from '../utils/sanitize.js';
import { usageRole } from './colors.js';
import type { Frame } from './frame.js';
import { configCountSegments } from './parts.js';
import { segment, type Segment } from './segments.js';
import { formatAgo, formatClock } from './time.js';

/** Config counts, output style, and failing MCP servers. */
export function environmentSegments(f: Frame): Segment[] {
  const d = f.config.display;
  const segments = configCountSegments(f);
  const style = d.showOutputStyle ? cleanText(f.stdin.output_style?.name, 40) : undefined;
  if (style) {
    const text = `${t('label.style')}: ${style}`;
    segments.push(segment('environment', f.paint.label(text), text, 'label', 3));
  }
  const failing = d.showConfigCounts || d.showMcp ? f.transcript.mcpErrors : [];
  if (failing.length > 0) {
    const overflow = failing.length > 3 ? ` +${failing.length - 3}` : '';
    const text = `${f.icons.warn} ${failing.slice(0, 3).join(', ')}${overflow}`;
    segments.push(segment('environment', f.paint.critical(text), text, 'critical', 1));
  }
  return segments;
}

const TTL_SECONDS: Record<string, number> = { '5m': 300, '1h': 3600 };

// Shows the expiry time rather than a countdown: between turns the statusline isn't
// repainted, so a countdown would freeze.
export function promptCacheSegment(f: Frame): Segment | null {
  const cache = f.stdin.prompt_cache;
  if (!f.config.display.showPromptCache || !cache?.caching_observed) return null;
  const expiresAt = typeof cache.expires_at === 'number' ? cache.expires_at * 1000 : 0;
  const remaining = cache.warm ? expiresAt - f.now : 0;
  const label = f.icons.cache || `${t('label.promptCache')} `;
  if (remaining <= 0) {
    const value = t('status.expired');
    return segment('promptCache', `${f.paint.label(t('label.promptCache'))} ${f.paint.label(value)}`, `${label}${value}`, 'label', 2);
  }
  const warnMs = Math.max(60, Math.floor((TTL_SECONDS[cache.ttl ?? ''] ?? 300) / 5)) * 1000;
  const value = formatClock(new Date(expiresAt), new Date(f.now), 'format.until');
  const role = remaining <= warnMs ? 'warning' : 'context';
  return segment('promptCache', `${f.paint.label(t('label.promptCache'))} ${f.paint[role](value)}`, `${label}${value}`, role, 2);
}

export function cacheHitSegment(f: Frame): Segment | null {
  const ratio = f.stdin.prompt_cache?.hit_ratio;
  if (!f.config.display.showCacheHitRate || typeof ratio !== 'number' || !Number.isFinite(ratio)) return null;
  const value = `${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;
  return segment('cacheHitRate', `${f.paint.label(t('label.cacheHit'))} ${value}`, `${t('label.cacheHit')} ${value}`, 'label', 2);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `Started: 2026-10-01 11:00`, `Last reply: 1m ago`. */
export function sessionTimeSegments(f: Frame): Segment[] {
  const d = f.config.display;
  const segments: Segment[] = [];
  const start = f.transcript.sessionStart;
  if (d.showSessionStartDate && start) {
    const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}`;
    segments.push(segment('sessionTime', `${f.paint.label(`${t('label.started')}:`)} ${date}`, `${t('label.started')} ${date}`, 'label', 3));
  }
  const last = f.transcript.lastResponseAt;
  if (d.showLastResponseAt && last) {
    const ago = formatAgo(f.now - last.getTime());
    segments.push(segment('sessionTime', `${f.paint.label(`${t('label.lastReply')}:`)} ${ago}`, `${t('label.lastReply')} ${ago}`, 'label', 3));
  }
  return segments;
}

/** Approximate system RAM. */
export function memorySegment(f: Frame): Segment | null {
  const memory = f.memory;
  if (!f.config.display.showMemoryUsage || !memory) return null;
  const role = usageRole(memory.usedPercent);
  const amounts = `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`;
  const text = `${f.paint.label(t('label.ram'))} ${f.paint.bar(memory.usedPercent, f.barWidth, role)} ${amounts} (${f.paint[role](`${memory.usedPercent}%`)})`;
  const plain = `${f.icons.ram || `${t('label.ram')} `}${f.paint.plainBar(memory.usedPercent, f.barWidth)} ${memory.usedPercent}%`;
  return segment('memory', text, plain, role, 2);
}

function insideCwd(cwd: string, candidate: string): string | null {
  const resolved = path.resolve(cwd, candidate);
  const relative = path.relative(path.resolve(cwd), resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) ? resolved : null;
}

const MAX_FILES = 6;

/** Recently changed files, newest first, with line diffs (expanded, gitStatus.showFileStats). */
export function gitFilesLine(f: Frame): string | null {
  const files = f.git?.files;
  if (!f.config.gitStatus.showFileStats || !files || (f.width !== null && f.width < 60)) return null;
  if (files.changed.length === 0 && files.untracked === 0) return null;
  const { paint } = f;
  const cwd = f.stdin.cwd;
  const mtime = (file: string): number => {
    try {
      const resolved = cwd ? insideCwd(cwd, file) : null;
      return resolved ? fs.statSync(resolved).mtimeMs : 0;
    } catch {
      return 0;
    }
  };
  const sorted = [...files.changed].sort((a, b) => mtime(b.path) - mtime(a.path));
  const style = {
    added: { color: paint.success, prefix: '+' },
    deleted: { color: paint.critical, prefix: '-' },
    modified: { color: paint.warning, prefix: '~' },
  } as const;
  const entries = sorted.slice(0, MAX_FILES).map((file) => {
    const { color, prefix } = style[file.type];
    const resolved = cwd ? insideCwd(cwd, file.path) : null;
    const name = color(sanitize(file.basename));
    let entry = `${color(prefix)}${resolved ? hyperlink(fileHref(resolved), name) : name}`;
    const diff = file.lineDiff;
    const parts = diff ? [diff.added > 0 ? paint.success(`+${diff.added}`) : '', diff.deleted > 0 ? paint.critical(`-${diff.deleted}`) : ''].filter(Boolean) : [];
    if (parts.length > 0) entry += paint.label('(') + parts.join(' ') + paint.label(')');
    return entry;
  });
  if (sorted.length > MAX_FILES) entries.push(paint.label(t('format.more', { count: sorted.length - MAX_FILES })));
  if (files.untracked > 0) entries.push(paint.label(`?${files.untracked}`));
  return entries.join('  ');
}
