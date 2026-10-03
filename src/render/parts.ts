import type { PathLevels } from '../config.js';
import { t } from '../i18n/index.js';
import { effortLevel, formatModelName, modelName, providerLabel, sessionCostUsd } from '../stdin.js';
import { formatElapsed, formatTokens, formatUsd } from '../utils/format.js';
import { fileHref, hyperlink } from '../utils/hyperlinks.js';
import { cleanText, sanitize } from '../utils/sanitize.js';
import type { Frame } from './frame.js';
import { styledEffort, styledModel } from './model-style.js';
import { segment, type Segment } from './segments.js';

const BRANCH_MAX = 32;

/** The effort's symbol and level as configured; either may be empty. */
function effortParts(f: Frame): { symbol: string; level: string } | null {
  const d = f.config.display;
  const info = d.showEffortLevel ? effortLevel(f.stdin, f.transcript.ultracode) : null;
  if (!info) return null;
  // ASCII has no effort symbols, and the symbol alone can't carry the ultracode marker.
  const symbol = f.config.icons === 'ascii' ? '' : info.symbol;
  if (d.effortFormat === 'symbol' && symbol && !info.level.startsWith('ultracode(')) return { symbol, level: '' };
  return d.effortFormat === 'text' || !symbol ? { symbol: '', level: info.level } : { symbol, level: info.level };
}

