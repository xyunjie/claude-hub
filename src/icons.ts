/**
 * Glyph tiers. `nerd` needs a Nerd Font; `unicode` is safe in any UTF-8 terminal;
 * `ascii` avoids every wide or ambiguous-width character (CJK terminals, bare locales).
 */
export const ICON_TIERS = ['unicode', 'nerd', 'ascii'] as const;
export type IconTier = typeof ICON_TIERS[number];

export interface Icons {
  /** Prefixes inside segments; empty means "use the text label instead". */
  model: string;
  folder: string;
  branch: string;
  duration: string;
  cost: string;
  lines: string;
  speed: string;
  context: string;
  usage: string;
  weekly: string;
  cache: string;
  ram: string;
  /** Status glyphs. */
  running: string;
  done: string;
  error: string;
  todo: string;
  warn: string;
  ahead: string;
  behind: string;
  worktree: string;
  /** Dashboard: the model mark, reset time, token in/out, and a clean worktree. */
  mark: string;
  reset: string;
  up: string;
  down: string;
  clean: string;
  /** Usage bar: where an even pace would be, and the over-pace forecast. */
  paceMark: string;
  forecast: string;
  /** Lean separator, the joiner inside a segment, and the list-overflow ellipsis. */
  separator: string;
  dot: string;
  ellipsis: string;
  /** Boxed-style frame prefixes: first, middle, last, and a lone row. */
  frame: [string, string, string, string];
  /** Powerline arrow and capsule caps; empty in tiers without a Nerd Font. */
  arrow: string;
  capLeft: string;
  capRight: string;
}

const UNICODE: Icons = {
  model: '', folder: '', branch: '⎇ ', duration: '⏱ ', cost: '', lines: '', speed: '',
  context: '', usage: '', weekly: '', cache: '', ram: '',
  mark: '◆', reset: '↻', up: '↑', down: '↓', clean: '✓',
  running: '◐', done: '✓', error: '✗', todo: '▸', warn: '⚠', ahead: '↑', behind: '↓', worktree: '⎇',
  paceMark: '│', forecast: '▲',
  separator: ' │ ', dot: ' · ', ellipsis: '…',
  frame: ['╭─ ', '├─ ', '╰─ ', '── '],
  arrow: '', capLeft: '', capRight: '',
};

export const ICON_SETS: Record<IconTier, Icons> = {
  unicode: UNICODE,
  nerd: {
    ...UNICODE,
    model: '\u{F06A9} ', // nf-md-robot
    folder: ' ', // nf-fa-folder_open_o
    branch: ' ', // nf-pl-branch
    duration: ' ', // nf-fa-hourglass_half
    cost: ' ', // nf-fa-dollar
    lines: ' ', // nf-fa-edit
    speed: ' ', // nf-fa-bolt
    context: ' ', // nf-fa-microchip
    usage: ' ', // nf-fa-tachometer
    weekly: ' ', // nf-fa-calendar
    cache: ' ', // nf-fa-database
    ram: ' ', // nf-fa-server
    done: '', // nf-fa-check
    error: '', // nf-fa-times
    warn: '', // nf-fa-warning
    worktree: '', // nf-fa-tree
    arrow: '', // nf-pl-left_hard_divider
    capLeft: '', // nf-ple-left_half_circle_thick
    capRight: '', // nf-ple-right_half_circle_thick
  },
  ascii: {
    ...UNICODE,
    branch: 'git:', duration: 'time ', mark: '*', reset: '~', up: '^', down: 'v', clean: 'ok', running: '*', done: '+', error: 'x', todo: '>', warn: '!',
    ahead: '^', behind: 'v', worktree: 'wt:', paceMark: '|', forecast: '^',
    separator: ' | ', dot: ' / ', ellipsis: '...',
    frame: ['+- ', '|- ', '`- ', '-- '],
  },
};
