import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../lib/api.js';
import { Store, Lock, User, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.success) {
        login(res.data.token, res.data.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-appBg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-800 text-white shadow-lg mb-4">
          <Store className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-extrabold text-navy-800 tracking-tight">CFECC STORES</h2>
        <p className="mt-1 text-xs text-textSecondary uppercase tracking-widest font-semibold">
          Stores Management System &bull; Visakhapatnam
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-6 shadow-elevated border border-borderLine rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-status-danger text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-textPrimary uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textPrimary uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-subtle hover:shadow-elevated transition-all disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Preset Demo Accounts */}
          <div className="mt-8 pt-6 border-t border-borderLine">
            <div className="flex items-center space-x-1 text-xs text-textSecondary font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Quick Role Demo Logins</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'Admin@123')}
                className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-navy-800 transition-colors"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager', 'Manager@123')}
                className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-navy-800 transition-colors"
              >
                Store Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('cashier', 'Cashier@123')}
                className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-navy-800 transition-colors"
              >
                POS Cashier
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-textSecondary">
          Protected Enterprise System &bull; CFECC Visakhapatnam &bull; All Rights Reserved
        </div>
      </div>
    </div>
  );
};

