# claude-hub

A themeable, real-time statusline HUD for [Claude Code](https://code.claude.com). It sits below your input and shows the model, project and git state, context usage, rate limits, session time and cost, and, if you turn them on, live tool, agent and todo activity.

> 🌐 English | [中文文档](README.zh.md)

```
[Opus 5.5 ◑ high] │ claude-hub git:(main* ↑2) │ ⏱ 1h 13m │ $2.48 │ +312 -48
Context ███████░░░ 72% │ Usage ████░░░░░░ 38% (resets in 1h 30m) │ Weekly ████████░░ 82% ▲ (resets in 3d)
◐ Edit: src/render/parts.ts | ✓ Read ×4 | ✓ Grep ×2
◐ Explore [haiku-4.5]: Finding theme code (1m 15s)
▸ Write the README (1/3)
```

Inspired by and partly derived from [claude-hud](https://github.com/jarrodwatts/claude-hud) (MIT). The config keys are compatible, so a claude-hud config can be imported.

## What's different from claude-hud

- **Themes**: `default`, `dracula`, `nord`, `catppuccin`, `gruvbox`, `tokyonight`, `mono`, plus per-role color overrides.
- **Bar styles**: `block` █░, `shade` ▓░, `line` ━─, `dot` ●○, `square` ■□.
- **Session time and cost on by default**: `⏱ 1h 13m │ $2.48`, with optional lines changed (`+312 -48`), today's and this week's spend.
- **Failed tools**: a tool whose every call errored shows `✗` instead of `✓`.
- **Transcript cache**: the parsed transcript is cached by size and mtime, so refreshes between turns don't re-read it.
- **Uninstall**: `setup.mjs uninstall` puts back the status line it replaced.

## Install

### As a plugin

```
/plugin marketplace add xyunjie/claude-hub
/plugin install claude-hub
/reload-plugins
/claude-hub:setup
```

### From a local checkout

```bash
git clone https://github.com/xyunjie/claude-hub.git && cd claude-hub
npm install && npm run build
node scripts/setup.mjs install --dev      # point the status line at this checkout
node scripts/setup.mjs import-hud         # optional: copy your claude-hud display settings
```

`install` backs up `settings.json`, keeps your `refreshInterval`, and saves the status line it replaces. `node scripts/setup.mjs uninstall` restores it. Set `CLAUDE_HUB_DISABLE=1` to blank the HUD for one session.

Preview every theme in your terminal with `npm run demo` (or `node scripts/demo.mjs nord`).

## Configure

Run `/claude-hub:configure`, ask Claude ("use the nord theme", "show tool activity"), or edit `~/.claude/plugins/claude-hub/config.json` (under `$CLAUDE_CONFIG_DIR` if set). Invalid values fall back to defaults. A `$CLAUDE_CONFIG_DIR/claude-hub.json` file with the same shape is layered on top, for per-config-dir overrides.

```json
{
  "theme": "catppuccin",
  "barStyle": "dot",
  "language": "en",
  "gitStatus": { "showAheadBehind": true },
  "display": { "showTools": true, "showAgents": true, "showTodos": true, "showLinesChanged": true },
  "colors": { "model": "#ff79c6" }
}
```

### Top level

| Key | Default | Values |
|---|---|---|
| `language` | `en` | `en`, `zh` / `zh-Hans`, `zh-Hant` / `zh-TW` |
| `theme` | `default` | `default`, `dracula`, `nord`, `catppuccin`, `gruvbox`, `tokyonight`, `mono` |
| `barStyle` | `block` | `block`, `shade`, `line`, `dot`, `square` |
| `lineLayout` | `expanded` | `expanded` (one row per element), `compact` (one dense line) |
| `showSeparators` | `false` | rule between the info rows and the activity rows |
| `pathLevels` | `1` | `1`, `2`, `3`, `full` |
| `maxWidth` | `null` | fallback width when the terminal width is unknown |
| `elementOrder` | all | order of rows in expanded mode: `project`, `context`, `usage`, `promptCache`, `cacheHitRate`, `memory`, `environment`, `tools`, `skills`, `mcp`, `agents`, `todos`, `sessionTime`. Leave one out to hide it |
| `projectLineOrder` | `[]` | move header segments to the front: `model`, `project`, `sessionName`, `version`, `extra`, `duration`, `cost`, `lines`, `speed`, `auth` |

### `gitStatus`

| Key | Default | |
|---|---|---|
| `enabled` | `true` | show `git:(branch)` |
| `showDirty` | `true` | `*` for uncommitted changes |
| `showAheadBehind` | `false` | `↑N ↓N` against upstream |
| `showFileStats` | `false` | `[+12 -3]`, a changed-files row (expanded) or `!M +A ✘D ?U` (compact) |
| `showWorktree` | `false` | `⎇ name` in a linked worktree |

### `display`

| Key | Default | |
|---|---|---|
| `showModel` / `showProject` / `showAddedDirs` | `true` | header pieces |
| `modelFormat` | `full` | `full`, `compact` (drop "(1M context)"), `short` (also drop "Claude ") |
| `modelOverride` | `""` | text to show instead of the model name |
| `modelSource` | `stdin` | `stdin`, `transcript` (what the API served), `auto` (served model only when a proxy swapped in a non-Claude one) |
| `showProvider` / `providerName` | `false` / `""` | provider label before the model |
| `showEffortLevel` / `effortFormat` | `false` / `full` | `◑ high`; `full`, `symbol`, `text` |
| `showContextBar` | `true` | |
| `contextValue` | `percent` | `percent`, `tokens`, `remaining`, `both` |
| `contextWarningThreshold` / `contextCriticalThreshold` | `70` / `85` | color bands |
| `showTokenBreakdown` | `true` | `(in: 12k, cache: 180k)` at the critical threshold |
| `autoCompactWindow` | `null` | measure context against this many tokens instead |
| `showUsage` | `true` | 5-hour and weekly limits (subscribers) |
| `usageValue` | `percent` | `percent`, `remaining` |
| `usageBarEnabled` / `usageCompact` | `true` / `false` | bars, or `5h: 25% (1h 30m)` |
| `usagePace` | `false` | color and `▲` when you're on track to hit a limit before it resets |
| `showResetLabel` | `true` | "resets in" wording |
| `usageThreshold` | `0` | hide usage below this percent |
| `sevenDayThreshold` | `80` | show the weekly window from this percent |
| `timeFormat` | `relative` | `relative`, `absolute`, `both` |
| `showDuration` | `true` | `⏱ 1h 5m` session time |
| `showCost` | `true` | session cost from Claude Code |
| `showRoutedCost` | `false` | also for Bedrock / Vertex |
| `showDailyCost` / `showWeeklyCost` | `false` | spend across all sessions today / this week |
| `showLinesChanged` | `false` | `+312 -48` lines this session |
| `showSpeed` | `false` | output tokens per second |
| `showSessionName` / `showClaudeCodeVersion` | `false` | |
| `showAuth` / `showAuthUser` | `false` | plan and account |
| `showConfigCounts` / `showOutputStyle` | `false` | CLAUDE.md, rules, MCPs, hooks counts; output style |
| `showPromptCache` / `showCacheHitRate` | `false` | prompt cache expiry and hit rate |
| `showMemoryUsage` | `false` | system RAM bar |
| `showSessionTokens` / `showCompactions` | `false` | session token totals; compaction count |
| `showSessionStartDate` / `showLastResponseAt` | `false` | |
| `showTools` / `showSkills` / `showMcp` / `showAgents` / `showTodos` | `false` | activity rows |
| `toolsMaxVisible` | `4` | completed tool kinds shown (`0` = all) |
| `mergeGroups` | `[["context","usage"]]` | adjacent elements that share a row when it fits |
| `customLine` / `customLinePosition` | `""` / `last` | your own text, `first` or `last` |

### `colors`

Roles: `model`, `project`, `git`, `gitBranch`, `label`, `context`, `warning`, `critical`, `usage`, `usageWarning`, `custom`, `running`, `success`, `tool`, `agent`, `cost`, `duration`, `barEmpty`. A value is a name (`red`, `brightBlue`, `gray`, `dim`, `bold`, …), a 256-color index, or `#rrggbb`. `barFilled` and `barEmptyChar` set the bar characters.

### Extra command

Add `--extra-cmd "your-command"` to the status line command and set `CLAUDE_HUB_ALLOW_EXTRA_CMD=1` to show its output (`{"label":"…"}` or the last line) in the header.

## How it works

Claude Code runs the status line command after each message and on `refreshInterval`, piping session JSON (model, context window, cost, rate limits, prompt cache) to stdin. claude-hub reads it, gathers only what the enabled elements need (transcript, git, config counts, …) in parallel, and prints the lines. Everything from stdin, the transcript, and git is sanitized before it reaches the terminal.

## Develop

```bash
npm install
npm test          # builds dist/ and runs node --test
npm run demo      # every theme with sample data
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":45,"context_window_size":200000}}' | node dist/index.js
```

`dist/` is committed so the plugin runs straight from a clone; rebuild before committing. Node.js 18+.

## License

MIT
