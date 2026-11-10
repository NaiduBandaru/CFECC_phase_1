import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
  Boxes,
  CreditCard,
  Banknote,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Store,
  FileText,
  Tag,
  ShieldCheck,
  Briefcase,
  BadgeDollarSign,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[]; // If omitted or user is SUPER_ADMIN, it is visible
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userRole = user?.roleCode || 'CASHIER';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const rawNavigationGroups: NavGroup[] = [
    {
      group: 'OVERVIEW',
      items: [
        {
          name: 'Dashboard',
          path: '/dashboard',
          icon: LayoutDashboard,
          roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER', 'HR_PAYROLL'],
        },
      ],
    },
    {
      group: 'STORE & INVENTORY',
      items: [
        { name: 'Items & Inventory', path: '/items', icon: Package, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
        { name: 'Vendors Master', path: '/vendors', icon: Truck, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      ],
    },
    {
      group: 'PURCHASING & GRN',
      items: [
        { name: 'Purchase Orders & GRN', path: '/purchasing', icon: FileSpreadsheet, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
        { name: 'Purchase Invoices', path: '/purchase-invoices', icon: FileText, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      ],
    },
    {
      group: 'SALES & BILLING',
      items: [
        { name: 'Sales Register', path: '/sales', icon: Receipt, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER'] },
        { name: 'Monthly Billing', path: '/billing', icon: CreditCard, roles: ['SUPER_ADMIN', 'ACCOUNTS_OFFICER'] },
      ],
    },
    {
      group: 'STAFF & PAYROLL',
      items: [
        { name: 'Employees KYC', path: '/employees', icon: Users, roles: ['SUPER_ADMIN', 'HR_PAYROLL'] },
        { name: 'Payroll Processing', path: '/payroll', icon: Banknote, roles: ['SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'HR_PAYROLL'] },
        { name: 'Recovery Records', path: '/recovery-records', icon: FileSpreadsheet, roles: ['SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'HR_PAYROLL'] },
      ],
    },
    {
      group: 'ANALYTICS & SYSTEM',
      items: [
        { name: 'Reports Center', path: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER'] },
        { name: 'System Settings', path: '/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
      ],
    },
  ];

  // Filter groups and items based on role permissions
  const navigationGroups = rawNavigationGroups
    .map((grp) => {
      const allowedItems = grp.items.filter((item) => {
        if (isSuperAdmin) return true;
        if (!item.roles) return true;
        return item.roles.includes(userRole);
      });
      return { ...grp, items: allowedItems };
    })
    .filter((grp) => grp.items.length > 0);

  return (
    <aside
      className={clsx(
        'fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-[#0A1220] text-slate-200 transition-all duration-300 ease-in-out border-r border-[#17253D] select-none',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* 1. BRAND HEADER */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#17253D] bg-[#0E1729]/60 shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20 shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white leading-tight">
                  CFECC STORES
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  ERP
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block tracking-wide truncate">
                Visakhapatnam, AP
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. DEDICATED QUICK POS LAUNCH ACTION */}
      <div className="p-3 border-b border-[#17253D] bg-[#0A1220]/80 shrink-0">
        <button
          onClick={() => navigate('/pos')}
          className={clsx(
            'w-full flex items-center rounded-xl bg-gradient-to-r from-blue-600 via-primary to-indigo-600 text-white font-bold shadow-md shadow-blue-600/20 hover:shadow-blue-600/30 hover:brightness-110 active:scale-[0.98] transition-all group',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 space-x-2.5'
          )}
          title="Open Point of Sale Terminal"
        >
          <ShoppingCart className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
          {!collapsed && (
            <>
              <span className="text-xs font-bold tracking-wide flex-1 text-left">
                POS Terminal
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-white/20 text-white border border-white/25">
                OPEN
              </span>
            </>
          )}
        </button>
      </div>

      {/* 3. NAVIGATION GROUPS & LINKS */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
        {navigationGroups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            {!collapsed && (
              <div className="px-3 text-[10px] font-bold text-slate-400/80 tracking-wider uppercase mb-1.5 flex items-center justify-between">
                <span>{grp.group}</span>
              </div>
            )}
            {grp.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path + '/')) ||
                (item.path === '/items' && (location.pathname === '/pricing' || location.pathname === '/inventory'));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all group relative',
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.07]',
                    collapsed && 'justify-center px-0 py-2.5'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon
                    className={clsx(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400',
                      !collapsed && 'mr-3'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                  {item.badge && !collapsed && (
                    <span className="ml-auto px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* 4. USER PROFILE & LOGOUT FOOTER */}
      <div className="p-3 border-t border-[#17253D] bg-[#0E1729]/80 shrink-0">
        <div
          className={clsx(
            'flex items-center rounded-xl bg-white/[0.04] border border-white/[0.06] p-2',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {/* Avatar with Online Dot */}
          <div className="flex items-center space-x-2.5 truncate">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center border border-white/10 shadow-sm">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0A1220]" />
            </div>

            {!collapsed && (
              <div className="truncate text-left">
                <div className="text-xs font-bold text-white truncate leading-tight">
                  {user?.fullName || 'Operator'}
                </div>
                <div className="flex items-center space-x-1 mt-0.5">
                  {isSuperAdmin ? (
                    <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      SUPER ADMIN
                    </span>
                  ) : userRole === 'STORE_MANAGER' ? (
                    <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                      STORE MANAGER
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                      {userRole}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Sign Out Action */}
          {!collapsed && (
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
