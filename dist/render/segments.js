import { truncateToWidth, visibleWidth } from './ansi.js';
import { RESET } from './colors.js';
export const segment = (key, text, plain, role, priority, glue = false) => ({ key, text, plain, role, priority, glue });
function lean(f, segments) {
    const separator = f.paint.label(f.icons.separator.trim());
    return segments.map((s, i) => (i === 0 ? s.text : s.glue ? ` ${s.text}` : ` ${separator} ${s.text}`)).join('');
}
// Each group of glued segments sits in its own brackets, drawn in the segment's color.
function bracket(f, segments) {
    const groups = [];
    for (const s of segments) {
        const text = f.paint[s.role](s.plain);
        if (s.glue && groups.length > 0)
            groups[groups.length - 1].push(text);
        else
            groups.push([text]);
    }
    return groups.map((g) => `${f.paint.label('[')}${g.join(' ')}${f.paint.label(']')}`).join(' ');
}
// Each segment is a colored block. With a Nerd Font, an arrow drawn in the previous
// block's color on the next block's background joins them; without one the blocks abut.
function powerline(f, segments) {
    let out = '';
    segments.forEach((s, i) => {
        const block = f.paint.block(s.role);
        if (i > 0 && f.icons.arrow) {
            const prev = f.paint.block(segments[i - 1].role);
            out += `${prev.asFg}${block.bg}${f.icons.arrow}${RESET}`;
        }
        out += `${block.bg}${block.text} ${s.plain} ${RESET}`;
    });
    const last = segments.at(-1);
    if (last && f.icons.arrow)
        out += `${f.paint.block(last.role).asFg}${f.icons.arrow}${RESET}`;
    return out;
}
// Each segment is a pill: rounded caps with a Nerd Font, square ends without.
function capsule(f, segments) {
    return segments.map((s) => {
        const block = f.paint.block(s.role);
        const left = f.icons.capLeft ? `${block.asFg}${f.icons.capLeft}${RESET}` : '';
        const right = f.icons.capRight ? `${block.asFg}${f.icons.capRight}${RESET}` : '';
        const pad = f.icons.capLeft ? '' : ' ';
        return `${left}${block.bg}${block.text}${pad}${s.plain}${pad}${RESET}${right}`;
    }).join(' ');
}
export function drawRow(f, segments, style = f.config.style) {
    if (segments.length === 0)
        return '';
    switch (style) {
        case 'powerline': return powerline(f, segments);
        case 'capsule': return capsule(f, segments);
        case 'bracket': return bracket(f, segments);
        default: return lean(f, segments);
    }
}
/** Glued segments travel together when a row is split or trimmed. */
function groupsOf(segments) {
    const groups = [];
    for (const s of segments) {
        if (s.glue && groups.length > 0)
            groups[groups.length - 1].push(s);
        else
            groups.push([s]);
    }
    return groups;
}
/**
 * Fits a row into `width`: drops the most optional segments (priority 3 and up) first,
 * then wraps between segments, then truncates any line that still overflows.
 */
export function fitRow(f, segments, width) {
    if (segments.length === 0)
        return [];
    if (width === null)
        return [drawRow(f, segments)];
    let kept = [...segments];
    while (visibleWidth(drawRow(f, kept)) > width) {
        const optional = kept.filter((s) => s.priority >= 3);
        if (optional.length === 0)
            break;
        const worst = optional.reduce((a, b) => (b.priority >= a.priority ? b : a));
        kept = kept.filter((s) => s !== worst);
    }
    const lines = [];
    let current = [];
    for (const group of groupsOf(kept)) {
        const candidate = [...current, ...group];
        if (current.length > 0 && visibleWidth(drawRow(f, candidate)) > width) {
            lines.push(drawRow(f, current));
            // A continuation line starts fresh, so a glued head must not hang off nothing.
            current = group.map((s, i) => (i === 0 ? { ...s, glue: false } : s));
        }
        else {
            current = candidate;
        }
    }
    if (current.length > 0)
        lines.push(drawRow(f, current));
    return lines.map((line) => truncateToWidth(line, width, f.icons.ellipsis));
}
/** Applies projectLineOrder: keyed segments move, unkeyed ones keep their slots. */
export function orderSegments(segments, order) {
    const slots = [];
    const byKey = new Map();
    segments.forEach((s, index) => {
        if (s.key === null)
            return;
        slots.push(index);
        byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
    });
    const reordered = [];
    for (const key of order) {
        reordered.push(...(byKey.get(key) ?? []));
        byKey.delete(key);
    }
    for (const list of byKey.values())
        reordered.push(...list);
    const result = [...segments];
    slots.forEach((slot, i) => {
        result[slot] = reordered[i];
    });
    return result;
}
//# sourceMappingURL=segments.js.map