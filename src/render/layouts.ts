import type { HubElement } from '../config.js';
import { ACTIVITY, activityLine, type ActivityElement } from './activity.js';
import { separatorLine, visibleWidth, wrapToWidth } from './ansi.js';
import { contextSegment, usageSegments } from './bars.js';
import type { Frame } from './frame.js';
import {
  cacheHitSegment, environmentSegments, gitFilesLine, memorySegment, promptCacheSegment, sessionTimeSegments,
} from './lines.js';
import {
  compactionsSegment, configCountSegments, customSegment, headerSegments, sessionTokensSegment,
} from './parts.js';
import { fitRow, orderSegments, type Segment } from './segments.js';

const isActivity = (element: HubElement): element is ActivityElement => (ACTIVITY as HubElement[]).includes(element);
const present = <T>(items: Array<T | null>): T[] => items.filter((item): item is T => item !== null);

function projectSegments(f: Frame): Segment[] {
  const segments = headerSegments(f, false);
  const last = customSegment(f, 'last');
  if (last) segments.push(last);
  return orderSegments(segments, f.config.projectLineOrder);
}

function elementSegments(f: Frame, element: HubElement): Segment[] {
  switch (element) {
    case 'project': return projectSegments(f);
    case 'context': return [contextSegment(f)];
    case 'usage': return usageSegments(f);
    case 'promptCache': return present([promptCacheSegment(f)]);
    case 'cacheHitRate': return present([cacheHitSegment(f)]);
    case 'memory': return present([memorySegment(f)]);
    case 'environment': return environmentSegments(f);
    case 'sessionTime': return sessionTimeSegments(f);
    default: return [];
  }
}

/** Width a row may use: the frame's, less the boxed prefix. */
export function rowWidth(f: Frame): number | null {
  if (f.width === null) return null;
  return f.config.style === 'boxed' ? f.width - visibleWidth(f.icons.frame[0]) : f.width;
}

interface Row {
  lines: string[];
  activity: boolean;
}

const textRow = (f: Frame, text: string, activity: boolean): Row => ({
  lines: text.split('\n').flatMap((line) => wrapToWidth(line, rowWidth(f) ?? 0)),
  activity,
});

function withSeparator(f: Frame, rows: Row[]): string[] {
  const lines = rows.flatMap((row) => row.lines);
  const firstActivity = rows.findIndex((row) => row.activity);
  if (!f.config.showSeparators || firstActivity <= 0) return lines;
  const before = rows.slice(0, firstActivity).flatMap((row) => row.lines);
  const widest = Math.max(...before.map((line) => visibleWidth(line)), 20);
  const width = rowWidth(f);
  lines.splice(before.length, 0, separatorLine(width ? Math.min(widest, width) : widest, f.paint.label));
  return lines;
}

/** One row per element in elementOrder; adjacent members of a merge group share a row. */
export function expandedLines(f: Frame): string[] {
  const order = f.config.elementOrder;
  const groupOf = new Map<HubElement, Set<HubElement>>();
  for (const group of f.config.display.mergeGroups) {
    const members = new Set(group);
    for (const element of group) if (!groupOf.has(element)) groupOf.set(element, members);
  }

  const rows: Row[] = [];
  const width = rowWidth(f);
  for (let index = 0; index < order.length; index += 1) {
    const element = order[index];
    if (isActivity(element)) {
      const line = activityLine(f, element);
      if (line) rows.push(textRow(f, line, true));
      continue;
    }
    const group = groupOf.get(element);
    const run: HubElement[] = [element];
    while (group && index + 1 < order.length && group.has(order[index + 1]) && !isActivity(order[index + 1])) {
      run.push(order[index + 1]);
      index += 1;
    }
    const segments = run.flatMap((member) => elementSegments(f, member));
    if (segments.length > 0) rows.push({ lines: fitRow(f, segments, width), activity: false });
  }

  const gitFiles = gitFilesLine(f);
  if (gitFiles) rows.push(textRow(f, gitFiles, false));
  const extra = present([sessionTokensSegment(f), compactionsSegment(f)]);
  if (extra.length > 0) rows.push({ lines: fitRow(f, extra, width), activity: false });
  return withSeparator(f, rows);
}

/** One dense row, the context bar riding with the model, then the activity lines. */
export function compactLines(f: Frame): string[] {
  const header = headerSegments(f, true);
  const modelAt = header.findIndex((s) => s.key === 'model');
  const context = contextSegment(f, true);
  // Keyed 'model' so projectLineOrder moves the bar with the badge.
  context.key = 'model';
  header.splice(modelAt + 1, 0, context);

  const segments = [
    ...header,
    ...configCountSegments(f),
    ...usageSegments(f, true),
    ...present([sessionTokensSegment(f), compactionsSegment(f)]),
    ...sessionTimeSegments(f),
    ...present([promptCacheSegment(f), cacheHitSegment(f), customSegment(f, 'last')]),
  ];
  const rows: Row[] = [{ lines: fitRow(f, orderSegments(segments, f.config.projectLineOrder), rowWidth(f)), activity: false }];
  for (const element of ACTIVITY) {
    const line = activityLine(f, element);
    if (line) rows.push(textRow(f, line, true));
  }
  return withSeparator(f, rows);
}
