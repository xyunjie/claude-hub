import type { HubElement } from '../config.js';
import { ACTIVITY, activityLine, type ActivityElement } from './activity.js';
import { separatorLine, visibleWidth } from './ansi.js';
import { contextBarAndValue, contextLine, tokenBreakdown, usageParts } from './bars.js';
import type { Frame } from './frame.js';
import { cacheHitRateLine, environmentLine, gitFilesLine, memoryLine, promptCacheLine, sessionTimeLine } from './lines.js';
import {
  compactionsPart, configCountParts, customLinePart, headerParts, orderParts, sessionTokensPart, type Part,
} from './parts.js';

const isActivity = (element: HubElement): element is ActivityElement => (ACTIVITY as HubElement[]).includes(element);

function projectLine(f: Frame): string | null {
  const parts = headerParts(f, false);
  const last = customLinePart(f, 'last');
  if (last) parts.push({ key: null, text: last });
  return parts.length > 0 ? orderParts(parts, f.config.projectLineOrder).join(' │ ') : null;
}

function elementLine(f: Frame, element: HubElement, align: boolean): string | null {
  switch (element) {
    case 'project': return projectLine(f);
    case 'context': return contextLine(f, align);
    case 'usage': return usageParts(f, align)?.join(' │ ') ?? null;
    case 'promptCache': return promptCacheLine(f);
    case 'cacheHitRate': return cacheHitRateLine(f);
    case 'memory': return memoryLine(f, align);
    case 'environment': return environmentLine(f);
    case 'sessionTime': return sessionTimeLine(f);
    default: return activityLine(f, element);
  }
}

interface Row {
  line: string;
  activity: boolean;
}

/** One row per element in elementOrder, merging adjacent members of a merge group that fit. */
export function expandedLines(f: Frame): string[] {
  const order = f.config.elementOrder;
  const groupOf = new Map<HubElement, Set<HubElement>>();
  for (const group of f.config.display.mergeGroups) {
    const members = new Set(group);
    for (const element of group) if (!groupOf.has(element)) groupOf.set(element, members);
  }

  const rows: Row[] = [];
  const seen = new Set<HubElement>();
  for (let index = 0; index < order.length; index += 1) {
    const element = order[index];
    if (seen.has(element)) continue;
    const group = groupOf.get(element);
    const run: HubElement[] = [];
    for (let next = index; group && next < order.length && group.has(order[next]) && !seen.has(order[next]); next += 1) {
      run.push(order[next]);
    }
    if (run.length <= 1) {
      seen.add(element);
      const line = elementLine(f, element, false);
      if (line) rows.push({ line, activity: isActivity(element) });
      continue;
    }

    index += run.length - 1;
    run.forEach((member) => seen.add(member));
    const entries = run
      .map((member) => ({ member, line: elementLine(f, member, false) }))
      .filter((entry): entry is { member: HubElement; line: string } => !!entry.line);
    const combined = entries.map(({ line }) => line).join(' │ ');
    if (entries.length === 1 || f.width === null || visibleWidth(combined) <= f.width) {
      if (combined) rows.push({ line: combined, activity: entries.some(({ member }) => isActivity(member)) });
    } else {
      // Too wide to share a row: stack them, with their bar labels aligned.
      for (const { member } of entries) rows.push({ line: elementLine(f, member, true) ?? '', activity: isActivity(member) });
    }
  }

  const lines = rows.map(({ line }) => line);
  for (const extra of [gitFilesLine(f), sessionTokensPart(f), compactionsPart(f)]) if (extra) lines.push(extra);

  const firstActivity = rows.findIndex(({ activity }) => activity);
  if (f.config.showSeparators && firstActivity > 0) {
    const widest = Math.max(...rows.slice(0, firstActivity).map(({ line }) => visibleWidth(line)), 20);
    lines.splice(firstActivity, 0, separatorLine(f.width ? Math.min(widest, f.width) : widest, f.paint.label));
  }
  return lines;
}

/** One dense session line, then the activity lines. */
export function compactLines(f: Frame): string[] {
  const header = headerParts(f, true);
  // The context bar rides with the model badge, so the cluster moves as the 'model' segment.
  const { bar, value } = contextBarAndValue(f);
  const model = header.find((part) => part.key === 'model');
  const cluster = [model?.text, bar, value].filter(Boolean).join(' ');
  const parts: Part[] = model
    ? header.map((part) => (part === model ? { key: 'model', text: cluster } : part))
    : [{ key: 'model', text: cluster }, ...header];

  const add = (text: string | null): void => {
    if (text) parts.push({ key: null, text });
  };
  configCountParts(f).forEach(add);
  (usageParts(f) ?? []).forEach(add);
  add(sessionTokensPart(f));
  add(compactionsPart(f));
  add(sessionTimeLine(f));
  add(promptCacheLine(f));
  add(cacheHitRateLine(f));
  add(customLinePart(f, 'last'));

  const line = orderParts(parts, f.config.projectLineOrder).join(' | ') + tokenBreakdown(f);
  const activity = ACTIVITY.map((element) => activityLine(f, element)).filter((l): l is string => !!l);
  const lines = [line];
  if (f.config.showSeparators && activity.length > 0) {
    const widest = Math.max(visibleWidth(line), 20);
    lines.push(separatorLine(f.width ? Math.min(widest, f.width) : widest, f.paint.label));
  }
  return [...lines, ...activity];
}
