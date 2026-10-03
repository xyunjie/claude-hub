// Renders sample data in every style × theme, or the ones you pick:
//   node scripts/preview.mjs                          every combination, info rows only
//   node scripts/preview.mjs --style capsule          one style in every theme, full HUD
//   node scripts/preview.mjs --theme nord --icons nerd --width 80 --layout compact --lang zh-Hans
//   node scripts/preview.mjs --style dashboard --bar half --bar-color gradient
import { mergeConfig, STYLES } from '../dist/config.js';
import { setLanguage } from '../dist/i18n/index.js';
import { renderLines } from '../dist/render/index.js';
import { THEME_NAMES } from '../dist/themes.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const styles = flag('style') ? [flag('style')] : STYLES;
const themes = flag('theme') ? [flag('theme')] : THEME_NAMES;
const full = Boolean(flag('style') || flag('theme')) || args.includes('--full');
const width = Number(flag('width') ?? 120);

const now = Date.now();
const sec = (ms) => Math.floor((now + ms) / 1000);
const stdin = {
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  cwd: '/Users/me/code/claude-hub',
  context_window: {
    used_percentage: 72, context_window_size: 200000, current_usage: { input_tokens: 144000 },
    total_input_tokens: 1_700_000, total_output_tokens: 28_000,
  },
  prompt_cache: { warm: true, caching_observed: true, ttl: '1h', expires_at: sec(3_000_000), hit_ratio: 0.97 },
  workspace: { repo: { host: 'github.com', owner: 'xyunjie', name: 'claude-hub' } },
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
  todos: [{ content: 'Ship claude-hub', status: 'completed' }, { content: 'Restyle the HUD', status: 'in_progress' }, { content: 'Push to GitHub', status: 'pending' }],
  skills: [], mcpServers: [], mcpErrors: [],
};
const usage = {
  fiveHour: 38, sevenDay: 82, fiveHourResetAt: new Date(now + 5_400_000), sevenDayResetAt: new Date(now + 260_000_000),
};
const git = { branch: 'main', dirty: true, ahead: 2, behind: 0 };

for (const style of styles) {
  for (const theme of themes) {
    const config = mergeConfig({
      style,
      theme,
      icons: flag('icons') ?? 'unicode',
      barStyle: flag('bar') ?? 'auto',
      barColor: flag('bar-color') ?? 'band',
      lineLayout: flag('layout') ?? 'expanded',
      language: flag('lang') ?? 'en',
      gitStatus: { showAheadBehind: true },
      display: {
        showTools: full, showAgents: full, showTodos: full,
        showEffortLevel: true, showLinesChanged: true, usagePace: true,
      },
    });
    setLanguage(config.language);
    console.log(`\n\x1b[1m── ${style} · ${theme} · ${config.icons} ──\x1b[0m`);
    const lines = renderLines({
      stdin, config, transcript, git, usage, counts: null, costTotals: null, speed: null, memory: null, auth: null, extraLabel: null,
    }, width, now);
    for (const line of lines) console.log(line);
  }
}
