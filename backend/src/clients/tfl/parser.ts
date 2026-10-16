import {
  cleanLinePrefix,
  parseDisruptionNotices,
  TFL_LINES,
  TFL_LINES_BY_ID,
  type TflLine,
} from '@railsignal/shared';
import { isDisruptionInWindow } from '../../domain/temporal.js';
import type { ParsedDisruption, ParseTflDisruptionsOptions, RawTflLineStatus } from './types.js';

export type { ParsedDisruption, ParseTflDisruptionsOptions, RawTflLineStatus };

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

const PLANNED_ENGINEERING_SEVERITIES: ReadonlySet<string> = new Set([
  'part closure',
  'planned closure',
  'reduced service',
  'part suspended',
  'bus service',
  'special service',
  'suspended',
  'closed',
  'part closed',
  'not running',
  'service closed',
]);

const TRANSIENT_SEVERITY_DESCRIPTIONS: ReadonlySet<string> = new Set([
  'minor delays',
  'severe delays',
]);

function hasWeekendRelevance(text?: string): boolean {
  if (!text) return false;
  return /\b(weekends?|saturdays?|sundays?|fri(days?)?\s*(evening|night)?|mon(days?)?\s*(morning)?)\b/i.test(
    text,
  );
}

// Resolves a TfL line from either an affected route lineId or text heuristics in the description.
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

// Normalizes TfL disruption status strings into human-readable severity descriptions.
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

// Strips repetitive line and mode name prefixes from description text (e.g. "Northern line: No service...").
export function cleanCorridorDescription(description: string, lineName?: string): string {
  return cleanLinePrefix(description, lineName);
}

// Maps date-scoped raw TfL line statuses into normalized domain disruptions
// filtered strictly to the target weekend operational window.
export function parseTflDisruptions(options: ParseTflDisruptionsOptions): ParsedDisruption[] {
  const { weekendWindow } = options;
  const lines = options.lineStatuses ?? options.disruptions ?? [];
  const results: ParsedDisruption[] = [];
  const seenKeys = new Set<string>();

  for (const rawLine of lines) {
    const line = resolveTflLine(rawLine.id, rawLine.name);
    if (!line) continue;

    const lineStatuses = rawLine.lineStatuses ?? [];
    for (const statusItem of lineStatuses) {
      const severityDescription = statusItem.statusSeverityDescription?.trim() || '';
      const severityLower = severityDescription.toLowerCase();

      // 1. Skip normal service
      if (severityLower === 'good service') {
        continue;
      }

      const disruption = statusItem.disruption;
      const category = (disruption?.category ?? disruption?.categoryDescription ?? '')
        .toLowerCase()
        .replace(/[\s-_]/g, '');

      // 2. Discard transient live delays
      if (category === 'realtime') {
        continue;
      }

      const isPlannedCategory = category === 'plannedwork';
      const isPlannedSeverity = PLANNED_ENGINEERING_SEVERITIES.has(severityLower);
      const isTransient = TRANSIENT_SEVERITY_DESCRIPTIONS.has(severityLower);

      // Discard unaccompanied Minor Delays / Severe Delays not explicitly planned work
      if (isTransient && !isPlannedCategory) {
        continue;
      }

      // Accept planned engineering disruptions or disruptions classified as PlannedWork
      if (!isPlannedSeverity && !isPlannedCategory) {
        continue;
      }

      // Clean corridorDescription from lineStatus.reason or disruption.description
      const rawDescription =
        statusItem.reason?.trim() ||
        disruption?.description?.trim() ||
        disruption?.summary?.trim() ||
        line.name;

      // 3. Extract validFrom and validTo from validityPeriods
      const validityPeriods = statusItem.validityPeriods ?? [];
      let validFromStr: string;
      let validToStr: string;

      if (validityPeriods.length > 0) {
        const overlappingPeriods = validityPeriods.filter((vp) =>
          isDisruptionInWindow({
            validFrom: vp.fromDate,
            validTo: vp.toDate,
            window: weekendWindow,
          }),
        );

        // If explicit validity periods are defined but none overlap the weekend, discard
        if (overlappingPeriods.length === 0) {
          continue;
        }

        const sortedFrom = overlappingPeriods
          .map((p) => p.fromDate)
          .filter((d): d is string => Boolean(d))
          .sort();
        const sortedTo = overlappingPeriods
          .map((p) => p.toDate)
          .filter((d): d is string => Boolean(d))
          .sort();

        validFromStr = sortedFrom[0] ?? weekendWindow.windowStart.toISOString();
        validToStr = sortedTo[sortedTo.length - 1] ?? weekendWindow.windowEnd.toISOString();
      } else {
        // Fall back to weekendWindow bounds when categorized as PlannedWork or notice has weekend operational relevance
        if (!isPlannedCategory && !hasWeekendRelevance(rawDescription)) {
          continue;
        }
        validFromStr = weekendWindow.windowStart.toISOString();
        validToStr = weekendWindow.windowEnd.toISOString();
      }

      // 4. Verify overlap with isDisruptionInWindow
      const overlaps = isDisruptionInWindow({
        validFrom: validFromStr,
        validTo: validToStr,
        window: weekendWindow,
      });

      if (!overlaps) {
        continue;
      }

      const corridor = cleanCorridorDescription(rawDescription, line.name);

      // 6. Deduplicate by ${lineId}:${weekendDate}:${corridorDescription}
      const dedupeKey = `${line.id}:${weekendWindow.weekendDate}:${corridor}`;
      if (seenKeys.has(dedupeKey)) {
        continue;
      }
      seenKeys.add(dedupeKey);

      let sourceLastUpdated =
        disruption?.lastUpdate ||
        disruption?.created ||
        statusItem.modified ||
        statusItem.created ||
        rawLine.modified ||
        rawLine.created ||
        new Date().toISOString();

      if (sourceLastUpdated.startsWith('0001-01-01')) {
        sourceLastUpdated = new Date().toISOString();
      }

      const notices = parseDisruptionNotices(corridor, line.name);

      results.push({
        lineId: line.id,
        lineName: line.name,
        mode: line.mode,
        statusSeverityDescription: severityDescription || 'Planned Closure',
        corridorDescription: corridor,
        weekendDate: weekendWindow.weekendDate,
        validFrom: validFromStr,
        validTo: validToStr,
        sourceLastUpdated,
        notices,
      });
    }
  }

  return results;
}
