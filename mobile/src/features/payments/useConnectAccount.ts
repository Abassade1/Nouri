import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { connectDashboard, connectOnboard, connectStatus, PaymentsError } from './api';

export type AccountState = 'loading' | 'not_started' | 'in_progress' | 'ready';

/** The carer's Stripe payout account: where it stands, and the actions to set it up or manage it. */
export function useConnectAccount(enabled = true) {
  const [state, setState] = useState<AccountState>(enabled ? 'loading' : 'ready');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const s = await connectStatus();
      setState(s.ready ? 'ready' : s.started ? 'in_progress' : 'not_started');
      setError(false);
    } catch (e) {
      setError(!(e instanceof PaymentsError && e.code === 'not_approved_carer'));
      setState('not_started');
    }
  }, [enabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Opens Stripe's hosted onboarding; when the carer comes back we re-check. */
  const setup = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const { url } = await connectOnboard();
      if (url) await WebBrowser.openAuthSessionAsync(url, Linking.createURL('stripe/return'));
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const manage = useCallback(async () => {
    setBusy(true);
    try {
      const { url } = await connectDashboard();
      if (url) await WebBrowser.openBrowserAsync(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, setup, manage, refresh };
}
