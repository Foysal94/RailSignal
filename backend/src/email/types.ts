import type { DisruptionNotice, LineMode } from '@railsignal/shared';
import type React from 'react';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface DisruptionDigestItem {
  lineId: string;
  lineName: string;
  mode?: LineMode;
  color?: string;
  contrastBorder?: boolean;
  statusSeverityDescription: string;
  corridorDescription: string;
  notices?: DisruptionNotice[];
}

export interface DisruptionDigestProps {
  recipientEmail?: string;
  weekendDate?: string;
  weekendWindowDescription?: string;
  disruptions?: DisruptionDigestItem[];
  unsubscribeToken?: string;
  unsubscribeUrl?: string;
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
