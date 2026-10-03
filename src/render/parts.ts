import type { PathLevels, ProjectSegment } from '../config.js';
import { t } from '../i18n/index.js';
import { effortLevel, formatModelName, modelName, providerLabel, sessionCostUsd } from '../stdin.js';
import { formatElapsed, formatTokens, formatUsd } from '../utils/format.js';
import { fileHref, hyperlink } from '../utils/hyperlinks.js';
import { cleanText, sanitize } from '../utils/sanitize.js';
import type { Frame } from './frame.js';

/** A project-line part; `key` lets projectLineOrder move it, null keeps its slot. */
export interface Part {
  key: ProjectSegment | null;
  text: string;
}

function effortSuffix(f: Frame): string {
  const d = f.config.display;
  const info = d.showEffortLevel ? effortLevel(f.stdin, f.transcript.ultracode) : null;
  if (!info) return '';
  // The symbol alone can't carry the ultracode marker, so symbol mode keeps the full form.
  if (d.effortFormat === 'symbol' && info.symbol && !info.level.startsWith('ultracode(')) return ` ${info.symbol}`;
  return d.effortFormat === 'text' || !info.symbol ? ` ${info.level}` : ` ${info.symbol} ${info.level}`;
}

/** `[Opus 5.5 ◑ high | Bedrock]`, or with the provider first when showProvider is on. */
export function modelBadge(f: Frame): string | null {
  const d = f.config.display;
  if (!d.showModel) return null;
  const name = d.modelOverride || formatModelName(modelName(f.stdin, f.transcript, d.modelSource), d.modelFormat);
  const core = `${sanitize(name)}${effortSuffix(f)}`;
  const provider = providerLabel(f.stdin);
  let text = provider ? `${core} | ${provider}` : core;
  if (d.showProvider) {
    const shown = d.providerName.trim() || provider;
    text = shown ? `${shown} | ${core}` : core;
  }
  return f.paint.model(`[${text}]`);
}

/** An untrusted cwd shown with the configured number of trailing segments. */
export function formatProjectPath(cwd: string, levels: PathLevels): string {
  const safe = sanitize(cwd);
  const segments = safe.split(/[/\\]/).filter(Boolean);
  if (levels !== 'full') return segments.slice(-levels).join('/') || (/^[/\\]/.test(safe) ? '/' : safe);
  if (/^[A-Za-z]:[\\/]/.test(safe)) return segments.join('/');
  return /^[\\/]/.test(safe) ? `/${segments.join('/')}` : segments.join('/') || safe;
}

const MAX_ADDED_DIRS = 5;

function addedDirs(f: Frame): string | null {
  const dirs = f.stdin.workspace?.added_dirs;
  if (!f.config.display.showAddedDirs || !Array.isArray(dirs)) return null;
  const named = dirs
    .filter((dir): dir is string => typeof dir === 'string' && dir.length > 0)
    .map((dir) => ({ dir, name: cleanText(dir.split(/[/\\]/).filter(Boolean).pop() ?? dir, 24) }))
    .filter((entry): entry is { dir: string; name: string } => !!entry.name);
  if (named.length === 0) return null;
  const shown = named.slice(0, MAX_ADDED_DIRS).map(({ dir, name }) => hyperlink(fileHref(dir), f.paint.label(`+${name}`)));
  if (named.length > MAX_ADDED_DIRS) shown.push(f.paint.label(t('format.more', { count: named.length - MAX_ADDED_DIRS })));
  return shown.join(' ');
}

