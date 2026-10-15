import { TFL_LINES, TFL_LINES_BY_ID, type TflLine } from '@railsignal/shared';
import { isDisruptionInWindow } from '../../domain/temporal.js';
import type { ParsedDisruption, ParseTflDisruptionsOptions, RawTflDisruption } from './types.js';

export type { ParsedDisruption, ParseTflDisruptionsOptions, RawTflDisruption };

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
export function resolveStatusSeverityDescription(
  closureText?: string,
  description?: string,
): string {
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

/**
 * Maps raw TfL disruptions into normalized domain disruptions filtered strictly to the weekend window.
 * Deduplicates multiple reports for the same line and corridor within the same weekend.
 */
const REALTIME_CATEGORIES = new Set(['realtime']);
const TRANSIENT_SEVERITY_DESCRIPTIONS: ReadonlySet<string> = new Set([
  'Minor Delays',
  'Severe Delays',
]);

function isRealTimeDisruption(raw: RawTflDisruption): boolean {
  if (raw.category && REALTIME_CATEGORIES.has(raw.category.toLowerCase().trim())) {
    return true;
  }
  if (
    raw.categoryDescription &&
    REALTIME_CATEGORIES.has(raw.categoryDescription.toLowerCase().trim())
  ) {
    return true;
  }
  return false;
}

function isPlannedWorkDisruption(raw: RawTflDisruption): boolean {
  if (raw.category && raw.category.toLowerCase().trim() === 'plannedwork') {
    return true;
  }
  if (raw.categoryDescription && raw.categoryDescription.toLowerCase().trim() === 'plannedwork') {
    return true;
  }
  if (raw.type && raw.type.toLowerCase().trim() === 'plannedwork') {
    return true;
  }
  if (raw.closureText && raw.closureText.toLowerCase().trim() in CLOSURE_TEXT_MAP) {
    return true;
  }
  return false;
}

export function parseTflDisruptions(options: ParseTflDisruptionsOptions): ParsedDisruption[] {
  const { disruptions, weekendWindow } = options;
  const results: ParsedDisruption[] = [];
  const seenKeys = new Set<string>();

  for (const raw of disruptions) {
    // TfL returns real-time live incidents alongside planned works; live incidents must be discarded
    if (isRealTimeDisruption(raw)) {
      continue;
    }

    const isPlanned = isPlannedWorkDisruption(raw);

    const routes =
      raw.affectedRoutes && raw.affectedRoutes.length > 0 ? raw.affectedRoutes : [undefined];

    for (const route of routes) {
      const line = resolveTflLine(route?.lineId, raw.description);
      if (!line) continue;

      const hasExplicitValidTo = Boolean(route?.validTo);
      const hasExplicitValidFrom = Boolean(route?.validFrom);

      // TfL transient weekday incidents lack validTo dates and start before Friday 19:00.
      // We must never default validToStr to Monday morning for midweek incidents.
      const effectiveStartIso = route?.validFrom || (!isPlanned ? raw.created : undefined);
      if (!hasExplicitValidTo) {
        if (effectiveStartIso) {
          const effectiveStartDate = new Date(effectiveStartIso);
          if (
            !Number.isNaN(effectiveStartDate.getTime()) &&
            effectiveStartDate < weekendWindow.windowStart
          ) {
            continue;
          }
        }
        if (!isPlanned) {
          continue;
        }
      }

      const validFromStr =
        route?.validFrom ||
        (isPlanned && !hasExplicitValidFrom
          ? weekendWindow.windowStart.toISOString()
          : raw.created || weekendWindow.windowStart.toISOString());

      const validToStr = route?.validTo || weekendWindow.windowEnd.toISOString();

      const overlaps = isDisruptionInWindow({
        validFrom: validFromStr,
        validTo: validToStr,
        window: weekendWindow,
      });

      if (!overlaps) continue;

      const severity = resolveStatusSeverityDescription(raw.closureText, raw.description);
      if (TRANSIENT_SEVERITY_DESCRIPTIONS.has(severity) && (!isPlanned || !hasExplicitValidTo)) {
        continue;
      }

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
