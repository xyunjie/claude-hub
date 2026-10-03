import { t } from '../i18n/index.js';
import { contextUsage } from '../stdin.js';
import { formatCountdown, formatTokens } from '../utils/format.js';
import { stripAnsi } from './ansi.js';
import { contextRole, usageRole, RESET } from './colors.js';
const stripSgr = (text) => stripAnsi(text);
import { segment } from './segments.js';
import { formatReset } from './time.js';
export const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
export const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;
export const getContext = (f) => contextUsage(f.stdin, f.config.display.autoCompactWindow, f.transcript.contextTokens);
/** ` (in: 12k, cache: 180k)` once context reaches the critical threshold. */
function tokenBreakdown(f, percent) {
    const d = f.config.display;
    const usage = f.stdin.context_window?.current_usage;
    if (!d.showTokenBreakdown || !usage || percent < d.contextCriticalThreshold)
        return '';
    const cache = (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    return ` (${t('format.in')}: ${formatTokens(usage.input_tokens ?? 0)}, ${t('format.cache')}: ${formatTokens(cache)})`;
}
/**
 * `Context █████░░░░░ 45%`. Compact drops the label and glues it to the model.
 * Critical context gets a warning glyph so it reads without color too.
 */
export function contextSegment(f, compact = false) {
    const d = f.config.display;
    const ctx = getContext(f);
    const role = contextRole(ctx.percent, d.contextWarningThreshold, d.contextCriticalThreshold);
    const ratio = ctx.size > 0 ? `${formatTokens(ctx.tokens)}/${formatTokens(ctx.size)}` : formatTokens(ctx.tokens);
    const value = d.contextValue === 'tokens' ? ratio
        : d.contextValue === 'remaining' ? `${Math.max(0, 100 - ctx.percent)}%`
            : d.contextValue === 'both' && ctx.size > 0 ? `${ctx.percent}% (${ratio})`
                : `${ctx.percent}%`;
    const warn = role === 'critical' ? ` ${f.icons.warn}` : '';
    const breakdown = tokenBreakdown(f, ctx.percent);
    const text = [
        compact ? '' : f.paint.label(t('label.context')),
        d.showContextBar ? f.paint.bar(ctx.percent, f.barWidth, role) : '',
        f.paint[role](`${value}${warn}`),
    ].filter(Boolean).join(' ') + (breakdown ? f.paint.label(breakdown) : '');
    const plain = [
        f.icons.context ? f.icons.context.trimEnd() : compact ? '' : t('label.context'),
        d.showContextBar ? f.paint.plainBar(ctx.percent, f.barWidth) : '',
        `${value}${warn}`,
    ].filter(Boolean).join(' ') + breakdown;
    return segment('context', text, plain, role, 0, compact);
}
// Below this much usage a linear projection is noise, so pace stays normal.
const MIN_PACE_PERCENT = 10;
/** How much of the window has passed, 0-1, or null when the reset is unknown. */
export function elapsedShare(resetAt, windowMs, now) {
    if (!resetAt)
        return null;
    const remaining = resetAt.getTime() - now;
    if (!Number.isFinite(remaining) || remaining <= 0 || remaining >= windowMs)
        return null;
    return (windowMs - remaining) / windowMs;
}
/**
 * Grades how fast a window is being consumed by projecting the used percentage linearly
 * to its reset: amber when it would end at 90% or more, red when it would run out first.
 */
export function usagePace(percent, resetAt, windowMs, now) {
    const elapsed = elapsedShare(resetAt, windowMs, now);
    if (percent === null || elapsed === null)
        return null;
    if (percent < MIN_PACE_PERCENT)
        return 'normal';
    const projected = percent / elapsed;
    if (projected > 100)
        return 'critical';
    return projected >= 90 ? 'warning' : 'normal';
}
/**
 * Where usage will be when the window resets, at the current rate. Null until 5% of the
 * window has passed, since earlier projections swing wildly.
 */
export function projectedPercent(percent, resetAt, windowMs, now) {
    const elapsed = elapsedShare(resetAt, windowMs, now);
    if (percent === null || elapsed === null || elapsed < 0.05)
        return null;
    return Math.round(percent / elapsed);
}
/**
 * `→64%` (dim), `→94%` (warning), or `→143% ▲21h2m` (critical, with the time until the
 * limit): the projected usage at reset. Empty when pace is off or there is no projection.
 */
export function projectionText(f, percent, resetAt, windowMs, compact = false) {
    if (!f.config.display.usagePace)
        return '';
    const projected = projectedPercent(percent, resetAt, windowMs, f.now);
    if (projected === null)
        return '';
    const arrow = f.config.icons === 'ascii' ? '->' : '→';
    const text = `${arrow}${projected}%`;
    if (projected <= 100)
        return projected >= 90 ? f.paint.usageWarning(text) : f.paint.label(text);
    const eta = timeToLimit(percent, resetAt, windowMs, f.now);
    const time = eta === null ? '' : compact ? formatCountdown(eta).replace(/ /g, '') : formatCountdown(eta);
    return f.paint.critical(`${text}${time ? ` ${f.icons.forecast}${time}` : ''}`);
}
/** At the current rate, how long until the window hits 100%; null unless that comes before the reset. */
export function timeToLimit(percent, resetAt, windowMs, now) {
    const elapsed = elapsedShare(resetAt, windowMs, now);
    if (percent === null || elapsed === null || percent <= 0 || percent >= 100 || !resetAt)
        return null;
    const ms = ((100 - percent) * elapsed * windowMs) / percent;
    return ms < resetAt.getTime() - now ? ms : null;
}
function windowSegment(f, w) {
    const d = f.config.display;
    const { paint, icons } = f;
    const pace = d.usagePace ? usagePace(w.percent, w.resetAt, w.windowMs, f.now) : null;
    const role = usageRole(w.percent ?? 0, pace);
    const shown = w.percent === null ? null : d.usageValue === 'remaining' ? Math.max(0, 100 - w.percent) : w.percent;
    const percentPlain = shown === null ? '--' : `${shown}%`;
    const projection = projectionText(f, w.percent, w.resetAt, w.windowMs);
    // The marker shows where an even pace would have the bar by now.
    const mark = d.usagePace ? elapsedShare(w.resetAt, w.windowMs, f.now) : null;
    const reset = formatReset(w.resetAt, d.timeFormat, f.now);
    const resetText = reset && d.showResetLabel && !d.usageCompact
        ? `${t(d.timeFormat === 'absolute' ? 'format.resets' : 'format.resetsIn')} ${reset}`
        : reset;
    const bar = d.usageBarEnabled && !d.usageCompact;
    const text = [
        paint.label(d.usageCompact ? `${w.short}:` : t(w.key)),
        bar ? paint.bar(w.percent ?? 0, f.barWidth, role, mark) : '',
        shown === null ? paint.label('--') : `${paint.code(role)}${percentPlain}${RESET}`,
        projection,
        resetText ? paint.label(`(${resetText})`) : '',
    ].filter(Boolean).join(' ');
    // On a block the window name is short and the reset is just the time.
    const icon = w.key === 'label.weekly' ? icons.weekly : icons.usage;
    const plain = [
        `${icon}${w.short}`,
        bar ? paint.plainBar(w.percent ?? 0, f.barWidth, mark) : '',
        percentPlain,
        stripSgr(projection),
        reset ? `${icons.dot.trim()} ${reset}` : '',
    ].filter(Boolean).join(' ');
    return segment('usage', text, plain, role, w.key === 'label.weekly' ? 2 : 1);
}
/**
 * The 5-hour window, plus the weekly one once it reaches sevenDayThreshold or burns too
 * fast; a single "limit reached" notice when either is exhausted.
 */
export function usageSegments(f, compact = false) {
    const d = f.config.display;
    const usage = f.usage;
    if (!d.showUsage || !usage)
        return [];
    if (usage.fiveHour === 100 || usage.sevenDay === 100) {
        const resetAt = usage.fiveHour === 100 ? usage.fiveHourResetAt : usage.sevenDayResetAt;
        const reset = formatReset(resetAt, d.timeFormat, f.now);
        const notice = `${f.icons.warn} ${t('status.limitReached')}${reset ? ` (${reset})` : ''}`;
        const text = compact || d.usageCompact ? f.paint.critical(notice) : `${f.paint.label(t('label.usage'))} ${f.paint.critical(notice)}`;
        return [segment('usage', text, notice, 'critical', 0)];
    }
    const weekPace = d.usagePace ? usagePace(usage.sevenDay, usage.sevenDayResetAt, SEVEN_DAY_MS, f.now) : null;
    const fivePace = d.usagePace ? usagePace(usage.fiveHour, usage.fiveHourResetAt, FIVE_HOUR_MS, f.now) : null;
    const alert = [fivePace, weekPace].some((p) => p === 'warning' || p === 'critical');
    if (Math.max(usage.fiveHour ?? 0, usage.sevenDay ?? 0) < d.usageThreshold && !alert)
        return [];
    const showWeek = usage.sevenDay !== null
        && (usage.fiveHour === null || usage.sevenDay >= d.sevenDayThreshold || weekPace === 'warning' || weekPace === 'critical');
    const segments = [];
    if (usage.fiveHour !== null) {
        segments.push(windowSegment(f, { short: '5h', key: 'label.usage', percent: usage.fiveHour, resetAt: usage.fiveHourResetAt, windowMs: FIVE_HOUR_MS }));
    }
    if (showWeek) {
        segments.push(windowSegment(f, { short: '7d', key: 'label.weekly', percent: usage.sevenDay, resetAt: usage.sevenDayResetAt, windowMs: SEVEN_DAY_MS }));
    }
    return segments;
}
//# sourceMappingURL=bars.js.map