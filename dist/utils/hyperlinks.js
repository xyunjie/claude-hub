import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sanitize } from './sanitize.js';
const LINK_PROTOCOLS = new Set(['https:', 'file:']);
export function fileHref(filePath) {
    try {
        return pathToFileURL(path.resolve(filePath)).toString();
    }
    catch {
        return null;
    }
}
/** `text` as an OSC 8 link to `uri` when that is a valid https: or file: URL, else plain `text`. */
export function hyperlink(uri, text) {
    if (!uri)
        return text;
    try {
        const url = new URL(sanitize(uri));
        return LINK_PROTOCOLS.has(url.protocol) ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : text;
    }
    catch {
        return text;
    }
}
//# sourceMappingURL=hyperlinks.js.map