/** A named ANSI color, a 256-color index (0-255), or a `#rrggbb` hex string. */
export type ColorValue = string | number;

export const NAMED_COLORS = {
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
} as const;

export type ColorName = keyof typeof NAMED_COLORS;

export const COLOR_ROLES = [
  'model', 'project', 'git', 'gitBranch', 'label', 'context', 'warning', 'critical',
  'usage', 'usageWarning', 'custom', 'running', 'success', 'tool', 'agent', 'cost', 'duration', 'barEmpty',
] as const;

export type ColorRole = typeof COLOR_ROLES[number];
export type Palette = Record<ColorRole, ColorValue>;

// "default" uses the terminal's own 16-color palette, so it follows the terminal theme.
const DEFAULT: Palette = {
  model: 'cyan',
  project: 'yellow',
  git: 'magenta',
  gitBranch: 'cyan',
  label: 'dim',
  context: 'green',
  warning: 'yellow',
  critical: 'red',
  usage: 'brightBlue',
  usageWarning: 'brightMagenta',
  custom: 208,
  running: 'yellow',
  success: 'green',
  tool: 'cyan',
  agent: 'magenta',
  cost: 'green',
  duration: 'cyan',
  barEmpty: 'dim',
};

export const THEMES = {
  // Claude's orange accent on soft truecolor tones; the dashboard style's default.
  claude: {
    model: '#e0875e', project: '#7aa2f7', git: '#bb9af7', gitBranch: '#bb9af7', label: '#6e7681',
    context: '#9ece6a', warning: '#e0af68', critical: '#f7768e', usage: '#9ece6a', usageWarning: '#e0af68',
    custom: '#e0875e', running: '#e0af68', success: '#9ece6a', tool: '#7dcfff', agent: '#bb9af7',
    cost: '#9ece6a', duration: '#7dcfff', barEmpty: '#3b4048',
  },
  // One calm lavender for everything; only warnings break the monotone.
  lavender: {
    model: '#a9b1f5', project: '#a9b1f5', git: '#a9b1f5', gitBranch: '#a9b1f5', label: '#8087b8',
    context: '#a9b1f5', warning: '#e0af68', critical: '#f7768e', usage: '#a9b1f5', usageWarning: '#e0af68',
    custom: '#a9b1f5', running: '#a9b1f5', success: '#a9b1f5', tool: '#a9b1f5', agent: '#a9b1f5',
    cost: '#a9b1f5', duration: '#a9b1f5', barEmpty: '#4a5078',
  },
  default: DEFAULT,
  dracula: {
    model: '#8be9fd', project: '#f1fa8c', git: '#ff79c6', gitBranch: '#8be9fd', label: '#6272a4',
    context: '#50fa7b', warning: '#ffb86c', critical: '#ff5555', usage: '#bd93f9', usageWarning: '#ff79c6',
    custom: '#ffb86c', running: '#f1fa8c', success: '#50fa7b', tool: '#8be9fd', agent: '#ff79c6',
    cost: '#50fa7b', duration: '#8be9fd', barEmpty: '#44475a',
  },
  nord: {
    model: '#88c0d0', project: '#ebcb8b', git: '#b48ead', gitBranch: '#8fbcbb', label: '#616e88',
    context: '#a3be8c', warning: '#ebcb8b', critical: '#bf616a', usage: '#81a1c1', usageWarning: '#b48ead',
    custom: '#d08770', running: '#ebcb8b', success: '#a3be8c', tool: '#88c0d0', agent: '#b48ead',
    cost: '#a3be8c', duration: '#88c0d0', barEmpty: '#3b4252',
  },
  catppuccin: {
    model: '#89dceb', project: '#f9e2af', git: '#cba6f7', gitBranch: '#94e2d5', label: '#6c7086',
    context: '#a6e3a1', warning: '#fab387', critical: '#f38ba8', usage: '#89b4fa', usageWarning: '#f5c2e7',
    custom: '#fab387', running: '#f9e2af', success: '#a6e3a1', tool: '#89dceb', agent: '#cba6f7',
    cost: '#a6e3a1', duration: '#74c7ec', barEmpty: '#45475a',
  },
  gruvbox: {
    model: '#83a598', project: '#fabd2f', git: '#d3869b', gitBranch: '#8ec07c', label: '#928374',
    context: '#b8bb26', warning: '#fe8019', critical: '#fb4934', usage: '#83a598', usageWarning: '#d3869b',
    custom: '#fe8019', running: '#fabd2f', success: '#b8bb26', tool: '#8ec07c', agent: '#d3869b',
    cost: '#b8bb26', duration: '#83a598', barEmpty: '#504945',
  },
  tokyonight: {
    model: '#7dcfff', project: '#e0af68', git: '#bb9af7', gitBranch: '#73daca', label: '#565f89',
    context: '#9ece6a', warning: '#e0af68', critical: '#f7768e', usage: '#7aa2f7', usageWarning: '#bb9af7',
    custom: '#ff9e64', running: '#e0af68', success: '#9ece6a', tool: '#7dcfff', agent: '#bb9af7',
    cost: '#9ece6a', duration: '#7dcfff', barEmpty: '#3b4261',
  },
  mono: {
    model: 'bold', project: 'white', git: 'white', gitBranch: 'bold', label: 'dim',
    context: 'white', warning: 'bold', critical: 'bold', usage: 'white', usageWarning: 'bold',
    custom: 'bold', running: 'bold', success: 'white', tool: 'white', agent: 'white',
    cost: 'white', duration: 'white', barEmpty: 'dim',
  },
} satisfies Record<string, Palette>;

