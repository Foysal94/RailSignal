import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export interface AppProps {
  queryClient?: QueryClient;
}

export function App({ queryClient: injectedClient }: AppProps = {}) {
  const [queryClient] = useState(
    () =>
      injectedClient ??
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans">
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <div className="rounded-lg border border-slate-800 bg-[#111827] p-8 text-center text-slate-300">
            <h1 className="text-xl font-bold tracking-tight text-white">RailSignal</h1>
            <p className="mt-2 text-sm text-slate-400">Weekend Closure Radar client shell</p>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
