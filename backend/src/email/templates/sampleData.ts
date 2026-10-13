import type { DisruptionDigestProps } from './DisruptionDigest.js';

export const SAMPLE_DISRUPTION_DIGEST_PROPS: Required<DisruptionDigestProps> = {
  recipientEmail: 'commuter@example.com',
  weekendDate: '2026-10-16',
  weekendWindowDescription: 'Friday 16 Oct, 19:00 – Monday 19 Oct, 04:30 UK Local Time',
  disruptions: [
    {
      lineId: 'central',
      lineName: 'Central',
      mode: 'tube',
      color: '#E32017',
      statusSeverityDescription: 'Part Closure',
      corridorDescription:
        'No service between White City and West Ruislip. Rail replacement buses operate.',
    },
    {
      lineId: 'northern',
      lineName: 'Northern',
      mode: 'tube',
      color: '#000000',
      contrastBorder: true,
      statusSeverityDescription: 'Planned Closure',
      corridorDescription: 'No service between Camden Town and High Barnet due to track renewal.',
    },
  ],
  unsubscribeToken: 'sample_token_xyz_123',
  unsubscribeUrl: 'https://railsignal.london/unsubscribe?token=sample_token_xyz_123',
};
