import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Search, ShoppingCart, LogOut, User as UserIcon, Bell } from 'lucide-react';

interface HeaderProps {
  collapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-surface border-b border-borderLine transition-all duration-300 flex items-center justify-between px-6 ${
        collapsed ? 'left-20' : 'left-64'
      }`}
    >
      {/* Global Search Bar */}
      <div className="flex items-center w-72 sm:w-80 lg:w-96">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, employee ID, bill no..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-3">
        {/* Quick POS Button */}
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-subtle transition-all"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>New Sale</span>
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-lg text-textSecondary hover:bg-slate-100 hover:text-textPrimary transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
        </button>

        <div className="h-6 w-px bg-borderLine" />

        {/* User Profile */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
            {user?.fullName?.charAt(0) || <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-navy-800 leading-tight truncate max-w-[140px] flex items-center space-x-1.5">
              <span>{user?.fullName || 'User'}</span>
            </div>
            <div className="text-[10px] leading-tight font-medium mt-0.5">
              {user?.roleCode === 'SUPER_ADMIN' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                  SUPER ADMIN
                </span>
              ) : user?.roleCode === 'STORE_MANAGER' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-primary border border-blue-200 font-mono">
                  STORE MANAGER
                </span>
              ) : user?.roleCode === 'CASHIER' ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                  POS CASHIER
                </span>
              ) : (
                <span className="text-textSecondary font-mono">{user?.roleName || user?.roleCode}</span>
              )}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-1.5 text-textSecondary hover:text-status-danger hover:bg-rose-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

