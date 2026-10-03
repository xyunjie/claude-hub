import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeConfig } from '../dist/config.js';
import { setLanguage } from '../dist/i18n/index.js';
import { renderLines } from '../dist/render/index.js';
import { stripAnsi, visibleWidth, wrapToWidth } from '../dist/render/ansi.js';
import { timeToLimit, usagePace } from '../dist/render/bars.js';
import { shortModel } from '../dist/render/activity.js';

const NOW = Date.UTC(2026, 9, 2, 12, 0, 0);
const empty = { tools: [], skills: [], mcpServers: [], mcpErrors: [], agents: [], todos: [] };

// Most tests pin the lean style on the terminal palette; dashboard tests opt in.
function render(stdin, config = {}, extra = {}, width = 200) {
  const merged = mergeConfig({ style: 'lean', theme: 'default', ...config, display: { usagePace: false, ...config.display } });
  setLanguage(merged.language);
  const ctx = {
    stdin, config: merged, transcript: empty, git: null, usage: null, counts: null,
    costTotals: null, speed: null, memory: null, auth: null, extraLabel: null, ...extra,
  };
  return renderLines(ctx, width, NOW).map(stripAnsi);
}

const base = {
  model: { display_name: 'Opus 5.5' },
  cwd: '/home/me/proj',
  context_window: { used_percentage: 45, context_window_size: 200000 },
  cost: { total_cost_usd: 1.5, total_duration_ms: 3_900_000 },
};

test('default HUD is two lines: header with time and cost, then context', () => {
  const lines = render(base);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '[Opus 5.5] │ proj │ ⏱ 1h 5m │ $1.50');
  assert.equal(lines[1], 'Context █████░░░░░ 45%');
});

test('usage merges onto the context row and shows the reset', () => {
  const usage = { fiveHour: 25, sevenDay: 10, fiveHourResetAt: new Date(NOW + 5_400_000), sevenDayResetAt: null };
  const [, row] = render(base, {}, { usage });
  assert.equal(row, 'Context █████░░░░░ 45% │ Usage ███░░░░░░░ 25% (resets in 1h 30m)');
});

test('limit reached replaces the bars with a notice', () => {
  const usage = { fiveHour: 100, sevenDay: 40, fiveHourResetAt: new Date(NOW + 600_000), sevenDayResetAt: null };
  assert.match(render(base, {}, { usage })[1], /Usage ⚠ Limit reached \(10m\)/);
});

test('git segment shows branch, dirty flag, ahead/behind', () => {
  const git = { branch: 'main', dirty: true, ahead: 2, behind: 1 };
  const [header] = render(base, { gitStatus: { showAheadBehind: true } }, { git });
  assert.match(header, /proj git:\(main\* ↑2 ↓1\)/);
});

test('Chinese labels', () => {
  assert.equal(render(base, { language: 'zh-Hans' })[1], '上下文 █████░░░░░ 45%');
});

test('bar style and theme change the bar', () => {
  assert.match(render(base, { barStyle: 'dot', theme: 'nord' })[1], /●●●●●○○○○○/);
});

test('compact layout puts everything on one line', () => {
  const lines = render(base, { lineLayout: 'compact' });
  assert.equal(lines.length, 1);
  assert.equal(lines[0], '[Opus 5.5] █████░░░░░ 45% │ proj │ ⏱ 1h 5m │ $1.50');
});

test('activity lines for tools, agents and todos', () => {
  const transcript = {
    ...empty,
    tools: [
      { id: '1', name: 'Edit', target: 'src/a.ts', status: 'running', startTime: new Date(NOW) },
      { id: '2', name: 'Read', status: 'completed', startTime: new Date(NOW) },
      { id: '3', name: 'Read', status: 'completed', startTime: new Date(NOW) },
    ],
    agents: [{ id: 'a', type: 'Explore', model: 'claude-haiku-4-5', status: 'running', startTime: new Date(NOW - 65_000) }],
    todos: [{ content: 'Do it', status: 'in_progress' }, { content: 'Done', status: 'completed' }],
  };
  const lines = render(base, { display: { showTools: true, showAgents: true, showTodos: true } }, { transcript });
  assert.deepEqual(lines.slice(2), ['◐ Edit: src/a.ts │ ✓ Read ×2', '◐ Explore [haiku-4.5] (1m 5s)', '▸ Do it (1/2)']);
});