export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const BAR_STYLES = {
  // Heights, tallest to flattest: solid, tall, block, half, line, thin.
  solid: ['█', '█'],
  tall: ['▇', '▇'],
  block: ['█', '░'],
  half: ['▄', '▄'],
  thin: ['─', '─'],
  shade: ['▓', '░'],
  line: ['━', '─'],
  dot: ['●', '○'],
  square: ['■', '□'],
  bead: ['▰', '▱'],
  ascii: ['#', '-'],
} as const;

export type BarStyle = keyof typeof BAR_STYLES;
/** `auto` picks per style: `line` for the dashboard, `block` otherwise. */
export const BAR_STYLE_NAMES = ['auto', ...Object.keys(BAR_STYLES)] as Array<BarStyle | 'auto'>;

/** The `#rrggbb` of a hex color value, or null for named and 256-color values. */
export function hexRgb(value: ColorValue): Rgb | null {
  return typeof value === 'string' && HEX.test(value)
    ? [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as Rgb
    : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isColorValue(value: unknown): value is ColorValue {
  return (typeof value === 'string' && (value in NAMED_COLORS || HEX.test(value)))
    || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 255);
}

/** The SGR escape that starts `value`. */
export function toAnsi(value: ColorValue): string {
  if (typeof value === 'number') return `\x1b[38;5;${value}m`;
  if (HEX.test(value)) {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return NAMED_COLORS[value as ColorName] ?? '';
}

type Rgb = [number, number, number];

const ANSI_16: Rgb[] = [
  [0, 0, 0], [205, 49, 49], [13, 188, 121], [229, 229, 16], [36, 114, 200], [188, 63, 188], [17, 168, 205], [229, 229, 229],
  [102, 102, 102], [241, 76, 76], [35, 209, 139], [245, 245, 67], [59, 142, 234], [214, 112, 214], [41, 184, 219], [255, 255, 255],
];

// Approximate RGB of each named color, used only to pick a readable text color on top of it.
const NAMED_RGB: Record<ColorName, Rgb> = {
  dim: ANSI_16[8], bold: ANSI_16[7], red: ANSI_16[1], green: ANSI_16[2], yellow: ANSI_16[3], blue: ANSI_16[4],
  magenta: ANSI_16[5], cyan: ANSI_16[6], white: ANSI_16[7], gray: ANSI_16[8], brightRed: ANSI_16[9],
  brightGreen: ANSI_16[10], brightYellow: ANSI_16[11], brightBlue: ANSI_16[12], brightMagenta: ANSI_16[13], brightCyan: ANSI_16[14],
};

// Background SGR for each named color. dim and gray become a gray block, bold a white one.
const NAMED_BG: Record<ColorName, string> = {
  dim: '\x1b[100m', bold: '\x1b[47m', red: '\x1b[41m', green: '\x1b[42m', yellow: '\x1b[43m', blue: '\x1b[44m',
  magenta: '\x1b[45m', cyan: '\x1b[46m', white: '\x1b[47m', gray: '\x1b[100m', brightRed: '\x1b[101m',
  brightGreen: '\x1b[102m', brightYellow: '\x1b[103m', brightBlue: '\x1b[104m', brightMagenta: '\x1b[105m', brightCyan: '\x1b[106m',
};

// The foreground that draws the same color as NAMED_BG, for powerline arrows and capsule caps.
const NAMED_BG_AS_FG: Partial<Record<ColorName, string>> = { dim: '\x1b[90m', bold: '\x1b[37m' };

function rgbOf(value: ColorValue): Rgb {
  if (typeof value === 'number') {
    if (value < 16) return ANSI_16[value];
    if (value >= 232) {
      const level = 8 + (value - 232) * 10;
      return [level, level, level];
    }
    const cube = value - 16;
    const step = (n: number): number => (n === 0 ? 0 : 55 + n * 40);
    return [step(Math.floor(cube / 36)), step(Math.floor(cube / 6) % 6), step(cube % 6)];
  }
  if (HEX.test(value)) return [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as Rgb;
  return NAMED_RGB[value as ColorName] ?? ANSI_16[7];
}

/** How to draw a solid block of `value`: its background, the same color as a foreground, and readable text on it. */
export function blockColors(value: ColorValue): { bg: string; asFg: string; text: string } {
  const [r, g, b] = rgbOf(value);
  const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
  if (typeof value === 'string' && value in NAMED_COLORS) {
    const name = value as ColorName;
    return { bg: NAMED_BG[name], asFg: NAMED_BG_AS_FG[name] ?? toAnsi(value), text: light ? '\x1b[30m' : '\x1b[97m' };
  }
  const bg = typeof value === 'number' ? `\x1b[48;5;${value}m` : `\x1b[48;2;${r};${g};${b}m`;
  return { bg, asFg: toAnsi(value), text: light ? '\x1b[38;2;30;30;46m' : '\x1b[38;2;255;255;255m' };
}

/**
 * Color stops for gradient bars, low usage → high. Themes without their own ramp
 * fall back to normal → warning → critical.
 */
export const RAMPS: Partial<Record<ThemeName, string[]>> = {
  claude: ['#7dcfff', '#9ece6a', '#e0af68', '#ff9e64', '#f7768e'],
  lavender: ['#a9b1f5', '#c0a8f0', '#e0af68', '#f7768e'],
  dracula: ['#8be9fd', '#50fa7b', '#f1fa8c', '#ffb86c', '#ff5555'],
  nord: ['#88c0d0', '#a3be8c', '#ebcb8b', '#d08770', '#bf616a'],
  catppuccin: ['#89dceb', '#a6e3a1', '#f9e2af', '#fab387', '#f38ba8'],
  gruvbox: ['#83a598', '#b8bb26', '#fabd2f', '#fe8019', '#fb4934'],
  tokyonight: ['#7dcfff', '#9ece6a', '#e0af68', '#ff9e64', '#f7768e'],
};

/** A point along hex color stops, 0-1. */
export function sampleStops(stops: string[], position: number): Rgb {
  const rgbs = stops.map((stop) => hexRgb(stop) as Rgb);
  const t = Math.min(1, Math.max(0, position)) * (rgbs.length - 1);
  const i = Math.min(rgbs.length - 2, Math.floor(t));
  const local = t - i;
  return rgbs[i].map((v, k) => Math.round(v + (rgbs[i + 1][k] - v) * local)) as Rgb;
}

export const fgRgb = ([r, g, b]: Rgb): string => `\x1b[38;2;${r};${g};${b}m`;
