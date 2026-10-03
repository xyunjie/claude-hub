// C0 and C1 controls, DEL, and the bidi marks, embeddings, overrides, and isolates.
const CONTROL_AND_BIDI = /[\u0000-\u001F\u007F-\u009F؜‎‏‪-‮⁦-⁩⁪-⁯]/g;

/** Untrusted text made safe to print: no escape sequences, controls, or bidi overrides. */
export function sanitize(input: string): string {
  return input
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B[@-Z\\-_]/g, '')
    .replace(CONTROL_AND_BIDI, '');
}

/** A sanitized, trimmed string capped at `max` characters, or undefined when empty or not a string. */
export function cleanText(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = sanitize(value).trim();
  if (!text) return undefined;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** `text` cut to `max` characters, ending in `suffix` when cut. */
export function truncate(text: string | null | undefined, max: number, suffix = '…'): string {
  if (!text) return '';
  return text.length <= max ? text : text.slice(0, Math.max(0, max - suffix.length)) + suffix;
}
