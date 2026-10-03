// DEBUG=claude-hub (or DEBUG=*) logs to stderr, which `claude --debug` shows for the status line.
const enabled = process.env.DEBUG?.includes('claude-hub') || process.env.DEBUG === '*';
export function createDebug(namespace) {
    return (msg, ...args) => {
        if (enabled)
            console.error(`[claude-hub:${namespace}] ${msg}`, ...args);
    };
}
//# sourceMappingURL=debug.js.map