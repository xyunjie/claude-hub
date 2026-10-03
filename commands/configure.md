---
description: Configure claude-hub display options (theme, layout, language, elements)
allowed-tools: Bash, Read, Write, AskUserQuestion
---

Edit the claude-hub config at `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/claude-hub/config.json`. Read it first (it may not exist yet; treat that as `{}`), and read `${CLAUDE_PLUGIN_ROOT}/README.md` for the full option list.

Ask with AskUserQuestion, one round of up to four questions, skipping any the user already answered in their request:

1. **Theme** (header "Theme"): `default` (follows your terminal colors), `dracula`, `nord`, `catppuccin`, `gruvbox`, `tokyonight`, `mono`. Mention the user can preview them with `npm run demo` in the repo.
2. **Layout** (header "Layout"): `expanded` (one row per element) or `compact` (one dense line).
3. **Extra lines** (header "Lines", multiSelect): tools, agents, todos, session tokens, prompt cache, memory, config counts.
4. **Language** (header "Language"): English (`en`), 简体中文 (`zh-Hans`), 繁體中文 (`zh-Hant`).

Map answers to keys: `theme`, `lineLayout`, `language`, and `display.showTools` / `showAgents` / `showTodos` / `showSessionTokens` / `showPromptCache` / `showMemoryUsage` / `showConfigCounts`.

Merge the changes into the existing object, preserving every key you did not ask about, show the user the resulting JSON diff, then write the file. Claude Code picks the change up on its next status line refresh; no restart is needed.
