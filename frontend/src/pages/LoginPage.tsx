import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthCard, authInputClass, authSubmitClass, SubmitLabel } from '@/features/auth/AuthCard';
import { useLogin } from '@/features/auth/useCurrentUser';

export default function LoginPage() {
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();

  // Google OAuth failures come back as /login?error=…
  useEffect(() => {
    const oauthError = params.get('error');
    if (oauthError) {
      setError(oauthError);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // On success the `me` query is filled in and RedirectIfAuthed takes the user into the app.
  const onEmailLogin = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate({ email, password }, { onError: (err) => setError(err.message) });
  };

  return (
    <AuthCard
      title="Login"
      googleLabel="Login with Google"
      divider="or login through email"
      error={error}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onEmailLogin} className="space-y-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email ID"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <button type="submit" disabled={login.isPending} className={authSubmitClass}>
          <SubmitLabel pending={login.isPending} label="Login" pendingLabel="Logging in…" />
        </button>
      </form>
    </AuthCard>
  );
}
