import type { DisruptionNotice, ReplacementBusRoute } from './contracts/lines.js';

const KNOWN_LINE_PREFIX_PATTERN =
  /^(?:docklands light railway|dlr|elizabeth line|overground|bakerloo|central|circle|district|hammersmith & city|hammersmith and city|jubilee|metropolitan|northern|piccadilly|victoria|waterloo & city|waterloo and city|lioness line|mildmay line|windrush line|weaver line|suffragette line|liberty line)(?:\s+line)?\s*:\s*/i;

// Strips redundant line or mode names from the start of descriptions
export function cleanLinePrefix(text: string, lineName?: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(KNOWN_LINE_PREFIX_PATTERN, '');

  if (lineName) {
    const escaped = lineName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dynamicRegex = new RegExp(`^${escaped}(?:\\s+line)?\\s*:\\s*`, 'i');
    cleaned = cleaned.replace(dynamicRegex, '');
  }

  return cleaned.trim();
}

function formatRawTime(timeStr: string): string {
  if (/^\d{4}$/.test(timeStr)) {
    return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
  }
  return timeStr;
}

function formatTimeframeString(raw: string): string {
  let formatted = raw.trim().replace(/,\s*$/, '');
  formatted = formatted.replace(
    /\b(after|until|from)\s+(\d{4})\b/gi,
    (_, prep, time) => `${prep} ${formatRawTime(time)}`,
  );
  formatted = formatted.replace(
    /,\s*(after|until|from)\s+(\d{1,2}:\d{2})/gi,
    (_, prep, time) => ` · ${prep.charAt(0).toUpperCase() + prep.slice(1).toLowerCase()} ${time}`,
  );
  formatted = formatted.replace(/\s+and\s+/gi, ' & ');
  return formatted;
}

// Splits composite descriptions into individual time-scoped operational clauses
export function splitDisruptionClauses(text: string): string[] {
  // TfL descriptions concatenate notices via newlines or mid-paragraph sentence starts
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const clauses: string[] = [];

  for (const line of lines) {
    // Split on day boundaries if multiple notices are crammed into a single line
    const daySplitRegex =
      /(?<=[.!?]|\bnot run|\boperate[sd]?|\bclosed)\s+(?=(?:On\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\b)/gi;
    const parts = line
      .split(daySplitRegex)
      .map((p) => p.trim())
      .filter(Boolean);
    clauses.push(...parts);
  }

  return clauses.length > 0 ? clauses : [text.trim()];
}

function parseReplacementBus(text: string): { route?: ReplacementBusRoute; remainingText: string } {
  // 1. Look for explicit service code (1-3 chars like 'S' or 'A1')
  const codeMatch = text.match(
    /(?:(?:Rail\s+)?replacement\s+bus(?:\s+service)?\s+([A-Z0-9]{1,3})\b|Service\s+([A-Z0-9]{1,3})\s*:)/i,
  );
  const serviceCode = codeMatch ? (codeMatch[1] || codeMatch[2]).toUpperCase() : '';
  const serviceName = serviceCode
    ? `Replacement Bus Service ${serviceCode}`
    : 'Replacement Bus Service';

  // 2. Match the overall bus route sentence
  const busMatch = text.match(
    /(?:(?:Rail\s+)?replacement\s+bus(?:es)?(?:\s+service)?(?:\s+[A-Za-z0-9]+)?(?:\s+will\s+run\s+as\s+follows:?)?|Service\s+[A-Za-z0-9]+\s*:)\s*(?:will run as follows:|operates between|:)?\s*([^.]+?)(?:\.|$)/i,
  );

  if (!busMatch) {
    return { remainingText: text };
  }

  const fullMatch = busMatch[0];
  const rawRouteSection = busMatch[1]?.trim() || '';

  // Extract station stops separated by dashes, 'via', or commas
  let stops = rawRouteSection
    .split(/\s*[-–—]\s*/)
    .map((s) => s.replace(/\s*\([^)]*\)/g, '').trim())
    .filter((s) => s.length > 1 && !/^(for|via|or|use|operated?|between|and)\b/i.test(s));

  if (stops.length <= 1) {
    stops = rawRouteSection
      .split(/\s*(?:via|,)\s*/)
      .map((s) => s.replace(/\s*\([^)]*\)/g, '').trim())
      .filter((s) => s.length > 1 && !/^(for|via|or|use|operated?|between|and)\b/i.test(s));
  }

  const busRoute: ReplacementBusRoute = {
    serviceName,
    stops: stops.length > 1 ? stops : [rawRouteSection],
    summary: `${stops.length > 1 ? stops.length : 'Multiple'} stops`,
    rawRoute: rawRouteSection,
  };

  const remainingText = text.replace(fullMatch, '').trim();
  return { route: busRoute, remainingText };
}

