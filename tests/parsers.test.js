import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseNumstat, parseStatus } from '../dist/git.js';
import { parseTranscriptFile } from '../dist/transcript.js';
import { contextUsage, readStdin } from '../dist/stdin.js';
import { Readable } from 'node:stream';

test('parseStatus reads branch, ahead/behind and file kinds', () => {
  const out = [
    '# branch.oid abcdef1234567', '# branch.head main', '# branch.ab +2 -1',
    '1 .M N... 100644 100644 100644 a b src/x.ts', '1 A. N... 000000 100644 100644 a b new.ts', '? untracked.txt', '',
  ].join('\0');
  const parsed = parseStatus(out);
  assert.equal(parsed.head, 'main');
  assert.equal(parsed.ahead, 2);
  assert.equal(parsed.behind, 1);
  assert.equal(parsed.files.modified, 1);
  assert.equal(parsed.files.added, 1);
  assert.equal(parsed.files.untracked, 1);
  assert.equal(parsed.files.changed[0].path, 'src/x.ts');
});

test('parseNumstat handles renames and binaries', () => {
  const diffs = parseNumstat(['3\t1\ta.ts', '-\t-\timg.png', '2\t0\t', 'old.ts', 'new.ts', ''].join('\0'));
  assert.deepEqual(diffs.get('a.ts'), { added: 3, deleted: 1 });
  assert.equal(diffs.has('img.png'), false);
  assert.deepEqual(diffs.get('new.ts'), { added: 2, deleted: 0 });
});

test('transcript: tools, agents, todos, dedup usage, compactions', async () => {
  const lines = [
    { type: 'assistant', timestamp: '2026-10-02T10:00:00Z', message: { id: 'm1', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 }, content: [
      { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a/b.ts' } },
      { type: 'tool_use', id: 't2', name: 'Agent', input: { subagent_type: 'Explore', description: 'look' } },
      { type: 'tool_use', id: 't3', name: 'TodoWrite', input: { todos: [{ content: 'one', status: 'in_progress' }, { content: 'two', status: 'pending' }] } },
      { type: 'tool_use', id: 't4', name: 'mcp__github__list', input: {} },
    ] } },
    { type: 'assistant', timestamp: '2026-10-02T10:00:01Z', message: { id: 'm1', usage: { input_tokens: 10, output_tokens: 7 } } },
    { type: 'user', timestamp: '2026-10-02T10:00:02Z', message: { content: [
      { type: 'tool_result', tool_use_id: 't1' }, { type: 'tool_result', tool_use_id: 't4', is_error: true },
    ] } },
    { type: 'system', subtype: 'compact_boundary', timestamp: '2026-10-02T10:01:00Z', compactMetadata: { postTokens: 1234 } },
    'not json',
  ];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hub-')), 't.jsonl');
  fs.writeFileSync(file, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n'));
  const data = await parseTranscriptFile(file);
  assert.equal(data.tools.find((t) => t.id === 't1').status, 'completed');
  assert.equal(data.tools.find((t) => t.id === 't1').target, '/a/b.ts');
  assert.equal(data.agents[0].status, 'running');
  assert.deepEqual(data.todos.map((t) => t.status), ['in_progress', 'pending']);
  assert.deepEqual(data.mcpServers, ['github']);
  assert.deepEqual(data.mcpErrors, ['github']);
  assert.equal(data.sessionTokens.outputTokens, 7);
  assert.equal(data.compactions, 1);
  assert.equal(data.contextTokens, 1234);
  assert.equal(data.servedModel, 'claude-opus-5-5');
});

test('contextUsage falls back to token counts', () => {
  const stdin = { context_window: { context_window_size: 200000, current_usage: { input_tokens: 50000 } } };
  assert.deepEqual(contextUsage(stdin, null), { percent: 25, tokens: 50000, size: 200000 });
  assert.equal(contextUsage(stdin, 100000).percent, 50);
});

test('readStdin parses JSON and rejects junk', async () => {
  assert.deepEqual(await readStdin(Readable.from(['{"a":', '1}'])), { a: 1 });
  assert.equal(await readStdin(Readable.from(['[1,2]'])), null);
});
