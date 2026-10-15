import type { SendTestDigestRequest, SendTestDigestResponse } from '@railsignal/shared';
import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { sendTestDigest } from '../api/client';

export function useSendTestAlert(): UseMutationResult<
  SendTestDigestResponse,
  Error,
  SendTestDigestRequest
> {
  return useMutation({
    mutationFn: (request: SendTestDigestRequest) => sendTestDigest(request),
  });
}
