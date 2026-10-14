import { Redirect } from 'expo-router';

/** Email-confirmation / OAuth return link. AuthProvider consumes the code; we just move on. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
