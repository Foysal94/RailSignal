import type { DisruptionDigestProps } from './types.js';

/**
 * Constructs email headers enforcing RFC 8058 one-click unsubscribe compliance.
 *
 * Rationale:
 * Gmail and Yahoo (effective February 2024) mandate that bulk senders provide both:
 * 1. A bracketed URI in 'List-Unsubscribe' (<https://...>)
 * 2. The exact header 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'
 * Failing to provide both triggers deliverability degradation and spam filtering.
 *
 * Precedence & Normalization:
 * - Colliding header keys (case-insensitive) are stripped from customHeaders so that RFC 8058
 *   headers take precedence and prevent duplicate/conflicting header fields.
 * - Leading/trailing brackets are normalized to prevent invalid double-bracket syntax <<...>>.
 */
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

  // Case-insensitive filtering of colliding headers to prevent duplicate list-unsubscribe headers
  const sanitizedHeaders = Object.fromEntries(
    Object.entries(customHeaders ?? {}).filter(
      ([k]) => !['list-unsubscribe', 'list-unsubscribe-post'].includes(k.toLowerCase()),
    ),
  );

  return {
    ...sanitizedHeaders,
    ...(unsubscribeUrl
      ? {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : {}),
  };
}
