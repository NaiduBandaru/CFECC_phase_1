import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Search, ShoppingCart, LogOut, User as UserIcon, Bell } from 'lucide-react';

interface HeaderProps {
  collapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ collapsed }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Generate breadcrumb title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return { title: 'Executive Dashboard', category: 'Overview' };
    if (path.startsWith('/employees')) return { title: 'Employee Master', category: 'Master Data' };
    if (path.startsWith('/items')) return { title: 'Store Items Master', category: 'Master Data' };
    if (path.startsWith('/vendors')) return { title: 'Vendor Master', category: 'Master Data' };
    if (path.startsWith('/pos')) return { title: 'Point of Sale (POS)', category: 'Operations' };
    if (path.startsWith('/sales')) return { title: 'Sales Register', category: 'Operations' };
    if (path.startsWith('/purchasing')) return { title: 'Purchasing & GRN', category: 'Operations' };
    if (path.startsWith('/inventory')) return { title: 'Inventory & Stock Valuation', category: 'Operations' };
    if (path.startsWith('/billing')) return { title: 'Monthly Employee Billing', category: 'Finance' };
    if (path.startsWith('/payroll')) return { title: 'Payroll Recovery & Payslips', category: 'Finance' };
    if (path.startsWith('/reports')) return { title: 'Reports & Business Analytics', category: 'Insights' };
    if (path.startsWith('/settings')) return { title: 'Administration & Audit Logs', category: 'Settings' };
    return { title: 'CFECC Stores', category: 'System' };
  };

  const { title, category } = getPageTitle();

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-surface border-b border-borderLine transition-all duration-300 flex items-center justify-between px-6 ${
        collapsed ? 'left-20' : 'left-64'
      }`}
    >
      {/* Breadcrumbs */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-textSecondary">
          <span>{category}</span>
          <span>/</span>
          <span className="font-semibold text-textPrimary">{title}</span>
        </div>
        <h1 className="text-base font-bold text-navy-800 leading-none mt-0.5">{title}</h1>
      </div>

      {/* Center Search */}
      <div className="hidden md:flex items-center w-72 lg:w-96">
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
            <div className="text-xs font-bold text-navy-800 leading-tight truncate max-w-[120px]">
              {user?.fullName || 'User'}
            </div>
            <div className="text-[10px] text-textSecondary leading-tight font-medium">
              {user?.roleName || user?.roleCode || 'Operator'}
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

