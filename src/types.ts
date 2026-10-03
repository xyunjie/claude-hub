// The statusline payload Claude Code writes to stdin (code.claude.com/docs/en/statusline).
export interface StdinData {
  session_id?: string;
  session_name?: string;
  version?: string;
  transcript_path?: string;
  cwd?: string;
  workspace?: {
    current_dir?: string;
    project_dir?: string;
    added_dirs?: string[];
    git_worktree?: string;
    repo?: RepoIdentity;
  } | null;
  model?: { id?: string; display_name?: string };
  output_style?: { name?: string };
  context_window?: {
    context_window_size?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
    used_percentage?: number | null;
  };
  cost?: {
    total_cost_usd?: number | null;
    total_duration_ms?: number | null;
    total_api_duration_ms?: number | null;
    total_lines_added?: number | null;
    total_lines_removed?: number | null;
  } | null;
  rate_limits?: {
    five_hour?: RateLimitWindow | null;
    seven_day?: RateLimitWindow | null;
  } | null;
  prompt_cache?: {
    warm?: boolean;
    caching_observed?: boolean;
    ttl?: string;
    expires_at?: number | null;
    hit_ratio?: number | null;
  } | null;
  effort?: { level?: string } | null;
}

export interface RateLimitWindow {
  used_percentage?: number | null;
  resets_at?: number | null;
}

/** The `workspace.repo` identity Claude Code parses from the origin remote. */
export interface RepoIdentity {
  host?: string;
  owner?: string;
  name?: string;
}

export interface ToolEntry {
  id: string;
  name: string;
  target?: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
}

export interface AgentEntry {
  id: string;
  type: string;
  model?: string;
  description?: string;
  status: 'running' | 'completed';
  startTime: Date;
  endTime?: Date;
  background?: boolean;
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface TranscriptData {
  tools: ToolEntry[];
  skills: string[];
  mcpServers: string[];
  /** MCP servers whose latest tool result was an error. */
  mcpErrors: string[];
  agents: AgentEntry[];
  todos: TodoItem[];
  sessionStart?: Date;
  lastResponseAt?: Date;
  sessionTokens?: TokenUsage;
  compactions?: number;
  /** Main-conversation context size at its last request, or after the last compaction. */
  contextTokens?: number;
  ultracode?: boolean;
  /** The model the API actually served on the last response. */
  servedModel?: string;
}

export interface UsageData {
  fiveHour: number | null;
  sevenDay: number | null;
  fiveHourResetAt: Date | null;
  sevenDayResetAt: Date | null;
}

export interface LineDiff {
  added: number;
  deleted: number;
}

export interface ChangedFile {
  basename: string;
  path: string;
  type: 'modified' | 'added' | 'deleted';
  lineDiff?: LineDiff;
}

export interface GitStatus {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  branchUrl?: string;
  lineDiff?: LineDiff;
  files?: {
    modified: number;
    added: number;
    deleted: number;
    untracked: number;
    changed: ChangedFile[];
  };
}

export interface ConfigCounts {
  claudeMd: number;
  rules: number;
  mcps: number;
  hooks: number;
}

export interface MemoryInfo {
  totalBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export interface CostTotals {
  todayUsd: number;
  /** Null until the 7-day window's reset time is known. */
  weekUsd: number | null;
}

export interface AuthInfo {
  method: string | null;
  user: string | null;
}
