import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readAuthInfo } from './auth.js';
import { loadConfig } from './config.js';
import { countConfigs } from './config-counts.js';
import { getCostTotals } from './daily-cost.js';
import { parseExtraCmdArg, runExtraCmd } from './extra-cmd.js';
import { getGitStatus } from './git.js';
import { setLanguage, t } from './i18n/index.js';
import { getMemoryUsage } from './memory.js';
import { render } from './render/index.js';
import { getOutputSpeed } from './speed.js';
import { isContextUnreported, readStdin, usageFromStdin } from './stdin.js';
import { emptyTranscript, parseTranscript } from './transcript.js';
// CLAUDE_HUB_DISABLE=1 blanks the HUD for one session while keeping the statusLine setting.
export function isDisabled(env = process.env) {
    const value = env.CLAUDE_HUB_DISABLE?.trim().toLowerCase();
    return !!value && !['0', 'false', 'off', 'no'].includes(value);
}
function needsTranscript(config, stdin) {
    const d = config.display;
    return d.showTools || d.showSkills || d.showMcp || d.showAgents || d.showTodos || d.showConfigCounts
        || d.showSessionTokens || d.showCompactions || d.showSessionStartDate || d.showLastResponseAt
        || d.showEffortLevel || d.modelSource !== 'stdin' || isContextUnreported(stdin)
        // The dashboard's token cell falls back to transcript totals.
        || (config.style === 'dashboard' && typeof stdin.context_window?.total_input_tokens !== 'number');
}
export async function main() {
    if (isDisabled())
        return;
    try {
        const stdin = await readStdin();
        const config = loadConfig();
        setLanguage(config.language);
        if (!stdin) {
            // Setup runs the command without input to check that it starts.
            console.log(t('init.ready'));
            return;
        }
        const d = config.display;
        const extraCmd = parseExtraCmdArg();
        const [transcript, git, extraLabel, memory] = await Promise.all([
            needsTranscript(config, stdin) ? parseTranscript(stdin.transcript_path) : emptyTranscript(),
            config.gitStatus.enabled
                ? getGitStatus(stdin.cwd, { lineDiffs: config.gitStatus.showFileStats, repo: stdin.workspace?.repo })
                : null,
            extraCmd ? runExtraCmd(extraCmd) : null,
            d.showMemoryUsage ? getMemoryUsage() : null,
        ]);
        const usage = d.showUsage ? usageFromStdin(stdin) : null;
        render({
            stdin,
            config,
            transcript,
            git,
            usage,
            extraLabel,
            memory,
            counts: d.showConfigCounts ? countConfigs(stdin.cwd) : null,
            costTotals: d.showDailyCost || d.showWeeklyCost
                ? getCostTotals(stdin, { allowRouted: d.showRoutedCost, sevenDayResetAt: usage?.sevenDayResetAt ?? null })
                : null,
            speed: d.showSpeed ? getOutputSpeed(stdin) : null,
            auth: d.showAuth || d.showAuthUser || d.showRenewal ? readAuthInfo() : null,
        });
    }
    catch (error) {
        console.log('[claude-hub] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
}
const isSamePath = (a, b) => {
    try {
        return realpathSync(a) === realpathSync(b);
    }
    catch {
        return a === b;
    }
};
if (process.argv[1] && isSamePath(process.argv[1], fileURLToPath(import.meta.url))) {
    void main();
}
//# sourceMappingURL=index.js.map