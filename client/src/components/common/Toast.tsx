import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type: ToastType;
  message: string;
  title?: string | undefined;
  durationMs?: number | undefined;
}

export interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timeoutsRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, message, title, durationMs = 4000 }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, message, title, durationMs };

      setToasts((prev) => [...prev, newToast]);

      if (durationMs > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, durationMs);
        timeoutsRef.current.set(id, timer);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => {
      for (const timer of timeoutsRef.current.values()) {
        clearTimeout(timer);
      }
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border p-4 shadow-xl transition-all ${
              toast.type === 'error'
                ? 'bg-red-950/95 border-red-800 text-red-200'
                : toast.type === 'success'
                  ? 'bg-slate-900/95 border-emerald-600/80 text-emerald-200'
                  : 'bg-slate-900/95 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex-1">
              {toast.title && <p className="font-semibold text-sm mb-0.5">{toast.title}</p>}
              <p className="text-sm">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center -mr-2 -mt-2 rounded-lg text-slate-400 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
