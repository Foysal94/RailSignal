import { type LineMode } from '@railsignal/shared';
import { type TZDate } from '@date-fns/tz';

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

export interface WeekendWindowOptions {
  referenceDate?: Date | undefined;
}

export interface WeekendWindow {
  weekendDate: string; // ISO date 'YYYY-MM-DD' representing target Friday
  windowStart: TZDate; // Friday 19:00 Europe/London
  windowEnd: TZDate;   // Monday 04:30 Europe/London
}

export interface IsDisruptionInWindowOptions {
  validFrom?: string | Date | undefined;
  validTo?: string | Date | undefined;
  window: WeekendWindow;
}

export interface ParseTflDisruptionsOptions {
  disruptions: RawTflDisruption[];
  weekendWindow: WeekendWindow;
}
