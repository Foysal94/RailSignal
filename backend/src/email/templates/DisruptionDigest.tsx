import React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { getTflLineById, type LineMode } from '@railsignal/shared';

export interface DisruptionDigestItem {
  lineId: string;
  lineName: string;
  mode?: LineMode;
  color?: string;
  contrastBorder?: boolean;
  statusSeverityDescription: string;
  corridorDescription: string;
}

export interface DisruptionDigestProps {
  recipientEmail?: string;
  weekendDate?: string;
  weekendWindowDescription?: string;
  disruptions?: DisruptionDigestItem[];
  unsubscribeToken?: string;
  unsubscribeUrl?: string;
}

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
      corridorDescription: 'No service between White City and West Ruislip. Rail replacement buses operate.',
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

export default function DisruptionDigest(props: DisruptionDigestProps = {}): React.JSX.Element {
  const isPreview = Object.keys(props).length === 0;
  const weekendDate = props.weekendDate ?? (isPreview ? SAMPLE_DISRUPTION_DIGEST_PROPS.weekendDate : '');
  const weekendWindowDescription =
    props.weekendWindowDescription ??
    (isPreview
      ? SAMPLE_DISRUPTION_DIGEST_PROPS.weekendWindowDescription
      : `Weekend Window: Friday 19:00 – Monday 04:30 UK Local Time (${weekendDate})`);
  const disruptions = props.disruptions ?? (isPreview ? SAMPLE_DISRUPTION_DIGEST_PROPS.disruptions : []);
  const unsubscribeToken =
    props.unsubscribeToken ?? (isPreview ? SAMPLE_DISRUPTION_DIGEST_PROPS.unsubscribeToken : '');
  const unsubscribeUrl =
    props.unsubscribeUrl ?? `https://railsignal.london/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  const hasDisruptions = disruptions.length > 0;
  const previewText = hasDisruptions
    ? `RailSignal: ${disruptions.length} planned weekend disruption${disruptions.length > 1 ? 's' : ''} detected for your lines`
    : 'RailSignal: All monitored lines running with Good Service this weekend';

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading as="h1" style={styles.brandTitle}>
              RailSignal
            </Heading>
            <Text style={styles.brandSubtitle}>London Weekend Closure Radar</Text>
          </Section>

          <Section style={styles.summarySection}>
            <Heading as="h2" style={styles.sectionTitle}>
              Weekend Disruption Digest
            </Heading>
            <Text style={styles.windowDescription}>{weekendWindowDescription}</Text>
          </Section>

          <Section style={styles.contentSection}>
            {hasDisruptions ? (
              disruptions.map((item, index) => {
                const staticLine = getTflLineById(item.lineId);
                const lineColor = item.color ?? staticLine?.color ?? '#0019A8';
                const hasContrastBorder = item.contrastBorder ?? staticLine?.contrastBorder ?? false;

                return (
                  <Section
                    key={`${item.lineId}-${index}`}
                    style={{
                      ...styles.card,
                      borderLeft: `6px solid ${lineColor}`,
                      border: hasContrastBorder ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                    }}
                  >
                    <table style={styles.fullWidthTable}>
                      <tbody>
                        <tr>
                          <td style={styles.cardHeaderCell}>
                            <Text style={styles.lineName}>{item.lineName}</Text>
                          </td>
                          <td style={styles.badgeCell}>
                            <span style={styles.severityBadge}>
                              {item.statusSeverityDescription}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <Text style={styles.corridorDescription}>
                      {item.corridorDescription}
                    </Text>
                  </Section>
                );
              })
            ) : (
              <Section style={styles.goodServiceCard}>
                <table style={styles.fullWidthTable}>
                  <tbody>
                    <tr>
                      <td>
                        <Text style={styles.goodServiceTitle}>Good Service</Text>
                        <Text style={styles.goodServiceDescription}>
                          No planned closures reported on your monitored lines for this weekend window.
                        </Text>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>
            )}
          </Section>

          <Section style={styles.footerSection}>
            <Hr style={styles.divider} />
            <Text style={styles.footerNote}>
              You received this radar digest because you subscribed to RailSignal closure alerts for your monitored London transit routes.
            </Text>
            <Text style={styles.footerLinkRow}>
              <Link href={unsubscribeUrl} style={styles.unsubscribeLink}>
                Unsubscribe from alerts
              </Link>
            </Text>
            {unsubscribeToken && (
              <Text style={styles.footerToken}>
                Subscription Token: <code style={styles.tokenCode}>{unsubscribeToken}</code>
              </Text>
            )}
            <Text style={styles.footerBrand}>
              RailSignal · Automated London Transit Engineering Radar
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    margin: '0 auto',
    maxWidth: '580px',
    overflow: 'hidden' as const,
  },
  header: {
    backgroundColor: '#0f172a',
    padding: '28px 32px',
    textAlign: 'center' as const,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: '26px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    margin: '0 0 4px',
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: '13px',
    letterSpacing: '0.5px',
    margin: 0,
    textTransform: 'uppercase' as const,
  },
  summarySection: {
    padding: '24px 32px 12px',
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 6px',
  },
  windowDescription: {
    color: '#64748b',
    fontSize: '14px',
    lineHeight: '20px',
    margin: 0,
  },
  contentSection: {
    padding: '12px 32px 24px',
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
    marginBottom: '14px',
    padding: '16px',
  },
  fullWidthTable: {
    borderCollapse: 'collapse' as const,
    width: '100%',
  },
  cardHeaderCell: {
    verticalAlign: 'middle',
  },
  lineName: {
    color: '#0f172a',
    fontSize: '17px',
    fontWeight: '700',
    margin: 0,
  },
  badgeCell: {
    textAlign: 'right' as const,
    verticalAlign: 'middle',
  },
  severityBadge: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    color: '#991b1b',
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.2px',
    padding: '3px 8px',
  },
  corridorDescription: {
    color: '#334155',
    fontSize: '14px',
    lineHeight: '21px',
    margin: '10px 0 0',
  },
  goodServiceCard: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderLeft: '6px solid #16a34a',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
    padding: '18px',
  },
  goodServiceTitle: {
    color: '#166534',
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 4px',
  },
  goodServiceDescription: {
    color: '#15803d',
    fontSize: '14px',
    lineHeight: '20px',
    margin: 0,
  },
  footerSection: {
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    padding: '24px 32px 32px',
    textAlign: 'center' as const,
  },
  divider: {
    borderColor: '#e2e8f0',
    margin: '0 0 20px',
  },
  footerNote: {
    color: '#64748b',
    fontSize: '13px',
    lineHeight: '18px',
    margin: '0 0 12px',
  },
  footerLinkRow: {
    margin: '0 0 12px',
  },
  unsubscribeLink: {
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: '600',
    textDecoration: 'underline',
  },
  footerToken: {
    color: '#94a3b8',
    fontSize: '11px',
    margin: '0 0 8px',
  },
  tokenCode: {
    backgroundColor: '#e2e8f0',
    borderRadius: '3px',
    color: '#475569',
    fontFamily: 'monospace',
    padding: '2px 4px',
  },
  footerBrand: {
    color: '#94a3b8',
    fontSize: '12px',
    margin: 0,
  },
};
