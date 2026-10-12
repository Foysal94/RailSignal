import { randomUUID } from 'node:crypto';
import React from 'react';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { config } from '../config.js';
import DisruptionDigest, { type DisruptionDigestProps } from './templates/DisruptionDigest.js';

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
  from?: string;
  replyTo?: string | string[];
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
}

export interface ResendClientOptions {
  resendApiKey?: string;
  nodeEnv?: string;
  fromEmail?: string;
  logger?: Logger;
  resendInstance?: Resend;
}

export class ResendEmailClient {
  private readonly resend: Resend | null;
  private readonly nodeEnv: string;
  private readonly defaultFrom: string;
  private readonly logger: Logger;

  constructor(options: ResendClientOptions = {}) {
    this.nodeEnv = options.nodeEnv ?? config.nodeEnv;
    this.defaultFrom =
      options.fromEmail ?? config.emailFrom ?? 'RailSignal Alerts <alerts@railsignal.london>';
    this.logger = options.logger ?? console;

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
    if (options.react) {
      htmlContent = await render(options.react);
    } else if (options.html) {
      htmlContent = options.html;
    } else {
      throw new Error('Either react element or html string must be provided');
    }

    const fromAddress = options.from ?? this.defaultFrom;

    // Resend API key is omitted in local dev or test environments; fallback to console logging
    if (!this.resend) {
      if (this.nodeEnv === 'production') {
        throw new Error('RESEND_API_KEY is required in production environment');
      }

      const recipientText = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      this.logger.info(
        `[Resend Mock Fallback] Email to ${recipientText} with subject "${options.subject}":\n${htmlContent}`
      );

      return {
        id: `mock-${randomUUID()}`,
        delivered: false,
        mocked: true,
      };
    }

    const response = await this.resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: htmlContent,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

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

    return this.sendEmail({
      to: options.to,
      subject,
      react: digestElement,
      ...(options.from ? { from: options.from } : {}),
    });
  }
}

export function createResendClient(options?: ResendClientOptions): ResendEmailClient {
  return new ResendEmailClient(options);
}

export const resendClient = createResendClient();
