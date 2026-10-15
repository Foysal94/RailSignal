import type { WeekendStatusItem } from '@railsignal/shared';
import { render, screen } from '@testing-library/react';
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
});
