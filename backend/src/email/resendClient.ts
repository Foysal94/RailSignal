import { ResendTransportClient, type TransportClientOptions } from './client.js';
import { buildDigestEmailPayload } from './digestService.js';
import type {
  Logger,
  SendDisruptionDigestOptions,
  SendEmailOptions,
  SendEmailResult,
} from './types.js';

export type ResendClientOptions = TransportClientOptions;

/**
 * Public facade coordinating email template compilation, domain digest payload
 * building, and resilient transport dispatch via Resend.
 */
export class ResendEmailClient {
  private readonly transport: ResendTransportClient;

  constructor(options: ResendClientOptions = {}) {
    this.transport = new ResendTransportClient(options);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.transport.send(options);
  }

  async sendDisruptionDigest(options: SendDisruptionDigestOptions): Promise<SendEmailResult> {
    const payload = buildDigestEmailPayload(options);
    return this.transport.send(payload);
  }
}

export function createResendClient(options?: ResendClientOptions): ResendEmailClient {
  return new ResendEmailClient(options);
}

export const resendClient = createResendClient();

export type { Logger, SendEmailOptions, SendEmailResult, SendDisruptionDigestOptions };
