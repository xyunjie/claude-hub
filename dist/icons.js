/**
 * Glyph tiers. `nerd` needs a Nerd Font; `unicode` is safe in any UTF-8 terminal;
 * `ascii` avoids every wide or ambiguous-width character (CJK terminals, bare locales).
 */
export const ICON_TIERS = ['unicode', 'nerd', 'ascii'];
const UNICODE = {
    model: '', folder: '', branch: '⎇ ', duration: '⏱ ', cost: '', lines: '', speed: '',
    context: '', usage: '', weekly: '', cache: '', ram: '',
    mark: '◆', reset: '↻', up: '↑', down: '↓', clean: '✓',
    running: '◐', done: '✓', error: '✗', todo: '▸', warn: '⚠', ahead: '↑', behind: '↓', worktree: '⎇',
    paceMark: '│', forecast: '▲',
    separator: ' │ ', dot: ' · ', ellipsis: '…',
    frame: ['╭─ ', '├─ ', '╰─ ', '── '],
    arrow: '', capLeft: '', capRight: '',
};
export const ICON_SETS = {
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
//# sourceMappingURL=icons.js.map