import { getTerminalWidth } from '../utils/terminal.js';
import { RESET } from './colors.js';
import { createFrame } from './frame.js';
import { dashboardLines } from './dashboard.js';
import { compactLines, expandedLines } from './layouts.js';
// The boxed style hangs every line off a frame: ╭─ first, ├─ middle, ╰─ last.
function frameLines(f, lines) {
    const [first, middle, last, lone] = f.icons.frame;
    if (lines.length === 1)
        return [`${f.paint.label(lone)}${lines[0]}`];
    return lines.map((line, i) => {
        const prefix = i === 0 ? first : i === lines.length - 1 ? last : middle;
        return `${f.paint.label(prefix)}${line}`;
    });
}
/** The lines the HUD prints, fitted to the terminal width when it is known. */
export function renderLines(ctx, columns, now) {
    const frame = createFrame(ctx, columns, now);
    const lines = (ctx.config.lineLayout === 'compact' ? compactLines(frame)
        : ctx.config.style === 'dashboard' ? dashboardLines(frame)
            : expandedLines(frame)).filter(Boolean);
    const framed = ctx.config.style === 'boxed' ? frameLines(frame, lines) : lines;
    return framed.map((line) => `${RESET}${line}`);
}
export function render(ctx) {
    process.stdout.write(`${renderLines(ctx, getTerminalWidth(), Date.now()).join('\n')}\n`);
}
//# sourceMappingURL=index.js.map