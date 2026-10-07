import { t } from '../i18n/index.js';
import { formatCountdown } from '../utils/format.js';
/** Wall-clock time such as `at 14:30`, with the date when it isn't today. */
export function formatClock(at, now, pattern = 'format.at') {
    const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const value = at.toDateString() === now.toDateString()
        ? time
        : `${at.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
    return t(pattern, { time: value });
}
/** `2h 30m`, `at 14:30`, or both. Empty when the reset is unknown or already past. */
export function formatReset(resetAt, format, now) {
    if (!resetAt)
        return '';
    const remaining = resetAt.getTime() - now;
    if (remaining <= 0)
        return '';
    if (format === 'relative')
        return formatCountdown(remaining);
    const clock = formatClock(resetAt, new Date(now));
    return format === 'absolute' ? clock : `${formatCountdown(remaining)}, ${clock}`;
}
/**
 * The first monthly anniversary of `start` after `now`, in UTC; a 31st start renews on
 * the last day of shorter months. An estimate: annual plans, plan changes, and
 * cancellations aren't recorded locally.
 */
export function nextMonthlyRenewal(start, now) {
    const day = start.getUTCDate();
    const at = (months) => {
        const year = start.getUTCFullYear();
        const month = start.getUTCMonth() + months;
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return new Date(Date.UTC(year, month, Math.min(day, lastDay), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
    };
    const today = new Date(now);
    let months = Math.max(1, (today.getUTCFullYear() - start.getUTCFullYear()) * 12 + today.getUTCMonth() - start.getUTCMonth());
    while (at(months).getTime() <= now)
        months++;
    return at(months);
}
/** `45s ago`, `2h 5m ago`, `3d 4h ago`. */
export function formatAgo(ms) {
    if (ms < 0)
        return t('format.justNow');
    const ago = (value) => t('format.ago', { value });
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60)
        return ago(`${seconds}s`);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return ago(`${minutes}m`);
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return ago(minutes % 60 > 0 ? `${hours}h ${minutes % 60}m` : `${hours}h`);
    const days = Math.floor(hours / 24);
    return ago(hours % 24 > 0 ? `${days}d ${hours % 24}h` : `${days}d`);
}
//# sourceMappingURL=time.js.map