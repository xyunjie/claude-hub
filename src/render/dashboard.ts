import { t } from '../i18n/index.js';
import { effortLevel, formatModelName, modelName, providerLabel, sessionCostUsd } from '../stdin.js';
import { formatCountdown, formatElapsed, formatTokens, formatUsd } from '../utils/format.js';
import { fileHref, hyperlink } from '../utils/hyperlinks.js';
import { cleanText, sanitize } from '../utils/sanitize.js';
import { textWidth, truncateToWidth, visibleWidth } from './ansi.js';
import { FIVE_HOUR_MS, SEVEN_DAY_MS, elapsedShare, getContext, projectionText, usagePace } from './bars.js';
import { contextRole, usageRole, RESET } from './colors.js';
import type { Frame } from './frame.js';
import { expandedLines } from './layouts.js';
import {
  customSegment, extraSegment, formatProjectPath, linesSegment, planText, sessionNameSegment, speedSegment, versionSegment,
} from './parts.js';
import { styledEffort, styledModel } from './model-style.js';
import { fitRow, segment, type Segment } from './segments.js';

const BOLD = '\x1b[1m';
const compactTime = (ms: number): string => formatCountdown(ms).replace(/ /g, '');

// ── Identity row: ◆ Opus 5.5 xhigh │ owner/repo ⎇ main ✓ ───────────────────────

function modelPart(f: Frame): Segment | null {
  const d = f.config.display;
  if (!d.showModel) return null;
  const name = sanitize(d.modelOverride || formatModelName(modelName(f.stdin, f.transcript, d.modelSource), d.modelFormat));
  const effort = d.showEffortLevel ? effortLevel(f.stdin, f.transcript.ultracode)?.level : undefined;
  const provider = d.showProvider ? d.providerName.trim() || providerLabel(f.stdin) : providerLabel(f.stdin);
  const styled = styledModel(f, name, f.icons.mark, f.stdin.model?.id);
  const text = [
    styled.mark,
    styled.name,
    effort ? styledEffort(f, effort) : '',
    provider ? f.paint.label(`· ${provider}`) : '',
  ].filter(Boolean).join(' ');
  return segment('model', text, name, 'model', 0);
}

/** `owner/repo` from Claude Code's remote identity, else the project path; then the branch. */
function projectPart(f: Frame): Segment | null {
  const { paint, icons } = f;
  const d = f.config.display;
  const repo = f.stdin.workspace?.repo;
  const cwd = f.stdin.cwd ?? f.stdin.workspace?.current_dir;
  const repoName = repo?.owner && repo.name ? cleanText(`${repo.owner}/${repo.name}`, 60) : undefined;
  const name = d.showProject ? repoName ?? (cwd ? formatProjectPath(cwd, f.config.pathLevels) : undefined) : undefined;
  const pieces: string[] = [];
  if (name) pieces.push(hyperlink(cwd ? fileHref(cwd) : null, paint.project(name)));

  const git = f.git;
  const g = f.config.gitStatus;
  if (git && g.enabled) {
    const branch = sanitize(git.branch);
    let vcs = `${paint.git(icons.branch.trim())} ${hyperlink(git.branchUrl, paint.gitBranch(branch))}`;
    if (g.showDirty) vcs += ` ${git.dirty ? paint.warning('*') : paint.success(icons.clean)}`;
    if (g.showAheadBehind && git.ahead > 0) vcs += ` ${paint.gitBranch(`${icons.ahead}${git.ahead}`)}`;
    if (g.showAheadBehind && git.behind > 0) vcs += ` ${paint.gitBranch(`${icons.behind}${git.behind}`)}`;
    if (g.showFileStats && git.lineDiff && git.lineDiff.added + git.lineDiff.deleted > 0) {
      vcs += ` ${paint.success(`+${git.lineDiff.added}`)} ${paint.critical(`-${git.lineDiff.deleted}`)}`;
    }
    const worktree = g.showWorktree ? cleanText(f.stdin.workspace?.git_worktree, 40) : undefined;
    if (worktree) vcs += ` ${paint.label(`${icons.worktree} ${worktree}`)}`;
    pieces.push(vcs);
  }
  return pieces.length > 0 ? segment('project', pieces.join(' '), '', 'project', 0) : null;
}

function identityRow(f: Frame): string[] {
  const segments = [
    customSegment(f, 'first'), modelPart(f), projectPart(f), sessionNameSegment(f), versionSegment(f),
    extraSegment(f), linesSegment(f), speedSegment(f), customSegment(f, 'last'),
  ].filter((s): s is Segment => s !== null);
  return fitRow(f, segments, f.width);
}