/** `git:(main* ↑2 ↓1 [+12 -3])`, or with compact file counts `!2 +1 ?3`. */
export function vcsPart(f: Frame, compact: boolean): string | null {
  const status = f.git;
  const g = f.config.gitStatus;
  if (!status || !g.enabled) return null;
  const { paint } = f;
  const inner = [hyperlink(status.branchUrl, paint.gitBranch(`${sanitize(status.branch)}${g.showDirty && status.dirty ? '*' : ''}`))];
  if (g.showAheadBehind) {
    if (status.ahead > 0) inner.push(paint.gitBranch(`↑${status.ahead}`));
    if (status.behind > 0) inner.push(paint.gitBranch(`↓${status.behind}`));
  }
  if (g.showFileStats) {
    if (!compact && status.lineDiff) {
      const diff = [
        status.lineDiff.added > 0 ? paint.success(`+${status.lineDiff.added}`) : '',
        status.lineDiff.deleted > 0 ? paint.critical(`-${status.lineDiff.deleted}`) : '',
      ].filter(Boolean);
      if (diff.length > 0) inner.push(`[${diff.join(' ')}]`);
    }
    if (compact && status.files) {
      const { modified, added, deleted, untracked } = status.files;
      const counts = ([[modified, '!'], [added, '+'], [deleted, '✘'], [untracked, '?']] as const)
        .filter(([n]) => n > 0)
        .map(([n, symbol]) => `${symbol}${n}`);
      if (counts.length > 0) inner.push(paint.gitBranch(counts.join(' ')));
    }
  }
  const worktreeName = g.showWorktree ? cleanText(f.stdin.workspace?.git_worktree, 40) : undefined;
  const worktree = worktreeName ? ` ${paint.git(`⎇ ${worktreeName}`)}` : '';
  return `${paint.git('git:(')}${inner.join(' ')}${paint.git(')')}${worktree}`;
}

/** The project path (linked), added dirs, and VCS segment as one part. */
export function projectPart(f: Frame, compact: boolean): string | null {
  const pieces: string[] = [];
  const cwd = f.stdin.cwd ?? f.stdin.workspace?.current_dir;
  if (f.config.display.showProject && cwd) {
    const text = f.paint.project(formatProjectPath(cwd, f.config.pathLevels));
    pieces.push(compact ? text : hyperlink(fileHref(cwd), text));
  }
  if (!compact) {
    const dirs = addedDirs(f);
    if (dirs) pieces.push(dirs);
  }
  const vcs = vcsPart(f, compact);
  if (vcs) pieces.push(vcs);
  return pieces.length > 0 ? pieces.join(' ') : null;
}

export function sessionNamePart(f: Frame): string | null {
  const name = f.config.display.showSessionName ? cleanText(f.stdin.session_name) : undefined;
  return name ? f.paint.label(name) : null;
}

export function versionPart(f: Frame): string | null {
  const version = f.config.display.showClaudeCodeVersion ? cleanText(f.stdin.version, 32) : undefined;
  return version ? f.paint.label(`CC v${version}`) : null;
}

export function extraPart(f: Frame): string | null {
  return f.extraLabel ? f.paint.label(f.extraLabel) : null;
}

/** `⏱ 1h 5m`: wall time since the session started. */
export function durationPart(f: Frame): string | null {
  const duration = f.config.display.showDuration ? formatElapsed(f.stdin.cost?.total_duration_ms) : '';
  return duration ? f.paint.duration(`⏱ ${duration}`) : null;
}

