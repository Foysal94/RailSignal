import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useSendTestAlert } from './useSendTestAlert';

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

describe('useSendTestAlert hook', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_execute_mutation_and_return_demo_response', async () => {
    server.use(
      http.post('/api/demo/send-test-digest', () => {
        return HttpResponse.json(
          { status: 'queued', email: 'commuter@example.com' },
          { status: 202 },
        );
      }),
    );

    const { result } = renderHook(() => useSendTestAlert(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        email: 'commuter@example.com',
        lineIds: ['victoria'],
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      status: 'queued',
      email: 'commuter@example.com',
    });
  });

  it('Should_handle_mutation_error_states', async () => {
    server.use(
      http.post('/api/demo/send-test-digest', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Bad Request',
            status: 400,
            detail: 'Queue unavailable',
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    const { result } = renderHook(() => useSendTestAlert(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        email: 'commuter@example.com',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Queue unavailable');
  });
});
