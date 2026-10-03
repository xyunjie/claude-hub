import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { createDebug } from './debug.js';
import { hubDir } from './paths.js';
import type { AgentEntry, TodoItem, TokenUsage, ToolEntry, TranscriptData } from './types.js';
import { cleanText, sanitize } from './utils/sanitize.js';

const debug = createDebug('transcript');

const TOOLS_KEPT = 20;
const AGENTS_KEPT = 10;
const MESSAGE_IDS_MAX = 4096;
const MCP_TOOL = /^mcp__(.+?)__(.+)$/;
// Claude Code's /effort output; anchored so prose quoting it can't flip ultracode.
const EFFORT_COMMAND = /^<local-command-stdout>Set effort level to (\w+)/;
const CACHE_VERSION = 1;

interface Usage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
}

interface Block {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
}

interface Entry {
  type?: string;
  subtype?: string;
  operation?: string;
  content?: unknown;
  timestamp?: string;
  isSidechain?: boolean;
  message?: { id?: unknown; model?: unknown; content?: Block[] | string; usage?: Usage };
  toolUseResult?: { resolvedModel?: unknown; isAsync?: unknown; status?: unknown };
  compactMetadata?: { postTokens?: unknown };
  attachment?: { type?: string };
}

export const emptyTranscript = (): TranscriptData => ({
  tools: [], skills: [], mcpServers: [], mcpErrors: [], agents: [], todos: [],
});

const ZERO: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
const FIELDS = Object.keys(ZERO) as (keyof TokenUsage)[];

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

const add = (total: TokenUsage, usage: TokenUsage): void => {
  for (const field of FIELDS) total[field] += usage[field];
};

const max = (a: TokenUsage, b: TokenUsage): TokenUsage =>
  Object.fromEntries(FIELDS.map((field) => [field, Math.max(a[field], b[field])])) as unknown as TokenUsage;

// Tool inputs are written by the model, so their text is untrusted terminal input.
const rawText = (value: unknown): string | undefined =>
  typeof value === 'string' ? sanitize(value) || undefined : undefined;

function toolTarget(tool: string, input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  switch (tool) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return rawText(input.file_path ?? input.notebook_path ?? input.path);
    case 'Glob':
    case 'Grep':
      return rawText(input.pattern);
    case 'Skill':
      return cleanText(input.skill, 64);
    case 'WebFetch':
      return rawText(input.url);
    case 'WebSearch':
      return rawText(input.query);
    case 'Bash': {
      const command = rawText(input.command)?.replace(/\s+/g, ' ').trim();
      if (!command) return undefined;
      return command.length > 30 ? `${command.slice(0, 30).trimEnd()}…` : command;
    }
  }
  return undefined;
}

function todoStatus(status: unknown): TodoItem['status'] | null {
  switch (status) {
    case 'pending':
    case 'not_started':
      return 'pending';
    case 'in_progress':
    case 'running':
      return 'in_progress';
    case 'completed':
    case 'complete':
    case 'done':
      return 'completed';
    default:
      return null;
  }
}

function toTodo(value: unknown): TodoItem[] {
  const todo = value as { content?: unknown; status?: unknown } | null;
  const content = rawText(todo?.content);
  const status = todoStatus(todo?.status);
  return content && status ? [{ content, status }] : [];
}

class Parser {
  private tools = new Map<string, ToolEntry>();
  private agents = new Map<string, AgentEntry>();
  private skills = new Set<string>();
  private mcpServers = new Set<string>();
  private mcpErrors = new Set<string>();
  private todos: TodoItem[] = [];
  private taskIndex = new Map<string, number>();
  private agentCompletions = new Map<string, Date>();
  // Claude Code logs one API response several times, so usage is the per-field max per
  // message id. Ids evicted to bound memory settle into `settled`.
  private usageById = new Map<string, TokenUsage>();
  private settled: TokenUsage = { ...ZERO };
  private lastIdless: string | undefined;
  private data: TranscriptData = { ...emptyTranscript(), compactions: 0 };

