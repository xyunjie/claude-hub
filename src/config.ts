import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createDebug } from './debug.js';
import { ICON_TIERS, type IconTier } from './icons.js';
import { LANGUAGES, type Language } from './i18n/index.js';
import { claudeConfigDir, hubDir } from './paths.js';
import type { ModelFormat, ModelSource } from './stdin.js';
import {
  BAR_STYLE_NAMES, COLOR_ROLES, THEME_NAMES, isColorValue,
  type BarStyle, type ColorRole, type ColorValue, type ThemeName,
} from './themes.js';
import { sanitize } from './utils/sanitize.js';
import { MAX_TERMINAL_WIDTH } from './utils/terminal.js';

const debug = createDebug('config');
const MAX_CONFIG_BYTES = 64 * 1024;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export const ELEMENTS = [
  'project', 'context', 'usage', 'promptCache', 'cacheHitRate', 'memory',
  'environment', 'tools', 'skills', 'mcp', 'agents', 'todos', 'sessionTime',
] as const;

/** Orderable segments of the project line. */
export const PROJECT_SEGMENTS = [
  'model', 'project', 'sessionName', 'version', 'extra', 'duration', 'cost', 'lines', 'speed', 'auth',
] as const;

const LAYOUTS = ['expanded', 'compact'] as const;
export const STYLES = ['dashboard', 'lean', 'powerline', 'capsule', 'boxed', 'bracket'] as const;
const BAR_COLORS = ['band', 'gradient'] as const;
const PATH_LEVELS = [1, 2, 3, 'full'] as const;
const CONTEXT_VALUES = ['percent', 'tokens', 'remaining', 'both'] as const;
const USAGE_VALUES = ['percent', 'remaining'] as const;
const MODEL_FORMATS = ['full', 'compact', 'short'] as const;
const MODEL_SOURCES = ['stdin', 'auto', 'transcript'] as const;
const EFFORT_FORMATS = ['full', 'symbol', 'text'] as const;
const TIME_FORMATS = ['relative', 'absolute', 'both'] as const;
const POSITIONS = ['first', 'last'] as const;

export type HubElement = typeof ELEMENTS[number];
export type ProjectSegment = typeof PROJECT_SEGMENTS[number];
export type Layout = typeof LAYOUTS[number];
export type Style = typeof STYLES[number];
export type PathLevels = typeof PATH_LEVELS[number];
export type ContextValue = typeof CONTEXT_VALUES[number];
export type UsageValue = typeof USAGE_VALUES[number];
export type EffortFormat = typeof EFFORT_FORMATS[number];
export type TimeFormat = typeof TIME_FORMATS[number];

export interface HubConfig {
  language: Language;
  theme: ThemeName;
  style: Style;
  icons: IconTier;
  barStyle: BarStyle | 'auto';
  /** `band` colors a whole bar by its level; `gradient` shades each cell low → high. */
  barColor: typeof BAR_COLORS[number];
  lineLayout: Layout;
  showSeparators: boolean;
  pathLevels: PathLevels;
  maxWidth: number | null;
  /** Columns left free at the right edge, for Claude Code's own notices. */
  reserveWidth: number;
  elementOrder: HubElement[];
  projectLineOrder: ProjectSegment[];
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
    showFileStats: boolean;
    showWorktree: boolean;
  };
  display: {
    showModel: boolean;
    modelFormat: ModelFormat;
    modelOverride: string;
    modelSource: ModelSource;
    showProvider: boolean;
    providerName: string;
    showEffortLevel: boolean;
    effortFormat: EffortFormat;
    showProject: boolean;
    showAddedDirs: boolean;
    showContextBar: boolean;
    contextValue: ContextValue;
    showTokenBreakdown: boolean;
    contextWarningThreshold: number;
    contextCriticalThreshold: number;
    autoCompactWindow: number | null;
    showUsage: boolean;
    usageValue: UsageValue;
    usageBarEnabled: boolean;
    usageCompact: boolean;
    usagePace: boolean;
    /** Color the model by family (Fable shimmers, Opus accent, Sonnet muted) and effort by level. */
    modelColors: boolean;
    showResetLabel: boolean;
    usageThreshold: number;
    sevenDayThreshold: number;
    timeFormat: TimeFormat;
    showDuration: boolean;
    showCost: boolean;
    showRoutedCost: boolean;
    showDailyCost: boolean;
    showWeeklyCost: boolean;
    showLinesChanged: boolean;
    showSpeed: boolean;
    showSessionName: boolean;
    showClaudeCodeVersion: boolean;
    showAuth: boolean;
    showAuthUser: boolean;
    showRenewal: boolean;
    showConfigCounts: boolean;
    showOutputStyle: boolean;
    showPromptCache: boolean;
    showCacheHitRate: boolean;
    showMemoryUsage: boolean;
    showSessionTokens: boolean;
    showCompactions: boolean;
    showSessionStartDate: boolean;
    showLastResponseAt: boolean;
    showTools: boolean;
    showSkills: boolean;
    showMcp: boolean;
    showAgents: boolean;
    showTodos: boolean;
    toolsMaxVisible: number;
    mergeGroups: HubElement[][];
    customLine: string;
    customLinePosition: typeof POSITIONS[number];
  };
  /** Per-role overrides on top of the theme, plus the bar characters. */
  colors: Partial<Record<ColorRole, ColorValue>> & { barFilled?: string; barEmptyChar?: string };
}

