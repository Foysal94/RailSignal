import React from 'react';
import { type EmailClient, emailClient } from './client.js';
import { buildUnsubscribeHeaders } from './headers.js';
import DisruptionDigest from './templates/DisruptionDigest.js';
import type {
  DisruptionDigestProps,
  SendDisruptionDigestOptions,
  SendEmailResult,
} from './types.js';

/**
 * Domain dispatcher coordinating transactional email templates and domain payloads.
 *
 * Rationale:
 * Keeps domain presentation logic (React email template creation, fallback subjects, and
 * RFC 8058 deliverability headers) decoupled from the underlying network transport client,
 * adhering to Single Responsibility and avoiding God-object accumulation as new email types are added.
 */
export async function sendDisruptionDigest(
  options: SendDisruptionDigestOptions,
  client: EmailClient = emailClient,
): Promise<SendEmailResult> {
  const subject =
    options.subject ??
    `RailSignal Weekend Radar: ${options.digest.weekendDate ?? 'Disruption Digest'}`;

  const digestElement = React.createElement(
    DisruptionDigest,
    options.digest as DisruptionDigestProps & React.Attributes,
  );

  const headers = buildUnsubscribeHeaders(options.digest, options.headers);

  return client.sendEmail({
    to: options.to,
    subject,
    react: digestElement,
    headers,
    ...(options.from ? { from: options.from } : {}),
  });
}
