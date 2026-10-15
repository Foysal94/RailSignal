import { getTflLineById } from '@railsignal/shared';
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
import type React from 'react';
import type { DisruptionDigestItem, DisruptionDigestProps } from '../types.js';
import { SAMPLE_DISRUPTION_DIGEST_PROPS } from './sampleData.js';
import { emailStyles } from './styles.js';

export type { DisruptionDigestItem, DisruptionDigestProps };
export { SAMPLE_DISRUPTION_DIGEST_PROPS };

export default function DisruptionDigest(props: DisruptionDigestProps = {}): React.JSX.Element {
  const isPreview = Object.keys(props).length === 0;
  const weekendDate =
    props.weekendDate ?? (isPreview ? SAMPLE_DISRUPTION_DIGEST_PROPS.weekendDate : '');
  const weekendWindowDescription =
    props.weekendWindowDescription ??
    (isPreview
      ? SAMPLE_DISRUPTION_DIGEST_PROPS.weekendWindowDescription
      : `Weekend Window: Friday 19:00 – Monday 04:30 UK Local Time (${weekendDate})`);
  const disruptions =
    props.disruptions ?? (isPreview ? SAMPLE_DISRUPTION_DIGEST_PROPS.disruptions : []);
  const unsubscribeToken =
    props.unsubscribeToken ?? (isPreview ? SAMPLE_DISRUPTION_DIGEST_PROPS.unsubscribeToken : '');
  const unsubscribeUrl =
    props.unsubscribeUrl ??
    `https://railsignal.london/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  const hasDisruptions = disruptions.length > 0;
  const previewText = hasDisruptions
    ? `RailSignal: ${disruptions.length} planned weekend disruption${disruptions.length > 1 ? 's' : ''} detected for your lines`
    : 'RailSignal: All monitored lines running with Good Service this weekend';

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={emailStyles.header}>
            <Heading as="h1" style={emailStyles.brandTitle}>
              RailSignal
            </Heading>
            <Text style={emailStyles.brandSubtitle}>London Weekend Closure Radar</Text>
          </Section>

          <Section style={emailStyles.summarySection}>
            <Heading as="h2" style={emailStyles.sectionTitle}>
              Weekend Disruption Digest
            </Heading>
            <Text style={emailStyles.windowDescription}>{weekendWindowDescription}</Text>
          </Section>

          <Section style={emailStyles.contentSection}>
            {hasDisruptions ? (
              disruptions.map((item) => {
                const staticLine = getTflLineById(item.lineId);
                const lineColor = item.color ?? staticLine?.color ?? '#0019A8';
                const hasContrastBorder =
                  item.contrastBorder ?? staticLine?.contrastBorder ?? false;

                return (
                  <Section
                    key={`${item.lineId}-${item.corridorDescription}`}
                    style={{
                      ...emailStyles.card,
                      // Email client quirk: shorthand 'border' MUST precede 'borderLeft'. Otherwise,
                      // 'border: 1px solid' renders after and erases the line brand color bar.
                      border: hasContrastBorder ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                      borderLeft: `6px solid ${lineColor}`,
                    }}
                  >
                    <table style={emailStyles.fullWidthTable}>
                      <tbody>
                        <tr>
                          <td style={emailStyles.cardHeaderCell}>
                            <Text style={emailStyles.lineName}>{item.lineName}</Text>
                          </td>
                          <td style={emailStyles.badgeCell}>
                            <span style={emailStyles.severityBadge}>
                              {item.statusSeverityDescription}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {item.notices && item.notices.length > 0 ? (
                      item.notices.map((notice, idx) => (
                        <div
                          key={`${item.lineId}-${notice.headline}-${notice.timeframe ?? idx}`}
                          style={idx > 0 ? emailStyles.noticeContainer : { marginTop: '10px' }}
                        >
                          {notice.timeframe && (
                            <div>
                              <span style={emailStyles.noticeTimeframeBadge}>
                                {notice.timeframe}
                              </span>
                            </div>
                          )}
                          <Text style={emailStyles.noticeHeadline}>{notice.headline}</Text>
                          {notice.busRoute && (
                            <div style={emailStyles.busRouteSection}>
                              <Text style={emailStyles.busRouteName}>
                                {notice.busRoute.serviceName}
                              </Text>
                              <Text style={emailStyles.busRouteStops}>
                                {notice.busRoute.stops.join(' ↔ ')}
                              </Text>
                            </div>
                          )}
                          {notice.details?.map((detail) => (
                            <Text key={detail} style={emailStyles.noticeDetailItem}>
                              • {detail}
                            </Text>
                          ))}
                        </div>
                      ))
                    ) : (
                      <Text style={emailStyles.corridorDescription}>
                        {item.corridorDescription}
                      </Text>
                    )}
                  </Section>
                );
              })
            ) : (
              <Section style={emailStyles.goodServiceCard}>
                <table style={emailStyles.fullWidthTable}>
                  <tbody>
                    <tr>
                      <td>
                        <Text style={emailStyles.goodServiceTitle}>Good Service</Text>
                        <Text style={emailStyles.goodServiceDescription}>
                          No planned closures reported on your monitored lines for this weekend
                          window.
                        </Text>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>
            )}
          </Section>

          <Section style={emailStyles.footerSection}>
            <Hr style={emailStyles.divider} />
            <Text style={emailStyles.footerNote}>
              You received this radar digest because you subscribed to RailSignal closure alerts for
              your monitored London transit routes.
            </Text>
            <Text style={emailStyles.footerLinkRow}>
              <Link href={unsubscribeUrl} style={emailStyles.unsubscribeLink}>
                Unsubscribe from alerts
              </Link>
            </Text>
            {unsubscribeToken && (
              <Text style={emailStyles.footerToken}>
                Subscription Token: <code style={emailStyles.tokenCode}>{unsubscribeToken}</code>
              </Text>
            )}
            <Text style={emailStyles.footerBrand}>
              RailSignal · Automated London Transit Engineering Radar
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
