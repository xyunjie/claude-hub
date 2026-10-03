# CLAUDE.md

claude-hub is a Claude Code status line plugin: Claude Code pipes session JSON to `dist/index.js` on stdin and shows what it prints.

## Commands

```bash
npm test          # builds dist/, then node --test
npm run demo      # every theme with sample data
node scripts/setup.mjs install --dev   # run this checkout as your status line
```

## Layout

- `src/index.ts` gathers data in parallel (only what enabled elements need); all I/O happens there and in the collector modules (`transcript.ts`, `git.ts`, `config-counts.ts`, `memory.ts`, `speed.ts`, `daily-cost.ts`, `auth.ts`).
- `src/render/` is pure: `frame.ts` samples clock, width, and palette once; `parts.ts`, `bars.ts`, `lines.ts`, `activity.ts` build pieces; `layouts.ts` arranges them; `ansi.ts` measures and wraps.
- `src/config.ts`: `DEFAULT_CONFIG` is the schema, `RULES` validates non-boolean keys. Keep keys compatible with claude-hud where they overlap.
- `src/themes.ts`: palettes, bar styles, color parsing.

## Rules

- Sanitize any text from stdin, the transcript, git, or config before printing (`utils/sanitize.ts`).
- New display elements are opt-in; the default HUD stays two lines.
- Commit `dist/` rebuilt with the source change, since the plugin runs from the repo.
- Document new config keys in both READMEs.
