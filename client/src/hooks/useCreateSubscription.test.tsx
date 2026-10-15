import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useCreateSubscription } from './useCreateSubscription';

const server = setupServer();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCreateSubscription hook', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_execute_mutation_and_return_subscription_response', async () => {
    server.use(
      http.post('/api/subscriptions', () => {
        return HttpResponse.json(
          {
            id: 'sub-456',
            email: 'friday@example.com',
            subscribedLineIds: ['victoria', 'central'],
            createdAt: '2026-10-15T12:00:00Z',
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateSubscription(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        email: 'friday@example.com',
        lineIds: ['victoria', 'central'],
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('sub-456');
    expect(result.current.data?.subscribedLineIds).toEqual(['victoria', 'central']);
  });

  it('Should_handle_mutation_error_states', async () => {
    server.use(
      http.post('/api/subscriptions', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid email address format',
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    const { result } = renderHook(() => useCreateSubscription(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        email: 'invalid-email',
        lineIds: ['victoria'],
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invalid email address format');
  });
});
