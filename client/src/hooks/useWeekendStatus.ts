import type { WeekendStatusResponse } from '@railsignal/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { fetchWeekendStatus } from '../api/client';

/**
 * Custom query hook for fetching weekend rail closure status.
 * Uses TanStack Query v5 object syntax. Exposes isFetching for network-driven skeleton gating.
 * Forwards AbortSignal to cancel stale requests on parameter change or unmount.
 */
export function useWeekendStatus(
  referenceDate?: string,
): UseQueryResult<WeekendStatusResponse, Error> {
  return useQuery({
    queryKey: ['weekendStatus', referenceDate],
    queryFn: ({ signal }) => fetchWeekendStatus(referenceDate, { signal }),
  });
}
