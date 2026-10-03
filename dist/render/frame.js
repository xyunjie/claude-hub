import { ICON_SETS } from '../icons.js';
import { buildPaint } from './colors.js';
export function createFrame(ctx, columns, now) {
    const available = columns ?? ctx.config.maxWidth;
    const width = available === null ? null : Math.max(20, available - ctx.config.reserveWidth);
    const dashboard = ctx.config.style === 'dashboard';
    const barWidth = width === null || width >= 100 ? (dashboard ? 12 : 10) : width >= 70 ? (dashboard ? 8 : 6) : 4;
    return { ...ctx, now, width, barWidth, paint: buildPaint(ctx.config), icons: ICON_SETS[ctx.config.icons] };
}
//# sourceMappingURL=frame.js.map