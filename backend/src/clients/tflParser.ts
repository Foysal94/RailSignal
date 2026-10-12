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

const LINE_ID_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'hammersmith-and-city': 'hammersmith-city',
  'waterloo-and-city': 'waterloo-city',
  'elizabeth-line': 'elizabeth',
});

// Declarative pattern table for lines frequently mentioned only in free-text descriptions
const DESCRIPTION_LINE_PATTERNS: ReadonlyArray<{ pattern: RegExp; id: string }> = [
  { pattern: /\b(docklands light railway|dlr)\b/i, id: 'dlr' },
  { pattern: /\belizabeth(\s+line)?\b/i, id: 'elizabeth' },
  { pattern: /\bhammersmith\s*(&|and)\s*city\b/i, id: 'hammersmith-city' },
  { pattern: /\bwaterloo\s*(&|and)\s*city\b/i, id: 'waterloo-city' },
];

const CLOSURE_TEXT_MAP: Readonly<Record<string, string>> = Object.freeze({
  partclosure: 'Part Closure',
  partsuspended: 'Part Suspended',
  plannedclosure: 'Planned Closure',
  fullclosure: 'Planned Closure',
  closure: 'Planned Closure',
});

const DESCRIPTION_SEVERITY_PATTERNS: ReadonlyArray<{ pattern: RegExp; severity: string }> = [
  { pattern: /part[- ]closure/i, severity: 'Part Closure' },
  { pattern: /part suspended/i, severity: 'Part Suspended' },
  { pattern: /(planned closure|closed between)/i, severity: 'Planned Closure' },
  { pattern: /reduced service/i, severity: 'Reduced Service' },
  { pattern: /minor delays/i, severity: 'Minor Delays' },
  { pattern: /severe delays/i, severity: 'Severe Delays' },
];

/**
 * Resolves a TfL line from either an affected route lineId or text heuristics in the description.
 * TfL API disruption records frequently omit the route entity or provide empty lineId fields.
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
    const matchedAlias = DESCRIPTION_LINE_PATTERNS.find(({ pattern }) => pattern.test(description));
    if (matchedAlias && TFL_LINES_BY_ID[matchedAlias.id]) {
      return TFL_LINES_BY_ID[matchedAlias.id];
    }

    for (const line of TFL_LINES) {
      const regex = new RegExp(`\\b${line.name.toLowerCase()}(\\s+line)?\\b`, 'i');
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
    const mapped = CLOSURE_TEXT_MAP[closureText.toLowerCase()];
    if (mapped) return mapped;
  }

  if (description) {
    const matched = DESCRIPTION_SEVERITY_PATTERNS.find(({ pattern }) => pattern.test(description));
    if (matched) return matched.severity;
  }

  return 'Planned Closure';
}

/**
 * Strips repetitive line name prefixes from description text (e.g. "Northern line: No service...").
 */
export function cleanCorridorDescription(description: string, lineName?: string): string {
  if (!lineName) return description.trim();
  const prefixRegex = new RegExp(`^${lineName}(\\s+line)?\\s*:\\s*`, 'i');
  return description.replace(prefixRegex, '').trim() || description.trim();
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
      if (!line) continue;

      const validFromStr = route?.validFrom || raw.created || weekendWindow.windowStart.toISOString();
      const validToStr = route?.validTo || weekendWindow.windowEnd.toISOString();

      const overlaps = isDisruptionInWindow({
        validFrom: validFromStr,
        validTo: validToStr,
        window: weekendWindow,
      });

      if (!overlaps) continue;

      const severity = resolveStatusSeverityDescription(raw.closureText, raw.description);
      const corridor = cleanCorridorDescription(raw.description, line.name);
      const dedupeKey = `${line.id}:${weekendWindow.weekendDate}:${corridor}`;

      if (seenKeys.has(dedupeKey)) continue;
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
