// Prints the HUD for sample data in every theme: `npm run demo`, or `node scripts/demo.mjs nord`.
import { mergeConfig } from '../dist/config.js';
import { setLanguage } from '../dist/i18n/index.js';
import { renderLines } from '../dist/render/index.js';
import { THEME_NAMES } from '../dist/themes.js';

const now = Date.now();
const sec = (ms) => Math.floor((now + ms) / 1000);
const stdin = {
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  cwd: '/Users/me/code/claude-hub',
  context_window: { used_percentage: 72, context_window_size: 200000, current_usage: { input_tokens: 144000 } },
  cost: { total_cost_usd: 2.48, total_duration_ms: 4_380_000, total_lines_added: 312, total_lines_removed: 48 },
  rate_limits: { five_hour: { used_percentage: 38, resets_at: sec(5_400_000) }, seven_day: { used_percentage: 82, resets_at: sec(260_000_000) } },
  effort: { level: 'high' },
};
const transcript = {
  tools: [
    { id: '1', name: 'Edit', target: 'src/render/parts.ts', status: 'running', startTime: new Date(now - 2000) },
    ...Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, name: 'Read', status: 'completed', startTime: new Date(now) })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `g${i}`, name: 'Grep', status: 'completed', startTime: new Date(now) })),
  ],
  agents: [{ id: 'a', type: 'Explore', model: 'claude-haiku-4-5-20251001', description: 'Finding theme code', status: 'running', startTime: new Date(now - 75_000) }],
  todos: [{ content: 'Ship claude-hub', status: 'completed' }, { content: 'Write the README', status: 'in_progress' }, { content: 'Push to GitHub', status: 'pending' }],
  skills: [], mcpServers: [], mcpErrors: [],
};
const git = { branch: 'main', dirty: true, ahead: 2, behind: 0 };

const themes = process.argv[2] ? [process.argv[2]] : THEME_NAMES;
for (const theme of themes) {
  const config = mergeConfig({
    theme,
    gitStatus: { showAheadBehind: true },
    display: { showTools: true, showAgents: true, showTodos: true, showEffortLevel: true, showLinesChanged: true, usagePace: true },
  });
  setLanguage(config.language);
  console.log(`\n\x1b[1m── ${theme} ──\x1b[0m`);
  for (const line of renderLines({ stdin, config, transcript, git, usage: {
    fiveHour: 38, sevenDay: 82, fiveHourResetAt: new Date(now + 5_400_000), sevenDayResetAt: new Date(now + 260_000_000),
  }, counts: null, costTotals: null, speed: null, memory: null, auth: null, extraLabel: null }, 120, now)) console.log(line);
}