test('projectLineOrder moves segments', () => {
  assert.equal(render(base, { projectLineOrder: ['cost', 'model'] })[0], '$1.50 │ [Opus 5.5] │ proj │ ⏱ 1h 5m');
});

test('untrusted text is sanitized', () => {
  const lines = render({ ...base, model: { display_name: 'Op\x1b[31mus\x07' } });
  assert.match(lines[0], /^\[Opus\]/);
});

test('narrow terminals wrap at separators', () => {
  assert.deepEqual(wrapToWidth('aaaa │ bbbb │ cccc', 12), ['aaaa │ bbbb', 'cccc']);
  assert.equal(stripAnsi(wrapToWidth('abcdefghijklmnop', 8)[0]), 'abcde...');
  assert.equal(visibleWidth('上下文'), 6);
});

test('pace grades projected consumption', () => {
  const window = 5 * 3600_000;
  assert.equal(usagePace(50, new Date(NOW + window / 2), window, NOW), 'warning');
  assert.equal(usagePace(80, new Date(NOW + window / 2), window, NOW), 'critical');
  assert.equal(usagePace(20, new Date(NOW + window / 2), window, NOW), 'normal');
});

test('shortModel', () => {
  assert.equal(shortModel('claude-haiku-4-5-20251001'), 'haiku-4.5');
  assert.equal(shortModel('claude-3-5-sonnet-20241022'), 'sonnet-3.5');
  assert.equal(shortModel('gpt-x'), 'gpt-x');
});

const plainText = (line) => line.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '');
const withUsage = { usage: { fiveHour: 25, sevenDay: 10, fiveHourResetAt: new Date(NOW + 5_400_000), sevenDayResetAt: null } };

test('bracket style wraps each segment group', () => {
  const lines = render(base, { style: 'bracket' }, withUsage).map(plainText);
  assert.equal(lines[0], '[Opus 5.5] [proj] [⏱ 1h 5m] [$1.50]');
  assert.equal(lines[1], '[Context █████░░░░░ 45%] [5h ███░░░░░░░ 25% · 1h 30m]');
});

test('boxed style frames the rows', () => {
  const lines = render(base, { style: 'boxed' }).map(plainText);
  assert.deepEqual(lines.map((l) => l.slice(0, 3)), ['╭─ ', '╰─ ']);
  assert.equal(render(base, { style: 'boxed', elementOrder: ['context'] })[0], '── Context █████░░░░░ 45%');
});

