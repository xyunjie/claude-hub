import * as fs from 'node:fs';
import { claudeJsonPath } from './paths.js';
import type { AuthInfo } from './types.js';
import { cleanText } from './utils/sanitize.js';

const hasApiKey = (env: NodeJS.ProcessEnv): boolean => !!env.ANTHROPIC_API_KEY?.trim();

/** Plan and account from the `oauthAccount` block Claude Code keeps in .claude.json. */
export function deriveAuthInfo(claudeJson: unknown, env: NodeJS.ProcessEnv = process.env): AuthInfo {
  // ANTHROPIC_API_KEY wins at runtime even when an old oauthAccount remains.
  if (hasApiKey(env)) return { method: 'API Key', user: null, subscribedAt: null };
  const account = (claudeJson as { oauthAccount?: Record<string, unknown> } | null)?.oauthAccount;
  if (!account || typeof account !== 'object') return { method: null, user: null, subscribedAt: null };

  let method: string | null = null;
  const orgType = cleanText(account.organizationType, 64);
  if (orgType) {
    // "claude_max" → "Claude Max", plus the "20x" of a "default_claude_max_20x" tier.
    method = orgType.split('_').filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
    const tier = /_(\d+x)$/i.exec(cleanText(account.organizationRateLimitTier, 64) ?? '')?.[1];
    if (tier && !method.toLowerCase().includes(tier.toLowerCase())) method += ` ${tier}`;
  }
  const email = cleanText(account.emailAddress, 128);
  const started = typeof account.subscriptionCreatedAt === 'string' ? new Date(account.subscriptionCreatedAt) : null;
  return {
    method,
    user: email ? email.split('@')[0] : cleanText(account.displayName, 64) ?? null,
    subscribedAt: started && Number.isFinite(started.getTime()) ? started : null,
  };
}

export function readAuthInfo(): AuthInfo {
  if (hasApiKey(process.env)) return { method: 'API Key', user: null, subscribedAt: null };
  try {
    return deriveAuthInfo(JSON.parse(fs.readFileSync(claudeJsonPath(), 'utf8')));
  } catch {
    return { method: null, user: null, subscribedAt: null };
  }
}