export const DEFAULT_CONFIG: HubConfig = {
  language: 'en',
  theme: 'claude',
  style: 'dashboard',
  icons: 'unicode',
  barStyle: 'auto',
  barColor: 'gradient',
  lineLayout: 'expanded',
  showSeparators: false,
  pathLevels: 1,
  maxWidth: null,
  reserveWidth: 0,
  elementOrder: [...ELEMENTS],
  projectLineOrder: [],
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: false,
    showFileStats: false,
    showWorktree: false,
  },
  display: {
    showModel: true,
    modelFormat: 'full',
    modelOverride: '',
    modelSource: 'stdin',
    showProvider: false,
    providerName: '',
    showEffortLevel: false,
    effortFormat: 'full',
    showProject: true,
    showAddedDirs: true,
    showContextBar: true,
    contextValue: 'percent',
    showTokenBreakdown: true,
    contextWarningThreshold: 70,
    contextCriticalThreshold: 85,
    autoCompactWindow: null,
    showUsage: true,
    usageValue: 'percent',
    usageBarEnabled: true,
    usageCompact: false,
    usagePace: true,
    modelColors: true,
    showResetLabel: true,
    usageThreshold: 0,
    sevenDayThreshold: 80,
    timeFormat: 'relative',
    showDuration: true,
    showCost: true,
    showRoutedCost: false,
    showDailyCost: false,
    showWeeklyCost: false,
    showLinesChanged: false,
    showSpeed: false,
    showSessionName: false,
    showClaudeCodeVersion: false,
    showAuth: false,
    showAuthUser: false,
    showRenewal: false,
    showConfigCounts: false,
    showOutputStyle: false,
    showPromptCache: false,
    showCacheHitRate: false,
    showMemoryUsage: false,
    showSessionTokens: false,
    showCompactions: false,
    showSessionStartDate: false,
    showLastResponseAt: false,
    showTools: false,
    showSkills: false,
    showMcp: false,
    showAgents: false,
    showTodos: false,
    toolsMaxVisible: 4,
    mergeGroups: [['context', 'usage']],
    customLine: '',
    customLinePosition: 'last',
  },
  colors: {},
};

export function configPath(): string {
  return path.join(hubDir(os.homedir()), 'config.json');
}

// Lives outside plugins/, which users often share across several CLAUDE_CONFIG_DIRs,
// so it stays per-directory and overrides the shared config.
export function overridePath(): string {
  return path.join(claudeConfigDir(os.homedir()), 'claude-hub.json');
}

// A rule maps a raw user value to a valid one, or to the fallback (the default).
type Rule = (value: unknown, fallback: any) => unknown;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = (allowed: readonly unknown[]): Rule => (value, fallback) => (allowed.includes(value) ? value : fallback);
const percent: Rule = (value, fallback) => (isNumber(value) ? Math.max(0, Math.min(100, value)) : fallback);
const count: Rule = (value, fallback) => (Number.isInteger(value) && (value as number) >= 0 ? value : fallback);
const text = (max: number): Rule => (value, fallback) => (typeof value === 'string' ? sanitize(value).slice(0, max) : fallback);

// Known names, once each, in order. An empty result falls back only when `nonEmpty`.
const names = (known: readonly unknown[], nonEmpty: boolean): Rule => (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  const kept = [...new Set(value.filter((item) => known.includes(item)))];
  return kept.length > 0 || !nonEmpty ? kept : fallback;
};

