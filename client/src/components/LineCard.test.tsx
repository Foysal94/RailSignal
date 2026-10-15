import type { WeekendStatusItem } from '@railsignal/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LineCard } from './LineCard';

describe('LineCard Component', () => {
  it('Should_render_line_name_and_emerald_badge_for_no_planned_closures', () => {
    const item: WeekendStatusItem = {
      lineId: 'victoria',
      lineName: 'Victoria',
      mode: 'tube',
      color: '#0098D4',
      statusSeverityDescription: 'Good Service',
      hasDisruption: false,
      disruptions: [],
    };

    render(<LineCard line={item} />);

    expect(screen.getByRole('heading', { name: 'Victoria' })).toBeInTheDocument();
    const badge = screen.getByText('No Planned Closures');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-emerald-300');
  });

  it('Should_render_planned_closure_red_badge_and_disruption_corridor', () => {
    const item: WeekendStatusItem = {
      lineId: 'central',
      lineName: 'Central',
      mode: 'tube',
      color: '#E32017',
      statusSeverityDescription: 'Planned Closure',
      corridorDescription: 'No service between White City and Ealing Broadway.',
      hasDisruption: true,
      disruptions: [
        {
          id: 'disruption-1',
          lineId: 'central',
          lineName: 'Central',
          mode: 'tube',
          statusSeverityDescription: 'Planned Closure',
          corridorDescription: 'No service between White City and Ealing Broadway.',
          weekendDate: '2026-10-17',
          validFrom: '2026-10-16T19:00:00Z',
          validTo: '2026-10-19T04:30:00Z',
          sourceLastUpdated: '2026-10-14T10:00:00Z',
          projectedAt: '2026-10-14T10:00:00Z',
        },
      ],
    };

    render(<LineCard line={item} />);

    expect(screen.getByRole('heading', { name: 'Central' })).toBeInTheDocument();
    const badge = screen.getByText('Planned Closure');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-red-300');
    expect(
      screen.getByText('No service between White City and Ealing Broadway.'),
    ).toBeInTheDocument();
  });

  it('Should_render_part_closure_amber_badge', () => {
    const item: WeekendStatusItem = {
      lineId: 'district',
      lineName: 'District',
      mode: 'tube',
      color: '#00782A',
      statusSeverityDescription: 'Part Closure',
      corridorDescription: 'No service between Turnham Green and Richmond.',
      hasDisruption: true,
      disruptions: [],
    };

    render(<LineCard line={item} />);

    const badge = screen.getByText('Part Closure');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-300');
  });

  it('Should_apply_contrast_border_outline_when_contrastBorder_is_true', () => {
    const item: WeekendStatusItem = {
      lineId: 'northern',
      lineName: 'Northern',
      mode: 'tube',
      color: '#000000',
      contrastBorder: true,
      statusSeverityDescription: 'Good Service',
      hasDisruption: false,
      disruptions: [],
    };

    render(<LineCard line={item} />);

    const stripe = screen.getByTestId('line-accent-stripe');
    expect(stripe).toBeInTheDocument();
    expect(stripe.className).toContain('ring-neutral-500');
  });

  it('Should_render_emerald_badge_when_statusSeverityDescription_is_explicitly_No_Planned_Closures', () => {
    const item: WeekendStatusItem = {
      lineId: 'jubilee',
      lineName: 'Jubilee',
      mode: 'tube',
      color: '#A0A5A9',
      statusSeverityDescription: 'No Planned Closures',
      hasDisruption: false,
      disruptions: [],
    };

    render(<LineCard line={item} />);

    const badge = screen.getByText('No Planned Closures');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-emerald-300');
    expect(badge.className).not.toContain('text-red-300');
  });

  it('Should_render_red_badge_for_complete_line_shutdown_severities', () => {
    for (const severity of ['Closed', 'Service Closed', 'Not Running']) {
      const item: WeekendStatusItem = {
        lineId: 'waterloo-city',
        lineName: 'Waterloo & City',
        mode: 'tube',
        color: '#95CDBA',
        statusSeverityDescription: severity,
        hasDisruption: true,
        disruptions: [
          {
            id: 'd-1',
            lineId: 'waterloo-city',
            lineName: 'Waterloo & City',
            mode: 'tube',
            statusSeverityDescription: severity,
            corridorDescription: 'No weekend service',
            weekendDate: '2026-10-16',
            validFrom: '2026-10-16T19:00:00Z',
            validTo: '2026-10-19T04:30:00Z',
            sourceLastUpdated: '2026-10-16T10:00:00Z',
            projectedAt: '2026-10-16T10:05:00Z',
          },
        ],
      };

      const { unmount } = render(<LineCard line={item} />);
      const badge = screen.getByText(severity);
      expect(badge.className).toContain('text-red-300');
      unmount();
    }
  });

  it('Should_render_amber_badge_for_part_closed_status', () => {
    const item: WeekendStatusItem = {
      lineId: 'bakerloo',
      lineName: 'Bakerloo',
      mode: 'tube',
      color: '#B36305',
      statusSeverityDescription: 'Part Closed',
      hasDisruption: true,
      disruptions: [
        {
          id: 'd-2',
          lineId: 'bakerloo',
          lineName: 'Bakerloo',
          mode: 'tube',
          statusSeverityDescription: 'Part Closed',
          corridorDescription: 'Part closed between Queen’s Park and Harrow & Wealdstone',
          weekendDate: '2026-10-16',
          validFrom: '2026-10-16T19:00:00Z',
          validTo: '2026-10-19T04:30:00Z',
          sourceLastUpdated: '2026-10-16T10:00:00Z',
          projectedAt: '2026-10-16T10:05:00Z',
        },
      ],
    };

    render(<LineCard line={item} />);
    const badge = screen.getByText('Part Closed');
    expect(badge.className).toContain('text-amber-300');
    expect(badge.className).not.toContain('text-red-300');
  });

  it('Should_render_structured_notices_with_station_first_headline_and_timeframe', () => {
    const item: WeekendStatusItem = {
      lineId: 'mildmay',
      lineName: 'Mildmay line',
      mode: 'overground',
      color: '#EF7B10',
      statusSeverityDescription: 'Part Closure',
      hasDisruption: true,
      notices: [
        {
          headline: 'Gospel Oak ↔ Stratford: No service',
          timeframe: 'Sunday · Until 11:15',
        },
        {
          headline: 'Camden Road ↔ Stratford: No service',
          timeframe: 'Sunday · After 22:15',
        },
      ],
      disruptions: [],
    };

    render(<LineCard line={item} />);

    expect(screen.getByText('Gospel Oak ↔ Stratford: No service')).toBeInTheDocument();
    expect(screen.getByText('Sunday · Until 11:15')).toBeInTheDocument();
    expect(screen.getByText('Camden Road ↔ Stratford: No service')).toBeInTheDocument();
    expect(screen.getByText('Sunday · After 22:15')).toBeInTheDocument();
  });

  it('Should_toggle_replacement_bus_accordion_with_accessible_attributes', async () => {
    const item: WeekendStatusItem = {
      lineId: 'mildmay',
      lineName: 'Mildmay line',
      mode: 'overground',
      color: '#EF7B10',
      statusSeverityDescription: 'Part Closure',
      hasDisruption: true,
      notices: [
        {
          headline: 'Gospel Oak ↔ Stratford: No service',
          timeframe: 'Sunday · Until 11:15',
          busRoute: {
            serviceName: 'Replacement Bus Service S',
            stops: ['Gospel Oak', 'Camden Road', 'Stratford'],
            summary: '3 stops',
            rawRoute: 'Gospel Oak - Camden Road - Stratford',
          },
        },
      ],
      disruptions: [],
    };

    render(<LineCard line={item} />);

    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: /Replacement Bus Service S/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Gospel Oak ↔ Camden Road/)).not.toBeInTheDocument();

    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Camden Road')).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('Should_display_uppercase_DLR_mode_acronym', () => {
    const item: WeekendStatusItem = {
      lineId: 'dlr',
      lineName: 'DLR',
      mode: 'dlr',
      color: '#00A4A7',
      statusSeverityDescription: 'Part Closure',
      hasDisruption: true,
      notices: [
        {
          headline: 'Shadwell ↔ Tower Gateway: No service',
          timeframe: 'Sunday 18 October',
        },
      ],
      disruptions: [],
    };

    render(<LineCard line={item} />);

    expect(screen.getByText('DLR', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('Dlr')).not.toBeInTheDocument();
  });
});
