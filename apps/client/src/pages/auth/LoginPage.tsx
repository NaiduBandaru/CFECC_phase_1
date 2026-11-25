import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../lib/api.js';
import {
  Store,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('cfecc_remember_username') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem('cfecc_remember_username');
    } catch {
      return false;
    }
  });
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.roleCode === 'CASHIER') {
        navigate('/pos', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState) {
      setIsCapsLock(e.getModifierState('CapsLock'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const cleanUsername = username.trim();

    try {
      const res = await api.post('/auth/login', { username: cleanUsername, password });
      if (res.data.success) {
        if (rememberMe) {
          localStorage.setItem('cfecc_remember_username', cleanUsername);
        } else {
          localStorage.removeItem('cfecc_remember_username');
        }

        login(res.data.token, res.data.user);
        if (res.data.user?.roleCode === 'CASHIER') {
          navigate('/pos');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-navy-950 to-slate-900 flex items-center justify-center p-4 selection:bg-primary selection:text-white relative overflow-hidden">
      {/* Decorative Ambient Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 sm:p-9 space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-white shadow-md shadow-primary/25 ring-4 ring-primary/10">
            <Store className="w-7 h-7" />
          </div>

          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Building2 className="w-3 h-3 text-primary" />
              <span>Regd No. B-1460 &bull; Visakhapatnam</span>
            </div>
            <h1 className="text-xl font-extrabold text-navy-950 tracking-tight">CFECC STORES</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consumer Co-operative Society Internal Portal
            </p>
          </div>
        </div>

        {/* Security Badge Pill */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>256-Bit TLS Encrypted &bull; Audit Monitored</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Caps Lock Warning */}
        {isCapsLock && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center space-x-2 text-amber-800 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">Caps Lock is ON. Passwords are case-sensitive.</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} onKeyUp={handleKeyDown} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Username or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoFocus={!username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or cashier1"
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white text-slate-900 transition-all font-medium placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white text-slate-900 transition-all placeholder:text-slate-400 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Option */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 text-primary rounded border-slate-300 focus:ring-primary"
              />
              <span className="text-slate-600 font-medium">Remember username on this terminal</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 cursor-pointer active:scale-[0.99] mt-2"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authenticating...</span>
              </div>
            ) : (
              <>
                <span>Sign In to System</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Notice */}
        <div className="pt-3 border-t border-slate-200/80 text-center space-y-1">
          <p className="text-[11px] font-semibold text-slate-600">
            Coromandel Fertilisers Employees Co-operative Consumers Society Ltd.
          </p>
          <p className="text-[10px] text-slate-400">
            Authorized personnel only. All access and activity is logged and audited.
          </p>
        </div>
      </div>
    </div>
  );
};
