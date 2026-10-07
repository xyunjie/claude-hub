# claude-hub

一个可换主题的 [Claude Code](https://code.claude.com) 实时状态栏。常驻在输入框下方，显示模型、项目与 git 状态、上下文用量、使用率限制、会话时长与费用；开启后还能显示正在运行的工具、子代理和待办进度。

> 🌐 [English](README.md) | 中文文档

```
◆ Opus 5.5 high │ xyunjie/claude-hub ⎇ main * ↑2 │ +312 -48
ctx ━━━━━━━━━─── 72% 144k/200k     │ tok ↑1.7M ↓28k cache 97%               │ cost $2.48
5h  ━━━━━──┼──── 38% →76% ↻2h30m │ 7d  ━━━━━━━┿━━── 82% →164% ▲18h27m ↻3d │ time 1h13m
◐ Edit: src/render/parts.ts │ ✓ Read ×4 │ ✓ Grep ×2
◐ Explore [haiku-4.5]: Finding theme code (1m 15s)
▸ Write the README (1/3)
```

参考并部分改编自 [claude-hud](https://github.com/jarrodwatts/claude-hud)（MIT）。配置键与之兼容，可以直接导入 claude-hud 的配置。

## 风格

风格（`style`）决定外形，主题（`theme`）决定配色，图标（`icons`）决定字形，三者可以自由组合。用 `npm run preview`（或 `node scripts/preview.mjs --style capsule --icons nerd`）预览所有组合。

| `style` | 效果（unicode 图标） |
|---|---|
| `dashboard`（默认） | 身份行（`◆ 模型 强度 │ owner/repo ⎇ 分支 ✓`）加对齐的指标网格：`ctx`/`5h`/`7d` 渐变粗线进度条（细十字 `┼` 标出均速位置）、灰色细节和用量推算、`tok ↑输入 ↓输出 cache %`、`cost`、`time` 及订阅套餐与预计续费（`showAuth`、`showRenewal`）。窄屏时先隐藏 `tok`，再把费用和时长挪到进度条右侧 |
| `lean` | `[Opus 5.5] │ app git:(main*) │ ⏱ 1h 13m │ $2.48` |
| `powerline` | 彩色色块；`icons: "nerd"` 时用 `` 箭头相连 |
| `capsule` | 每段一个彩色胶囊；`icons: "nerd"` 时两端为圆角 |
| `boxed` | lean 内容挂在框线上：`╭─ …` / `├─ …` / `╰─ …` |
| `bracket` | `[Opus 5.5] [app ⎇ main*] [⏱ 1h 13m] [$2.48]` |

| `icons` | |
|---|---|
| `unicode`（默认） | 任何 UTF-8 终端都能正常显示，不需要 Nerd Font |
| `nerd` | Nerd Font 图标，以及 powerline 箭头和胶囊圆角 |
| `ascii` | 纯 ASCII，适合中日韩宽字符终端：`|` 分隔、`#-` 进度条、`^`/`v` 表示领先/落后 |

终端变窄时，先隐藏可选段（改动行数、速度、版本、账号、会话名等），再在段与段之间换行，最后截断。`reserveWidth` 可在右侧预留列宽。

## 与 claude-hud 的区别

- **风格与图标档位**：同一份数据有五种外形，每种都能在有或没有 Nerd Font 的情况下使用（见上）。
- **用量推算**：进度条标出均速应到位置，`→164%` 推算重置时的用量，`▲18h27m` 表示按当前速度多久撞上限额。
- **模型与思考等级配色**：Fable 流光、Opus 主色、Sonnet 低调；思考等级从灰色 `low` 到粗体红 `max`。
- **主题**：`claude`、`lavender`、`default`、`dracula`、`nord`、`catppuccin`、`gruvbox`、`tokyonight`、`mono`，并可按角色覆盖颜色。
- **进度条高度与渐变**：从满格 `solid` █、与文字等高的 `tall` ▇，到 `half` ▄、`line` ━、`thin` ─，逐格渐变着色。
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

用 `npm run preview` 在终端预览所有风格和主题。

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
| `theme` | `claude` | 配色主题：`claude`（橙色主色，真彩色）、`lavender`、`default`（跟随终端 16 色）、`dracula`、`nord`、`catppuccin`、`gruvbox`、`tokyonight`、`mono` |
| `style` | `dashboard` | 外形：`dashboard`、`lean`、`powerline`、`capsule`、`boxed`、`bracket` |
| `icons` | `unicode` | 图标档位：`unicode`、`nerd`、`ascii` |
| `barStyle` | `auto` | 进度条高度与字形：`solid` █（满格）、`tall` ▇（与文字等高）、`block` █░、`half` ▄、`line` ━─、`thin` ─（最扁）、`shade`、`dot`、`square`、`bead`、`ascii`。`auto` 时 dashboard 用 `line`，其他用 `block` |
| `barColor` | `gradient` | `gradient` 每格沿主题色带渐变（`claude` 为青→绿→黄→橙→红），百分比也按位置取色；`band` 整条按级别着色。16 色主题始终用 band |
| `reserveWidth` | `0` | 右侧预留列数，例如 `40` 留给 Claude Code 的提示 |
| `lineLayout` | `expanded` | `expanded` 多行，`compact` 单行 |
| `display.showDuration` / `showCost` | `true` | 会话时长 / 费用 |
| `display.showDailyCost` / `showWeeklyCost` | `false` | 今日 / 本周所有会话总花费 |
| `display.showLinesChanged` | `false` | 本次会话增删行数 |
| `display.showAuth` / `showAuthUser` | `false` | 订阅套餐（Pro / Max 5x / Max 20x）/ 账号；dashboard 中显示在用量行 |
| `display.showRenewal` | `false` | `续费 ~23d`：距订阅开始日下一个月度周年日的天数。仅为估算，本地不记录年付、换套餐或取消 |
| `display.usagePace` | `true` | 按当前速度推算：进度条中标出均速应到位置，`→76%` 为重置时的预计用量（90% 起变黄，超过 100% 变红），`▲38m` 为预计多久撞上限额 |
| `display.modelColors` | `true` | 按模型着色（Fable 带 `✦` 流光渐变、Opus 主色、Sonnet 低调灰、Haiku 浅色），思考等级按强度着色（low 灰、medium 蓝、high 绿、xhigh 橙、max 粗体红、ultracode 流光） |
| `display.showTools` / `showAgents` / `showTodos` | `false` | 活动行 |
| `colors.<角色>` | 主题值 | 颜色名、256 色序号或 `#rrggbb` |

## 开发

```bash
npm install
npm test          # 构建 dist/ 并运行 node --test
npm run preview   # 用示例数据展示所有风格 × 主题
```

`dist/` 会提交到仓库，插件克隆后即可运行；提交前请重新构建。需要 Node.js 18+。

## 许可证

MIT
