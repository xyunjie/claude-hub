# claude-hub

一个可换主题的 [Claude Code](https://code.claude.com) 实时状态栏。常驻在输入框下方，显示模型、项目与 git 状态、上下文用量、使用率限制、会话时长与费用；开启后还能显示正在运行的工具、子代理和待办进度。

> 🌐 [English](README.md) | 中文文档

```
[Opus 5.5 ◑ high] │ claude-hub git:(main* ↑2) │ ⏱ 1h 13m │ $2.48 │ +312 -48
Context ███████░░░ 72% │ Usage ████░░░░░░ 38% (resets in 1h 30m) │ Weekly ████████░░ 82% ▲ (resets in 3d)
◐ Edit: src/render/parts.ts | ✓ Read ×4 | ✓ Grep ×2
◐ Explore [haiku-4.5]: Finding theme code (1m 15s)
▸ Write the README (1/3)
```

参考并部分改编自 [claude-hud](https://github.com/jarrodwatts/claude-hud)（MIT）。配置键与之兼容，可以直接导入 claude-hud 的配置。

## 与 claude-hud 的区别

- **主题**：`default`、`dracula`、`nord`、`catppuccin`、`gruvbox`、`tokyonight`、`mono`，并可按角色覆盖颜色。
- **进度条样式**：`block` █░、`shade` ▓░、`line` ━─、`dot` ●○、`square` ■□。
- **默认显示会话时长与费用**：`⏱ 1h 13m │ $2.48`，可选显示改动行数（`+312 -48`）、今日与本周花费。
- **失败工具**：某个工具全部调用都失败时显示 `✗` 而不是 `✓`。
- **transcript 缓存**：按文件大小和修改时间缓存解析结果，两轮对话之间的刷新不再重复读取。
- **卸载**：`setup.mjs uninstall` 会恢复被替换的原状态栏。

## 安装

### 作为插件

```
/plugin marketplace add xyunjie/claude-hub
/plugin install claude-hub
/reload-plugins
/claude-hub:setup
```

### 从本地仓库

```bash
git clone https://github.com/xyunjie/claude-hub.git && cd claude-hub
npm install && npm run build
node scripts/setup.mjs install --dev      # 让状态栏直接运行这个仓库
node scripts/setup.mjs import-hud         # 可选：导入 claude-hud 的显示设置
```

`install` 会备份 `settings.json`、保留你的 `refreshInterval`，并保存被替换的状态栏；`node scripts/setup.mjs uninstall` 可恢复。设置 `CLAUDE_HUB_DISABLE=1` 可在单个会话中隐藏 HUD。

用 `npm run demo`（或 `node scripts/demo.mjs nord`）在终端预览所有主题。

## 配置

运行 `/claude-hub:configure`、直接告诉 Claude（"换成 nord 主题"、"显示工具活动"），或编辑 `~/.claude/plugins/claude-hub/config.json`（设置了 `$CLAUDE_CONFIG_DIR` 时在其下）。无效值会回退为默认值。`$CLAUDE_CONFIG_DIR/claude-hub.json` 结构相同，会叠加在上面，用于按配置目录覆盖。

```json
{
  "theme": "catppuccin",
  "barStyle": "dot",
  "language": "zh-Hans",
  "gitStatus": { "showAheadBehind": true },
  "display": { "showTools": true, "showAgents": true, "showTodos": true, "showLinesChanged": true },
  "colors": { "model": "#ff79c6" }
}
```

界面语言默认英文（`en`），可设为 `zh-Hans`（简体）或 `zh-Hant`（繁体）。

全部选项见 [README.md 的 Configure 一节](README.md#configure)，键名和含义两份文档一致。常用项：

| 键 | 默认值 | 说明 |
|---|---|---|
| `theme` | `default` | 配色主题，`default` 跟随终端配色 |
| `barStyle` | `block` | 进度条样式 |
| `lineLayout` | `expanded` | `expanded` 多行，`compact` 单行 |
| `display.showDuration` / `showCost` | `true` | 会话时长 / 费用 |
| `display.showDailyCost` / `showWeeklyCost` | `false` | 今日 / 本周所有会话总花费 |
| `display.showLinesChanged` | `false` | 本次会话增删行数 |
| `display.usagePace` | `false` | 按当前速度会在重置前用完时变色并显示 `▲` |
| `display.showTools` / `showAgents` / `showTodos` | `false` | 活动行 |
| `colors.<角色>` | 主题值 | 颜色名、256 色序号或 `#rrggbb` |

## 开发

```bash
npm install
npm test          # 构建 dist/ 并运行 node --test
npm run demo      # 用示例数据展示所有主题
```

`dist/` 会提交到仓库，插件克隆后即可运行；提交前请重新构建。需要 Node.js 18+。

## 许可证

MIT
