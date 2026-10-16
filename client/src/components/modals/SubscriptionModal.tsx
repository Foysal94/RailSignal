import { TFL_LINE_IDS, TFL_LINES } from '@railsignal/shared';
import { type FormEvent, useRef, useState } from 'react';
import { useCreateSubscription } from '../../hooks/useCreateSubscription';
import { Dialog } from '../common/Dialog';

export interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionModal({ open, onOpenChange }: SubscriptionModalProps) {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const subscriptionMutation = useCreateSubscription();

  const [email, setEmail] = useState('');
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedLines, setSelectedLines] = useState<string[]>([...TFL_LINE_IDS]);
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  let emailError: string | null = null;
  if (touchedEmail || submitted) {
    if (trimmedEmail.length === 0) {
      if (submitted) {
        emailError = 'Please enter an email address.';
      }
    } else if (!isEmailValid) {
      emailError = 'Please enter a valid email address (e.g. commuter@example.com).';
    }
  }

  const allSelected = selectedLines.length === TFL_LINES.length;

  const handleSelectAllToggle = () => {
    if (localError === 'At least one line must be selected.') {
      setLocalError(null);
    }
    if (subscriptionMutation.isError) {
      subscriptionMutation.reset();
    }
    if (allSelected) {
      setSelectedLines([]);
    } else {
      setSelectedLines([...TFL_LINE_IDS]);
    }
  };

  const toggleLine = (lineId: string) => {
    if (localError === 'At least one line must be selected.') {
      setLocalError(null);
    }
    if (subscriptionMutation.isError) {
      subscriptionMutation.reset();
    }
    setSelectedLines((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setLocalError(null);

    const validEmail = email.trim();
    if (!validEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validEmail)) {
      return;
    }

    if (selectedLines.length === 0) {
      setLocalError('At least one line must be selected.');
      return;
    }

    try {
      await subscriptionMutation.mutateAsync({
        email: validEmail,
        lineIds: selectedLines,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save subscription';
      setLocalError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      initialFocusRef={emailInputRef}
      title="Friday Alerts Subscription"
      description="Receive timely weekend closure briefings every Friday morning directly in your inbox."
    >
      {subscriptionMutation.isSuccess ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-4 text-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h3 className="font-semibold text-white">Subscription Confirmed!</h3>
            </div>
            <p className="text-sm mt-1">
              You are now subscribed for <strong className="text-white">{email}</strong>. Every
              alert guarantees Friday morning email delivery and one-click unsubscribe links.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {(localError || subscriptionMutation.isError) && (
            <div
              role="alert"
              className="rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-sm text-red-300"
            >
              {localError || subscriptionMutation.error?.message}
            </div>
          )}

          <div>
            <label
              htmlFor="subscription-email"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Email Address
            </label>
            <input
              ref={emailInputRef}
              id="subscription-email"
              type="email"
              value={email}
              onBlur={() => setTouchedEmail(true)}
              onChange={(e) => {
                setEmail(e.target.value);
                if (localError) setLocalError(null);
                if (subscriptionMutation.isError) subscriptionMutation.reset();
              }}
              placeholder="commuter@example.com"
              required
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'subscription-email-error' : undefined}
              className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {emailError && (
              <p id="subscription-email-error" role="alert" className="mt-1 text-xs text-amber-400">
                {emailError}
              </p>
            )}
          </div>

          <fieldset className="border-0 p-0 m-0">
            <legend className="sr-only">Monitored London Lines</legend>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="block text-sm font-medium text-slate-300">
                  Monitored London Lines
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
                  {selectedLines.length}/{TFL_LINES.length} lines selected
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-400 hover:text-blue-300 select-none min-h-[44px]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAllToggle}
                  aria-label="Select all lines"
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                <span>Select All</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 sm:max-h-52 overflow-y-auto overscroll-contain p-1 border border-slate-800 rounded-lg bg-slate-900/40">
              {TFL_LINES.map((line) => {
                const checked = selectedLines.includes(line.id);
                return (
                  <label
                    key={line.id}
                    className="flex items-center gap-2.5 min-h-[44px] px-2.5 py-1.5 rounded hover:bg-slate-800/50 cursor-pointer text-xs font-medium text-slate-200 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLine(line.id)}
                      aria-label={line.name}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: line.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{line.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 pt-3 pb-1 border-t border-slate-800 bg-radar-card">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={subscriptionMutation.isPending}
              aria-busy={subscriptionMutation.isPending}
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {subscriptionMutation.isPending ? 'Subscribing...' : 'Subscribe to Friday Alerts'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
