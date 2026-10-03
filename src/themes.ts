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
  block: ['█', '░'],
  shade: ['▓', '░'],
  line: ['━', '─'],
  dot: ['●', '○'],
  square: ['■', '□'],
} as const;

export type BarStyle = keyof typeof BAR_STYLES;
export const BAR_STYLE_NAMES = Object.keys(BAR_STYLES) as BarStyle[];

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
