import {
  TFL_LINES,
  TFL_LINES_BY_ID,
  type LineMode,
  type TflLine,
} from '@railsignal/shared';
import { type WeekendWindow, isDisruptionInWindow } from './tflTemporal.js';

export interface RawTflAffectedRoute {
  id?: string | undefined;
  lineId?: string | undefined;
  routeCode?: string | undefined;
  name?: string | undefined;
  direction?: string | undefined;
  originationName?: string | undefined;
  destinationName?: string | undefined;
  validFrom?: string | undefined;
  validTo?: string | undefined;
}

export interface RawTflDisruption {
  $type?: string | undefined;
  category?: string | undefined;
  type?: string | undefined;
  categoryDescription?: string | undefined;
  description: string;
  summary?: string | undefined;
  additionalInfo?: string | undefined;
  created?: string | undefined;
  lastUpdate?: string | undefined;
  affectedRoutes?: RawTflAffectedRoute[] | undefined;
  affectedStops?: unknown[] | undefined;
  closureText?: string | undefined;
}

export interface ParsedDisruption {
  lineId: string;
  lineName: string;
  mode: LineMode;
  statusSeverityDescription: string;
  corridorDescription: string;
  weekendDate: string;
  validFrom: string;
  validTo: string;
  sourceLastUpdated: string;
}

// TfL route IDs often use non-standard slugs or alternate spellings
const LINE_ID_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'hammersmith-and-city': 'hammersmith-city',
  'waterloo-and-city': 'waterloo-city',
  'elizabeth-line': 'elizabeth',
});

/**
 * Resolves a TfL line from either an affected route lineId or text heuristics in the description.
 * 
 * Rationale:
 * TfL Unified API disruption records frequently omit the route entity or provide empty lineId fields,
 * requiring fallback pattern matching on line names inside free-text descriptions.
 */
export function resolveTflLine(rawLineId?: string, description?: string): TflLine | undefined {
  if (rawLineId) {
    const normalized = rawLineId.toLowerCase().trim();
    const canonicalId = LINE_ID_ALIASES[normalized] ?? normalized;
    if (TFL_LINES_BY_ID[canonicalId]) {
      return TFL_LINES_BY_ID[canonicalId];
    }
  }

  if (description) {
    const desc = description.toLowerCase();

    // Specific multi-word or alias checks first to avoid ambiguous substring collisions
    if (desc.includes('docklands light railway') || /\bdlr\b/.test(desc)) {
      return TFL_LINES_BY_ID['dlr'];
    }
    if (desc.includes('elizabeth line') || /\belizabeth\b/.test(desc)) {
      return TFL_LINES_BY_ID['elizabeth'];
    }
    if (desc.includes('hammersmith & city') || desc.includes('hammersmith and city')) {
      return TFL_LINES_BY_ID['hammersmith-city'];
    }
    if (desc.includes('waterloo & city') || desc.includes('waterloo and city')) {
      return TFL_LINES_BY_ID['waterloo-city'];
    }

    for (const line of TFL_LINES) {
      const lineNameLower = line.name.toLowerCase();
      const regex = new RegExp(`\\b${lineNameLower}(\\s+line)?\\b`, 'i');
      if (regex.test(description)) {
        return line;
      }
    }
  }

  return undefined;
}

/**
 * Normalizes TfL disruption status strings into human-readable severity descriptions.
 * Structured closureText is evaluated first before falling back to description phrase matching.
 */
export function resolveStatusSeverityDescription(closureText?: string, description?: string): string {
  if (closureText) {
    const lower = closureText.toLowerCase();
    if (lower === 'partclosure') return 'Part Closure';
    if (lower === 'partsuspended') return 'Part Suspended';
    if (lower === 'plannedclosure' || lower === 'fullclosure' || lower === 'closure') {
      return 'Planned Closure';
    }
  }

  if (description) {
    const lower = description.toLowerCase();
    if (lower.includes('part closure') || lower.includes('part-closure')) return 'Part Closure';
    if (lower.includes('planned closure') || lower.includes('closed between')) return 'Planned Closure';
    if (lower.includes('part suspended')) return 'Part Suspended';
    if (lower.includes('reduced service')) return 'Reduced Service';
    if (lower.includes('minor delays')) return 'Minor Delays';
    if (lower.includes('severe delays')) return 'Severe Delays';
  }

  return 'Planned Closure';
}

/**
 * Strips repetitive line name prefixes from description text (e.g. "Northern line: No service...").
 */
export function cleanCorridorDescription(description: string, lineName?: string): string {
  let cleaned = description.trim();
  if (lineName) {
    const prefixRegex = new RegExp(`^${lineName}(\\s+line)?\\s*:\\s*`, 'i');
    cleaned = cleaned.replace(prefixRegex, '').trim();
  }
  return cleaned || description.trim();
}

export interface ParseTflDisruptionsOptions {
  disruptions: RawTflDisruption[];
  weekendWindow: WeekendWindow;
}

/**
 * Maps raw TfL disruptions into normalized domain disruptions filtered strictly to the weekend window.
 * Deduplicates multiple reports for the same line and corridor within the same weekend.
 */
export function parseTflDisruptions(options: ParseTflDisruptionsOptions): ParsedDisruption[] {
  const { disruptions, weekendWindow } = options;
  const results: ParsedDisruption[] = [];
  const seenKeys = new Set<string>();

  for (const raw of disruptions) {
    const routes = raw.affectedRoutes && raw.affectedRoutes.length > 0 ? raw.affectedRoutes : [undefined];

    for (const route of routes) {
      const line = resolveTflLine(route?.lineId, raw.description);
      if (!line) {
        continue;
      }

      const validFromStr = route?.validFrom || raw.created || weekendWindow.windowStart.toISOString();
      const validToStr = route?.validTo || weekendWindow.windowEnd.toISOString();

      const overlaps = isDisruptionInWindow({
        validFrom: validFromStr,
        validTo: validToStr,
        window: weekendWindow,
      });

      if (!overlaps) {
        continue;
      }

      const severity = resolveStatusSeverityDescription(raw.closureText, raw.description);
      const corridor = cleanCorridorDescription(raw.description, line.name);
      const dedupeKey = `${line.id}:${weekendWindow.weekendDate}:${corridor}`;

      if (seenKeys.has(dedupeKey)) {
        continue;
      }
      seenKeys.add(dedupeKey);

      results.push({
        lineId: line.id,
        lineName: line.name,
        mode: line.mode,
        statusSeverityDescription: severity,
        corridorDescription: corridor,
        weekendDate: weekendWindow.weekendDate,
        validFrom: new Date(validFromStr).toISOString(),
        validTo: new Date(validToStr).toISOString(),
        sourceLastUpdated: raw.lastUpdate || raw.created || new Date().toISOString(),
      });
    }
  }

  return results;
}
