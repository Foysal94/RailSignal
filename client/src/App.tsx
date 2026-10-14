import { Header } from './components/layout/Header';
import { NetworkStatusGrid } from './components/NetworkStatusGrid';

export function App() {
  return (
    <div className="min-h-screen bg-radar-bg text-slate-100 flex flex-col font-sans">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <NetworkStatusGrid />
      </main>
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>RailSignal — London Weekend Rail Closure Early Warning System</p>
        <p className="mt-1">Powered by official Transport for London (TfL) Unified API data.</p>
      </footer>
    </div>
  );
}

export default App;