// Groups need two or more known elements, and an element joins at most one group.
const mergeGroups: Rule = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  const used = new Set<unknown>();
  const groups: unknown[][] = [];
  for (const group of value) {
    if (!Array.isArray(group)) continue;
    const members = [...new Set(group.filter((item) => (ELEMENTS as readonly unknown[]).includes(item) && !used.has(item)))];
    if (members.length < 2) continue;
    members.forEach((member) => used.add(member));
    groups.push(members);
  }
  return value.length === 0 || groups.length > 0 ? groups : fallback;
};

// Exactly one visible character.
const barChar = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) return undefined;
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)];
  return graphemes.length === 1 ? value : undefined;
};

const colors: Rule = (value) => {
  const result: HubConfig['colors'] = {};
  if (!isObject(value)) return result;
  for (const role of COLOR_ROLES) {
    if (isColorValue(value[role])) result[role] = value[role] as ColorValue;
  }
  const filled = barChar(value.barFilled);
  const empty = barChar(value.barEmptyChar);
  if (filled) result.barFilled = filled;
  if (empty) result.barEmptyChar = empty;
  return result;
};

// Booleans need no rule: a boolean default accepts only booleans.
const RULES: Record<string, Rule> = {
  language: oneOf(LANGUAGES),
  theme: oneOf(THEME_NAMES),
  style: oneOf(STYLES),
  icons: oneOf(ICON_TIERS),
  reserveWidth: (value, fallback) => (Number.isInteger(value) && (value as number) >= 0 ? Math.min(value as number, 200) : fallback),
  barStyle: oneOf(BAR_STYLE_NAMES),
  barColor: oneOf(BAR_COLORS),
  lineLayout: oneOf(LAYOUTS),
  pathLevels: oneOf(PATH_LEVELS),
  maxWidth: (value) => (isNumber(value) && value > 0 ? Math.min(Math.floor(value), MAX_TERMINAL_WIDTH) : null),
  elementOrder: names(ELEMENTS, true),
  projectLineOrder: names(PROJECT_SEGMENTS, false),
  colors,
  'display.modelFormat': oneOf(MODEL_FORMATS),
  'display.modelOverride': text(80),
  'display.modelSource': oneOf(MODEL_SOURCES),
  'display.providerName': text(40),
  'display.effortFormat': oneOf(EFFORT_FORMATS),
  'display.contextValue': oneOf(CONTEXT_VALUES),
  'display.contextWarningThreshold': percent,
  'display.contextCriticalThreshold': percent,
  'display.autoCompactWindow': (value) => (Number.isInteger(value) && (value as number) > 0 ? value : null),
  'display.usageValue': oneOf(USAGE_VALUES),
  'display.usageThreshold': percent,
  'display.sevenDayThreshold': percent,
  'display.timeFormat': oneOf(TIME_FORMATS),
  'display.toolsMaxVisible': count,
  'display.mergeGroups': mergeGroups,
  'display.customLine': text(80),
  'display.customLinePosition': oneOf(POSITIONS),
};

// Walks the defaults, so unknown keys are dropped and every known key is validated.
function normalize(defaults: Record<string, unknown>, input: unknown, prefix = ''): Record<string, unknown> {
  const source = isObject(input) ? input : {};
  const result: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const keyPath = prefix + key;
    const rule = RULES[keyPath];
    const value = source[key];
    if (rule) result[key] = rule(value, fallback);
    else if (isObject(fallback)) result[key] = normalize(fallback, value, `${keyPath}.`);
    else result[key] = typeof fallback === 'boolean' && typeof value === 'boolean' ? value : fallback;
  }
  return result;
}

export function mergeConfig(user: unknown): HubConfig {
  return normalize(structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>, user) as unknown as HubConfig;
}

function isSafeShape(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (Array.isArray(value)) return value.every((item) => isSafeShape(item, depth + 1));
  if (!isObject(value)) return true;
  return Object.entries(value).every(([key, child]) => !UNSAFE_KEYS.has(key) && isSafeShape(child, depth + 1));
}

// Sections merge key by key; arrays and scalars replace the base value.
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = isObject(current) && isObject(value) ? deepMerge(current, value) : value;
  }
  return result;
}

export function readConfigFile(file: string): Record<string, unknown> | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) return null;
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isObject(parsed) && isSafeShape(parsed) ? parsed : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') debug('Ignoring %s:', file, err instanceof Error ? err.message : err);
    return null;
  }
}

export function loadConfig(): HubConfig {
  const base = readConfigFile(configPath()) ?? {};
  const override = readConfigFile(overridePath());
  return mergeConfig(override ? deepMerge(base, override) : base);
}
