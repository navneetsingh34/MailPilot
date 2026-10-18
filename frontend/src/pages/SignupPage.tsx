import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { AuthCard, authInputClass, authSubmitClass, SubmitLabel } from '@/features/auth/AuthCard';
import { useSignup } from '@/features/auth/useCurrentUser';

/** Matches the backend's signup schema. */
const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signup = useSignup();

  const onSignup = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(null);
      requestAnimationFrame(() => setError('Passwords do not match'));
      return;
    }
    setError(null);
    signup.mutate(
      { name, email, password },
      {
        onSuccess: () => toast.success('Account created'),
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <AuthCard
      title="Sign up"
      googleLabel="Sign up with Google"
      divider="or sign up through email"
      error={error}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Login
          </Link>
        </>
      }
    >
      <form onSubmit={onSignup} className="space-y-2.5">
        <input
          type="text"
          required
          autoComplete="name"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={authInputClass}
        />
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
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={authInputClass}
        />
        <button type="submit" disabled={signup.isPending} className={authSubmitClass}>
          <SubmitLabel pending={signup.isPending} label="Create account" pendingLabel="Creating account…" />
        </button>
      </form>
    </AuthCard>
  );
}
