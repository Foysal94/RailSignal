import type {
  DisruptionNotice as DbDisruptionNotice,
  WeekendDisruption as DbWeekendDisruption,
  Prisma,
} from '@prisma/client';
import type { DisruptionNotice, ReplacementBusRoute } from '@railsignal/shared';

export type WeekendDisruptionWithNotices = DbWeekendDisruption & {
  notices?: DbDisruptionNotice[] | undefined;
};

export type DisruptionNoticeCreateInput = Omit<
  Prisma.DisruptionNoticeCreateWithoutDisruptionInput,
  'id'
>;

export function serializeDisruptionNotice(notice: DisruptionNotice): DisruptionNoticeCreateInput {
  return {
    headline: notice.headline,
    corridor: notice.corridor,
    timeframe: notice.timeframe ?? null,
    // Complex nested objects are serialized to JSON strings for SQLite and PostgreSQL dialect parity (ADR 0002).
    busRouteJson: notice.busRoute ? JSON.stringify(notice.busRoute) : null,
    detailsJson:
      notice.details && notice.details.length > 0 ? JSON.stringify(notice.details) : null,
    rawFallback: notice.rawFallback ?? null,
  };
}

export function deserializeDisruptionNotice(record: DbDisruptionNotice): DisruptionNotice {
  let busRoute: ReplacementBusRoute | undefined;
  if (record.busRouteJson) {
    try {
      busRoute = JSON.parse(record.busRouteJson) as ReplacementBusRoute;
    } catch {
      busRoute = undefined;
    }
  }

  let details: string[] | undefined;
  if (record.detailsJson) {
    try {
      const parsed = JSON.parse(record.detailsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        details = parsed as string[];
      }
    } catch {
      details = undefined;
    }
  }

  return {
    headline: record.headline,
    corridor: record.corridor,
    ...(record.timeframe ? { timeframe: record.timeframe } : {}),
    ...(busRoute ? { busRoute } : {}),
    ...(details ? { details } : {}),
    ...(record.rawFallback ? { rawFallback: record.rawFallback } : {}),
  };
}
