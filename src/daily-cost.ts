import * as fs from 'node:fs';
import * as path from 'node:path';
import { hubDir } from './paths.js';
import { sessionCostUsd } from './stdin.js';
import type { CostTotals, StdinData } from './types.js';

const WRITE_THROTTLE_MS = 30_000;
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;

interface LedgerSession {
  // Native total when first seen today, and within the current week.
  baseline: number;
  weekBaseline: number;
  // Highest native total seen. Absolute rather than a delta, so a write lost to a
  // concurrent render is restored by the next one instead of drifting.
  total: number;
  ts: number;
}

interface Ledger {
  /** Local calendar day, YYYYMMDD: the counter resets at the user's midnight. */
  date: string;
  sessions: Record<string, LedgerSession>;
  /** When weekly accumulation began, plus spend from sessions already dropped. */
  week: { start: number; carry: number };
}

const ledgerPath = (): string => path.join(hubDir(), 'daily-cost.json');

function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function readLedger(file: string): Ledger | null {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isObject(value) || typeof value.date !== 'string' || !/^\d{8}$/.test(value.date) || !isObject(value.sessions)) return null;
    const sessions: Record<string, LedgerSession> = {};
    for (const [id, raw] of Object.entries(value.sessions)) {
      if (!isObject(raw) || !isAmount(raw.baseline) || !isAmount(raw.total) || !isAmount(raw.ts)) continue;
      sessions[id] = {
        baseline: raw.baseline,
        weekBaseline: isAmount(raw.weekBaseline) ? raw.weekBaseline : raw.baseline,
        total: raw.total,
        ts: raw.ts,
      };
    }
    const week = isObject(value.week) ? value.week : {};
    return { date: value.date, sessions, week: { start: isAmount(week.start) ? week.start : 0, carry: isAmount(week.carry) ? week.carry : 0 } };
  } catch {
    return null;
  }
}

function writeLedger(file: string, ledger: Ledger, now: number): void {
  const tmp = `${file}.${process.pid}.${now}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(tmp, file);
    fs.utimesSync(file, new Date(now), new Date(now));
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Nothing left to clean up.
    }
  }
}

const isThrottled = (file: string, now: number): boolean => {
  try {
    return now - fs.statSync(file).mtimeMs <= WRITE_THROTTLE_MS;
  } catch {
    return false;
  }
};

// Folds this session's native cost into a ledger shared by all sessions and returns
// today's and this week's spend, or null when nothing has been recorded.
export function getCostTotals(
  stdin: StdinData,
  options: { allowRouted: boolean; sevenDayResetAt: Date | null },
  now = Date.now(),
): CostTotals | null {
  const file = ledgerPath();
  const today = dayKey(now);
  const stored = readLedger(file);
  const ledger: Ledger = stored ?? { date: today, sessions: {}, week: { start: now, carry: 0 } };
  let changed = stored === null;

  // Sessions unseen for a day leave the ledger, but their spend stays in the week.
  for (const [id, session] of Object.entries(ledger.sessions)) {
    if (now - session.ts > SESSION_MAX_AGE_MS) {
      ledger.week.carry += Math.max(0, session.total - session.weekBaseline);
      delete ledger.sessions[id];
      changed = true;
    }
  }
  // At midnight, active sessions carry over so only today's part of their spend counts.
  if (ledger.date !== today) {
    ledger.date = today;
    for (const session of Object.values(ledger.sessions)) session.baseline = session.total;
    changed = true;
  }
  // Restart the week when the 7-day quota window opened after accumulation began.
  const resetAt = options.sevenDayResetAt?.getTime();
  const windowStart = resetAt !== undefined && Number.isFinite(resetAt) ? resetAt - SEVEN_DAY_MS : null;
  if (windowStart !== null && ledger.week.start < windowStart) {
    for (const session of Object.values(ledger.sessions)) session.weekBaseline = session.total;
    ledger.week = { start: now, carry: 0 };
    changed = true;
  }

  const sessionId = typeof stdin.session_id === 'string' ? stdin.session_id.trim() : '';
  const cost = sessionCostUsd(stdin, options.allowRouted);
  if (sessionId && cost !== null) {
    const session = ledger.sessions[sessionId];
    if (!session) {
      ledger.sessions[sessionId] = { baseline: cost, weekBaseline: cost, total: cost, ts: now };
      changed = true;
    } else {
      if (cost > session.total) {
        session.total = cost;
        changed = true;
      }
      session.ts = now;
    }
  }

  const sessions = Object.values(ledger.sessions);
  if (sessions.length === 0 && ledger.week.carry === 0) return null;
  if (changed || !isThrottled(file, now)) writeLedger(file, ledger, now);

  const sum = (pick: (s: LedgerSession) => number): number =>
    sessions.reduce((total, s) => total + Math.max(0, s.total - pick(s)), 0);
  return {
    todayUsd: sum((s) => s.baseline),
    weekUsd: windowStart !== null ? ledger.week.carry + sum((s) => s.weekBaseline) : null,
  };
}
