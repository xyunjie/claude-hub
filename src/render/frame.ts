import type { HubConfig } from '../config.js';
import { ICON_SETS, type Icons } from '../icons.js';
import type {
  AuthInfo, ConfigCounts, CostTotals, GitStatus, MemoryInfo, StdinData, TranscriptData, UsageData,
} from '../types.js';
import { buildPaint, type Paint } from './colors.js';

/** Everything gathered for one render. */
export interface RenderContext {
  stdin: StdinData;
  config: HubConfig;
  transcript: TranscriptData;
  git: GitStatus | null;
  usage: UsageData | null;
  counts: ConfigCounts | null;
  costTotals: CostTotals | null;
  speed: number | null;
  memory: MemoryInfo | null;
  auth: AuthInfo | null;
  extraLabel: string | null;
}

/** The render context with the clock, width, palette, and glyphs resolved once. */
export interface Frame extends RenderContext {
  now: number;
  /** Lines fit this width; null when the terminal width is unknown. */
  width: number | null;
  barWidth: number;
  paint: Paint;
  icons: Icons;
}

export function createFrame(ctx: RenderContext, columns: number | null, now: number): Frame {
  const available = columns ?? ctx.config.maxWidth;
  const width = available === null ? null : Math.max(20, available - ctx.config.reserveWidth);
  const dashboard = ctx.config.style === 'dashboard';
  const barWidth = width === null || width >= 100 ? (dashboard ? 12 : 10) : width >= 70 ? (dashboard ? 8 : 6) : 4;
  return { ...ctx, now, width, barWidth, paint: buildPaint(ctx.config), icons: ICON_SETS[ctx.config.icons] };
}