test('powerline uses Nerd arrows only with nerd icons', () => {
  const raw = (config) => {
    const merged = mergeConfig({ theme: 'default', ...config });
    setLanguage(merged.language);
    return renderLines({ stdin: base, config: merged, transcript: empty, git: null, usage: null, counts: null,
      costTotals: null, speed: null, memory: null, auth: null, extraLabel: null }, 200, NOW).join('\n');
  };
  assert.ok(raw({ style: 'powerline', icons: 'nerd' }).includes('\uE0B0'));
  assert.ok(!/[\uE000-\uF8FF]/u.test(raw({ style: 'powerline' })));
  assert.ok(raw({ style: 'capsule', icons: 'nerd' }).includes('\uE0B6'));
  // Blocks carry a background color.
  assert.match(raw({ style: 'capsule' }), /\x1b\[4[0-7]m|\x1b\[10[0-7]m|\x1b\[48;/);
});

test('ascii icons keep the info rows pure ASCII', () => {
  const git = { branch: 'main', dirty: true, ahead: 1, behind: 1 };
  const stdin = { ...base, effort: { level: 'high' } };
  const lines = render(stdin, { icons: 'ascii', gitStatus: { showAheadBehind: true }, display: { showEffortLevel: true, usagePace: true } }, { ...withUsage, git });
  for (const line of lines) assert.match(plainText(line), /^[\x20-\x7e]*$/, line);
  assert.match(lines[1], /Context #####----- 45%/);
});

test('usage pace marker and limit forecast', () => {
  const usage = { fiveHour: 80, sevenDay: null, fiveHourResetAt: new Date(NOW + 2.5 * 3600_000), sevenDayResetAt: null };
  const [, row] = render(base, { display: { usagePace: true } }, { usage });
  // Half the window has passed, so the marker sits mid-bar; 80% at half time hits 100% in 37.5m.
  assert.match(row, /Usage █████▏██░░ 80% →160% ▲38m/);
  assert.equal(timeToLimit(80, new Date(NOW + 2.5 * 3600_000), 5 * 3600_000, NOW), 37.5 * 60_000);
  assert.equal(timeToLimit(20, new Date(NOW + 2.5 * 3600_000), 5 * 3600_000, NOW), null);
});

test('narrow terminals drop optional segments before wrapping', () => {
  const stdin = { ...base, cost: { ...base.cost, total_lines_added: 10, total_lines_removed: 2 }, version: '2.3.0' };
  const config = { display: { showLinesChanged: true, showClaudeCodeVersion: true } };
  assert.equal(render(stdin, config, {}, 200)[0], '[Opus 5.5] │ proj │ CC v2.3.0 │ ⏱ 1h 5m │ $1.50 │ +10 -2');
  assert.equal(render(stdin, config, {}, 40)[0], '[Opus 5.5] │ proj │ ⏱ 1h 5m │ $1.50');
});

test('reserveWidth leaves room at the right edge', () => {
  const lines = render(base, { reserveWidth: 30 }, withUsage, 80);
  assert.ok(lines.every((line) => visibleWidth(line) <= 50), lines.join('\n'));
});

test('zero cost is hidden', () => {
  assert.equal(render({ ...base, cost: { total_cost_usd: 0, total_duration_ms: 60_000 } })[0], '[Opus 5.5] │ proj │ ⏱ 1m');
});

const dashUsage = { usage: { fiveHour: 2, sevenDay: 69, fiveHourResetAt: new Date(NOW + 4 * 3600_000 + 29 * 60_000), sevenDayResetAt: new Date(NOW + 49 * 3600_000) } };
const dashStdin = {
  ...base,
  model: { display_name: 'Opus 5.5' },
  effort: { level: 'xhigh' },
  workspace: { repo: { host: 'github.com', owner: 'Jrsgslb', name: 'nevedu' } },
  context_window: { used_percentage: 9, context_window_size: 1_000_000, current_usage: { input_tokens: 89_000 }, total_input_tokens: 1_700_000, total_output_tokens: 28_000 },
  prompt_cache: { hit_ratio: 0.97 },
};

test('dashboard: identity row and an aligned metrics grid', () => {
  const git = { branch: 'main', dirty: false, ahead: 0, behind: 0 };
  const lines = render(dashStdin, { style: 'dashboard', barStyle: 'line', display: { showEffortLevel: true } }, { ...dashUsage, git }, 140).map(plainText);
  assert.equal(lines[0], '◆ Opus 5.5 xhigh │ Jrsgslb/nevedu ⎇ main ✓');
  assert.equal(lines[1], 'ctx ━─────────── 9%  89k/1M │ tok ↑1.7M ↓28k cache 97%   │ cost $1.50');
  assert.equal(lines[2], '5h  ──────────── 2%  ↻4h29m │ 7d  ━━━━━━━━──── 69% ↻2d1h │ time 1h5m');
  // The separators line up.
  assert.equal(lines[1].indexOf('│'), lines[2].indexOf('│'));
});

test('dashboard: narrow terminals drop the token cell, then move text cells beside the bars', () => {
  const lines = render(dashStdin, { style: 'dashboard' }, dashUsage, 44).map(plainText);
  assert.ok(lines.every((line) => visibleWidth(line) <= 44), lines.join('\n'));
  assert.ok(!lines.some((line) => line.includes('tok')));
  assert.match(lines[1], /^ctx .* │ cost \$1\.50$/);
  assert.match(lines[3], /^7d /);
});

test('bar heights and the gradient fill', () => {
  const ctx = (config) => render(dashStdin, { style: 'lean', ...config })[1];
  assert.match(ctx({ barStyle: 'half' }), /Context ▄▄▄▄▄▄▄▄▄▄ 9%/);
  assert.match(ctx({ barStyle: 'thin' }), /Context ────────── 9%/);
  const merged = mergeConfig({ style: 'lean', theme: 'claude', barColor: 'gradient' });
  const lines = renderLines({ stdin: { ...base, context_window: { used_percentage: 90, context_window_size: 200000 } }, config: merged, transcript: empty,
    git: null, usage: null, counts: null, costTotals: null, speed: null, memory: null, auth: null, extraLabel: null }, 200, NOW);
  // Each filled cell gets its own truecolor shade.
  const shades = new Set(lines[1].match(/\x1b\[38;2;[0-9;]+m█/g));
  assert.ok(shades.size >= 5, `${shades.size} shades`);
});

test('dashboard projects usage at reset and warns before the limit', () => {
  // 5h: 80% used with half the window gone → 160% at reset, the limit in ~38m.
  const usage = { fiveHour: 80, sevenDay: 30, fiveHourResetAt: new Date(NOW + 2.5 * 3600_000), sevenDayResetAt: new Date(NOW + 3.5 * 86400_000) };
  const lines = render(dashStdin, { style: 'dashboard', display: { usagePace: true } }, { usage }, 160).map(plainText);
  assert.match(lines[2], /80% →160% ▲38m ↻2h30m/);
  assert.match(lines[2], /30% →60% ↻3d12h/);
});

test('model families and effort levels get their own colors', () => {
  const raw = (id, name, effort, config = {}) => {
    const merged = mergeConfig({ style: 'dashboard', ...config, display: { showEffortLevel: true, ...config.display } });
    return renderLines({ stdin: { ...dashStdin, model: { id, display_name: name }, effort: { level: effort } }, config: merged,
      transcript: empty, git: null, usage: null, counts: null, costTotals: null, speed: null, memory: null, auth: null, extraLabel: null }, 160, NOW)[0];
  };
  const fable = raw('claude-fable-5-1', 'Fable 5.1', 'max');
  // Fable shimmers: a different color per character, and a sparkle mark.
  assert.ok(new Set(fable.match(/\x1b\[38;2;[0-9;]+mF|\x1b\[38;2;[0-9;]+ma/g)).size >= 2);
  assert.match(stripAnsi(fable), /^✦ Fable 5\.1 max/);
  // Sonnet is muted and not bold; Opus keeps the bold theme accent.
  assert.match(raw('claude-sonnet-5-5', 'Sonnet 5.5', 'low'), /\x1b\[38;2;154;163;178mSonnet 5\.5/);
  assert.match(raw('claude-opus-5-5', 'Opus 5.5', 'low'), /\x1b\[1m\x1b\[38;2;224;135;94mOpus 5\.5/);
  // Effort: max is bold red, low is gray.
  assert.match(raw('claude-opus-5-5', 'Opus 5.5', 'max'), /\x1b\[1m\x1b\[38;2;247;118;142mmax/);
  assert.match(raw('claude-opus-5-5', 'Opus 5.5', 'low'), /\x1b\[38;2;110;118;129mlow/);
  // Turned off, everything takes the theme color.
  assert.doesNotMatch(raw('claude-fable-5-1', 'Fable 5.1', 'max', { display: { modelColors: false } }), /✦/);
});

test('dashboard bars are lines with a thin crossing pace marker', () => {
  const usage = { fiveHour: 80, sevenDay: null, fiveHourResetAt: new Date(NOW + 2.5 * 3600_000), sevenDayResetAt: null };
  const draw = (config) => renderLines({ stdin: dashStdin, config: mergeConfig({ style: 'dashboard', ...config }), transcript: empty, git: null,
    usage, counts: null, costTotals: null, speed: null, memory: null, auth: null, extraLabel: null }, 160, NOW)[2];
  // Half the window has passed: the marker crosses the fill at cell 6.
  assert.match(stripAnsi(draw({})), /^5h +━━━━━━┿━━━── 80%/);
  assert.match(draw({}), /\x1b\[38;2;235;235;235m┿/);
  // Taller bars keep the bar whole: a lightened cell on ▇, a thin line over the cell color on █.
  const shades = [...draw({ barStyle: 'tall' }).matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+)m▇/g)].map((m) => Number(m[1]) + Number(m[2]) + Number(m[3]));
  assert.ok(Math.max(...shades) > 600, String(shades));
  assert.match(draw({ barStyle: 'solid' }), /\x1b\[48;2;[0-9;]+m\x1b\[38;2;235;235;235m▏/);
});