export function parseSingleDisruptionNotice(
  rawClause: string,
  lineName?: string,
): DisruptionNotice {
  const cleaned = cleanLinePrefix(rawClause, lineName);
  if (!cleaned) {
    return { headline: 'Service Disruption' };
  }

  // 1. Timeframe extraction
  const timeframeRegex =
    /^(?:On\s+)?((?:(?:Saturday|Sunday|Friday|Monday)\s+\d{1,2}(?:\s+[A-Za-z]+)?\s*(?:&|and)\s*(?:Saturday|Sunday|Friday|Monday)\s+\d{1,2}(?:\s+[A-Za-z]+)?|(?:Saturday|Sunday|Friday|Monday)\s+\d{1,2}(?:\s+[A-Za-z]+)?|(?:Saturday|Sunday|Friday|Monday))\s*(?:,\s*(?:after|until|from)\s+\d{4})?)(?:,\s*|:\s*|\s+-\s+)?/i;

  const timeframeMatch = cleaned.match(timeframeRegex);
  let timeframe: string | undefined;
  let body = cleaned;

  if (timeframeMatch) {
    timeframe = formatTimeframeString(timeframeMatch[1]);
    body = cleaned.slice(timeframeMatch[0].length).trim();
  }

  // 2. Corridor / Headline extraction
  let headline: string | undefined;
  const details: string[] = [];

  const closureBetweenMatch = body.match(
    /(?:no service|closed|part closed|part suspended)\s+between\s+([A-Za-z0-9\s'&./-]+?)\s+and\s+([A-Za-z0-9\s'&./-]+?)(?:\.|$|due to)/i,
  );

  const reducedServiceMatch = body.match(
    /(?:a reduced service (?:operates|will run))\s+between\s+([A-Za-z0-9\s'&./-]+?)\s+and\s+([A-Za-z0-9\s'&./-]+?)(?:\.|$|due to)/i,
  );

  const trainAlterationMatch = body.match(
    /(?:the\s+\d{4}\s+train\s+from\s+([A-Za-z0-9\s]+?)\s+to\s+([A-Za-z0-9\s]+?)\b[^.]*)/i,
  );

  if (closureBetweenMatch) {
    const stationA = closureBetweenMatch[1].trim();
    const stationB = closureBetweenMatch[2].trim();
    headline = `${stationA} ↔ ${stationB}: No service`;
    body = body.replace(closureBetweenMatch[0], '').trim();
  } else if (reducedServiceMatch) {
    const stationA = reducedServiceMatch[1].trim();
    const stationB = reducedServiceMatch[2].trim();
    headline = `${stationA} ↔ ${stationB}: Reduced service`;
    body = body.replace(reducedServiceMatch[0], '').trim();
  } else if (trainAlterationMatch) {
    headline = `${trainAlterationMatch[1].trim()} → ${trainAlterationMatch[2].trim()}: Service Alterations`;
    // Keep alteration sentence in details if useful
    body = body.replace(trainAlterationMatch[0], '').trim();
  } else {
    // First sentence fallback
    const firstSentence = body.split(/[.;]\s/)[0]?.trim();
    headline = firstSentence && firstSentence.length > 5 ? firstSentence : cleaned;
    body = body.slice(headline.length).trim();
  }

  // 3. Bus route extraction from remaining body
  const { route: busRoute, remainingText } = parseReplacementBus(body);
  body = remainingText;

  // 4. Secondary advice and notes extraction
  const lastTrainsMatch = body.match(/Last through trains?:?\s*([^.]+?)(?:\.|$)/i);
  if (lastTrainsMatch) {
    details.push(`Last through trains: ${lastTrainsMatch[1].trim()}`);
  }

  const stationClosedMatch = body.match(/([A-Za-z0-9,\s&]+ stations? (?:are|is) CLOSED)/i);
  if (stationClosedMatch) {
    details.push(stationClosedMatch[1].trim());
  }

  const localBusMatch = body.match(/(For [^.]+? use local bus [^.]+?)(?:\.|$)/i);
  if (localBusMatch) {
    details.push(localBusMatch[1].trim());
  }

  // Additional narrative sentences not yet captured in headline/busRoute
  const remainingSentences = body
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      if (headline && s.includes(headline)) return false;
      if (lastTrainsMatch && s.includes(lastTrainsMatch[1])) return false;
      if (stationClosedMatch && s.includes(stationClosedMatch[1])) return false;
      if (localBusMatch && s.includes(localBusMatch[1])) return false;
      return true;
    });

  for (const sentence of remainingSentences) {
    if (!details.includes(sentence) && sentence.length > 10) {
      details.push(sentence);
    }
  }

  return {
    headline,
    ...(timeframe ? { timeframe } : {}),
    ...(busRoute ? { busRoute } : {}),
    ...(details.length > 0 ? { details } : {}),
    rawFallback: rawClause,
  };
}

export function parseDisruptionNotices(
  rawDescription: string,
  lineName?: string,
): DisruptionNotice[] {
  if (!rawDescription?.trim()) {
    return [];
  }

  const clauses = splitDisruptionClauses(rawDescription);
  return clauses.map((clause) => parseSingleDisruptionNotice(clause, lineName));
}
