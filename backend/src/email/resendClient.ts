import { randomUUID } from 'node:crypto';
import React from 'react';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import {
  handleWhen,
  retry,
  ExponentialBackoff,
  type IPolicy,
} from 'cockatiel';
import { config } from '../config.js';
import DisruptionDigest, {
  type DisruptionDigestProps,
} from './templates/DisruptionDigest.js';

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

export interface ResendClientOptions {
  resendApiKey?: string;
  nodeEnv?: string;
  fromEmail?: string;
  logger?: Logger;
  resendInstance?: Resend;
  retryPolicy?: IPolicy;
}

export class ResendEmailClient {
  private readonly resend: Resend | null;
  private readonly nodeEnv: string;
  private readonly defaultFrom: string;
  private readonly logger: Logger;
  private readonly retryPolicy: IPolicy;

  constructor(options: ResendClientOptions = {}) {
    this.nodeEnv = options.nodeEnv ?? config.nodeEnv;
    this.defaultFrom =
      options.fromEmail ?? config.emailFrom ?? 'RailSignal Alerts <alerts@railsignal.london>';
    this.logger = options.logger ?? console;

    // Resend free tier enforces rate limits (2 req/s); retry on transient 429/5xx errors with exponential backoff
    this.retryPolicy =
      options.retryPolicy ??
      retry(
        handleWhen((err: unknown) => {
          if (err instanceof Error) {
            const msg = err.message.toLowerCase();
            return msg.includes('429') || msg.includes('rate limit') || msg.includes('500') || msg.includes('503');
          }
          return false;
        }),
        { maxAttempts: 3, backoff: new ExponentialBackoff() }
      );

    const apiKey = options.resendApiKey ?? config.resendApiKey;

    if (options.resendInstance) {
      this.resend = options.resendInstance;
    } else if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    let htmlContent: string;
    let textContent: string | undefined = options.text;

    if (options.react) {
      htmlContent = await render(options.react);
      if (!textContent) {
        textContent = await render(options.react, { plainText: true });
      }
    } else if (options.html) {
      htmlContent = options.html;
    } else {
      throw new Error('Either react element or html string must be provided');
    }

    const fromAddress = options.from ?? this.defaultFrom;

    // In development and test when RESEND_API_KEY is omitted, avoid hitting live quotas and log preview
    if (!this.resend) {
      if (this.nodeEnv === 'production') {
        throw new Error('RESEND_API_KEY is required in production environment');
      }

      const recipientText = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      this.logger.info(
        `[Resend Mock Fallback] Email to ${recipientText} | Subject: "${options.subject}" (${htmlContent.length} bytes HTML)\n` +
          `Preview:\n${textContent ?? htmlContent.slice(0, 300)}`
      );

      return {
        id: `mock-${randomUUID()}`,
        delivered: false,
        mocked: true,
      };
    }

    const response = await this.retryPolicy.execute(async () => {
      const res = await this.resend!.emails.send({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: htmlContent,
        ...(textContent ? { text: textContent } : {}),
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
      });

      if (res.error) {
        throw new Error(res.error.message);
      }

      return res;
    });

    if (!response.data) {
      throw new Error('Resend dispatch did not return email identifier data');
    }

    return {
      id: response.data.id,
      delivered: true,
      mocked: false,
    };
  }

  async sendDisruptionDigest(options: SendDisruptionDigestOptions): Promise<SendEmailResult> {
    const subject =
      options.subject ??
      `RailSignal Weekend Radar: ${options.digest.weekendDate ?? 'Disruption Digest'}`;
    const digestElement = React.createElement(
      DisruptionDigest,
      options.digest as DisruptionDigestProps & React.Attributes
    );

    const unsubscribeUrl =
      options.digest.unsubscribeUrl ??
      `https://railsignal.london/unsubscribe?token=${encodeURIComponent(options.digest.unsubscribeToken ?? '')}`;

    // RFC 8058 one-click list unsubscribe headers for inbox provider reputation (Gmail, Yahoo, Apple Mail)
    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...options.headers,
    };

    return this.sendEmail({
      to: options.to,
      subject,
      react: digestElement,
      headers,
      ...(options.from ? { from: options.from } : {}),
    });
  }
}

export function createResendClient(options?: ResendClientOptions): ResendEmailClient {
  return new ResendEmailClient(options);
}

export const resendClient = createResendClient();
