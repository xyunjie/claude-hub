import { getTerminalWidth } from '../utils/terminal.js';
import { wrapToWidth } from './ansi.js';
import { RESET } from './colors.js';
import { createFrame, type RenderContext } from './frame.js';
import { compactLines, expandedLines } from './layouts.js';

export type { RenderContext };

/** The lines the HUD prints, wrapped to the terminal width when it is known. */
export function renderLines(ctx: RenderContext, columns: number | null, now: number): string[] {
  const frame = createFrame(ctx, columns, now);
  const lines = ctx.config.lineLayout === 'compact' ? compactLines(frame) : expandedLines(frame);
  return lines
    .flatMap((line) => line.split('\n'))
    .flatMap((line) => wrapToWidth(line, frame.width ?? 0))
    .map((line) => `${RESET}${line}`);
}

export function render(ctx: RenderContext): void {
  process.stdout.write(`${renderLines(ctx, getTerminalWidth(), Date.now()).join('\n')}\n`);
}
