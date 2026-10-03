import type { HubConfig } from '../config.js';
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

/** The render context with the clock, width, and palette resolved once. */
export interface Frame extends RenderContext {
  now: number;
  /** Lines wrap to this width; null when the terminal width is unknown. */
  width: number | null;
  barWidth: number;
  paint: Paint;
}

export function createFrame(ctx: RenderContext, columns: number | null, now: number): Frame {
  const width = columns ?? ctx.config.maxWidth;
  const barWidth = columns === null || columns >= 100 ? 10 : columns >= 60 ? 6 : 4;
  return { ...ctx, now, width, barWidth, paint: buildPaint(ctx.config) };
}
