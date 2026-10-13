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
 * Precedence:
 * Generated RFC 8058 headers strictly override any colliding keys supplied in customHeaders
 * to prevent accidental misconfiguration or non-compliant values.
 */
export function buildUnsubscribeHeaders(
  digest: Pick<DisruptionDigestProps, 'unsubscribeUrl' | 'unsubscribeToken'>,
  customHeaders?: Record<string, string>,
): Record<string, string> {
  const unsubscribeUrl =
    digest.unsubscribeUrl ??
    (digest.unsubscribeToken
      ? `https://railsignal.london/unsubscribe?token=${encodeURIComponent(digest.unsubscribeToken)}`
      : undefined);

  return {
    ...customHeaders,
    ...(unsubscribeUrl
      ? {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : {}),
  };
}