// ── Metrics grid ──────────────────────────────────────────────────────────────
//   ctx ━━━──────── 9%  89k/1M  │ tok ↑1.7M ↓28k cache 97% │ cost $1.50
//   5h  ━────────── 2%  ↻4h29m  │ 7d ━━━━━━━──── 69% ↻2d1h  │ time 1h5m

interface BarCell {
  kind: 'bar';
  label: string;
  bar: string;
  percent: string;
  detail: string;
  priority: number;
}

interface TextCell {
  kind: 'text';
  text: string;
  priority: number;
}

type Cell = BarCell | TextCell;

function contextCell(f: Frame): BarCell {
  const d = f.config.display;
  const ctx = getContext(f);
  const role = contextRole(ctx.percent, d.contextWarningThreshold, d.contextCriticalThreshold);
  const shown = d.contextValue === 'remaining' ? Math.max(0, 100 - ctx.percent) : ctx.percent;
  const detail = ctx.size > 0 ? `${formatTokens(ctx.tokens)}/${formatTokens(ctx.size)}` : ctx.tokens > 0 ? formatTokens(ctx.tokens) : '';
  const warn = role === 'critical' ? f.paint.critical(f.icons.warn) : '';
  return {
    kind: 'bar',
    label: t('short.context'),
    bar: d.showContextBar ? f.paint.bar(ctx.percent, f.barWidth, role) : '',
    percent: `${BOLD}${f.paint.level(ctx.percent, role) ?? f.paint.code(role)}${shown}%${RESET}`,
    detail: [warn, detail ? f.paint.label(detail) : ''].filter(Boolean).join(' '),
    priority: 0,
  };
}

function windowCell(f: Frame, label: string, percent: number | null, resetAt: Date | null, windowMs: number, priority: number): BarCell {
  const d = f.config.display;
  const pace = d.usagePace ? usagePace(percent, resetAt, windowMs, f.now) : null;
  const role = usageRole(percent ?? 0, pace);
  const mark = d.usagePace ? elapsedShare(resetAt, windowMs, f.now) : null;
  const shown = percent === null ? null : d.usageValue === 'remaining' ? Math.max(0, 100 - percent) : percent;
  const projection = projectionText(f, percent, resetAt, windowMs, true);
  // Over pace, the percent takes the warning color; otherwise its place on the gradient.
  const percentColor = pace === 'warning' || pace === 'critical' ? f.paint.code(role) : f.paint.level(percent ?? 0, role) ?? f.paint.code(role);
  const remaining = resetAt ? resetAt.getTime() - f.now : 0;
  const reset = remaining > 0 ? f.paint.label(`${f.icons.reset}${compactTime(remaining)}`) : '';
  return {
    kind: 'bar',
    label,
    bar: d.usageBarEnabled ? f.paint.bar(percent ?? 0, f.barWidth, role, mark) : '',
    percent: shown === null ? f.paint.label('--') : `${BOLD}${percentColor}${shown}%${RESET}`,
    detail: [projection, reset].filter(Boolean).join(' '),
    priority,
  };
}

function tokensCell(f: Frame): TextCell | null {
  const window = f.stdin.context_window;
  const session = f.transcript.sessionTokens;
  const input = window?.total_input_tokens
    ?? (session ? session.inputTokens + session.cacheCreationTokens + session.cacheReadTokens : null);
  const output = window?.total_output_tokens ?? session?.outputTokens ?? null;
  if (!input && !output) return null;
  const hit = f.stdin.prompt_cache?.hit_ratio;
  const cache = typeof hit === 'number' && Number.isFinite(hit) ? hit * 100
    : session && input ? (session.cacheReadTokens / input) * 100 : null;
  const { icons, paint } = f;
  const text = [
    paint.label(t('short.tokens')),
    `${icons.up}${formatTokens(input ?? 0)}`,
    `${icons.down}${formatTokens(output ?? 0)}`,
    cache !== null ? `${paint.label(t('short.cache'))} ${Math.round(cache)}%` : '',
  ].filter(Boolean).join(' ');
  return { kind: 'text', text, priority: 3 };
}

