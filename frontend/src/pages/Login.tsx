import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthAPI } from '../api/auth.api';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthLayout } from '../components/layout/AuthLayout';
import { AlertCircle, Check } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await AuthAPI.login({ email, password });
      setAuth(response.user, response.token, remember);
      setSuccess(true);
      // Brief affirmation before handing off to the dashboard — long enough
      // to register, short enough to never feel like a delay.
      await new Promise((resolve) => setTimeout(resolve, 350));
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to login';
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your BlackWater account"
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:text-blue-400 transition-colors">
            Sign up here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="priya.sharma@technova.in"
        />
        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-400 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border bg-surface accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
            />
            Remember me
          </label>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={loading && !success} disabled={success}>
          {success ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Signed in
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
