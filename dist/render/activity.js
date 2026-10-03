import { t } from '../i18n/index.js';
import { formatSpan } from '../utils/format.js';
import { sanitize, truncate } from '../utils/sanitize.js';
export const ACTIVITY = ['tools', 'skills', 'mcp', 'agents', 'todos'];
// MCP tools show only their tool name: mcp__github__create_issue → create_issue.
const toolName = (name) => {
    const safe = sanitize(name);
    return /^mcp__.+__.+$/.test(safe) ? safe.split('__').pop() ?? safe : safe;
};
function shortenPath(target, ellipsis, max = 20) {
    const normalized = sanitize(target).replace(/\\/g, '/');
    if (normalized.length <= max)
        return normalized;
    const file = normalized.split('/').pop() || normalized;
    return file.length >= max ? `${file.slice(0, max - ellipsis.length)}${ellipsis}` : `${ellipsis}/${file}`;
}
/** `◐ Edit: auth.ts | ✓ Read ×3 | ✓ Grep ×2`: the two newest running tools, then completed counts. */
function toolsLine(f) {
    const { paint } = f;
    // With a skills line, Skill invocations live there instead.
    const tools = f.config.display.showSkills ? f.transcript.tools.filter((tool) => tool.name !== 'Skill') : f.transcript.tools;
    const maxVisible = f.config.display.toolsMaxVisible;
    const parts = tools
        .filter((tool) => tool.status === 'running')
        .slice(-2)
        .map((tool) => `${paint.running(f.icons.running)} ${paint.tool(toolName(tool.name))}${tool.target ? paint.label(`: ${shortenPath(tool.target, f.icons.ellipsis)}`) : ''}`);
    const counts = new Map();
    for (const tool of tools) {
        if (tool.status === 'running')
            continue;
        const entry = counts.get(tool.name) ?? { done: 0, errors: 0 };
        entry.done += 1;
        if (tool.status === 'error')
            entry.errors += 1;
        counts.set(tool.name, entry);
    }
    const sorted = [...counts].sort((a, b) => b[1].done - a[1].done);
    const visible = maxVisible === 0 ? sorted : sorted.slice(0, maxVisible);
    for (const [name, { done, errors }] of visible) {
        const icon = errors === done ? paint.critical(f.icons.error) : paint.success(f.icons.done);
        parts.push(`${icon} ${toolName(name)} ${paint.label(`${f.config.icons === 'ascii' ? 'x' : '×'}${done}`)}`);
    }
    if (sorted.length > visible.length)
        parts.push(paint.label(t('format.more', { count: sorted.length - visible.length })));
    return parts.length > 0 ? parts.join(` ${paint.label(f.icons.separator.trim())} `) : null;
}
/** `✓ Skills (5): a, b, c, d, +1 more`. */
function namesLine(f, title, names, maxVisible) {
    const { paint } = f;
    if (names.length === 0)
        return null;
    const shown = (maxVisible === 0 ? names : names.slice(0, maxVisible)).map((name) => paint.tool(name));
    if (names.length > shown.length)
        shown.push(paint.label(t('format.more', { count: names.length - shown.length })));
    return `${paint.success(f.icons.done)} ${title} ${paint.label(`(${names.length})`)}: ${shown.join(', ')}`;
}
const MAX_AGENTS = 3;
const MAX_RECENT = 2;
const RECENT_MS = 60_000;
/** `claude-haiku-4-5-20251001` → `haiku-4.5`; aliases and unknown ids pass through. */
export function shortModel(model) {
    const id = model?.trim().replace(/\[[^\]]*\]$/, '');
    if (!id)
        return undefined;
    const current = id.match(/^claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d+))?(?:-\d{8})?$/i);
    if (current)
        return `${current[1].toLowerCase()}-${current[2]}${current[3] ? `.${current[3]}` : ''}`;
    const legacy = id.match(/^claude-(\d+)(?:-(\d+))?-(opus|sonnet|haiku)(?:-\d{8})?$/i);
    if (legacy)
        return `${legacy[3].toLowerCase()}-${legacy[1]}${legacy[2] ? `.${legacy[2]}` : ''}`;
    return id;
}
/** Up to three agents: running ones first, then those that finished in the last minute. */
function agentsLine(f) {
    const { paint } = f;
    const running = f.transcript.agents.filter((agent) => agent.status === 'running').slice(-MAX_AGENTS);
    const slots = Math.min(MAX_RECENT, MAX_AGENTS - running.length);
    const recent = f.transcript.agents.filter((agent) => {
        const ended = agent.endTime?.getTime();
        return agent.status === 'completed' && ended !== undefined && ended <= f.now && f.now - ended <= RECENT_MS;
    });
    const shown = [...running, ...(slots > 0 ? recent.slice(-slots) : [])];
    if (shown.length === 0)
        return null;
    return shown.map((agent) => {
        const icon = agent.status === 'running' ? paint.running(f.icons.running) : paint.success(f.icons.done);
        const model = shortModel(agent.model);
        const description = truncate(agent.description?.trim(), 40, f.icons.ellipsis);
        const elapsed = formatSpan(Math.max(0, (agent.endTime?.getTime() ?? f.now) - agent.startTime.getTime()));
        return `${icon} ${paint.agent(agent.type)}${model ? ` ${paint.label(`[${model}]`)}` : ''}`
            + `${description ? paint.label(`: ${description}`) : ''} ${paint.label(`(${elapsed})`)}`;
    }).join('\n');
}
/** `▸ Fix the bug (2/5)`, or `✓ All todos complete (5/5)`. */
function todosLine(f) {
    const { paint } = f;
    const todos = f.transcript.todos;
    if (todos.length === 0)
        return null;
    const done = todos.filter((todo) => todo.status === 'completed').length;
    const progress = paint.label(`(${done}/${todos.length})`);
    const current = todos.find((todo) => todo.status === 'in_progress');
    if (current)
        return `${paint.running(f.icons.todo)} ${truncate(current.content, 50, f.icons.ellipsis)} ${progress}`;
    return done === todos.length ? `${paint.success(f.icons.done)} ${t('status.allTodosDone')} ${progress}` : null;
}
export function activityLine(f, element) {
    const d = f.config.display;
    switch (element) {
        case 'tools': return d.showTools ? toolsLine(f) : null;
        case 'skills': return d.showSkills ? namesLine(f, t('label.skills'), f.transcript.skills, 4) : null;
        case 'mcp': return d.showMcp ? namesLine(f, t('label.mcps'), f.transcript.mcpServers, 4) : null;
        case 'agents': return d.showAgents ? agentsLine(f) : null;
        case 'todos': return d.showTodos ? todosLine(f) : null;
    }
}
//# sourceMappingURL=activity.js.map