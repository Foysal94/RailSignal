import type { WeekendStatusResponse } from '@railsignal/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { fetchWeekendStatus } from '../api/client';

export function useWeekendStatus(
  referenceDate?: string,
): UseQueryResult<WeekendStatusResponse, Error> {
  return useQuery({
    queryKey: ['weekendStatus', referenceDate],
    queryFn: ({ signal }) => fetchWeekendStatus(referenceDate, { signal }),
  });
}
