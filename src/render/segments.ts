import type { HubElement, ProjectSegment, Style } from '../config.js';
import type { ColorRole } from '../themes.js';
import { truncateToWidth, visibleWidth } from './ansi.js';
import { RESET } from './colors.js';
import type { Frame } from './frame.js';

/**
 * One piece of a row. Each style draws the same segments differently: lean, boxed and
 * bracket use `text`; powerline and capsule put `plain` on a block of `role`'s color.
 */
export interface Segment {
  /** Lets projectLineOrder move it; null keeps its slot. */
  key: ProjectSegment | HubElement | null;
  /** Colored foreground text. */
  text: string;
  /** Uncolored text for a colored block. */
  plain: string;
  role: ColorRole;
  /** 0 is never dropped; higher numbers are dropped first on narrow terminals. */
  priority: number;
  /** Lean and boxed join it to the previous segment with a space instead of a separator. */
  glue?: boolean;
}

export const segment = (
  key: Segment['key'], text: string, plain: string, role: ColorRole, priority: number, glue = false,
): Segment => ({ key, text, plain, role, priority, glue });

function lean(f: Frame, segments: Segment[]): string {
  const separator = f.paint.label(f.icons.separator.trim());
  return segments.map((s, i) => (i === 0 ? s.text : s.glue ? ` ${s.text}` : ` ${separator} ${s.text}`)).join('');
}

// Each group of glued segments sits in its own brackets, drawn in the segment's color.
function bracket(f: Frame, segments: Segment[]): string {
  const groups: string[][] = [];
  for (const s of segments) {
    const text = f.paint[s.role](s.plain);
    if (s.glue && groups.length > 0) groups[groups.length - 1].push(text);
    else groups.push([text]);
  }
  return groups.map((g) => `${f.paint.label('[')}${g.join(' ')}${f.paint.label(']')}`).join(' ');
}

// Each segment is a colored block. With a Nerd Font, an arrow drawn in the previous
// block's color on the next block's background joins them; without one the blocks abut.
function powerline(f: Frame, segments: Segment[]): string {
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
  if (last && f.icons.arrow) out += `${f.paint.block(last.role).asFg}${f.icons.arrow}${RESET}`;
  return out;
}

// Each segment is a pill: rounded caps with a Nerd Font, square ends without.
function capsule(f: Frame, segments: Segment[]): string {
  return segments.map((s) => {
    const block = f.paint.block(s.role);
    const left = f.icons.capLeft ? `${block.asFg}${f.icons.capLeft}${RESET}` : '';
    const right = f.icons.capRight ? `${block.asFg}${f.icons.capRight}${RESET}` : '';
    const pad = f.icons.capLeft ? '' : ' ';
    return `${left}${block.bg}${block.text}${pad}${s.plain}${pad}${RESET}${right}`;
  }).join(' ');
}

export function drawRow(f: Frame, segments: Segment[], style: Style = f.config.style): string {
  if (segments.length === 0) return '';
  switch (style) {
    case 'powerline': return powerline(f, segments);
    case 'capsule': return capsule(f, segments);
    case 'bracket': return bracket(f, segments);
    default: return lean(f, segments);
  }
}

/** Glued segments travel together when a row is split or trimmed. */
function groupsOf(segments: Segment[]): Segment[][] {
  const groups: Segment[][] = [];
  for (const s of segments) {
    if (s.glue && groups.length > 0) groups[groups.length - 1].push(s);
    else groups.push([s]);
  }
  return groups;
}

/**
 * Fits a row into `width`: drops the most optional segments (priority 3 and up) first,
 * then wraps between segments, then truncates any line that still overflows.
 */
export function fitRow(f: Frame, segments: Segment[], width: number | null): string[] {
  if (segments.length === 0) return [];
  if (width === null) return [drawRow(f, segments)];

  let kept = [...segments];
  while (visibleWidth(drawRow(f, kept)) > width) {
    const optional = kept.filter((s) => s.priority >= 3);
    if (optional.length === 0) break;
    const worst = optional.reduce((a, b) => (b.priority >= a.priority ? b : a));
    kept = kept.filter((s) => s !== worst);
  }

  const lines: string[] = [];
  let current: Segment[] = [];
  for (const group of groupsOf(kept)) {
    const candidate = [...current, ...group];
    if (current.length > 0 && visibleWidth(drawRow(f, candidate)) > width) {
      lines.push(drawRow(f, current));
      // A continuation line starts fresh, so a glued head must not hang off nothing.
      current = group.map((s, i) => (i === 0 ? { ...s, glue: false } : s));
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(drawRow(f, current));
  return lines.map((line) => truncateToWidth(line, width, f.icons.ellipsis));
}

/** Applies projectLineOrder: keyed segments move, unkeyed ones keep their slots. */
export function orderSegments(segments: Segment[], order: readonly string[]): Segment[] {
  const slots: number[] = [];
  const byKey = new Map<string, Segment[]>();
  segments.forEach((s, index) => {
    if (s.key === null) return;
    slots.push(index);
    byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
  });
  const reordered: Segment[] = [];
  for (const key of order) {
    reordered.push(...(byKey.get(key) ?? []));
    byKey.delete(key);
  }
  for (const list of byKey.values()) reordered.push(...list);
  const result = [...segments];
  slots.forEach((slot, i) => {
    result[slot] = reordered[i];
  });
  return result;
}
