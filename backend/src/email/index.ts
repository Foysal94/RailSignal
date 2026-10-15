export {
  createEmailClient,
  EmailClient,
  type EmailClientOptions,
  emailClient,
} from './client.js';
export { sendDisruptionDigest } from './digest.js';
export type {
  DisruptionDigestItem,
  DisruptionDigestProps,
  Logger,
  SendDisruptionDigestOptions,
  SendEmailOptions,
  SendEmailResult,
} from './types.js';

// Compatibility export for background workers expecting a client object with sendDisruptionDigest
import { sendDisruptionDigest } from './digest.js';
import type { SendDisruptionDigestOptions, SendEmailResult } from './types.js';

export interface DisruptionDigestSender {
  sendDisruptionDigest(options: SendDisruptionDigestOptions): Promise<SendEmailResult>;
}
export type ResendEmailClient = DisruptionDigestSender;
export const resendClient: DisruptionDigestSender = {
  sendDisruptionDigest,
};
