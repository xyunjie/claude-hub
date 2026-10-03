import { execFile } from 'node:child_process';
import { createDebug } from './debug.js';
import type { ChangedFile, GitStatus, LineDiff, RepoIdentity } from './types.js';

const debug = createDebug('git');
const MAX_OUTPUT_BYTES = 1024 * 1024;
const QUIET = ['-c', 'core.quotePath=false', '--no-optional-locks'];

class GitTimeoutError extends Error {}

function runGit(cwd: string, args: readonly string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', [...args], {
      cwd,
      timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    }, (error, stdout) => {
      if (!error) resolve(stdout);
      else reject(error.killed ? new GitTimeoutError(`git ${args.join(' ')} timed out`) : error);
    });
  });
}

export async function getGitStatus(cwd: string | undefined, options: { lineDiffs?: boolean; repo?: RepoIdentity | null } = {}): Promise<GitStatus | null> {
  if (!cwd) return null;

  let output: string;
  try {
    output = await runGit(cwd, [...QUIET, 'status', '--porcelain=v2', '--branch', '-z'], 1000);
  } catch (err) {
    debug('git status failed:', err instanceof Error ? err.message : err);
    return err instanceof GitTimeoutError ? branchOnly(cwd, options.repo) : null;
  }

  const parsed = parseStatus(output);
  const branch = parsed.head ?? await describeDetached(cwd, parsed.oid);
  if (!branch) return null;

  const status: GitStatus = {
    branch,
    dirty: parsed.dirty,
    ahead: parsed.ahead,
    behind: parsed.behind,
    branchUrl: githubUrl(options.repo, branch),
  };
  if (!parsed.dirty) return status;

  status.files = parsed.files;
  if (options.lineDiffs) {
    try {
      const diffs = parseNumstat(await runGit(cwd, [...QUIET, 'diff', '--numstat', '-z', 'HEAD'], 2000));
      status.lineDiff = { added: 0, deleted: 0 };
      for (const diff of diffs.values()) {
        status.lineDiff.added += diff.added;
        status.lineDiff.deleted += diff.deleted;
      }
      for (const file of parsed.files.changed) file.lineDiff = diffs.get(file.path);
    } catch (err) {
      debug('git diff --numstat failed:', err instanceof Error ? err.message : err);
    }
  }
  return status;
}

// A status that timed out in a large repo still leaves the branch worth showing.
async function branchOnly(cwd: string, repo: RepoIdentity | null | undefined): Promise<GitStatus | null> {
  try {
    const branch = (await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], 1000)).trim();
    if (!branch || branch === 'HEAD') return null;
    return { branch, dirty: false, ahead: 0, behind: 0, branchUrl: githubUrl(repo, branch) };
  } catch {
    return null;
  }
}

async function describeDetached(cwd: string, oid: string | null): Promise<string | null> {
  try {
    const tag = (await runGit(cwd, ['describe', '--tags', '--exact-match', 'HEAD'], 1000)).trim();
    if (tag) return tag;
  } catch {
    // Untagged commit.
  }
  return oid && /^[0-9a-f]{7,}$/.test(oid) ? `detached:${oid.slice(0, 7)}` : null;
}

const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/;

function githubUrl(repo: RepoIdentity | null | undefined, ref: string): string | undefined {
  if (repo?.host !== 'github.com' || !GITHUB_NAME.test(repo.owner ?? '') || !GITHUB_NAME.test(repo.name ?? '')) return undefined;
  const base = `https://github.com/${repo.owner}/${repo.name}`;
  const sha = /^detached:([0-9a-f]+)$/.exec(ref)?.[1];
  return sha ? `${base}/commit/${sha}` : `${base}/tree/${ref.split('/').map(encodeURIComponent).join('/')}`;
}

interface ParsedStatus {
  oid: string | null;
  head: string | null;
  ahead: number;
  behind: number;
  dirty: boolean;
  files: NonNullable<GitStatus['files']>;
}

// Fields before the path in `git status --porcelain=v2` records, by record type.
const PATH_FIELD: Record<string, number> = { '1': 8, '2': 9, u: 10 };

export function parseStatus(output: string): ParsedStatus {
  const parsed: ParsedStatus = {
    oid: null,
    head: null,
    ahead: 0,
    behind: 0,
    dirty: false,
    files: { modified: 0, added: 0, deleted: 0, untracked: 0, changed: [] },
  };
  const records = output.split('\0');
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.startsWith('# branch.oid ')) {
      parsed.oid = record.slice(13);
    } else if (record.startsWith('# branch.head ')) {
      const head = record.slice(14);
      parsed.head = head === '(detached)' ? null : head;
    } else if (record.startsWith('# branch.ab ')) {
      const match = /^\+(\d+) -(\d+)$/.exec(record.slice(12));
      if (match) {
        parsed.ahead = Number(match[1]);
        parsed.behind = Number(match[2]);
      }
    } else if (record.startsWith('? ')) {
      parsed.dirty = true;
      parsed.files.untracked++;
    } else if (record[1] === ' ' && record[0] in PATH_FIELD) {
      parsed.dirty = true;
      const filePath = afterFields(record, PATH_FIELD[record[0]]);
      if (record[0] === '2') i++; // A rename or copy is followed by its original path.
      const type = classify(record[2], record[3]);
      if (!type) continue;
      parsed.files[type]++;
      parsed.files.changed.push({ basename: filePath.split('/').pop() ?? filePath, path: filePath, type });
    }
  }
  return parsed;
}

function afterFields(record: string, fields: number): string {
  let index = 0;
  for (let field = 0; field < fields; field++) index = record.indexOf(' ', index) + 1;
  return record.slice(index);
}

// Index (x) and worktree (y) status letters. Renames, copies, and conflicts count as modified.
function classify(x: string, y: string): ChangedFile['type'] | null {
  if (x === 'A' || (x === 'U' && y === 'A')) return 'added';
  if (x === 'D' || y === 'D') return 'deleted';
  if (x === 'M' || y === 'M' || x === 'R' || x === 'C' || x === 'U') return 'modified';
  return null;
}

// `git diff --numstat -z`: "added\tdeleted\tpath", or for a rename an empty path
// followed by the old and new paths as separate records.
export function parseNumstat(output: string): Map<string, LineDiff> {
  const diffs = new Map<string, LineDiff>();
  const records = output.split('\0');
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const first = record.indexOf('\t');
    const second = record.indexOf('\t', first + 1);
    if (first === -1 || second === -1) continue;
    let filePath = record.slice(second + 1);
    if (filePath === '') {
      filePath = records[i + 2] ?? '';
      i += 2;
    }
    const added = Number.parseInt(record.slice(0, first), 10);
    const deleted = Number.parseInt(record.slice(first + 1, second), 10);
    if (!Number.isNaN(added) && !Number.isNaN(deleted)) diffs.set(filePath, { added, deleted });
  }
  return diffs;
}