/** `[Opus 5.5 ◑ high | Bedrock]`; with Nerd icons, a robot glyph instead of brackets. */
export function modelSegment(f: Frame): Segment | null {
  const d = f.config.display;
  if (!d.showModel) return null;
  const name = sanitize(d.modelOverride || formatModelName(modelName(f.stdin, f.transcript, d.modelSource), d.modelFormat));
  const effort = effortParts(f);
  const provider = d.showProvider ? d.providerName.trim() || providerLabel(f.stdin) : providerLabel(f.stdin);
  const effortPlain = effort ? [effort.symbol, effort.level].filter(Boolean).join(' ') : '';
  const core = [name, effortPlain].filter(Boolean).join(' ');
  const body = provider ? (d.showProvider ? `${provider} | ${core}` : `${core} | ${provider}`) : core;

  // The name takes its family color and the level its intensity color; the rest the badge color.
  const styledName = styledModel(f, name, '', f.stdin.model?.id).name;
  const styledEffortText = effort
    ? [effort.symbol ? f.paint.model(effort.symbol) : '', effort.level ? styledEffort(f, effort.level) : ''].filter(Boolean).join(' ')
    : '';
  const coreText = [styledName, styledEffortText].filter(Boolean).join(' ');
  const inner = provider
    ? (d.showProvider ? `${f.paint.model(`${provider} |`)} ${coreText}` : `${coreText} ${f.paint.model(`| ${provider}`)}`)
    : coreText;
  const text = f.icons.model ? `${f.paint.model(f.icons.model)}${inner}` : `${f.paint.model('[')}${inner}${f.paint.model(']')}`;
  return segment('model', text, `${f.icons.model}${body}`, 'model', 0);
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

function addedDirNames(f: Frame): Array<{ dir: string; name: string }> {
  const dirs = f.stdin.workspace?.added_dirs;
  if (!f.config.display.showAddedDirs || !Array.isArray(dirs)) return [];
  return dirs
    .filter((dir): dir is string => typeof dir === 'string' && dir.length > 0)
    .map((dir) => ({ dir, name: cleanText(dir.split(/[/\\]/).filter(Boolean).pop() ?? dir, 24) }))
    .filter((entry): entry is { dir: string; name: string } => !!entry.name);
}

/** The project path (linked) with any `/add-dir` directories. */
export function projectSegment(f: Frame): Segment | null {
  const cwd = f.stdin.cwd ?? f.stdin.workspace?.current_dir;
  const dirs = addedDirNames(f);
  const path = f.config.display.showProject && cwd ? formatProjectPath(cwd, f.config.pathLevels) : '';
  if (!path && dirs.length === 0) return null;

  const shownDirs = dirs.slice(0, MAX_ADDED_DIRS);
  const more = dirs.length > MAX_ADDED_DIRS ? t('format.more', { count: dirs.length - MAX_ADDED_DIRS }) : '';
  const textParts = [
    path ? hyperlink(cwd ? fileHref(cwd) : null, f.paint.project(`${f.icons.folder}${path}`)) : '',
    ...shownDirs.map(({ dir, name }) => hyperlink(fileHref(dir), f.paint.label(`+${name}`))),
    more ? f.paint.label(more) : '',
  ].filter(Boolean);
  const plainParts = [path ? `${f.icons.folder}${path}` : '', ...shownDirs.map(({ name }) => `+${name}`), more].filter(Boolean);
  return segment('project', textParts.join(' '), plainParts.join(' '), 'project', 0);
}

const truncateBranch = (branch: string, ellipsis: string): string =>
  branch.length <= BRANCH_MAX ? branch : `${branch.slice(0, BRANCH_MAX - 1)}${ellipsis}`;

/** `git:(main* ↑2 ↓1 [+12 -3])`, Starship-style `!2 +1 ?3` counts in compact. Glued to the project. */
export function gitSegment(f: Frame, compact: boolean): Segment | null {
  const status = f.git;
  const g = f.config.gitStatus;
  if (!status || !g.enabled) return null;
  const { paint, icons } = f;
  const branch = `${truncateBranch(sanitize(status.branch), icons.ellipsis)}${g.showDirty && status.dirty ? '*' : ''}`;
  const extras: Array<{ text: string; plain: string }> = [];
  if (g.showAheadBehind) {
    if (status.ahead > 0) extras.push({ text: paint.gitBranch(`${icons.ahead}${status.ahead}`), plain: `${icons.ahead}${status.ahead}` });
    if (status.behind > 0) extras.push({ text: paint.gitBranch(`${icons.behind}${status.behind}`), plain: `${icons.behind}${status.behind}` });
  }
  if (g.showFileStats) {
    if (!compact && status.lineDiff && status.lineDiff.added + status.lineDiff.deleted > 0) {
      const { added, deleted } = status.lineDiff;
      const parts = [added > 0 ? paint.success(`+${added}`) : '', deleted > 0 ? paint.critical(`-${deleted}`) : ''].filter(Boolean);
      extras.push({ text: `[${parts.join(' ')}]`, plain: [added > 0 ? `+${added}` : '', deleted > 0 ? `-${deleted}` : ''].filter(Boolean).join(' ') });
    }
    if (compact && status.files) {
      const { modified, added, deleted, untracked } = status.files;
      const deletedMark = f.config.icons === 'ascii' ? 'x' : '✘';
      const counts = ([[modified, '!'], [added, '+'], [deleted, deletedMark], [untracked, '?']] as const)
        .filter(([n]) => n > 0)
        .map(([n, symbol]) => `${symbol}${n}`)
        .join(' ');
      if (counts) extras.push({ text: paint.gitBranch(counts), plain: counts });
    }
  }
  const worktreeName = g.showWorktree ? cleanText(f.stdin.workspace?.git_worktree, 40) : undefined;
  const worktree = worktreeName ? `${icons.worktree} ${worktreeName}` : '';

  const linkedBranch = hyperlink(status.branchUrl, paint.gitBranch(branch));
  const inner = [linkedBranch, ...extras.map((e) => e.text)].join(' ');
  // Nerd icons show the branch glyph; the other tiers keep the familiar git:( ) wrapper.
  const text = f.config.icons === 'nerd'
    ? `${paint.git(icons.branch)}${inner}`
    : `${paint.git('git:(')}${inner}${paint.git(')')}`;
  const plain = [`${icons.branch}${branch}`, ...extras.map((e) => e.plain), worktree].filter(Boolean).join(' ');
  return segment('project', worktree ? `${text} ${paint.git(worktree)}` : text, plain, 'git', 1, true);
}

export function sessionNameSegment(f: Frame): Segment | null {
  const name = f.config.display.showSessionName ? cleanText(f.stdin.session_name) : undefined;
  return name ? segment('sessionName', f.paint.label(name), name, 'label', 3) : null;
}

export function versionSegment(f: Frame): Segment | null {
  const version = f.config.display.showClaudeCodeVersion ? cleanText(f.stdin.version, 32) : undefined;
  return version ? segment('version', f.paint.label(`CC v${version}`), `CC v${version}`, 'label', 4) : null;
}

export function extraSegment(f: Frame): Segment | null {
  return f.extraLabel ? segment('extra', f.paint.label(f.extraLabel), f.extraLabel, 'label', 3) : null;
}

/** `⏱ 1h 5m`: wall time since the session started. */
export function durationSegment(f: Frame): Segment | null {
  const duration = f.config.display.showDuration ? formatElapsed(f.stdin.cost?.total_duration_ms) : '';
  if (!duration) return null;
  return segment('duration', f.paint.duration(`${f.icons.duration}${duration}`), `${f.icons.duration}${duration}`, 'duration', 2);
}

/** `$1.23 · Today $4.56 · Week $12.00`. A zero session cost is hidden. */
export function costSegment(f: Frame): Segment | null {
  const d = f.config.display;
  const { paint, icons } = f;
  const session = d.showCost ? sessionCostUsd(f.stdin, d.showRoutedCost) : null;
  const pieces: Array<[string | null, number]> = [
    [session !== null && session > 0 ? null : '', session ?? 0],
    [d.showDailyCost && f.costTotals ? t('label.today') : '', f.costTotals?.todayUsd ?? 0],
    [d.showWeeklyCost && f.costTotals?.weekUsd != null ? t('label.week') : '', f.costTotals?.weekUsd ?? 0],
  ];
  const shown = pieces.filter(([label]) => label !== '');
  if (shown.length === 0) return null;
  const text = shown.map(([label, usd]) => `${label ? `${paint.label(label)} ` : ''}${paint.cost(formatUsd(usd))}`);
  const plain = shown.map(([label, usd]) => `${label ? `${label} ` : ''}${formatUsd(usd)}`);
  return segment('cost', text.join(paint.label(icons.dot)), `${icons.cost}${plain.join(icons.dot)}`, 'cost', 2);
}

/** `+120 -30`: lines Claude added and removed this session. */
export function linesSegment(f: Frame): Segment | null {
  if (!f.config.display.showLinesChanged) return null;
  const added = f.stdin.cost?.total_lines_added;
  const removed = f.stdin.cost?.total_lines_removed;
  if (typeof added !== 'number' || typeof removed !== 'number' || added + removed <= 0) return null;
  const text = `${f.paint.success(`+${added}`)} ${f.paint.critical(`-${removed}`)}`;
  return segment('lines', text, `${f.icons.lines}+${added} -${removed}`, 'success', 3);
}

export function speedSegment(f: Frame): Segment | null {
  if (!f.config.display.showSpeed || f.speed === null) return null;
  const value = `${f.speed.toFixed(1)} ${t('format.tokPerSec')}`;
  return segment('speed', f.paint.label(`${t('format.out')}: ${value}`), `${f.icons.speed}${value}`, 'label', 3);
}

/** `Claude Max 20x · alice`. */
export function authSegment(f: Frame): Segment | null {
  const d = f.config.display;
  if (!f.auth) return null;
  const parts = [d.showAuth ? f.auth.method : null, d.showAuthUser ? f.auth.user : null].filter(Boolean);
  if (parts.length === 0) return null;
  const text = parts.join(f.icons.dot);
  return segment('auth', f.paint.label(text), text, 'label', 4);
}

export function customSegment(f: Frame, position: 'first' | 'last'): Segment | null {
  const d = f.config.display;
  if (!d.customLine || d.customLinePosition !== position) return null;
  return segment(null, f.paint.custom(d.customLine), d.customLine, 'custom', 4);
}

/** `2 CLAUDE.md`, `3 rules`, `4 MCPs`, `1 hooks`. */
export function configCountSegments(f: Frame): Segment[] {
  const c = f.counts;
  if (!f.config.display.showConfigCounts || !c) return [];
  return [
    c.claudeMd > 0 ? `${c.claudeMd} CLAUDE.md` : null,
    c.rules > 0 ? `${c.rules} ${t('label.rules')}` : null,
    c.mcps > 0 ? `${c.mcps} MCPs` : null,
    c.hooks > 0 ? `${c.hooks} ${t('label.hooks')}` : null,
  ]
    .filter((part): part is string => part !== null)
    .map((part) => segment('environment', f.paint.label(part), part, 'label', 3));
}

/** `Tokens 262k (in: 6k, out: 2k, cache: 254k)`. */
export function sessionTokensSegment(f: Frame): Segment | null {
  const tokens = f.transcript.sessionTokens;
  if (!f.config.display.showSessionTokens || !tokens) return null;
  const cache = tokens.cacheCreationTokens + tokens.cacheReadTokens;
  const total = tokens.inputTokens + tokens.outputTokens + cache;
  if (total === 0) return null;
  const parts = [`${t('format.in')}: ${formatTokens(tokens.inputTokens)}`, `${t('format.out')}: ${formatTokens(tokens.outputTokens)}`];
  if (cache > 0) parts.push(`${t('format.cache')}: ${formatTokens(cache)}`);
  const text = `${t('label.tokens')} ${formatTokens(total)} (${parts.join(', ')})`;
  return segment(null, f.paint.label(text), text, 'label', 3);
}

export function compactionsSegment(f: Frame): Segment | null {
  const n = f.transcript.compactions ?? 0;
  if (!f.config.display.showCompactions || n <= 0) return null;
  const text = `${t('label.compactions')}: ${n}`;
  return segment(null, f.paint.label(text), text, 'label', 3);
}

/** The project-row segments shared by both layouts, in their native order. */
export function headerSegments(f: Frame, compact: boolean): Segment[] {
  return [
    customSegment(f, 'first'),
    modelSegment(f),
    projectSegment(f),
    gitSegment(f, compact),
    sessionNameSegment(f),
    versionSegment(f),
    extraSegment(f),
    durationSegment(f),
    costSegment(f),
    linesSegment(f),
    speedSegment(f),
    authSegment(f),
  ].filter((s): s is Segment => s !== null);
}
