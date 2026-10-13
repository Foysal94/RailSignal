import { describe, it, expect } from 'vitest';
import { buildDigestEmailPayload } from '../../../src/email/digestService.js';
import type { SendDisruptionDigestOptions } from '../../../src/email/types.js';

describe('Digest service', () => {
  it('Should_build_email_payload_with_rfc_8058_unsubscribe_headers_and_token_url', () => {
    const options: SendDisruptionDigestOptions = {
      to: 'commuter@example.com',
      digest: {
        weekendDate: '2026-10-16',
        disruptions: [],
        unsubscribeToken: 'token_sec_999',
      },
    };

    const payload = buildDigestEmailPayload(options);

    expect(payload.to).toBe('commuter@example.com');
    expect(payload.subject).toBe('RailSignal Weekend Radar: 2026-10-16');
    expect(payload.react).toBeDefined();
    expect(payload.headers).toBeDefined();
    expect(payload.headers!['List-Unsubscribe']).toBe(
      '<https://railsignal.london/unsubscribe?token=token_sec_999>'
    );
    expect(payload.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('Should_preserve_custom_subject_and_from_when_provided', () => {
    const options: SendDisruptionDigestOptions = {
      to: 'commuter@example.com',
      from: 'Custom Sender <alerts@custom.london>',
      subject: 'Custom Disruption Notice',
      digest: {
        weekendDate: '2026-10-16',
        disruptions: [],
        unsubscribeToken: 'token_abc',
      },
    };

    const payload = buildDigestEmailPayload(options);

    expect(payload.from).toBe('Custom Sender <alerts@custom.london>');
    expect(payload.subject).toBe('Custom Disruption Notice');
  });
});
