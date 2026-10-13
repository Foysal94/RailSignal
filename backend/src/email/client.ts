import { randomUUID } from 'node:crypto';
import type { IPolicy } from 'cockatiel';
import React from 'react';
import { Resend } from 'resend';
import { config } from '../config.js';
import { buildUnsubscribeHeaders } from './headers.js';
import { renderEmail } from './renderer.js';
import { createResendRetryPolicy } from './resilience.js';
import DisruptionDigest from './templates/DisruptionDigest.js';
import type {
  DisruptionDigestProps,
  Logger,
  SendDisruptionDigestOptions,
  SendEmailOptions,
  SendEmailResult,
} from './types.js';

export interface EmailClientOptions {
  resendApiKey?: string;
  nodeEnv?: string;
  fromEmail?: string;
  logger?: Logger;
  resendInstance?: Resend;
  retryPolicy?: IPolicy;
}

/**
 * Deep transactional email client consolidating template compilation,
 * RFC 8058 deliverability headers, Cockatiel retries, and Resend delivery.
 */
export class EmailClient {
  private readonly resend: Resend | null;
  private readonly nodeEnv: string;
  private readonly defaultFrom: string;
  private readonly logger: Logger;
  private readonly retryPolicy: IPolicy;

  constructor(options: EmailClientOptions = {}) {
    this.nodeEnv = options.nodeEnv ?? config.nodeEnv;
    this.defaultFrom =
      options.fromEmail ?? config.emailFrom ?? 'RailSignal Alerts <alerts@railsignal.london>';
    this.logger = options.logger ?? console;
    this.retryPolicy = options.retryPolicy ?? createResendRetryPolicy();

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
      const rendered = await renderEmail(options.react);
      htmlContent = rendered.html;
      if (!textContent) {
        textContent = rendered.text;
      }
    } else if (options.html) {
      htmlContent = options.html;
    } else {
      throw new Error('Either react element or html string must be provided');
    }

    const fromAddress = options.from ?? this.defaultFrom;

    if (!this.resend) {
      if (this.nodeEnv === 'production') {
        throw new Error('RESEND_API_KEY is required in production environment');
      }

      const recipientText = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      this.logger.info(
        `[Resend Mock Fallback] Email to ${recipientText} | Subject: "${options.subject}" (${htmlContent.length} bytes HTML)\n` +
          `Preview:\n${textContent ?? htmlContent.slice(0, 300)}`,
      );

      return {
        id: `mock-${randomUUID()}`,
        delivered: false,
        mocked: true,
      };
    }

    const resend = this.resend;
    const response = await this.retryPolicy.execute(async () => {
      const res = await resend.emails.send({
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
      options.digest as DisruptionDigestProps & React.Attributes,
    );

    const headers = buildUnsubscribeHeaders(options.digest, options.headers);

    return this.sendEmail({
      to: options.to,
      subject,
      react: digestElement,
      headers,
      ...(options.from ? { from: options.from } : {}),
    });
  }
}

let _defaultClient: EmailClient | null = null;

export function createEmailClient(options?: EmailClientOptions): EmailClient {
  return new EmailClient(options);
}

export function getEmailClient(): EmailClient {
  if (!_defaultClient) {
    _defaultClient = createEmailClient();
  }
  return _defaultClient;
}

/**
 * Lazy singleton proxy. Defers initialization until first method call so configuration
 * and environment variables are guaranteed to be populated, while preserving method `this` context.
 */
export const emailClient = new Proxy({} as EmailClient, {
  get(_target, prop, receiver) {
    const instance = getEmailClient();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
