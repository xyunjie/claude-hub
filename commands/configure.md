---
description: Configure claude-hub display options (theme, layout, language, elements)
allowed-tools: Bash, Read, Write, AskUserQuestion
---

Edit the claude-hub config at `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/claude-hub/config.json`. Read it first (it may not exist yet; treat that as `{}`), and read `${CLAUDE_PLUGIN_ROOT}/README.md` for the full option list.

Ask with AskUserQuestion, one round of up to four questions, skipping any the user already answered in their request:

1. **Style** (header "Style"): `dashboard` (identity row + aligned metric grid with thin bars, the default), `lean` (colored text, `│` separators), `powerline` (colored blocks), `capsule` (one pill per segment), `boxed` (rows on a `╭─ ╰─` frame), `bracket` (`[segments]`). Also ask whether they have a Nerd Font: yes → `icons: "nerd"` (arrows, rounded caps, glyphs); no → `unicode`; CJK-width terminal → `ascii`.
2. **Theme** (header "Theme"): `claude` (orange accent, the default), `lavender`, `default` (follows your terminal colors), `dracula`, `nord`, `catppuccin`, `gruvbox`, `tokyonight`, `mono`. Mention they can preview every combination with `node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs"`.
3. **Extra lines** (header "Lines", multiSelect): tools, agents, todos, session tokens, prompt cache, memory, config counts, usage pace.
4. **Layout and language** (header "Layout"): `expanded` or `compact`, and English (`en`), 简体中文 (`zh-Hans`), or 繁體中文 (`zh-Hant`). Offer these as combined options.

If the user asks about bars, `barStyle` sets the height (`solid` full cell, `tall` text height, `half`, `line`, `thin` flattest) and `barColor` is `gradient` (per-cell ramp, default) or `band`. `display.modelColors` toggles per-model and per-effort colors; `display.usagePace` the projection.

Map answers to keys: `style`, `icons`, `theme`, `lineLayout`, `language`, and `display.showTools` / `showAgents` / `showTodos` / `showSessionTokens` / `showPromptCache` / `showMemoryUsage` / `showConfigCounts` / `usagePace`. Before writing, run the preview script with the chosen `--style --theme --icons` so the user sees the result.

Merge the changes into the existing object, preserving every key you did not ask about, show the user the resulting JSON diff, then write the file. Claude Code picks the change up on its next status line refresh; no restart is needed.
