import { describe, expect, it } from 'vitest';
import {
  cleanLinePrefix,
  parseDisruptionNotices,
  splitDisruptionClauses,
} from '../src/disruptionNotice.js';

describe('Disruption Notice Parser', () => {
  describe('cleanLinePrefix', () => {
    it('Should_strip_uppercase_modal_and_line_prefixes', () => {
      expect(cleanLinePrefix('DOCKLANDS LIGHT RAILWAY: Sunday 18 October, no service...')).toBe(
        'Sunday 18 October, no service...',
      );

      expect(cleanLinePrefix('DLR: Sunday 18 October, no service...')).toBe(
        'Sunday 18 October, no service...',
      );

      expect(cleanLinePrefix('District Line: Saturday 17 and Sunday 18 October...')).toBe(
        'Saturday 17 and Sunday 18 October...',
      );

      expect(cleanLinePrefix('Elizabeth line: Sunday 18 October, a reduced service...')).toBe(
        'Sunday 18 October, a reduced service...',
      );

      expect(cleanLinePrefix('LONDON OVERGROUND: Sunday 18 October, no service...')).toBe(
        'Sunday 18 October, no service...',
      );
    });

    it('Should_strip_dynamic_line_name_when_provided', () => {
      expect(
        cleanLinePrefix('Mildmay line: Friday 16 October, service change...', 'Mildmay line'),
      ).toBe('Friday 16 October, service change...');
    });

    it('Should_leave_text_without_line_prefixes_unchanged', () => {
      expect(cleanLinePrefix('Saturday 17 October, no service between A and B.')).toBe(
        'Saturday 17 October, no service between A and B.',
      );
    });
  });

  describe('splitDisruptionClauses', () => {
    it('Should_split_clauses_separated_by_newlines', () => {
      const text =
        'Saturday 17 October, no service between A and B.\nSunday 18 October, no service between C and D.';
      const clauses = splitDisruptionClauses(text);
      expect(clauses).toHaveLength(2);
    });

    it('Should_split_crammed_multi_day_notices_without_newlines', () => {
      const text =
        'Friday 16 October, the 2159 train from Stratford to Richmond will terminate at Camden Road at 2219. The 2318 train from Richmond to Willesden Junction will not run Sunday 18 October, after 2215, no service between Camden Road and Stratford.';
      const clauses = splitDisruptionClauses(text);
      expect(clauses).toHaveLength(2);
      expect(clauses[0]).toContain('Friday 16 October');
      expect(clauses[1]).toContain('Sunday 18 October');
    });
  });

  describe('parseDisruptionNotices (Real Payloads)', () => {
    it('Should_parse_mildmay_three_part_composite_payload', () => {
      const mildmayRaw = `Friday 16 October, the 2159 train from Stratford to Richmond will terminate at Camden Road at 2219. The 2318 train from Richmond to Willesden Junction will not run
Sunday 18 October, after 2215, no service between Camden Road and Stratford. Rail replacement buses will run as follows: Service S: Camden Road - Holloway Road (Piccadilly line) - Highbury & Islington - Canonbury - Dalston Junction (for Dalston Kingsland) - Hackney Central - Homerton - Hackney Wick - Stratford. Last through trains: Richmond to Stratford 2110; Camden Road to Stratford 2203
Sunday 18 October, until 1115, no service between Gospel Oak and Stratford. Replacement bus service S operates between Gospel Oak (Southampton Road / Agincourt Road) and Stratford via Kentish Town West, Camden Road, Holloway Road (Piccadilly line), Highbury & Islington (for Caledonian Road & Barnsbury), Canonbury (St Pauls Road), Dalston Junction (for Dalston Kingsland), Hackney Central, Homerton and Hackney Wick.`;

      const notices = parseDisruptionNotices(mildmayRaw, 'Mildmay line');
      expect(notices).toHaveLength(3);

      // Notice 1: Friday night
      expect(notices[0].timeframe).toBe('Friday 16 October');
      expect(notices[0].headline).toBe('Stratford → Richmond: Service Alterations');

      // Notice 2: Sunday night
      expect(notices[1].timeframe).toBe('Sunday 18 October · After 22:15');
      expect(notices[1].headline).toBe('Camden Road ↔ Stratford: No service');
      expect(notices[1].busRoute?.serviceName).toBe('Replacement Bus Service S');
      expect(notices[1].busRoute?.stops.length).toBeGreaterThanOrEqual(4);
      expect(notices[1].details?.some((d) => d.includes('Last through trains'))).toBe(true);

      // Notice 3: Sunday morning
      expect(notices[2].timeframe).toBe('Sunday 18 October · Until 11:15');
      expect(notices[2].headline).toBe('Gospel Oak ↔ Stratford: No service');
      expect(notices[2].busRoute?.serviceName).toBe('Replacement Bus Service S');
      expect(notices[2].busRoute?.stops.length).toBeGreaterThanOrEqual(5);
    });

    it('Should_parse_dlr_payload_and_strip_redundant_header', () => {
      const dlrRaw =
        'DOCKLANDS LIGHT RAILWAY: Sunday 18 October, no service between Shadwell and Tower Gateway.';
      const notices = parseDisruptionNotices(dlrRaw, 'DLR');

      expect(notices).toHaveLength(1);
      expect(notices[0].timeframe).toBe('Sunday 18 October');
      expect(notices[0].headline).toBe('Shadwell ↔ Tower Gateway: No service');
    });

    it('Should_parse_district_line_closure_with_bus_service_note', () => {
      const districtRaw =
        'Saturday 17 and Sunday 18 October, no service between Turnham Green and Ealing Broadway. Replacement bus services operate.';
      const notices = parseDisruptionNotices(districtRaw, 'District');

      expect(notices).toHaveLength(1);
      expect(notices[0].timeframe).toBe('Saturday 17 & Sunday 18 October');
      expect(notices[0].headline).toBe('Turnham Green ↔ Ealing Broadway: No service');
    });

    it('Should_parse_reduced_service_and_extract_closed_stations', () => {
      const elizabethRaw =
        'Sunday 18 October, a reduced service operates between Paddington and Heathrow Terminal 4 / Maidenhead. Two trains an hour serve Heathrow Terminal 4. Acton Main Line, Hanwell and West Ealing stations are CLOSED.';
      const notices = parseDisruptionNotices(elizabethRaw, 'Elizabeth line');

      expect(notices).toHaveLength(1);
      expect(notices[0].timeframe).toBe('Sunday 18 October');
      expect(notices[0].headline).toBe(
        'Paddington ↔ Heathrow Terminal 4 / Maidenhead: Reduced service',
      );
      expect(notices[0].details?.some((d) => d.includes('stations are CLOSED'))).toBe(true);
    });

    it('Should_parse_stations_with_typographic_apostrophes_and_parentheses', () => {
      const raw = 'Saturday 17 October, no service between Queen’s Park and Harrow & Wealdstone.';
      const notices = parseDisruptionNotices(raw, 'Bakerloo');

      expect(notices).toHaveLength(1);
      expect(notices[0].timeframe).toBe('Saturday 17 October');
      expect(notices[0].headline).toBe('Queen’s Park ↔ Harrow & Wealdstone: No service');
      expect(notices[0].corridor).toBe(notices[0].headline);

      const rawWithParens =
        'Sunday 18 October, no service between Shepherd’s Bush and Kensington (Olympia).';
      const noticesParens = parseDisruptionNotices(rawWithParens, 'Overground');
      expect(noticesParens[0].headline).toBe('Shepherd’s Bush ↔ Kensington (Olympia): No service');
      expect(noticesParens[0].corridor).toBe(noticesParens[0].headline);
    });

    it('Should_parse_coloned_timeframes_without_leaking_into_details', () => {
      const raw = 'Sunday 18 October, after 22:15, no service between Camden Road and Stratford.';
      const notices = parseDisruptionNotices(raw, 'Mildmay line');

      expect(notices).toHaveLength(1);
      expect(notices[0].timeframe).toBe('Sunday 18 October · After 22:15');
      expect(notices[0].headline).toBe('Camden Road ↔ Stratford: No service');
      expect(notices[0].details).toBeUndefined();
    });

    it('Should_safely_fallback_on_unrecognized_free_text_without_data_loss', () => {
      const oddText = 'Service operates under special timing arrangements due to civil works.';
      const notices = parseDisruptionNotices(oddText);

      expect(notices).toHaveLength(1);
      expect(notices[0].headline).toBe(oddText);
      expect(notices[0].corridor).toBe(oddText);
      expect(notices[0].rawFallback).toBe(oddText);
    });
  });
});
