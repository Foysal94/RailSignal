import type { DisruptionDigestProps } from './types.js';

// RFC 8058 one-click list-unsubscribe headers for Gmail/Yahoo bulk-sender deliverability mandates.
// Colliding keys (case-insensitive) are stripped from customHeaders and angle brackets normalized.
export function buildUnsubscribeHeaders(
  digest: Pick<DisruptionDigestProps, 'unsubscribeUrl' | 'unsubscribeToken'>,
  customHeaders?: Record<string, string>,
): Record<string, string> {
  const rawUrl =
    digest.unsubscribeUrl ??
    (digest.unsubscribeToken
      ? `https://railsignal.london/unsubscribe?token=${encodeURIComponent(digest.unsubscribeToken)}`
      : undefined);

  const unsubscribeUrl = rawUrl ? rawUrl.trim().replace(/^<+|>+$/g, '') : undefined;

  if (!unsubscribeUrl) {
    return { ...(customHeaders ?? {}) };
  }

  // Case-insensitive filtering of colliding headers so RFC 8058 headers take strict precedence
  const sanitizedHeaders = Object.fromEntries(
    Object.entries(customHeaders ?? {}).filter(
      ([k]) => !['list-unsubscribe', 'list-unsubscribe-post'].includes(k.toLowerCase()),
    ),
  );

  return {
    ...sanitizedHeaders,
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
