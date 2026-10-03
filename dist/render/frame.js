import { buildPaint } from './colors.js';
export function createFrame(ctx, columns, now) {
    const width = columns ?? ctx.config.maxWidth;
    const barWidth = columns === null || columns >= 100 ? 10 : columns >= 60 ? 6 : 4;
    return { ...ctx, now, width, barWidth, paint: buildPaint(ctx.config) };
}
//# sourceMappingURL=frame.js.map