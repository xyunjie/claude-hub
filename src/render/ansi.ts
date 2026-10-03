import { isCjk } from '../i18n/index.js';
import { RESET } from './colors.js';

// CSI sequences, and OSC sequences ended by BEL or ESC \.
const ESCAPE_AT = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))/y;
const OSC8 = /\x1b\]8;;([^\x07\x1b]*)(?:\x07|\x1b\\)/g;
const OSC8_CLOSE = '\x1b]8;;\x1b\\';
const SEPARATOR = / \| | │ /g;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

interface Token {
  text: string;
  escape: boolean;
}

function tokenize(str: string): Token[] {
  const tokens: Token[] = [];
  let start = 0;
  let index = str.indexOf('\x1b');
  while (index !== -1) {
    ESCAPE_AT.lastIndex = index;
    const match = ESCAPE_AT.exec(str);
    if (!match) {
      index = str.indexOf('\x1b', index + 1);
      continue;
    }
    if (index > start) tokens.push({ text: str.slice(start, index), escape: false });
    tokens.push({ text: match[0], escape: true });
    start = index + match[0].length;
    index = str.indexOf('\x1b', start);
  }
  if (start < str.length) tokens.push({ text: str.slice(start), escape: false });
  return tokens;
}

function isWide(cp: number): boolean {
  return cp >= 0x1100 && (
    cp <= 0x115F || cp === 0x2329 || cp === 0x232A
    || (cp >= 0x2E80 && cp <= 0xA4CF && cp !== 0x303F)
    || (cp >= 0xAC00 && cp <= 0xD7A3)
    || (cp >= 0xF900 && cp <= 0xFAFF)
    || (cp >= 0xFE10 && cp <= 0xFE19)
    || (cp >= 0xFE30 && cp <= 0xFE6F)
    || (cp >= 0xFF00 && cp <= 0xFF60)
    || (cp >= 0xFFE0 && cp <= 0xFFE6)
    || (cp >= 0x1F300 && cp <= 0x1FAFF)
    || (cp >= 0x20000 && cp <= 0x3FFFD)
  );
}

// East Asian Ambiguous ranges the HUD emits (box drawing, blocks, arrows, shapes).
const isAmbiguous = (cp: number): boolean =>
  (cp >= 0x2010 && cp <= 0x2027) || (cp >= 0x2030 && cp <= 0x205E) || (cp >= 0x2190 && cp <= 0x23FF)
  || (cp >= 0x2460 && cp <= 0x24FF) || (cp >= 0x2500 && cp <= 0x27BF);

function graphemeWidth(grapheme: string, ambiguousWide: boolean): number {
  if (/^\p{Control}$/u.test(grapheme)) return 0;
  if (/\p{Extended_Pictographic}/u.test(grapheme)) return 2;
  let width = 0;
  for (const char of grapheme) {
    const cp = char.codePointAt(0) ?? 0;
    if (/^\p{Mark}$/u.test(char) || char === '‍' || (cp >= 0xFE00 && cp <= 0xFE0F)) continue;
    width = Math.max(width, isWide(cp) || (ambiguousWide && isAmbiguous(cp)) ? 2 : 1);
  }
  return width;
}

/** Terminal cells taken by plain text. */
export function textWidth(text: string): number {
  const ambiguousWide = isCjk();
  let width = 0;
  for (const { segment } of GRAPHEMES.segment(text)) width += graphemeWidth(segment, ambiguousWide);
  return width;
}

/** Terminal cells taken by text with escape sequences. */
export function visibleWidth(str: string): number {
  return tokenize(str).reduce((width, token) => width + (token.escape ? 0 : textWidth(token.text)), 0);
}

export function stripAnsi(str: string): string {
  return tokenize(str).filter((token) => !token.escape).map((token) => token.text).join('');
}

// The longest prefix that fits in `width` cells, keeping the escapes before the cut.
function sliceToWidth(str: string, width: number): string {
  const ambiguousWide = isCjk();
  let result = '';
  let used = 0;
  for (const token of tokenize(str)) {
    if (token.escape) {
      result += token.text;
      continue;
    }
    for (const { segment } of GRAPHEMES.segment(token.text)) {
      used += graphemeWidth(segment, ambiguousWide);
      if (used > width) return result;
      result += segment;
    }
  }
  return result;
}

function truncateToWidth(str: string, width: number): string {
  if (width <= 0 || visibleWidth(str) <= width) return str;
  const suffix = width >= 3 ? '...' : '.'.repeat(width);
  const kept = sliceToWidth(str, width - suffix.length);
  // Cutting inside an OSC 8 link without closing it would underline the rest of the line.
  const open = [...kept.matchAll(OSC8)].at(-1)?.[1];
  return `${kept}${open ? OSC8_CLOSE : ''}${suffix}${RESET}`;
}

interface Part {
  separator: string;
  text: string;
}

function splitAtSeparators(line: string): Part[] {
  const parts: Part[] = [];
  let separator = '';
  let partStart = 0;
  let offset = 0;
  let inLink = false;
  for (const token of tokenize(line)) {
    if (token.escape) {
      const url = /^\x1b\]8;;([^\x07\x1b]*)/.exec(token.text)?.[1];
      if (url !== undefined) inLink = url !== '';
    } else if (!inLink) {
      for (const match of token.text.matchAll(SEPARATOR)) {
        const at = offset + (match.index ?? 0);
        parts.push({ separator, text: line.slice(partStart, at) });
        separator = match[0];
        partStart = at + match[0].length;
      }
    }
    offset += token.text.length;
  }
  parts.push({ separator, text: line.slice(partStart) });

  // A leading "[model | provider]" badge contains a separator but must not wrap.
  const first = stripAnsi(parts[0].text);
  if (first.trimStart().startsWith('[') && !first.includes(']')) {
    let end = 1;
    while (end < parts.length && !stripAnsi(parts[end - 1].text).includes(']')) end += 1;
    const badge = parts.slice(0, end).map((part) => part.separator + part.text).join('');
    return [{ separator: '', text: badge }, ...parts.slice(end)];
  }
  return parts;
}

/** Wraps at the HUD's separators, truncating any part that still overflows. */
export function wrapToWidth(line: string, width: number): string[] {
  if (width <= 0 || visibleWidth(line) <= width) return [line];
  const parts = splitAtSeparators(line);
  if (parts.length <= 1) return [truncateToWidth(line, width)];
  const lines: string[] = [];
  let current = parts[0].text;
  for (const part of parts.slice(1)) {
    const candidate = `${current}${part.separator}${part.text}`;
    if (visibleWidth(candidate) <= width) {
      current = candidate;
      continue;
    }
    lines.push(truncateToWidth(current, width));
    current = part.text;
  }
  if (current) lines.push(truncateToWidth(current, width));
  return lines;
}

/** A dim rule `width` cells wide; ─ is ambiguous-width, so CJK terminals need half as many. */
export function separatorLine(width: number, paint: (text: string) => string): string {
  return paint('─'.repeat(Math.max(1, Math.floor(width / (isCjk() ? 2 : 1)))));
}