  line(raw: string): void {
    let entry: Entry | null = null;
    try {
      entry = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      // Malformed lines are skipped.
    }
    if (!entry || typeof entry !== 'object') {
      this.lastIdless = undefined;
      return;
    }

    const parsed = entry.timestamp ? new Date(entry.timestamp) : null;
    const at = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    if (at && !this.data.sessionStart) this.data.sessionStart = at;

    if (entry.type === 'assistant') this.assistant(entry, at);
    else this.lastIdless = undefined;

    if (entry.type === 'user' && typeof entry.message?.content === 'string') {
      const effort = EFFORT_COMMAND.exec(entry.message.content);
      if (effort) this.data.ultracode = effort[1].toLowerCase() === 'ultracode';
    }
    if (entry.type === 'attachment') {
      if (entry.attachment?.type === 'ultra_effort_enter') this.data.ultracode = true;
      if (entry.attachment?.type === 'ultra_effort_exit') this.data.ultracode = false;
    }
    if (entry.type === 'system' && entry.subtype === 'compact_boundary' && at) {
      this.data.compactions = (this.data.compactions ?? 0) + 1;
      const post = entry.compactMetadata?.postTokens;
      this.data.contextTokens = typeof post === 'number' && Number.isFinite(post) && post >= 0 ? Math.trunc(post) : undefined;
    }
    // A background agent's tool_result lands at launch; its completion is this enqueue.
    if (entry.type === 'queue-operation' && entry.operation === 'enqueue' && typeof entry.content === 'string' && at) {
      const toolUseId = /<tool-use-id>([^<]+)<\/tool-use-id>/.exec(entry.content)?.[1];
      if (toolUseId && /<task-id>[^<]+<\/task-id>/.test(entry.content)) this.agentCompletions.set(toolUseId, at);
    }

    if (Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block?.type === 'tool_use' && block.id && block.name) this.toolUse(block, at ?? new Date());
        if (block?.type === 'tool_result' && block.tool_use_id) this.toolResult(block, entry, at ?? new Date());
      }
    }
  }

  private assistant(entry: Entry, at: Date | null): void {
    if (at) this.data.lastResponseAt = at;
    const model = cleanText(entry.message?.model);
    // Claude Code writes '<synthetic>' on assistant records it generates locally.
    if (model && model !== '<synthetic>') this.data.servedModel = model;

    const raw = entry.message?.usage;
    if (!raw) {
      this.lastIdless = undefined;
      return;
    }
    const usage: TokenUsage = {
      inputTokens: toCount(raw.input_tokens),
      outputTokens: toCount(raw.output_tokens),
      cacheCreationTokens: toCount(raw.cache_creation_input_tokens),
      cacheReadTokens: toCount(raw.cache_read_input_tokens),
    };
    if (entry.isSidechain !== true) {
      this.data.contextTokens = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
    }

    const id = entry.message?.id;
    if (typeof id === 'string' && id && id.length <= 128) {
      this.lastIdless = undefined;
      const previous = this.usageById.get(id);
      this.usageById.set(id, previous ? max(previous, usage) : usage);
      if (this.usageById.size > MESSAGE_IDS_MAX) {
        const [oldestId, oldest] = this.usageById.entries().next().value as [string, TokenUsage];
        this.usageById.delete(oldestId);
        add(this.settled, oldest);
      }
      return;
    }
    // Without an id, only an identical record right after the previous one is a duplicate.
    const fingerprint = JSON.stringify(usage);
    if (fingerprint !== this.lastIdless) add(this.settled, usage);
    this.lastIdless = fingerprint;
  }

  private toolUse(block: Block, at: Date): void {
    const id = block.id as string;
    const name = block.name as string;
    const input = block.input;
    const skill = name === 'Skill' ? cleanText(input?.skill, 64) : undefined;
    if (skill) this.skills.add(skill);
    const server = cleanText(MCP_TOOL.exec(name)?.[1], 64);
    if (server) this.mcpServers.add(server);

    if (name === 'Task' || name === 'Agent') {
      this.agents.set(id, {
        id,
        type: cleanText(input?.subagent_type, 24) ?? 'agent',
        model: cleanText(input?.model),
        description: rawText(input?.description),
        status: 'running',
        startTime: at,
        background: input?.run_in_background === true,
      });
    } else if (name === 'TodoWrite') {
      if (Array.isArray(input?.todos)) this.replaceTodos(input.todos.flatMap(toTodo));
    } else if (name === 'TaskCreate') {
      const content = rawText(input?.subject) ?? rawText(input?.description) ?? 'Untitled task';
      this.todos.push({ content, status: todoStatus(input?.status) ?? 'pending' });
      const taskId = typeof input?.taskId === 'string' || typeof input?.taskId === 'number' ? String(input.taskId) : id;
      this.taskIndex.set(taskId, this.todos.length - 1);
    } else if (name === 'TaskUpdate') {
      const todo = this.todos[this.findTask(input?.taskId) ?? -1];
      if (!todo) return;
      const status = todoStatus(input?.status);
      if (status) todo.status = status;
      const content = rawText(input?.subject) ?? rawText(input?.description);
      if (content) todo.content = content;
    } else {
      this.tools.set(id, { id, name, target: toolTarget(name, input), status: 'running', startTime: at });
    }
  }

  private toolResult(block: Block, entry: Entry, at: Date): void {
    const id = block.tool_use_id as string;
    const tool = this.tools.get(id);
    if (tool) {
      tool.status = block.is_error ? 'error' : 'completed';
      tool.endTime = at;
      const server = cleanText(MCP_TOOL.exec(tool.name)?.[1], 64);
      if (server && block.is_error) this.mcpErrors.add(server);
      else if (server) this.mcpErrors.delete(server);
    }

    const agent = this.agents.get(id);
    if (agent) {
      // resolvedModel is what the subagent actually ran on, so it beats the caller's alias.
      agent.model = cleanText(entry.toolUseResult?.resolvedModel) ?? agent.model;
      if (entry.toolUseResult?.isAsync === true || entry.toolUseResult?.status === 'async_launched') agent.background = true;
      if (!agent.background) agent.endTime = at;
    }
  }

  // TodoWrite replaces the list; TaskCreate ids follow their todo by content, in order.
  private replaceTodos(next: TodoItem[]): void {
    const idsByContent = new Map<string, string[]>();
    for (const [taskId, index] of [...this.taskIndex].sort((a, b) => a[1] - b[1])) {
      const content = this.todos[index]?.content;
      if (content !== undefined) idsByContent.set(content, [...(idsByContent.get(content) ?? []), taskId]);
    }
    this.todos = [...next];
    this.taskIndex.clear();
    this.todos.forEach((todo, index) => {
      const taskId = idsByContent.get(todo.content)?.shift();
      if (taskId) this.taskIndex.set(taskId, index);
    });
  }

  // TaskUpdate names a task by the id TaskCreate returned, or by its 1-based position.
  private findTask(taskId: unknown): number | null {
    if (typeof taskId !== 'string' && typeof taskId !== 'number') return null;
    const key = String(taskId);
    const mapped = this.taskIndex.get(key);
    if (mapped !== undefined) return mapped;
    const position = /^\d+$/.test(key) ? Number(key) - 1 : -1;
    return position >= 0 && position < this.todos.length ? position : null;
  }

  finish(): TranscriptData {
    for (const [id, endTime] of this.agentCompletions) {
      const agent = this.agents.get(id);
      if (agent?.background) agent.endTime = endTime;
    }
    for (const agent of this.agents.values()) {
      if (agent.endTime) agent.status = 'completed';
    }
    const sessionTokens = { ...this.settled };
    for (const usage of this.usageById.values()) add(sessionTokens, usage);
    return {
      ...this.data,
      tools: [...this.tools.values()].slice(-TOOLS_KEPT),
      agents: [...this.agents.values()].slice(-AGENTS_KEPT),
      skills: [...this.skills],
      mcpServers: [...this.mcpServers],
      mcpErrors: [...this.mcpErrors],
      todos: this.todos,
      sessionTokens,
    };
  }
}

