import type { IPolicy } from 'cockatiel';
import React from 'react';
import type { Resend } from 'resend';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmailClient,
  EmailClient,
  type EmailClientOptions,
  emailClient,
  getEmailClient,
  resetEmailClient,
} from '../../../src/email/client.js';
import { createResendRetryPolicy } from '../../../src/email/resilience.js';
import type { Logger } from '../../../src/email/types.js';

function createMockClient(
  mockSend: ReturnType<typeof vi.fn>,
  options: Partial<EmailClientOptions> = {},
): EmailClient {
  return new EmailClient({
    nodeEnv: 'production',
    resendApiKey: 're_live_key',
    resendInstance: {
      emails: {
        send: mockSend,
      },
    } as unknown as Resend,
    ...options,
  });
}

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

    const client = createMockClient(mockSend, {
      nodeEnv: 'development',
      resendApiKey: 're_test_key_abc',
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

    const client = createMockClient(mockSend);

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

    const client = createMockClient(mockSend, {
      retryPolicy: createResendRetryPolicy(3, 0),
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

  it('Should_retry_transient_network_fetch_failures_and_succeed_on_subsequent_request', async () => {
    const mockSend = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        data: { id: 'email_recovered_789' },
        error: null,
      });

    const client = createMockClient(mockSend, {
      retryPolicy: createResendRetryPolicy(3, 0),
    });

    const result = await client.sendEmail({
      to: 'commuter@example.com',
      subject: 'Network retry alert',
      html: '<p>Recovered</p>',
    });

    expect(result.delivered).toBe(true);
    expect(result.id).toBe('email_recovered_789');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('Should_not_retry_fatal_non_transient_errors_and_throw_immediately', async () => {
    const mockSend = vi.fn().mockRejectedValue(new Error('Unauthorized: 401'));

    const client = createMockClient(mockSend, {
      retryPolicy: createResendRetryPolicy(3, 0),
    });

    await expect(
      client.sendEmail({
        to: 'commuter@example.com',
        subject: 'Fatal error alert',
        html: '<p>Fatal</p>',
      }),
    ).rejects.toThrow('Unauthorized: 401');

    expect(mockSend).toHaveBeenCalledOnce();
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

    const client = createMockClient(mockSend, {
      retryPolicy: customPolicy,
    });

    const result = await client.sendEmail({
      to: 'commuter@example.com',
      subject: 'Custom policy test',
      html: '<p>Custom policy</p>',
    });

    expect(result.delivered).toBe(true);
    expect(executedPolicySpies).toContain('custom_policy_executed');
  });

  it('Should_instantiate_via_createEmailClient_factory', () => {
    const client = createEmailClient({ nodeEnv: 'development' });
    expect(client).toBeInstanceOf(EmailClient);
  });

  it('Should_delegate_calls_via_lazy_emailClient_proxy_singleton', async () => {
    expect('sendEmail' in emailClient).toBe(true);
    expect(emailClient).toBeInstanceOf(EmailClient);

    const result = await emailClient.sendEmail({
      to: 'lazy@example.com',
      subject: 'Lazy proxy test',
      html: '<p>Lazy</p>',
    });

    expect(result.mocked).toBe(true);
    expect(result.delivered).toBe(false);
  });

  it('Should_reset_singleton_instance_via_resetEmailClient', () => {
    const client1 = getEmailClient();
    expect(client1).toBeInstanceOf(EmailClient);
    resetEmailClient();
    const client2 = getEmailClient();
    expect(client2).toBeInstanceOf(EmailClient);
    expect(client2).not.toBe(client1);
  });
});
