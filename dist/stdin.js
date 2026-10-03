import { cleanText } from './utils/sanitize.js';
const NO_DATA_TIMEOUT_MS = 250;
const MAX_STDIN_BYTES = 256 * 1024;
// Null for a TTY (a manual run), no input, oversized input, or invalid JSON. Resolves as
// soon as the buffered text parses, in case the writer leaves stdin open.
export function readStdin(stream = process.stdin) {
    if (stream.isTTY)
        return Promise.resolve(null);
    return new Promise((resolve) => {
        let raw = '';
        let done = false;
        const finish = (value) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            stream.pause();
            resolve(value);
        };
        const parse = () => {
            try {
                const value = JSON.parse(raw);
                return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
            }
            catch {
                return null;
            }
        };
        const timer = setTimeout(() => {
            if (!raw)
                finish(null);
        }, NO_DATA_TIMEOUT_MS);
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > MAX_STDIN_BYTES)
                return finish(null);
            const parsed = parse();
            if (parsed)
                finish(parsed);
        });
        stream.on('end', () => finish(parse()));
        stream.on('error', () => finish(null));
    });
}
export function liveContextTokens(stdin) {
    const usage = stdin.context_window?.current_usage;
    return (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
}
const toPercent = (value) => Math.min(100, Math.max(0, Math.round(value)));
// Claude Code's used_percentage when it reports one. It reads 0 or null before the first
// response and after /compact, so fall back to current_usage, then the transcript.
export function contextUsage(stdin, autoCompactWindow, transcriptTokens) {
    const live = liveContextTokens(stdin);
    const tokens = live > 0 ? live : transcriptTokens ?? 0;
    if (autoCompactWindow && autoCompactWindow > 0) {
        return { percent: toPercent((tokens / autoCompactWindow) * 100), tokens, size: autoCompactWindow };
    }
    const size = stdin.context_window?.context_window_size ?? 0;
    const native = stdin.context_window?.used_percentage;
    if (typeof native === 'number' && Number.isFinite(native) && native > 0) {
        return { percent: toPercent(native), tokens, size };
    }
    return { percent: size > 0 ? toPercent((tokens / size) * 100) : 0, tokens, size };
}
export function isContextUnreported(stdin) {
    const native = stdin.context_window?.used_percentage;
    return !(typeof native === 'number' && native > 0) && liveContextTokens(stdin) === 0;
}
const isClaudeModel = (id) => /^(claude-|anthropic\.)/i.test(id);
// "stdin" shows what Claude Code requested, "transcript" what the API served, and "auto"
// switches to the served model only when a proxy swapped in a non-Claude model.
export function modelName(stdin, transcript, source) {
    const requested = cleanText(stdin.model?.display_name) ?? cleanText(stdin.model?.id) ?? 'Unknown';
    const served = transcript?.servedModel;
    if (source === 'stdin' || !served)
        return requested;
    if (source === 'transcript')
        return served;
    return isClaudeModel(served) ? requested : served;
}
/** `compact` drops the "(1M context)" suffix; `short` also drops a leading "Claude ". */
export function formatModelName(name, format) {
    if (format === 'full')
        return name;
    const compact = name.replace(/\s*\([^)]*\bcontext\b[^)]*\)/i, '').trim();
    return format === 'short' ? compact.replace(/^Claude\s+/i, '') : compact;
}
const ENTERPRISE_MODEL_IDS = new Set(['opusplan', 'sonnetplan', 'haikuplan']);
export function providerLabel(stdin, env = process.env) {
    if (env.CLAUDE_CODE_USE_BEDROCK === '1')
        return 'Bedrock';
    if (env.CLAUDE_CODE_USE_VERTEX === '1')
        return 'Vertex';
    if (env.CLAUDE_CODE_USE_FOUNDRY === '1')
        return 'Foundry';
    if (ENTERPRISE_MODEL_IDS.has(stdin.model?.id?.toLowerCase() ?? ''))
        return 'Enterprise';
    return null;
}
/** Bedrock (`anthropic.claude-…`) and Vertex (`…@2024…`) bill through the cloud provider. */
export function isRoutedModel(id) {
    return !!id && (id.toLowerCase().includes('anthropic.claude-') || id.includes('@'));
}
const percent = (value) => typeof value === 'number' && Number.isFinite(value) ? toPercent(value) : null;
const resetAt = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value * 1000) : null;
export function usageFromStdin(stdin) {
    const limits = stdin.rate_limits;
    const fiveHour = percent(limits?.five_hour?.used_percentage);
    const sevenDay = percent(limits?.seven_day?.used_percentage);
    if (fiveHour === null && sevenDay === null)
        return null;
    return {
        fiveHour,
        sevenDay,
        fiveHourResetAt: resetAt(limits?.five_hour?.resets_at),
        sevenDayResetAt: resetAt(limits?.seven_day?.resets_at),
    };
}
/** Claude Code's own session cost; routed providers only with `allowRouted`, and once positive. */
export function sessionCostUsd(stdin, allowRouted) {
    const cost = stdin.cost?.total_cost_usd;
    if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0)
        return null;
    if (isRoutedModel(stdin.model?.id) && (!allowRouted || cost === 0))
        return null;
    return cost;
}
const EFFORT_SYMBOLS = { low: '○', medium: '◔', high: '◑', xhigh: '◕', max: '●' };
// stdin reports ultracode as an ordinary level, so the transcript marker distinguishes it.
export function effortLevel(stdin, ultracode) {
    const level = cleanText(stdin.effort?.level, 32)?.toLowerCase();
    if (!level)
        return null;
    const symbol = EFFORT_SYMBOLS[level] ?? '';
    return ultracode ? { level: `ultracode(${level})`, symbol } : { level, symbol };
}
//# sourceMappingURL=stdin.js.map