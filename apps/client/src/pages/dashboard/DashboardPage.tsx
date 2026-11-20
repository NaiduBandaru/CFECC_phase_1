import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../lib/api.js';
import { StatCard } from '../../components/ui/StatCard.js';
import {
  Users,
  CreditCard,
  TrendingUp,
  Package,
  AlertTriangle,
  IndianRupee,
  Layers,
  FileText,
  ShoppingCart,
  ArrowUpRight,
  Banknote,
  Clock,
  ShieldCheck,
  Tag,
  Settings,
  Briefcase,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Instant restoration from sessionStorage for 0ms visual rendering
  const [metrics, setMetrics] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('cfecc_dash_month');
      return saved ? JSON.parse(saved).metrics : null;
    } catch {
      return null;
    }
  });

  const [charts, setCharts] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('cfecc_dash_month');
      return saved ? JSON.parse(saved).charts : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => !metrics);

  // Initial load: fetch unified monthly summary in a single high-speed round trip
  useEffect(() => {
    fetchInitialDashboard();
  }, []);

  const fetchInitialDashboard = async () => {
    try {
      if (!metrics) {
        setLoading(true);
      }
      const res = await api.get('/dashboard/summary?range=month');
      if (res.data.success && res.data.data) {
        const { metrics: m, charts: c } = res.data.data;
        setMetrics(m);
        setCharts(c);
        sessionStorage.setItem('cfecc_dash_month', JSON.stringify(res.data.data));
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#2563EB', '#16A34A', '#D97706', '#9333EA', '#64748B'];

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="pb-1">
        <h2 className="text-xl font-bold text-navy-800">Executive Overview</h2>
        <p className="text-xs text-textSecondary mt-0.5">
          CFECC Employees Consumer Co-operative Society &bull; Real-time store sales, inventory & employee credit
        </p>
      </div>

      {/* Super Administrator Executive Management Console */}
      {user?.roleCode === 'SUPER_ADMIN' && (
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white p-4 rounded-xl border border-navy-700/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center space-x-2">
                <span>Super Administrator Management Console</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  ALL MANAGING CONTROLS ACTIVE
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Full authority over staff KYC, pricing revisions, billing settlements, audit trails, and WhatsApp API.
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => navigate('/employees')}
              className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 hover:text-white border border-navy-700 text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Employees</span>
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 hover:text-white border border-navy-700 text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Pricing Rules</span>
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 hover:text-white border border-navy-700 text-xs font-semibold transition-colors flex items-center space-x-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Billing & Recovery</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-amber-300" />
              <span>System Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Store Sales"
          value={`₹${(metrics?.periodSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${metrics?.periodInvoices || 0} completed transactions`}
          icon={TrendingUp}
          variant="primary"
          trend={{ value: '+14.2%', isPositive: true }}
        />
        <StatCard
          title="Employee Store Credit"
          value={`₹${(metrics?.totalEmployeeOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${metrics?.creditUtilizationPercent || 0}% limit utilized`}
          icon={CreditCard}
          variant="warning"
        />
        <StatCard
          title="Inventory Valuation"
          value={`₹${(metrics?.inventoryValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${metrics?.lowStockItemsCount || 0} items low in stock`}
          icon={Package}
          variant="success"
        />
        <StatCard
          title="Monthly Collections"
          value={`₹${(metrics?.periodCollections || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Cash/UPI & Payroll recoveries"
          icon={IndianRupee}
          variant="default"
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <Users className="w-3.5 h-3.5 mr-1.5 text-primary" />
            <span>Active Employees</span>
          </div>
          <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
            {metrics?.activeEmployees || 0} <span className="text-xs text-textSecondary font-normal">/ {metrics?.totalEmployees || 0} active</span>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>Monthly Purchases</span>
          </div>
          <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
            ₹{(metrics?.periodPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            <span>Low Stock Alerts</span>
          </div>
          <div className="text-xl font-bold text-status-warning mt-1 tabular-nums">
            {metrics?.lowStockItemsCount || 0} <span className="text-xs text-textSecondary font-normal">items below reorder</span>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            <span>Total Sales Bills</span>
          </div>
          <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
            {metrics?.totalInvoices || 0} <span className="text-xs text-textSecondary font-normal">recorded</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Purchases Trend */}
        <div className="lg:col-span-2 bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-navy-800">Monthly Sales vs Purchases Trend</h3>
              <p className="text-xs text-textSecondary">6-month comparison of store turnover vs replenishment</p>
            </div>
            <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Profitable Margin
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.salesTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#172B4D', borderColor: '#203A65', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="sales" name="Sales Turnover" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Category Breakdown */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-navy-800">Inventory Distribution</h3>
                <p className="text-xs text-textSecondary">Valuation share by commodity category</p>
              </div>
              {charts?.categoryDistribution && (
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-textSecondary uppercase tracking-wider block">Total Valuation</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ₹{Math.round((charts.categoryDistribution || []).reduce((acc: number, c: any) => acc + (Number(c.valuation) || 0), 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            <div className="h-48 relative">
              {charts?.categoryDistribution && charts.categoryDistribution.some((c: any) => Number(c.valuation) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.categoryDistribution.filter((c: any) => Number(c.valuation) > 0)}
                      dataKey="valuation"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                      innerRadius={42}
                      paddingAngle={3}
                    >
                      {charts.categoryDistribution.filter((c: any) => Number(c.valuation) > 0).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Valuation']}
                      contentStyle={{ backgroundColor: '#172B4D', borderColor: '#203A65', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-textSecondary text-xs">
                  <Package className="w-8 h-8 text-slate-300 mb-1" />
                  <span>No stock valuation data</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-100">
            {(charts?.categoryDistribution || []).map((c: any, idx: number) => {
              const totalVal = (charts?.categoryDistribution || []).reduce((acc: number, item: any) => acc + (Number(item.valuation) || 0), 0);
              const pct = totalVal > 0 ? (((Number(c.valuation) || 0) / totalVal) * 100).toFixed(1) : '0';
              return (
                <div key={c.category} className="flex items-center justify-between text-xs text-textSecondary hover:bg-slate-50/50 px-1 py-0.5 rounded transition-colors">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate text-navy-800 font-medium">{c.category}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                  </div>
                  <span className="font-semibold text-navy-800 tabular-nums shrink-0 ml-2">₹{Math.round(c.valuation).toLocaleString('en-IN')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
