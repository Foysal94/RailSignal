import { describe, expect, it } from 'vitest';
import { buildUnsubscribeHeaders } from '../../../src/email/headers.js';

describe('buildUnsubscribeHeaders', () => {
  it('Should_build_rfc_8058_headers_with_bracketed_url_when_unsubscribe_url_is_provided', () => {
    const headers = buildUnsubscribeHeaders({
      unsubscribeUrl: 'https://railsignal.london/unsubscribe?custom=1',
    });

    expect(headers).toEqual({
      'List-Unsubscribe': '<https://railsignal.london/unsubscribe?custom=1>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('Should_generate_encoded_unsubscribe_url_when_only_unsubscribe_token_is_provided', () => {
    const headers = buildUnsubscribeHeaders({
      unsubscribeToken: 'token with spaces+symbols/123',
    });

    expect(headers).toEqual({
      'List-Unsubscribe':
        '<https://railsignal.london/unsubscribe?token=token%20with%20spaces%2Bsymbols%2F123>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('Should_prefer_explicit_unsubscribe_url_over_token_when_both_are_provided', () => {
    const headers = buildUnsubscribeHeaders({
      unsubscribeUrl: 'https://railsignal.london/custom-unsubscribe',
      unsubscribeToken: 'token_ignored',
    });

    expect(headers['List-Unsubscribe']).toBe('<https://railsignal.london/custom-unsubscribe>');
  });

  it('Should_return_custom_headers_without_unsubscribe_headers_when_neither_url_nor_token_is_provided', () => {
    const headers = buildUnsubscribeHeaders({}, { 'X-Campaign-ID': 'campaign_456' });

    expect(headers).toEqual({
      'X-Campaign-ID': 'campaign_456',
    });
    expect(headers['List-Unsubscribe']).toBeUndefined();
    expect(headers['List-Unsubscribe-Post']).toBeUndefined();
  });

  it('Should_override_colliding_custom_headers_with_rfc_8058_headers', () => {
    const headers = buildUnsubscribeHeaders(
      { unsubscribeToken: 'safe_token_123' },
      {
        'List-Unsubscribe': 'invalid-unbracketed-value',
        'List-Unsubscribe-Post': 'invalid-post-value',
        'X-Trace-ID': 'trace_999',
      },
    );

    expect(headers['List-Unsubscribe']).toBe(
      '<https://railsignal.london/unsubscribe?token=safe_token_123>',
    );
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(headers['X-Trace-ID']).toBe('trace_999');
  });

  it('Should_preserve_non_colliding_custom_headers', () => {
    const headers = buildUnsubscribeHeaders(
      { unsubscribeUrl: 'https://railsignal.london/unsubscribe?token=abc' },
      {
        'X-Entity-Ref': 'sub_888',
        'X-Mailer': 'RailSignal-Mailer/1.0',
      },
    );

    expect(headers).toEqual({
      'X-Entity-Ref': 'sub_888',
      'X-Mailer': 'RailSignal-Mailer/1.0',
      'List-Unsubscribe': '<https://railsignal.london/unsubscribe?token=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('Should_return_empty_object_when_no_digest_fields_and_no_custom_headers_are_provided', () => {
    const headers = buildUnsubscribeHeaders({});
    expect(headers).toEqual({});
  });
});
