import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import React from 'react';
import DisruptionDigest, {
  type DisruptionDigestProps,
} from '../../src/email/templates/DisruptionDigest.js';

describe('DisruptionDigest email template', () => {
  it('Should_render_disruption_digest_with_line_status_cards_brand_colors_and_corridor_details', async () => {
    const props: DisruptionDigestProps = {
      recipientEmail: 'passenger@example.com',
      weekendDate: '2026-10-16',
      weekendWindowDescription: 'Friday 16 Oct, 19:00 – Monday 19 Oct, 04:30 UK Local Time',
      disruptions: [
        {
          lineId: 'central',
          lineName: 'Central',
          mode: 'tube',
          color: '#E32017',
          statusSeverityDescription: 'Part Closure',
          corridorDescription: 'No service between White City and West Ruislip.',
        },
        {
          lineId: 'northern',
          lineName: 'Northern',
          mode: 'tube',
          color: '#000000',
          contrastBorder: true,
          statusSeverityDescription: 'Planned Closure',
          corridorDescription: 'No service between Camden Town and High Barnet.',
        },
      ],
      unsubscribeToken: 'sub_token_123',
      unsubscribeUrl: 'https://railsignal.london/unsubscribe?token=sub_token_123',
    };

    const html = await render(React.createElement(DisruptionDigest, props));

    expect(html).toContain('RailSignal');
    expect(html).toContain('Weekend Disruption Digest');
    expect(html).toContain('Friday 16 Oct, 19:00 – Monday 19 Oct, 04:30 UK Local Time');

    expect(html).toContain('Central');
    expect(html).toContain('Part Closure');
    expect(html).toContain('No service between White City and West Ruislip.');

    expect(html).toContain('Northern');
    expect(html).toContain('Planned Closure');
    expect(html).toContain('No service between Camden Town and High Barnet.');

    // Verifies inlined CSS property generation required by desktop and mobile email clients
    expect(html).toMatch(/border-left:\s*6px solid #E32017/i);
    expect(html).toMatch(/border-left:\s*6px solid #000000/i);
    expect(html).toMatch(/background-color:\s*#f8fafc/i);
  });

  it('Should_render_good_service_notice_when_no_disruptions_are_present', async () => {
    const props: DisruptionDigestProps = {
      recipientEmail: 'passenger@example.com',
      weekendDate: '2026-10-16',
      disruptions: [],
      unsubscribeToken: 'sub_token_empty',
    };

    const html = await render(React.createElement(DisruptionDigest, props));

    expect(html).toContain('Good Service');
    expect(html).toContain('No planned closures reported on your monitored lines');
    expect(html).not.toContain('Part Closure');
  });

  it('Should_render_accessible_unsubscribe_footer_with_token_and_link', async () => {
    const props: DisruptionDigestProps = {
      recipientEmail: 'passenger@example.com',
      weekendDate: '2026-10-16',
      disruptions: [],
      unsubscribeToken: 'token_abc_xyz_789',
      unsubscribeUrl: 'https://railsignal.london/unsubscribe?token=token_abc_xyz_789',
    };

    const html = await render(React.createElement(DisruptionDigest, props));

    expect(html).toContain('https://railsignal.london/unsubscribe?token=token_abc_xyz_789');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('token_abc_xyz_789');
  });

  it('Should_render_default_preview_content_when_props_are_omitted', async () => {
    const html = await render(React.createElement(DisruptionDigest));

    expect(html).toContain('RailSignal');
    expect(html).toContain('Central');
    expect(html).toContain('Northern');
  });
});
