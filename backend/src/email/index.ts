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