/** `$1.23 · Today $4.56 · Week $12.00`. */
export function costPart(f: Frame): string | null {
  const d = f.config.display;
  const { paint } = f;
  const session = d.showCost ? sessionCostUsd(f.stdin, d.showRoutedCost) : null;
  const parts = [
    session !== null ? paint.cost(formatUsd(session)) : null,
    d.showDailyCost && f.costTotals ? `${paint.label(t('label.today'))} ${paint.cost(formatUsd(f.costTotals.todayUsd))}` : null,
    d.showWeeklyCost && f.costTotals?.weekUsd != null ? `${paint.label(t('label.week'))} ${paint.cost(formatUsd(f.costTotals.weekUsd))}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(paint.label(' · ')) : null;
}

/** `+120 -30`: lines Claude added and removed this session. */
export function linesPart(f: Frame): string | null {
  if (!f.config.display.showLinesChanged) return null;
  const added = f.stdin.cost?.total_lines_added;
  const removed = f.stdin.cost?.total_lines_removed;
  if (typeof added !== 'number' || typeof removed !== 'number' || added + removed <= 0) return null;
  return `${f.paint.success(`+${added}`)} ${f.paint.critical(`-${removed}`)}`;
}

export function speedPart(f: Frame): string | null {
  if (!f.config.display.showSpeed || f.speed === null) return null;
  return f.paint.label(`${t('format.out')}: ${f.speed.toFixed(1)} ${t('format.tokPerSec')}`);
}

/** `Claude Max 20x · alice`. */
export function authPart(f: Frame): string | null {
  const d = f.config.display;
  if (!f.auth) return null;
  const parts = [d.showAuth ? f.auth.method : null, d.showAuthUser ? f.auth.user : null].filter(Boolean);
  return parts.length > 0 ? f.paint.label(parts.join(' · ')) : null;
}

export function customLinePart(f: Frame, position: 'first' | 'last'): string | null {
  const d = f.config.display;
  return d.customLine && d.customLinePosition === position ? f.paint.custom(d.customLine) : null;
}

/** `2 CLAUDE.md | 3 rules | 4 MCPs | 1 hooks`. */
export function configCountParts(f: Frame): string[] {
  const c = f.counts;
  if (!f.config.display.showConfigCounts || !c) return [];
  return [
    c.claudeMd > 0 ? `${c.claudeMd} CLAUDE.md` : null,
    c.rules > 0 ? `${c.rules} ${t('label.rules')}` : null,
    c.mcps > 0 ? `${c.mcps} MCPs` : null,
    c.hooks > 0 ? `${c.hooks} ${t('label.hooks')}` : null,
  ].filter((part): part is string => part !== null).map((part) => f.paint.label(part));
}

/** `Tokens 262k (in: 6k, out: 2k, cache: 254k)`. */
export function sessionTokensPart(f: Frame): string | null {
  const tokens = f.transcript.sessionTokens;
  if (!f.config.display.showSessionTokens || !tokens) return null;
  const cache = tokens.cacheCreationTokens + tokens.cacheReadTokens;
  const total = tokens.inputTokens + tokens.outputTokens + cache;
  if (total === 0) return null;
  const parts = [`${t('format.in')}: ${formatTokens(tokens.inputTokens)}`, `${t('format.out')}: ${formatTokens(tokens.outputTokens)}`];
  if (cache > 0) parts.push(`${t('format.cache')}: ${formatTokens(cache)}`);
  return f.paint.label(`${t('label.tokens')} ${formatTokens(total)} (${parts.join(', ')})`);
}

export function compactionsPart(f: Frame): string | null {
  const n = f.transcript.compactions ?? 0;
  return f.config.display.showCompactions && n > 0 ? f.paint.label(`${t('label.compactions')}: ${n}`) : null;
}

/** Applies projectLineOrder: keyed parts move, unkeyed parts keep their slots. */
export function orderParts(parts: Part[], order: readonly ProjectSegment[]): string[] {
  const slots: number[] = [];
  const byKey = new Map<ProjectSegment, string[]>();
  parts.forEach((part, index) => {
    if (part.key === null) return;
    slots.push(index);
    byKey.set(part.key, [...(byKey.get(part.key) ?? []), part.text]);
  });
  const reordered: string[] = [];
  for (const key of order) {
    reordered.push(...(byKey.get(key) ?? []));
    byKey.delete(key);
  }
  for (const texts of byKey.values()) reordered.push(...texts);
  const result = parts.map((part) => part.text);
  slots.forEach((slot, i) => {
    result[slot] = reordered[i];
  });
  return result;
}

/** The project-line parts shared by both layouts, in their native order. */
export function headerParts(f: Frame, compact: boolean): Part[] {
  const parts: Part[] = [];
  const add = (text: string | null, key: Part['key'] = null): void => {
    if (text) parts.push({ key, text });
  };
  add(customLinePart(f, 'first'));
  add(modelBadge(f), 'model');
  add(projectPart(f, compact), 'project');
  add(sessionNamePart(f), 'sessionName');
  add(versionPart(f), 'version');
  add(extraPart(f), 'extra');
  add(durationPart(f), 'duration');
  add(costPart(f), 'cost');
  add(linesPart(f), 'lines');
  add(speedPart(f), 'speed');
  add(authPart(f), 'auth');
  return parts;
}
