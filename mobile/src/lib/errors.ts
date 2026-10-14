// Maps backend and network errors to keys in the errors.json translation files. Never show raw error text to users.
export type ErrorKey =
  | 'generic'
  | 'network'
  | 'invalidCredentials'
  | 'emailTaken'
  | 'weakPassword'
  | 'invalidEmail'
  | 'notConfigured'
  | 'socialCancelled';

export class AppError extends Error {
  constructor(public key: ErrorKey, public cause?: unknown) {
    super(key);
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = error as { message?: string; code?: string; status?: number } | null;
  const message = (e?.message ?? '').toLowerCase();
  const code = e?.code ?? '';

  if (code === 'invalid_credentials' || message.includes('invalid login')) return new AppError('invalidCredentials', error);
  if (code === 'user_already_exists' || message.includes('already registered')) return new AppError('emailTaken', error);
  if (code === 'weak_password' || message.includes('password should be')) return new AppError('weakPassword', error);
  if (code === 'validation_failed' || message.includes('invalid email')) return new AppError('invalidEmail', error);
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return new AppError('network', error);
  }
  return new AppError('generic', error);
}
