import { getTerminalWidth } from '../utils/terminal.js';
import { wrapToWidth } from './ansi.js';
import { RESET } from './colors.js';
import { createFrame } from './frame.js';
import { compactLines, expandedLines } from './layouts.js';
/** The lines the HUD prints, wrapped to the terminal width when it is known. */
export function renderLines(ctx, columns, now) {
    const frame = createFrame(ctx, columns, now);
    const lines = ctx.config.lineLayout === 'compact' ? compactLines(frame) : expandedLines(frame);
    return lines
        .flatMap((line) => line.split('\n'))
        .flatMap((line) => wrapToWidth(line, frame.width ?? 0))
        .map((line) => `${RESET}${line}`);
}
export function render(ctx) {
    process.stdout.write(`${renderLines(ctx, getTerminalWidth(), Date.now()).join('\n')}\n`);
}
//# sourceMappingURL=index.js.map