export async function parseTranscriptFile(file: string): Promise<TranscriptData> {
  const parser = new Parser();
  try {
    const input = fs.createReadStream(file);
    for await (const raw of readline.createInterface({ input, crlfDelay: Infinity })) parser.line(raw);
  } catch (err) {
    // A read cut short still renders what was parsed.
    debug('Transcript read failed:', err instanceof Error ? err.message : err);
  }
  return parser.finish();
}

// The parsed result is cached by the transcript's size and mtime, so the frequent
// re-renders between turns skip re-reading a transcript that hasn't changed.
function cachePath(file: string): string {
  const key = createHash('sha256').update(path.resolve(file)).digest('hex').slice(0, 32);
  return path.join(hubDir(), 'transcript-cache', `${key}.json`);
}

const DATE_FIELDS = ['startTime', 'endTime'] as const;

function revive(data: TranscriptData): TranscriptData {
  const date = (value: unknown): Date | undefined => (typeof value === 'string' ? new Date(value) : undefined);
  for (const list of [data.tools, data.agents] as unknown as Array<Array<Record<string, unknown>>>) {
    for (const item of list) {
      for (const field of DATE_FIELDS) if (item[field] !== undefined) item[field] = date(item[field]);
    }
  }
  data.sessionStart = date(data.sessionStart);
  data.lastResponseAt = date(data.lastResponseAt);
  return data;
}

function readCache(file: string, stat: fs.Stats): TranscriptData | null {
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath(file), 'utf8')) as {
      v?: number; size?: number; mtimeMs?: number; data?: TranscriptData;
    };
    return cached.v === CACHE_VERSION && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs && cached.data
      ? revive(cached.data)
      : null;
  } catch {
    return null;
  }
}

function writeCache(file: string, stat: fs.Stats, data: TranscriptData): void {
  const target = cachePath(file);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ v: CACHE_VERSION, size: stat.size, mtimeMs: stat.mtimeMs, data }), { mode: 0o600 });
    fs.renameSync(tmp, target);
  } catch (err) {
    debug('Cache write failed:', err instanceof Error ? err.message : err);
  }
}

export async function parseTranscript(file: string | undefined): Promise<TranscriptData> {
  let stat: fs.Stats;
  try {
    if (!file) return emptyTranscript();
    stat = fs.statSync(file);
    if (!stat.isFile()) return emptyTranscript();
  } catch {
    return emptyTranscript();
  }
  const cached = readCache(file, stat);
  if (cached) return cached;
  const data = await parseTranscriptFile(file);
  writeCache(file, stat, data);
  return data;
}
