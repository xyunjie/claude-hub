import { NAMED_COLORS, THEMES, fgRgb, hexRgb, sampleStops, toAnsi } from '../themes.js';
import { RESET } from './colors.js';
const BOLD = '\x1b[1m';
/** The family from the model id, falling back to the display name. */
export function modelFamily(id, name) {
    const text = `${id ?? ''} ${name}`.toLowerCase();
    for (const family of ['fable', 'opus', 'sonnet', 'haiku'])
        if (text.includes(family))
            return family;
    return 'other';
}
// Fable's shimmer, as truecolor stops or, on the 16-color default theme, ANSI colors.
const SHIMMER_HEX = ['#ff79c6', '#bd93f9', '#7aa2f7', '#7dcfff', '#9ece6a', '#e0af68', '#ff79c6'];
const SHIMMER_ANSI = ['brightMagenta', 'magenta', 'brightBlue', 'brightCyan', 'brightGreen', 'brightYellow'];
/** Whether the theme speaks truecolor; the 16-color themes keep to named colors. */
const truecolor = (f) => hexRgb((THEMES[f.config.theme] ?? THEMES.default).model) !== null;
/** `text` colored character by character along a rainbow gradient. */
export function shimmer(f, text, bold = true) {
    const chars = [...text];
    const weight = bold ? BOLD : '';
    if (!truecolor(f)) {
        return chars.map((c, i) => `${weight}${NAMED_COLORS[SHIMMER_ANSI[i % SHIMMER_ANSI.length]]}${c}`).join('') + RESET;
    }
    const span = Math.max(chars.length, 6);
    return chars.map((c, i) => {
        const position = (i % span) / span;
        return `${weight}${fgRgb(sampleStops(SHIMMER_HEX, position))}${c}`;
    }).join('') + RESET;
}
/** Muted for Sonnet, light for Haiku; null keeps the theme's model color. */
function familyColor(f, family) {
    const hex = truecolor(f);
    if (family === 'sonnet')
        return toAnsi(hex ? '#9aa3b2' : 'white');
    if (family === 'haiku')
        return toAnsi(hex ? '#8bd5ca' : 'cyan');
    return null;
}
/** The model mark and name, styled by family when display.modelColors is on. */
export function styledModel(f, name, mark, id) {
    const plain = { mark: f.paint.model(mark), name: `${BOLD}${f.paint.model(name)}` };
    if (!f.config.display.modelColors || f.config.theme === 'mono')
        return plain;
    const family = modelFamily(id, name);
    if (family === 'fable') {
        const sparkle = f.config.icons === 'ascii' ? '*' : '✦';
        return { mark: shimmer(f, sparkle), name: shimmer(f, name) };
    }
    const color = familyColor(f, family);
    // Sonnet and Haiku stay calm: their own color, regular weight.
    return color ? { mark: `${color}${mark}${RESET}`, name: `${color}${name}${RESET}` } : plain;
}
// Effort, quiet to loud.
const EFFORT_HEX = { low: '#6e7681', medium: '#7aa2f7', high: '#9ece6a', xhigh: '#ff9e64', max: '#f7768e' };
const EFFORT_ANSI = { low: 'gray', medium: 'blue', high: 'green', xhigh: 'yellow', max: 'red' };
/** The effort level colored by intensity: low gray … max bold red, ultracode shimmering. */
export function styledEffort(f, level) {
    if (!f.config.display.modelColors || f.config.theme === 'mono')
        return f.paint.label(level);
    if (level.startsWith('ultracode'))
        return shimmer(f, level, false);
    const base = level.toLowerCase();
    const color = truecolor(f) ? (EFFORT_HEX[base] ? toAnsi(EFFORT_HEX[base]) : null) : (EFFORT_ANSI[base] ? NAMED_COLORS[EFFORT_ANSI[base]] : null);
    if (!color)
        return f.paint.label(level);
    return `${base === 'max' ? BOLD : ''}${color}${level}${RESET}`;
}
//# sourceMappingURL=model-style.js.map