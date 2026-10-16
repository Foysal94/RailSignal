import type { DisruptionNotice, LineMode } from '@railsignal/shared';
import type { WeekendWindow, WeekendWindowOptions } from '../../domain/temporal.js';

export type { WeekendWindow, WeekendWindowOptions };

export interface RawTflValidityPeriod {
  fromDate?: string | undefined;
  toDate?: string | undefined;
  isNow?: boolean | undefined;
}

export interface RawTflLineDisruption {
  $type?: string | undefined;
  category?: string | undefined;
  type?: string | undefined;
  categoryDescription?: string | undefined;
  description?: string | undefined;
  summary?: string | undefined;
  additionalInfo?: string | undefined;
  created?: string | undefined;
  lastUpdate?: string | undefined;
  affectedRoutes?: unknown[] | undefined;
  affectedStops?: unknown[] | undefined;
  closureText?: string | undefined;
}

export interface RawTflLineStatusItem {
  $type?: string | undefined;
  id?: number | undefined;
  lineId?: string | undefined;
  statusSeverity?: number | undefined;
  statusSeverityDescription: string;
  reason?: string | undefined;
  created?: string | undefined;
  modified?: string | undefined;
  validityPeriods?: RawTflValidityPeriod[] | undefined;
  disruption?: RawTflLineDisruption | undefined;
}

export interface RawTflLineStatus {
  $type?: string | undefined;
  id: string;
  name: string;
  modeName: string;
  disruptions?: RawTflLineDisruption[] | undefined;
  created?: string | undefined;
  modified?: string | undefined;
  lineStatuses: RawTflLineStatusItem[];
}

// Backwards compatibility alias for code expecting RawTflDisruption
export type RawTflDisruption = RawTflLineDisruption;

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
  notices: DisruptionNotice[];
}

export interface ParseTflDisruptionsOptions {
  disruptions?: RawTflLineStatus[] | undefined;
  lineStatuses?: RawTflLineStatus[] | undefined;
  weekendWindow: WeekendWindow;
}
