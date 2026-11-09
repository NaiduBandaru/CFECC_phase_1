import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Shield,
  Briefcase,
  BadgeDollarSign,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: any;
  highlight?: boolean;
  roles?: string[]; // If omitted or contains user.roleCode or user is SUPER_ADMIN, it is visible
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user } = useAuth();
  const userRole = user?.roleCode || 'CASHIER';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const rawNavigationGroups: NavGroup[] = [
    {
      group: 'WORKSPACE',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER', 'HR_PAYROLL'] },
      ],
    },
    {
      group: 'MASTER DATA',
      items: [
        { name: 'Employees', path: '/employees', icon: Users, roles: ['SUPER_ADMIN', 'HR_PAYROLL'] },
        { name: 'Store Items', path: '/items', icon: Package, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
        { name: 'Item Pricing', path: '/pricing', icon: Tag, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
        { name: 'Vendors', path: '/vendors', icon: Truck, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      ],
    },
    {
      group: 'OPERATIONS',
      items: [
        { name: 'Point of Sale', path: '/pos', icon: ShoppingCart, highlight: true },
        { name: 'Sales Register', path: '/sales', icon: Receipt, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER'] },
        { name: 'Purchasing & GRN', path: '/purchasing', icon: FileSpreadsheet, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
        { name: 'Purchase Invoices', path: '/purchase-invoices', icon: FileText, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
        { name: 'Inventory & Stock', path: '/inventory', icon: Boxes, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      ],
    },
    {
      group: 'FINANCE & PAYROLL',
      items: [
        { name: 'Employee Billing', path: '/billing', icon: CreditCard, roles: ['SUPER_ADMIN', 'ACCOUNTS_OFFICER'] },
        { name: 'Payroll Processing', path: '/payroll', icon: Banknote, roles: ['SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'HR_PAYROLL'] },
        { name: 'Recovery Records', path: '/recovery-records', icon: Receipt, roles: ['SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'HR_PAYROLL'] },
      ],
    },
    {
      group: 'INSIGHTS & REPORTS',
      items: [
        { name: 'Reports Center', path: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER'] },
        { name: 'Purchase Reports', path: '/reports?tab=purchases', icon: FileSpreadsheet, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      ],
    },
    {
      group: 'ADMINISTRATION',
      items: [
        { name: 'System Settings', path: '/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
      ],
    },
  ];

  // Filter groups and items based on role
  const navigationGroups = rawNavigationGroups
    .map((grp) => {
      const allowedItems = grp.items.filter((item) => {
        if (isSuperAdmin) return true; // Super Admin has universal access to ALL managing things
        if (!item.roles) return true;
        return item.roles.includes(userRole);
      });
      return { ...grp, items: allowedItems };
    })
    .filter((grp) => grp.items.length > 0);

  return (
    <aside
      className={clsx(
        'fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-navy-800 text-white transition-all duration-300 ease-in-out border-r border-navy-700 select-none',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-navy-700/60 bg-navy-900/60">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white shadow-md flex-shrink-0">
            <Store className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="font-bold text-sm tracking-wide block leading-tight text-white">CFECC STORES</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-medium">VISAKHAPATNAM</span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Role Context Strip */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="p-2.5 rounded-lg bg-navy-900/70 border border-navy-700/60 flex items-center justify-between">
            <div className="flex items-center space-x-2 truncate">
              {isSuperAdmin ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : userRole === 'STORE_MANAGER' ? (
                <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
              ) : (
                <BadgeDollarSign className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div className="truncate text-left">
                <div className="text-[11px] font-bold text-white leading-tight truncate">
                  {user?.fullName || 'Operator'}
                </div>
                <div className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                  {user?.roleName || userRole}
                </div>
              </div>
            </div>
            {isSuperAdmin && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ALL PERMS
              </span>
            )}
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navigationGroups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            {!collapsed && (
              <div className="px-3 text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-2">
                {grp.group}
              </div>
            )}
            {grp.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative',
                    isActive
                      ? 'bg-primary text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-navy-700/70',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon
                    className={clsx(
                      'w-4 h-4 flex-shrink-0 transition-colors',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                      !collapsed && 'mr-3'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                  {item.highlight && !collapsed && (
                    <span className="ml-auto px-1.5 py-0.5 text-[9px] uppercase tracking-wider rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      POS
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / Location indicator */}
      <div className="p-3 border-t border-navy-700/60 bg-navy-900/40 text-[11px] text-slate-400 text-center truncate">
        {!collapsed ? (
          <div>
            <div className="font-medium text-slate-300">CFECC Enterprise v1.0</div>
            <div className="text-[10px] text-slate-500">Andhra Pradesh, India</div>
          </div>
        ) : (
          <div className="text-[10px] font-bold text-primary">v1.0</div>
        )}
      </div>
    </aside>
  );
};

