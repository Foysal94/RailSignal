import type { Resend } from 'resend';
import { describe, expect, it, vi } from 'vitest';
import { EmailClient } from '../../../src/email/client.js';
import { sendDisruptionDigest } from '../../../src/email/digest.js';

function createMockClient(mockSend: ReturnType<typeof vi.fn>): EmailClient {
  return new EmailClient({
    nodeEnv: 'production',
    resendApiKey: 're_live_key',
    resendInstance: {
      emails: {
        send: mockSend,
      },
    } as unknown as Resend,
  });
}

describe('Domain Email Dispatcher', () => {
  it('Should_send_disruption_digest_with_rfc_8058_unsubscribe_headers_and_rendered_template', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'email_digest_789' },
      error: null,
    });

    const client = createMockClient(mockSend);

    const result = await sendDisruptionDigest(
      {
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
      },
      client,
    );

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

    const client = createMockClient(mockSend);

    await sendDisruptionDigest(
      {
        to: 'subscriber@example.com',
        from: 'Custom Sender <custom@railsignal.london>',
        subject: 'Custom Disruption Radar Subject',
        digest: {
          weekendDate: '2026-10-16',
          disruptions: [],
        },
      },
      client,
    );

    const callArgs = mockSend.mock.calls[0]?.[0];
    expect(callArgs.from).toBe('Custom Sender <custom@railsignal.london>');
    expect(callArgs.subject).toBe('Custom Disruption Radar Subject');
  });

  it('Should_fallback_to_generic_subject_when_weekendDate_is_omitted', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'email_fallback_subject' },
      error: null,
    });

    const client = createMockClient(mockSend);

    await sendDisruptionDigest(
      {
        to: 'subscriber@example.com',
        digest: {
          disruptions: [],
        },
      },
      client,
    );

    const callArgs = mockSend.mock.calls[0]?.[0];
    expect(callArgs.subject).toBe('RailSignal Weekend Radar: Disruption Digest');
  });
});
