import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createDebug } from './debug.js';
import { ICON_TIERS } from './icons.js';
import { LANGUAGES } from './i18n/index.js';
import { claudeConfigDir, hubDir } from './paths.js';
import { BAR_STYLE_NAMES, COLOR_ROLES, THEME_NAMES, isColorValue, } from './themes.js';
import { sanitize } from './utils/sanitize.js';
import { MAX_TERMINAL_WIDTH } from './utils/terminal.js';
const debug = createDebug('config');
const MAX_CONFIG_BYTES = 64 * 1024;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
export const ELEMENTS = [
    'project', 'context', 'usage', 'promptCache', 'cacheHitRate', 'memory',
    'environment', 'tools', 'skills', 'mcp', 'agents', 'todos', 'sessionTime',
];
/** Orderable segments of the project line. */
export const PROJECT_SEGMENTS = [
    'model', 'project', 'sessionName', 'version', 'extra', 'duration', 'cost', 'lines', 'speed', 'auth',
];
const LAYOUTS = ['expanded', 'compact'];
export const STYLES = ['dashboard', 'lean', 'powerline', 'capsule', 'boxed', 'bracket'];
const BAR_COLORS = ['band', 'gradient'];
const PATH_LEVELS = [1, 2, 3, 'full'];
const CONTEXT_VALUES = ['percent', 'tokens', 'remaining', 'both'];
const USAGE_VALUES = ['percent', 'remaining'];
const MODEL_FORMATS = ['full', 'compact', 'short'];
const MODEL_SOURCES = ['stdin', 'auto', 'transcript'];
const EFFORT_FORMATS = ['full', 'symbol', 'text'];
const TIME_FORMATS = ['relative', 'absolute', 'both'];
const POSITIONS = ['first', 'last'];
export const DEFAULT_CONFIG = {
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
export function configPath() {
    return path.join(hubDir(os.homedir()), 'config.json');
}
// Lives outside plugins/, which users often share across several CLAUDE_CONFIG_DIRs,
// so it stays per-directory and overrides the shared config.
export function overridePath() {
    return path.join(claudeConfigDir(os.homedir()), 'claude-hub.json');
}
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = (allowed) => (value, fallback) => (allowed.includes(value) ? value : fallback);
const percent = (value, fallback) => (isNumber(value) ? Math.max(0, Math.min(100, value)) : fallback);
const count = (value, fallback) => (Number.isInteger(value) && value >= 0 ? value : fallback);
const text = (max) => (value, fallback) => (typeof value === 'string' ? sanitize(value).slice(0, max) : fallback);
// Known names, once each, in order. An empty result falls back only when `nonEmpty`.
const names = (known, nonEmpty) => (value, fallback) => {
    if (!Array.isArray(value))
        return fallback;
    const kept = [...new Set(value.filter((item) => known.includes(item)))];
    return kept.length > 0 || !nonEmpty ? kept : fallback;
};
// Groups need two or more known elements, and an element joins at most one group.
const mergeGroups = (value, fallback) => {
    if (!Array.isArray(value))
        return fallback;
    const used = new Set();
    const groups = [];
    for (const group of value) {
        if (!Array.isArray(group))
            continue;
        const members = [...new Set(group.filter((item) => ELEMENTS.includes(item) && !used.has(item)))];
        if (members.length < 2)
            continue;
        members.forEach((member) => used.add(member));
        groups.push(members);
    }
    return value.length === 0 || groups.length > 0 ? groups : fallback;
};
// Exactly one visible character.
const barChar = (value) => {
    if (typeof value !== 'string' || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
        return undefined;
    const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)];
    return graphemes.length === 1 ? value : undefined;
};
const colors = (value) => {
    const result = {};
    if (!isObject(value))
        return result;
    for (const role of COLOR_ROLES) {
        if (isColorValue(value[role]))
            result[role] = value[role];
    }
    const filled = barChar(value.barFilled);
    const empty = barChar(value.barEmptyChar);
    if (filled)
        result.barFilled = filled;
    if (empty)
        result.barEmptyChar = empty;
    return result;
};
// Booleans need no rule: a boolean default accepts only booleans.
const RULES = {
    language: oneOf(LANGUAGES),
    theme: oneOf(THEME_NAMES),
    style: oneOf(STYLES),
    icons: oneOf(ICON_TIERS),
    reserveWidth: (value, fallback) => (Number.isInteger(value) && value >= 0 ? Math.min(value, 200) : fallback),
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
    'display.autoCompactWindow': (value) => (Number.isInteger(value) && value > 0 ? value : null),
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
function normalize(defaults, input, prefix = '') {
    const source = isObject(input) ? input : {};
    const result = {};
    for (const [key, fallback] of Object.entries(defaults)) {
        const keyPath = prefix + key;
        const rule = RULES[keyPath];
        const value = source[key];
        if (rule)
            result[key] = rule(value, fallback);
        else if (isObject(fallback))
            result[key] = normalize(fallback, value, `${keyPath}.`);
        else
            result[key] = typeof fallback === 'boolean' && typeof value === 'boolean' ? value : fallback;
    }
    return result;
}
export function mergeConfig(user) {
    return normalize(structuredClone(DEFAULT_CONFIG), user);
}
function isSafeShape(value, depth = 0) {
    if (depth > 8)
        return false;
    if (Array.isArray(value))
        return value.every((item) => isSafeShape(item, depth + 1));
    if (!isObject(value))
        return true;
    return Object.entries(value).every(([key, child]) => !UNSAFE_KEYS.has(key) && isSafeShape(child, depth + 1));
}
// Sections merge key by key; arrays and scalars replace the base value.
function deepMerge(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        const current = result[key];
        result[key] = isObject(current) && isObject(value) ? deepMerge(current, value) : value;
    }
    return result;
}
export function readConfigFile(file) {
    try {
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES)
            return null;
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return isObject(parsed) && isSafeShape(parsed) ? parsed : null;
    }
    catch (err) {
        if (err.code !== 'ENOENT')
            debug('Ignoring %s:', file, err instanceof Error ? err.message : err);
        return null;
    }
}
export function loadConfig() {
    const base = readConfigFile(configPath()) ?? {};
    const override = readConfigFile(overridePath());
    return mergeConfig(override ? deepMerge(base, override) : base);
}
//# sourceMappingURL=config.js.map