import { t, type MessageKey } from '../i18n/index.js';
import { contextUsage } from '../stdin.js';
import { formatTokens } from '../utils/format.js';
import { textWidth } from './ansi.js';
import { contextRole, usageRole, RESET, type Pace } from './colors.js';
import type { Frame } from './frame.js';
import { formatReset } from './time.js';

const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;
const BAR_LABELS: MessageKey[] = ['label.context', 'label.usage', 'label.weekly', 'label.ram'];

/** A bar label, padded to the widest bar label when bars are stacked on separate rows. */
export function barLabel(f: Frame, key: MessageKey, align: boolean): string {
  const text = t(key);
  if (!align) return f.paint.label(text);
  const pad = Math.max(...BAR_LABELS.map((k) => textWidth(t(k)))) - textWidth(text);
  return f.paint.label(pad > 0 ? text + ' '.repeat(pad) : text);
}

export const getContext = (f: Frame) =>
  contextUsage(f.stdin, f.config.display.autoCompactWindow, f.transcript.contextTokens);

/** The context bar (when shown) and its value, e.g. `█████░░░░░ 45%`. */
export function contextBarAndValue(f: Frame): { bar: string | null; value: string } {
  const d = f.config.display;
  const ctx = getContext(f);
  const role = contextRole(ctx.percent, d.contextWarningThreshold, d.contextCriticalThreshold);
  const ratio = ctx.size > 0 ? `${formatTokens(ctx.tokens)}/${formatTokens(ctx.size)}` : formatTokens(ctx.tokens);
  const text = d.contextValue === 'tokens' ? ratio
    : d.contextValue === 'remaining' ? `${Math.max(0, 100 - ctx.percent)}%`
      : d.contextValue === 'both' && ctx.size > 0 ? `${ctx.percent}% (${ratio})`
        : `${ctx.percent}%`;
  return {
    bar: d.showContextBar ? f.paint.bar(ctx.percent, f.barWidth, role) : null,
    value: f.paint[role](text),
  };
}

/** ` (in: 12k, cache: 180k)` once context reaches the critical threshold. */
export function tokenBreakdown(f: Frame): string {
  const d = f.config.display;
  const usage = f.stdin.context_window?.current_usage;
  if (!d.showTokenBreakdown || !usage || getContext(f).percent < d.contextCriticalThreshold) return '';
  const cache = (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return f.paint.label(` (${t('format.in')}: ${formatTokens(usage.input_tokens ?? 0)}, ${t('format.cache')}: ${formatTokens(cache)})`);
}

export function contextLine(f: Frame, align = false): string {
  const { bar, value } = contextBarAndValue(f);
  return `${barLabel(f, 'label.context', align)} ${bar ? `${bar} ` : ''}${value}${tokenBreakdown(f)}`;
}

// Below this much usage a linear projection is noise, so pace stays normal.
const MIN_PACE_PERCENT = 10;

/**
 * Grades how fast a window is being consumed by projecting the used percentage linearly
 * to its reset: amber when it would end at 90% or more, red when it would run out first.
 */
export function usagePace(percent: number | null, resetAt: Date | null, windowMs: number, now: number): Pace | null {
  if (percent === null || !resetAt) return null;
  const remaining = resetAt.getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining >= windowMs) return null;
  if (percent < MIN_PACE_PERCENT) return 'normal';
  const projected = percent / ((windowMs - remaining) / windowMs);
  if (projected > 100) return 'critical';
  return projected >= 90 ? 'warning' : 'normal';
}

interface Window {
  short: string;
  key: MessageKey | null;
  percent: number | null;
  resetAt: Date | null;
  pace: Pace | null;
}

function percentText(f: Frame, w: Window): string {
  if (w.percent === null) return f.paint.label('--');
  const shown = f.config.display.usageValue === 'remaining' ? Math.max(0, 100 - w.percent) : w.percent;
  // The pace marker takes the pace's own color, which the percent band may outrank.
  const marker = w.pace === 'warning' || w.pace === 'critical' ? ` ${f.paint[usageRole(0, w.pace)]('▲')}` : '';
  return `${f.paint.code(usageRole(w.percent, w.pace))}${shown}%${RESET}${marker}`;
}

function formatWindow(f: Frame, w: Window, align: boolean, withLabel: boolean): string {
  const d = f.config.display;
  const reset = formatReset(w.resetAt, d.timeFormat, f.now);
  const percent = percentText(f, w);
  if (d.usageCompact) {
    return `${f.paint.label(`${w.short}:`)} ${percent}${reset ? ` ${f.paint.label(`(${reset})`)}` : ''}`;
  }
  const resetText = reset && d.showResetLabel ? `${t(d.timeFormat === 'absolute' ? 'format.resets' : 'format.resetsIn')} ${reset}` : reset;
  const label = w.key ? barLabel(f, w.key, align) : f.paint.label(w.short);
  if (d.usageBarEnabled) {
    const body = `${f.paint.bar(w.percent ?? 0, f.barWidth, usageRole(w.percent ?? 0, w.pace))} ${percent}${resetText ? ` (${resetText})` : ''}`;
    return withLabel ? `${label} ${body}` : body;
  }
  return `${label} ${percent}${resetText ? ` (${resetText})` : ''}`;
}

/**
 * The usage windows as parts: `Usage ██░░ 25% (resets in 1h 30m)`, plus the weekly window
 * once it reaches sevenDayThreshold or is burning too fast.
 */
export function usageParts(f: Frame, align = false): string[] | null {
  const d = f.config.display;
  const usage = f.usage;
  if (!d.showUsage || !usage) return null;

  const paceOn = d.usagePace;
  const five: Window = {
    short: '5h', key: 'label.usage', percent: usage.fiveHour, resetAt: usage.fiveHourResetAt,
    pace: paceOn ? usagePace(usage.fiveHour, usage.fiveHourResetAt, FIVE_HOUR_MS, f.now) : null,
  };
  const week: Window = {
    short: '7d', key: 'label.weekly', percent: usage.sevenDay, resetAt: usage.sevenDayResetAt,
    pace: paceOn ? usagePace(usage.sevenDay, usage.sevenDayResetAt, SEVEN_DAY_MS, f.now) : null,
  };
  const alert = [five.pace, week.pace].some((p) => p === 'warning' || p === 'critical');

  if (usage.fiveHour === 100 || usage.sevenDay === 100) {
    const resetAt = usage.fiveHour === 100 ? usage.fiveHourResetAt : usage.sevenDayResetAt;
    const reset = formatReset(resetAt, d.timeFormat, f.now);
    const notice = f.paint.critical(`⚠ ${t('status.limitReached')}${reset ? ` (${reset})` : ''}`);
    return [d.usageCompact ? notice : `${barLabel(f, 'label.usage', align)} ${notice}`];
  }
  if (Math.max(usage.fiveHour ?? 0, usage.sevenDay ?? 0) < d.usageThreshold && !alert) return null;

  const showWeek = usage.sevenDay !== null
    && (usage.fiveHour === null || usage.sevenDay >= d.sevenDayThreshold || week.pace === 'warning' || week.pace === 'critical');
  const parts: string[] = [];
  if (usage.fiveHour !== null) parts.push(formatWindow(f, five, align, true));
  if (showWeek) parts.push(formatWindow(f, week, align, true));
  return parts.length > 0 ? parts : null;
}
