export {
  createEmailClient,
  EmailClient,
  type EmailClientOptions,
  emailClient,
  resetEmailClient,
} from './client.js';
export { sendDisruptionDigest } from './dispatcher.js';
export type {
  DisruptionDigestItem,
  DisruptionDigestProps,
  Logger,
  SendDisruptionDigestOptions,
  SendEmailOptions,
  SendEmailResult,
} from './types.js';
