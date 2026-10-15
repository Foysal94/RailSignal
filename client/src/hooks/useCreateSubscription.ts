import type { CreateSubscriptionRequest, SubscriptionResponse } from '@railsignal/shared';
import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { createSubscription } from '../api/client';

export function useCreateSubscription(): UseMutationResult<
  SubscriptionResponse,
  Error,
  CreateSubscriptionRequest
> {
  return useMutation({
    mutationFn: (request: CreateSubscriptionRequest) => createSubscription(request),
  });
}
