import type { IPolicy } from 'cockatiel';
import React from 'react';
import type { Resend } from 'resend';
import { describe, expect, it, vi } from 'vitest';
import { createEmailClient, EmailClient, emailClient } from '../../../src/email/client.js';
import type { Logger } from '../../../src/email/types.js';

describe('EmailClient', () => {
  it('Should_use_mock_fallback_and_log_html_when_resend_api_key_is_omitted_in_development', async () => {
    const loggedMessages: string[] = [];
    const mockLogger: Logger = {
      info: (msg: string) => loggedMessages.push(msg),
      warn: (msg: string) => loggedMessages.push(msg),
      error: (msg: string) => loggedMessages.push(msg),
    };

    const client = new EmailClient({
      nodeEnv: 'development',
      logger: mockLogger,
    });

    const result = await client.sendEmail({
      to: 'commuter@example.com',
      subject: 'Weekend Radar Alert',
      react: React.createElement('div', null, 'Mock alert content'),
    });

    expect(result.delivered).toBe(false);
    expect(result.mocked).toBe(true);
    expect(result.id).toMatch(/^mock-/);
    expect(loggedMessages.length).toBeGreaterThan(0);
    expect(loggedMessages.some((msg) => msg.includes('Mock alert content'))).toBe(true);
  });

  it('Should_throw_an_error_when_api_key_is_omitted_in_production', async () => {
    const client = new EmailClient({
      nodeEnv: 'production',
      resendApiKey: undefined,
    });

    await expect(
      client.sendEmail({
        to: 'commuter@example.com',
        subject: 'Alert',
        html: '<p>Production alert</p>',
      }),
    ).rejects.toThrow(/RESEND_API_KEY is required in production/);
  });

  it('Should_throw_an_error_when_neither_react_element_nor_html_string_is_provided', async () => {
    const client = new EmailClient({
      nodeEnv: 'development',
    });

    await expect(
      client.sendEmail({
        to: 'commuter@example.com',
        subject: 'Empty email',
      }),
    ).rejects.toThrow('Either react element or html string must be provided');
  });

  it('Should_compile_react_template_and_send_email_via_resend_sdk_when_api_key_is_provided', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'email_resend_123' },
      error: null,
    });

    const client = new EmailClient({
      nodeEnv: 'development',
      resendApiKey: 're_test_key_abc',
      resendInstance: {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend,
    });

    const result = await client.sendEmail({
      to: 'passenger@example.com',
      subject: 'Weekend Disruption Alert',
      react: React.createElement('p', null, 'Live test email'),
      from: 'RailSignal <test@railsignal.london>',
    });

    expect(result.delivered).toBe(true);
    expect(result.mocked).toBe(false);
    expect(result.id).toBe('email_resend_123');
    expect(mockSend).toHaveBeenCalledOnce();

    const callArgs = mockSend.mock.calls[0]?.[0];
    expect(callArgs.to).toBe('passenger@example.com');
    expect(callArgs.subject).toBe('Weekend Disruption Alert');
    expect(callArgs.from).toBe('RailSignal <test@railsignal.london>');
    expect(callArgs.html).toContain('Live test email');
    expect(callArgs.text).toContain('Live test email');
  });

  it('Should_throw_an_error_when_resend_sdk_returns_an_api_error', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: null,
      error: {
        name: 'validation_error',
        message: 'Invalid email recipient address',
      },
    });

    const client = new EmailClient({
      nodeEnv: 'production',
      resendApiKey: 're_live_key',
      resendInstance: {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend,
    });

    await expect(
      client.sendEmail({
        to: 'invalid-email',
        subject: 'Weekend alert',
        html: '<p>Content</p>',
      }),
    ).rejects.toThrow('Invalid email recipient address');
  });

  it('Should_retry_on_transient_rate_limit_and_succeed_when_subsequent_request_passes', async () => {
    const mockSend = vi
      .fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded: 429 too many requests'))
      .mockResolvedValueOnce({
        data: { id: 'email_after_retry_456' },
        error: null,
      });

    const client = new EmailClient({
      nodeEnv: 'production',
      resendApiKey: 're_live_key',
      resendInstance: {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend,
    });

    const result = await client.sendEmail({
      to: 'commuter@example.com',
      subject: 'Alert with retry',
      html: '<p>Content</p>',
    });

    expect(result.delivered).toBe(true);
    expect(result.id).toBe('email_after_retry_456');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('Should_accept_custom_retry_policy_in_constructor_options_for_test_isolation', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'email_custom_policy_111' },
      error: null,
    });

    const executedPolicySpies: string[] = [];
    const customPolicy: IPolicy = {
      execute: async (fn) => {
        executedPolicySpies.push('custom_policy_executed');
        return fn({ attempt: 1 } as never);
      },
    } as unknown as IPolicy;

    const client = new EmailClient({
      nodeEnv: 'production',
      resendApiKey: 're_live_key',
      retryPolicy: customPolicy,
      resendInstance: {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend,
    });

    const result = await client.sendEmail({
      to: 'commuter@example.com',
      subject: 'Custom policy test',
      html: '<p>Custom policy</p>',
    });

    expect(result.delivered).toBe(true);
    expect(executedPolicySpies).toContain('custom_policy_executed');
  });

  it('Should_send_disruption_digest_with_rfc_8058_unsubscribe_headers_and_rendered_template', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'email_digest_789' },
      error: null,
    });

    const client = new EmailClient({
      nodeEnv: 'production',
      resendApiKey: 're_live_key',
      resendInstance: {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend,
    });

    const result = await client.sendDisruptionDigest({
      to: 'subscriber@example.com',
      digest: {
        recipientEmail: 'subscriber@example.com',
        weekendDate: '2026-10-16',
        disruptions: [
          {
            lineId: 'central',
            lineName: 'Central',
            mode: 'tube',
            color: '#E32017',
            statusSeverityDescription: 'Part Closure',
            corridorDescription: 'No service between White City and West Ruislip.',
          },
        ],
        unsubscribeToken: 'token_123',
        unsubscribeUrl: 'https://railsignal.london/unsubscribe?token=token_123',
      },
    });

    expect(result.delivered).toBe(true);
    const callArgs = mockSend.mock.calls[0]?.[0];
    expect(callArgs.headers['List-Unsubscribe']).toBe(
      '<https://railsignal.london/unsubscribe?token=token_123>',
    );
    expect(callArgs.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(callArgs.html).toContain('Central');
    expect(callArgs.text).toContain('Central');
  });

  it('Should_preserve_custom_subject_and_from_when_sending_disruption_digest', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'email_custom_digest_999' },
      error: null,
    });

    const client = new EmailClient({
      nodeEnv: 'production',
      resendApiKey: 're_live_key',
      resendInstance: {
        emails: {
          send: mockSend,
        },
      } as unknown as Resend,
    });

    await client.sendDisruptionDigest({
      to: 'subscriber@example.com',
      from: 'Custom Sender <custom@railsignal.london>',
      subject: 'Custom Disruption Radar Subject',
      digest: {
        weekendDate: '2026-10-16',
        disruptions: [],
      },
    });

    const callArgs = mockSend.mock.calls[0]?.[0];
    expect(callArgs.from).toBe('Custom Sender <custom@railsignal.london>');
    expect(callArgs.subject).toBe('Custom Disruption Radar Subject');
  });

  it('Should_instantiate_via_createEmailClient_factory', () => {
    const client = createEmailClient({ nodeEnv: 'development' });
    expect(client).toBeInstanceOf(EmailClient);
  });

  it('Should_delegate_calls_via_lazy_emailClient_proxy_singleton', async () => {
    expect('sendEmail' in emailClient).toBe(true);
    expect('sendDisruptionDigest' in emailClient).toBe(true);
    expect(emailClient).toBeInstanceOf(EmailClient);

    const result = await emailClient.sendEmail({
      to: 'lazy@example.com',
      subject: 'Lazy proxy test',
      html: '<p>Lazy</p>',
    });

    expect(result.mocked).toBe(true);
    expect(result.delivered).toBe(false);
  });
});
