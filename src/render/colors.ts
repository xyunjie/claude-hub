import type { HubConfig } from '../config.js';
import { BAR_STYLES, COLOR_ROLES, RAMPS, THEMES, blockColors, fgRgb, hexRgb, sampleStops, toAnsi, type ColorRole } from '../themes.js';

export const RESET = '\x1b[0m';

export interface Block {
  bg: string;
  /** The block's color as a foreground, for powerline arrows and capsule caps. */
  asFg: string;
  /** Readable text on the block. */
  text: string;
}

export type Paint = Record<ColorRole, (text: string) => string> & {
  /** The escape that starts a role's foreground color. */
  code: (role: ColorRole) => string;
  block: (role: ColorRole) => Block;
  /** A colored bar; `mark` (0-1) draws the pace marker at that position. */
  bar: (percent: number, width: number, role: ColorRole, mark?: number | null) => string;
  /** The same bar without color, for text on a colored block. */
  plainBar: (percent: number, width: number, mark?: number | null) => string;
  /** With `barColor: "gradient"`, the ramp's color at a usage percent; null otherwise. */
  level: (percent: number, role: ColorRole) => string | null;
};

/** The theme's palette with the user's per-role overrides on top. */
export function buildPaint(config: Pick<HubConfig, 'theme' | 'style' | 'barStyle' | 'barColor' | 'colors' | 'icons'>): Paint {
  const palette = { ...(THEMES[config.theme] ?? THEMES.default), ...config.colors };
  const codes = Object.fromEntries(COLOR_ROLES.map((role) => [role, toAnsi(palette[role])])) as Record<ColorRole, string>;
  const blocks = Object.fromEntries(COLOR_ROLES.map((role) => [role, blockColors(palette[role])])) as Record<ColorRole, Block>;
  // `auto`: ASCII bars for ASCII icons, thin lines for the dashboard, full blocks otherwise.
  const style = config.barStyle !== 'auto' ? config.barStyle
    : config.icons === 'ascii' ? 'ascii' : config.style === 'dashboard' ? 'line' : 'block';
  const ramp = config.barColor === 'gradient' ? gradientRamp(palette, RAMPS[config.theme]) : null;
  const [styleFilled, styleEmpty] = BAR_STYLES[style] ?? BAR_STYLES.block;
  const filledChar = config.colors.barFilled ?? styleFilled;
  const emptyChar = config.colors.barEmptyChar ?? styleEmpty;
  // The pace marker. Full-height bars (█) get a thin ▏ over the cell's own color as its
  // background, so the bar stays whole. Shorter bars (▇ ▄) can't: a background would poke
  // above them, so the marker is the same glyph in a lighter tint. Line bars get a cross
  // (┿ on the fill, ┼ on the track); the rest a thin │.
  const fullBar = style === 'solid' || style === 'block';
  const tintBar = style === 'tall' || style === 'half';
  const lineBar = style === 'line' || style === 'thin';
  const markFor = (filled: boolean): string => (config.icons === 'ascii' ? '|'
    : fullBar ? '▏' : tintBar ? filledChar : !lineBar ? '│' : filled && style === 'line' ? '┿' : '┼');
  const markCode = (cellColor: string): string => {
    if (config.icons === 'ascii') return codes.label;
    if (fullBar) return `${toBg(cellColor)}\x1b[38;2;235;235;235m`;
    if (tintBar) return lighten(cellColor) ?? '\x1b[97m';
    // A bright cross reads as a tick against the thin line.
    if (lineBar) return /\x1b\[38;2;/.test(codes.label) ? '\x1b[38;2;235;235;235m' : '\x1b[97m';
    return codes.label;
  };

  const cells = (percent: number, width: number, mark?: number | null) => {
    const w = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
    const p = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
    const filled = Math.round((p / 100) * w);
    const markAt = typeof mark === 'number' && mark > 0 && mark < 1 && w > 2 ? Math.min(w - 1, Math.round(mark * w)) : -1;
    return { w, filled, markAt };
  };

  const paint = Object.fromEntries(COLOR_ROLES.map((role) => [role, (text: string) => `${codes[role]}${text}${RESET}`])) as unknown as Paint;
  paint.code = (role) => codes[role];
  paint.block = (role) => blocks[role];
  paint.bar = (percent, width, role, mark) => {
    const { w, filled, markAt } = cells(percent, width, mark);
    // Consecutive cells of one kind share a single color span.
    let out = '';
    let run = '';
    let runCode = '';
    for (let i = 0; i < w; i++) {
      const fillCode = ramp ? ramp(role, (i + 1) / w) ?? codes[role] : codes[role];
      const [code, char] = i === markAt ? [markCode(i < filled ? fillCode : codes.barEmpty), markFor(i < filled)]
        : i < filled ? [fillCode, filledChar] : [codes.barEmpty, emptyChar];
      if (code !== runCode && run) {
        out += `${runCode}${run}${RESET}`;
        run = '';
      }
      runCode = code;
      run += char;
    }
    return run ? `${out}${runCode}${run}${RESET}` : out;
  };
  paint.level = (percent, role) => (ramp ? ramp(role, percent / 100) : null);
  paint.plainBar = (percent, width, mark) => {
    const { w, filled, markAt } = cells(percent, width, mark);
    return Array.from({ length: w }, (_, i) => (i === markAt ? markFor(i < filled) : i < filled ? filledChar : emptyChar)).join('');
  };
  return paint;
}

/**
 * For `barColor: "gradient"`: the color at `position` (0-1) along the theme's ramp, or along
 * normal → warning → critical. Null when the colors aren't hex, so bands are used.
 */
function gradientRamp(palette: Record<ColorRole, unknown>, themeRamp: string[] | undefined) {
  const hex = (role: ColorRole): string | null => (hexRgb(palette[role] as string) ? palette[role] as string : null);
  const derived = (roles: ColorRole[]): string[] | null => {
    const stops = roles.map(hex);
    return stops.every(Boolean) ? stops as string[] : null;
  };
  const contextStops = themeRamp ?? derived(['context', 'warning', 'critical']);
  const usageStops = themeRamp ?? derived(['usage', 'usageWarning', 'critical']);
  return (role: ColorRole, position: number): string | null => {
    const stops = role === 'usage' || role === 'usageWarning' ? usageStops : contextStops;
    return stops ? fgRgb(sampleStops(stops, position)) : null;
  };
}

/** A truecolor foreground escape mixed toward white by `amount`; null for other color forms. */
function lighten(fg: string, amount = 0.55): string | null {
  const rgb = /^\x1b\[38;2;(\d+);(\d+);(\d+)m$/.exec(fg);
  if (!rgb) return null;
  const [r, g, b] = rgb.slice(1).map((v) => Math.round(Number(v) + (255 - Number(v)) * amount));
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** The background version of a foreground color escape (truecolor, 256-color, or the 16 named). */
function toBg(fg: string): string {
  const truecolor = /^\x1b\[38;([0-9;]+)m$/.exec(fg);
  if (truecolor) return `\x1b[48;${truecolor[1]}m`;
  const named = /^\x1b\[(\d+)m$/.exec(fg);
  if (!named) return '';
  const n = Number(named[1]);
  if (n >= 30 && n <= 37) return `\x1b[${n + 10}m`;
  if (n >= 90 && n <= 97) return `\x1b[${n + 10}m`;
  return n === 2 ? '\x1b[100m' : '';
}

/** The context color band: normal, warning, or critical. */
export function contextRole(percent: number, warning: number, critical: number): ColorRole {
  if (percent >= critical) return 'critical';
  if (percent >= warning) return 'warning';
  return 'context';
}

export type Pace = 'normal' | 'warning' | 'critical';

/** The usage color band: the more severe of the used percentage and the pace. */
export function usageRole(percent: number, pace: Pace | null = null): ColorRole {
  if (percent >= 90 || pace === 'critical') return 'critical';
  if (percent >= 75 || pace === 'warning') return 'usageWarning';
  return 'usage';
}
