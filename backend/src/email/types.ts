import type React from 'react';
import type { DisruptionDigestProps } from './templates/DisruptionDigest.js';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  id: string;
  delivered: boolean;
  mocked: boolean;
}

export interface SendDisruptionDigestOptions {
  to: string;
  digest: DisruptionDigestProps;
  from?: string;
  subject?: string;
  headers?: Record<string, string>;
}
