import { TFL_LINE_IDS } from '@railsignal/shared';
import { type FormEvent, useRef, useState } from 'react';
import { useCreateSubscription } from '../../hooks/useCreateSubscription';
import { Dialog } from '../common/Dialog';
import { LineSelectionGrid } from '../common/LineSelectionGrid';

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

  const handleLinesChange = (lines: string[]) => {
    if (localError === 'At least one line must be selected.') {
      setLocalError(null);
    }
    if (subscriptionMutation.isError) {
      subscriptionMutation.reset();
    }
    setSelectedLines(lines);
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
              onClick={() => {
                subscriptionMutation.reset();
                onOpenChange(false);
              }}
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

          <LineSelectionGrid selectedLines={selectedLines} onChange={handleLinesChange} />

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