function costCell(f: Frame): TextCell | null {
  const d = f.config.display;
  const { paint } = f;
  const session = d.showCost ? sessionCostUsd(f.stdin, d.showRoutedCost) : null;
  const parts = [
    session !== null && session > 0 ? `${BOLD}${paint.cost(formatUsd(session))}` : '',
    d.showDailyCost && f.costTotals ? `${paint.label(t('label.today'))} ${paint.cost(formatUsd(f.costTotals.todayUsd))}` : '',
    d.showWeeklyCost && f.costTotals?.weekUsd != null ? `${paint.label(t('label.week'))} ${paint.cost(formatUsd(f.costTotals.weekUsd))}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? { kind: 'text', text: `${paint.label(t('short.cost'))} ${parts.join(paint.label(f.icons.dot))}`, priority: 2 } : null;
}

function timeCell(f: Frame): TextCell | null {
  const elapsed = f.config.display.showDuration ? formatElapsed(f.stdin.cost?.total_duration_ms) : '';
  return elapsed ? { kind: 'text', text: `${f.paint.label(t('short.time'))} ${f.paint.duration(elapsed.replace(/ /g, ''))}`, priority: 2 } : null;
}

/** `Max 20x · renews ~23d`: the plan sits beside the limits it sets. */
function planCell(f: Frame): TextCell | null {
  const text = planText(f, true);
  return text ? { kind: 'text', text: f.paint.label(text), priority: 2 } : null;
}

function metricRows(f: Frame): Cell[][] {
  const d = f.config.display;
  const order = f.config.elementOrder;
  const usage = d.showUsage ? f.usage : null;
  const rows: Cell[][] = [];

  const first: Array<Cell | null> = [order.includes('context') ? contextCell(f) : null, tokensCell(f), costCell(f)];
  const second: Array<Cell | null> = [];
  if (usage && order.includes('usage')) {
    if (usage.fiveHour !== null) second.push(windowCell(f, '5h', usage.fiveHour, usage.fiveHourResetAt, FIVE_HOUR_MS, 1));
    if (usage.sevenDay !== null) second.push(windowCell(f, '7d', usage.sevenDay, usage.sevenDayResetAt, SEVEN_DAY_MS, 1));
  }
  second.push(timeCell(f), planCell(f));
  for (const row of [first, second]) {
    const cells = row.filter((cell): cell is Cell => cell !== null);
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

const pad = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - visibleWidth(text)));

/** Draws the grid with every column, and the label and percent inside bar cells, aligned. */
function drawGrid(f: Frame, rows: Cell[][]): string[] {
  const bars = rows.flat().filter((cell): cell is BarCell => cell.kind === 'bar');
  const labelWidth = Math.max(0, ...bars.map((cell) => textWidth(cell.label)));
  const percentWidth = Math.max(0, ...bars.map((cell) => visibleWidth(cell.percent)));
  const draw = (cell: Cell): string => (cell.kind === 'text' ? cell.text : [
    f.paint.label(pad(cell.label, labelWidth)),
    cell.bar,
    cell.detail ? pad(cell.percent, percentWidth) : cell.percent,
    cell.detail,
  ].filter(Boolean).join(' '));

  const drawn = rows.map((row) => row.map(draw));
  const columns = Math.max(...drawn.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, c) => Math.max(0, ...drawn.map((row) => (row[c] ? visibleWidth(row[c]) : 0))));
  const separator = ` ${f.paint.label(f.icons.separator.trim())} `;
  return drawn.map((row) => row.map((text, c) => (c === row.length - 1 ? text : pad(text, widths[c]))).join(separator) + RESET);
}

/**
 * Fits the grid to the width, in steps: the full grid; without the optional token cell;
 * bars down the left with the text cells beside them; finally one cell per line.
 */
function fitGrid(f: Frame, rows: Cell[][]): string[] {
  const width = f.width;
  const fits = (lines: string[]): boolean => width === null || lines.every((line) => visibleWidth(line) <= width);
  const slim = rows.map((row) => row.filter((cell) => cell.priority < 3)).filter((row) => row.length > 0);
  const bars = slim.flat().filter((cell) => cell.kind === 'bar');
  const texts = slim.flat().filter((cell) => cell.kind === 'text');
  const twoColumn = Array.from({ length: Math.max(bars.length, texts.length) }, (_, i) => [bars[i], texts[i]].filter(Boolean) as Cell[]);
  for (const candidate of [rows, slim, twoColumn]) {
    const lines = drawGrid(f, candidate);
    if (fits(lines)) return lines;
  }
  return drawGrid(f, slim.flat().map((cell) => [cell])).map((line) => truncateToWidth(line, width ?? 0, f.icons.ellipsis));
}

/** The dashboard: identity row, aligned metrics grid, then the remaining elements and activity. */
export function dashboardLines(f: Frame): string[] {
  const rest = expandedLines({
    ...f,
    config: {
      ...f.config,
      elementOrder: f.config.elementOrder.filter((e) => e !== 'project' && e !== 'context' && e !== 'usage'),
      display: { ...f.config.display, showSessionTokens: false },
    },
  });
  return [...identityRow(f), ...fitGrid(f, metricRows(f)), ...rest];
}
