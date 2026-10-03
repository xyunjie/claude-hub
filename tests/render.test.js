import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeConfig } from '../dist/config.js';
import { setLanguage } from '../dist/i18n/index.js';
import { renderLines } from '../dist/render/index.js';
import { stripAnsi, visibleWidth, wrapToWidth } from '../dist/render/ansi.js';
import { usagePace } from '../dist/render/bars.js';
import { shortModel } from '../dist/render/activity.js';

const NOW = Date.UTC(2026, 9, 2, 12, 0, 0);
const empty = { tools: [], skills: [], mcpServers: [], mcpErrors: [], agents: [], todos: [] };

function render(stdin, config = {}, extra = {}, width = 200) {
  const merged = mergeConfig(config);
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
  assert.equal(lines[0], '[Opus 5.5] █████░░░░░ 45% | proj | ⏱ 1h 5m | $1.50');
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
  assert.deepEqual(lines.slice(2), ['◐ Edit: src/a.ts | ✓ Read ×2', '◐ Explore [haiku-4.5] (1m 5s)', '▸ Do it (1/2)']);
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
