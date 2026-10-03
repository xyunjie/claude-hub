import type { HubConfig } from '../config.js';
import { BAR_STYLES, COLOR_ROLES, THEMES, toAnsi, type ColorRole } from '../themes.js';

export const RESET = '\x1b[0m';

export type Paint = Record<ColorRole, (text: string) => string> & {
  /** The escape that starts a role's color, for spans that hold several pieces. */
  code: (role: ColorRole) => string;
  bar: (percent: number, width: number, role: ColorRole) => string;
};

/** The theme's palette with the user's per-role overrides on top. */
export function buildPaint(config: Pick<HubConfig, 'theme' | 'barStyle' | 'colors'>): Paint {
  const palette = { ...(THEMES[config.theme] ?? THEMES.default), ...config.colors };
  const codes = Object.fromEntries(COLOR_ROLES.map((role) => [role, toAnsi(palette[role])])) as Record<ColorRole, string>;
  const [styleFilled, styleEmpty] = BAR_STYLES[config.barStyle] ?? BAR_STYLES.block;
  const filledChar = config.colors.barFilled ?? styleFilled;
  const emptyChar = config.colors.barEmptyChar ?? styleEmpty;

  const paint = Object.fromEntries(COLOR_ROLES.map((role) => [role, (text: string) => `${codes[role]}${text}${RESET}`])) as unknown as Paint;
  paint.code = (role) => codes[role];
  paint.bar = (percent, width, role) => {
    const w = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
    const p = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
    const filled = Math.round((p / 100) * w);
    return `${codes[role]}${filledChar.repeat(filled)}${RESET}${codes.barEmpty}${emptyChar.repeat(w - filled)}${RESET}`;
  };
  return paint;
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
