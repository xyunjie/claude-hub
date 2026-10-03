import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import * as os from 'node:os';
export function parseVmStat(output) {
    const pageSize = /page size of (\d+) bytes/.exec(output)?.[1];
    const active = /Pages active:\s+(\d+)/.exec(output)?.[1];
    const wired = /Pages wired down:\s+(\d+)/.exec(output)?.[1];
    return pageSize && active && wired ? { pageSize: Number(pageSize), active: Number(active), wired: Number(wired) } : null;
}
export function parseMeminfo(output) {
    const total = /^MemTotal:\s+(\d+)\s+kB/m.exec(output)?.[1];
    const available = /^MemAvailable:\s+(\d+)\s+kB/m.exec(output)?.[1];
    return total && available ? { totalBytes: Number(total) * 1024, freeBytes: Number(available) * 1024 } : null;
}
const vmStat = () => new Promise((resolve, reject) => {
    execFile('/usr/bin/vm_stat', { encoding: 'utf8', timeout: 1000 }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
});
// os.freemem() leaves out reclaimable cache and overstates use, so read the OS's own
// accounting where it is cheap: active + wired pages on macOS, MemAvailable on Linux.
async function readRaw() {
    const fallback = { totalBytes: os.totalmem(), freeBytes: os.freemem() };
    try {
        if (process.platform === 'linux')
            return parseMeminfo(await readFile('/proc/meminfo', 'utf8')) ?? fallback;
        if (process.platform === 'darwin') {
            const vm = parseVmStat(await vmStat());
            if (vm)
                return { totalBytes: fallback.totalBytes, freeBytes: fallback.totalBytes - (vm.active + vm.wired) * vm.pageSize };
        }
    }
    catch {
        // Fall through to os.freemem().
    }
    return fallback;
}
export async function getMemoryUsage() {
    const { totalBytes, freeBytes } = await readRaw();
    if (!Number.isFinite(totalBytes) || totalBytes <= 0)
        return null;
    const free = Number.isFinite(freeBytes) ? Math.min(Math.max(freeBytes, 0), totalBytes) : 0;
    const usedBytes = totalBytes - free;
    return { totalBytes, usedBytes, usedPercent: Math.round((usedBytes / totalBytes) * 100) };
}
//# sourceMappingURL=memory.js.map