import { useMemo, useState } from 'react';
import { Header } from './components/layout/Header';
import { SubscriptionModal } from './components/modals/SubscriptionModal';
import { TestAlertModal } from './components/modals/TestAlertModal';
import { NetworkStatusGrid } from './components/NetworkStatusGrid';
import { useWeekendStatus } from './hooks/useWeekendStatus';

export function App() {
  const [testAlertOpen, setTestAlertOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const { data } = useWeekendStatus();
  const disruptedLineIds = useMemo(() => {
    return data?.lines.filter((line) => line.hasDisruption).map((line) => line.lineId) ?? [];
  }, [data]);

  return (
    <div className="min-h-screen bg-radar-bg text-slate-100 flex flex-col font-sans">
      <Header
        onSendTestAlert={() => setTestAlertOpen(true)}
        onFridayAlerts={() => setSubscriptionOpen(true)}
      />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <NetworkStatusGrid />
      </main>
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
        <p>RailSignal — London Weekend Rail Closure Early Warning System</p>
        <p className="mt-1">Powered by official Transport for London (TfL) Unified API data.</p>
      </footer>

      {testAlertOpen && (
        <TestAlertModal
          open={testAlertOpen}
          onOpenChange={setTestAlertOpen}
          disruptedLineIds={disruptedLineIds}
        />
      )}
      {subscriptionOpen && (
        <SubscriptionModal open={subscriptionOpen} onOpenChange={setSubscriptionOpen} />
      )}
    </div>
  );
}

export default App;
