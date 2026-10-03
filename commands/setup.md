---
description: Configure claude-hub as your statusline
allowed-tools: Bash, Read, AskUserQuestion
---

Set up claude-hub as the Claude Code status line. `${CLAUDE_PLUGIN_ROOT}` is this plugin's install directory.

## Step 1: Find the runtime

Run `command -v node` (on Windows PowerShell: `(Get-Command node).Source`). The result is `{RUNTIME}`. If nothing is found, stop and tell the user to install Node.js 18+ from https://nodejs.org, restart their shell, and run `/claude-hub:setup` again.

## Step 2: Inspect the current settings

```bash
"{RUNTIME}" "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" inspect
```

It prints JSON with `settingsPath`, `command`, `existing` (`none`, `claude-hub`, `claude-hud`, or `other`), `existingPreview`, and `configExists`. If it fails, show the error and stop. Don't edit settings.json by hand.

If `existing` is `other` or `claude-hud`, ask with AskUserQuestion:

- header: "Statusline"
- question: "You already have a status line: `{existingPreview}`. Replace it with claude-hub? settings.json is backed up first, and `/claude-hub:setup` can restore it later."
- options: "Replace it" / "Keep my current status line"

On "Keep", stop. Only ever show `existingPreview`, never the raw command, because it may contain secrets.

If `existing` is `claude-hud` and `configExists` is false, also ask whether to import the claude-hud display settings. On yes, run `"{RUNTIME}" "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" import-hud`.

## Step 3: Install

```bash
"{RUNTIME}" "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" install
```

This copies a launcher to `<config dir>/plugins/claude-hub/statusline.mjs` (it always runs the newest installed claude-hub), backs up settings.json, saves the replaced statusLine for `uninstall`, and writes `statusLine` while keeping every other setting.

Test it:

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":12,"context_window_size":200000}}' | {COMMAND}
```

`{COMMAND}` is the `command` from the report. It should print two HUD lines. If it errors or prints nothing, show the output, restore settings by copying `backupPath` over `settingsPath`, and stop.

## Step 4: Finish

The HUD shows as soon as settings.json changes. Tell the user in one line that they can change anything by asking (for example "use the dracula theme" or "show tool activity") or with `/claude-hub:configure`, and that `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" uninstall` restores their previous status line.
