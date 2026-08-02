import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthAPI } from '../api/auth.api';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthLayout } from '../components/layout/AuthLayout';
import { AlertCircle, Check } from 'lucide-react';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
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
      const response = await AuthAPI.register({ name, email, password, orgName });
      setAuth(response.user, response.token);
      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 350));
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to register';
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Start monitoring your services with BlackWater"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:text-blue-400 transition-colors">
            Sign in here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Full Name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Priya Sharma"
        />
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="text-xs text-gray-500 mt-1.5">Must be at least 8 characters.</p>
        </div>
        <Input
          label="Organization Name"
          type="text"
          autoComplete="organization"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="TechNova Solutions"
        />

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="w-full mt-2" isLoading={loading && !success} disabled={success}>
          {success ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Account created
            </>
          ) : (
            'Create Account'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
