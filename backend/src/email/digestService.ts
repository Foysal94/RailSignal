import React from 'react';
import DisruptionDigest, {
  type DisruptionDigestProps,
} from './templates/DisruptionDigest.js';
import type { SendDisruptionDigestOptions, SendEmailOptions } from './types.js';

/**
 * Transforms disruption digest domain parameters into a fully configured email
 * dispatch payload, including RFC 8058 one-click list-unsubscribe headers when available.
 */
export function buildDigestEmailPayload(
  options: SendDisruptionDigestOptions
): SendEmailOptions {
  const subject =
    options.subject ??
    `RailSignal Weekend Radar: ${options.digest.weekendDate ?? 'Disruption Digest'}`;

  const digestElement = React.createElement(
    DisruptionDigest,
    options.digest as DisruptionDigestProps & React.Attributes
  );

  const unsubscribeUrl =
    options.digest.unsubscribeUrl ??
    (options.digest.unsubscribeToken
      ? `https://railsignal.london/unsubscribe?token=${encodeURIComponent(options.digest.unsubscribeToken)}`
      : undefined);

  // RFC 8058 one-click list-unsubscribe headers for inbox deliverability
  const headers: Record<string, string> = {
    ...(unsubscribeUrl
      ? {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : {}),
    ...options.headers,
  };

  return {
    to: options.to,
    subject,
    react: digestElement,
    headers,
    ...(options.from ? { from: options.from } : {}),
  };
}
