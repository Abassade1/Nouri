import { supabase } from '@/lib/supabase';

/** A server function refused or failed; `code` is its stable error code (e.g. 'daily_limit_reached'). */
export class FunctionError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Calls one of our server functions as the signed-in user and returns its JSON (or a FunctionError with the code). */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new FunctionError('not_configured');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code = 'server_error';
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.error) code = payload.error;
    } catch {
      // network failure or non-JSON body
    }
    throw new FunctionError(code);
  }
  return data as T;
}
