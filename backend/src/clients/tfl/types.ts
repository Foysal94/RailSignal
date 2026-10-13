import type { LineMode } from '@railsignal/shared';
import type { WeekendWindow, WeekendWindowOptions } from '../../domain/temporal.js';

export type { WeekendWindow, WeekendWindowOptions };

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

export interface ParseTflDisruptionsOptions {
  disruptions: RawTflDisruption[];
  weekendWindow: WeekendWindow;
}
