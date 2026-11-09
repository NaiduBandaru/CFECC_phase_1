import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../lib/api.js';
import { StatCard } from '../../components/ui/StatCard.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import {
  Users,
  CreditCard,
  TrendingUp,
  Package,
  AlertTriangle,
  IndianRupee,
  Layers,
  FileText,
  Calendar,
  ShoppingCart,
  ArrowUpRight,
  Receipt,
  Banknote,
  CheckCircle2,
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
  const [metrics, setMetrics] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [mRes, cRes, aRes] = await Promise.all([
        api.get(`/dashboard/metrics?range=${timeRange}`),
        api.get('/dashboard/charts'),
        api.get('/dashboard/recent-activity'),
      ]);

      if (mRes.data.success) setMetrics(mRes.data.data);
      if (cRes.data.success) setCharts(cRes.data.data);
      if (aRes.data.success) setActivity(aRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#2563EB', '#16A34A', '#D97706', '#9333EA', '#64748B'];

  const getRangeLabel = () => {
    if (timeRange === 'today') return "Today's";
    if (timeRange === 'week') return "This Week's";
    return 'Monthly';
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeShift = activity?.activeShift || metrics?.activeShift;

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Executive Overview</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            CFECC Employees Consumer Co-operative Society &bull; Real-time store sales, inventory & employee credit
          </p>
        </div>

        {/* Time-Range Switcher */}
        <div className="flex items-center bg-surface p-1 rounded-lg border border-borderLine shadow-subtle">
          <Calendar className="w-3.5 h-3.5 text-textSecondary ml-2 mr-1" />
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              timeRange === 'today' ? 'bg-primary text-white shadow-xs' : 'text-textSecondary hover:text-navy-800'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              timeRange === 'week' ? 'bg-primary text-white shadow-xs' : 'text-textSecondary hover:text-navy-800'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              timeRange === 'month' ? 'bg-primary text-white shadow-xs' : 'text-textSecondary hover:text-navy-800'
            }`}
          >
            This Month
          </button>
        </div>
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

      {/* Operational Quick Actions Launcher */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center space-x-2.5 p-3 rounded-cfecc bg-primary hover:bg-primary-hover text-white shadow-subtle transition-all group text-left"
        >
          <div className="p-2 rounded-lg bg-white/15 group-hover:bg-white/20">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold leading-tight">POS Terminal</div>
            <div className="text-[10px] text-white/80">New Counter Sale</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/purchasing')}
          className="flex items-center space-x-2.5 p-3 rounded-cfecc bg-surface hover:bg-slate-50 border border-borderLine shadow-subtle transition-all text-left group"
        >
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-navy-800 leading-tight">Goods Inward</div>
            <div className="text-[10px] text-textSecondary">GRN & Challans</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/billing')}
          className="flex items-center space-x-2.5 p-3 rounded-cfecc bg-surface hover:bg-slate-50 border border-borderLine shadow-subtle transition-all text-left group"
        >
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-100">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-navy-800 leading-tight">Store Billing</div>
            <div className="text-[10px] text-textSecondary">Monthly Invoices</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/payroll')}
          className="flex items-center space-x-2.5 p-3 rounded-cfecc bg-surface hover:bg-slate-50 border border-borderLine shadow-subtle transition-all text-left group"
        >
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-navy-800 leading-tight">Payroll Recovery</div>
            <div className="text-[10px] text-textSecondary">Salary Deductions</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/reports')}
          className="flex items-center space-x-2.5 p-3 rounded-cfecc bg-surface hover:bg-slate-50 border border-borderLine shadow-subtle transition-all text-left group col-span-2 sm:col-span-1"
        >
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-navy-800 leading-tight">Audit Reports</div>
            <div className="text-[10px] text-textSecondary">Ledger & P&L</div>
          </div>
        </button>
      </div>

      {/* Live Register & Active Shift Status Widget */}
      {activeShift ? (
        <div className="bg-emerald-50/70 border border-emerald-300 rounded-cfecc p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute" />
              <span className="w-3 h-3 bg-emerald-600 rounded-full relative" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-emerald-900">
                  POS Register #{activeShift.terminal_id} &bull; Shift {activeShift.shift_number} Active
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">
                  OPEN
                </span>
              </div>
              <div className="text-[11px] text-emerald-800 mt-0.5">
                Cashier: <span className="font-semibold">{activeShift.cashier_name || 'Rajesh Varma'}</span> &bull; Float: ₹{parseFloat(activeShift.opening_float || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} &bull; Shift Sales: ₹{parseFloat(activeShift.total_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({activeShift.total_transactions || 0} bills)
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Open Cashier Register</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-amber-50/60 border border-amber-300 rounded-cfecc p-3 flex items-center justify-between shadow-subtle">
          <div className="flex items-center space-x-2 text-xs text-amber-900">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Cash register drawer is currently closed for the day.</span>
          </div>
          <button
            onClick={() => navigate('/pos')}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 underline"
          >
            Start New POS Shift &rarr;
          </button>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`${getRangeLabel()} Store Sales`}
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
          title={`${getRangeLabel()} Collections`}
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
            <span>{getRangeLabel()} Purchases</span>
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
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-navy-800">Inventory Distribution</h3>
            <p className="text-xs text-textSecondary">Valuation share by commodity category</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.categoryDistribution || []}
                  dataKey="valuation"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {(charts?.categoryDistribution || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Valuation']}
                  contentStyle={{ backgroundColor: '#172B4D', borderColor: '#203A65', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {(charts?.categoryDistribution || []).slice(0, 4).map((c: any, idx: number) => (
              <div key={c.category} className="flex items-center justify-between text-xs text-textSecondary">
                <div className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="truncate max-w-[140px]">{c.category}</span>
                </div>
                <span className="font-semibold text-navy-800 tabular-nums">₹{Math.round(c.valuation).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Sales, Low Stock Alerts & Repayments Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Store Transactions */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-navy-800">Recent Point of Sale Transactions</h3>
              <p className="text-[11px] text-textSecondary">Latest counter checkouts at store terminal</p>
            </div>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs text-primary font-semibold hover:underline flex items-center space-x-1"
            >
              <span>View All Sales</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-borderLine">
            {(activity?.recentSales || []).map((s: any) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors px-1 rounded">
                <div>
                  <div className="font-semibold text-navy-800 flex items-center space-x-1.5">
                    <span>{s.invoice_number}</span>
                    <span className="text-textSecondary">&bull;</span>
                    <span className="text-textPrimary">
                      {s.customer_name ? s.customer_name : s.first_name ? `${s.first_name} ${s.last_name}` : 'Walk-in Customer'}
                    </span>
                    {s.employee_code && (
                      <span className="text-[10px] font-mono text-textSecondary bg-slate-100 px-1 rounded">
                        {s.employee_code}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-textSecondary mt-0.5">
                    {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} &bull; {s.payment_mode.replace('_', ' ')} {s.item_count ? `&bull; ${s.item_count} items` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-navy-800 tabular-nums">₹{parseFloat(s.total_amount).toFixed(2)}</div>
                  <StatusBadge status="COMPLETED" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts & Direct Collections */}
        <div className="space-y-6">
          {/* Low Stock Alerts */}
          <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-navy-800">Low Stock Threshold Warnings</h3>
                  <p className="text-[11px] text-textSecondary">Commodities requiring vendor purchase replenishment</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/inventory')}
                className="text-xs text-primary font-semibold hover:underline flex items-center space-x-1"
              >
                <span>Stock Control</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-borderLine">
              {(activity?.lowStockAlerts || []).length === 0 ? (
                <div className="py-4 text-center text-xs text-textSecondary">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  All commodities are well stocked above safety threshold.
                </div>
              ) : (
                (activity?.lowStockAlerts || []).map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors px-1 rounded">
                    <div>
                      <div className="font-semibold text-navy-800">{item.name}</div>
                      <div className="text-[11px] text-textSecondary mt-0.5">
                        Code: {item.item_code} &bull; Safety Min: {parseFloat(item.min_stock)} {item.unit_code} &bull; {item.category_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 tabular-nums">
                        {parseFloat(item.current_stock)} {item.unit_code} left
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Direct Payments & Clearances */}
          <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-navy-800">Recent Employee Payments</h3>
                  <p className="text-[11px] text-textSecondary">Over-the-counter Cash & UPI store credit settlements</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/billing')}
                className="text-xs text-primary font-semibold hover:underline flex items-center space-x-1"
              >
                <span>Ledger</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-borderLine">
              {(activity?.recentPayments || []).length === 0 ? (
                <div className="py-4 text-center text-xs text-textSecondary">
                  No direct repayments logged yet.
                </div>
              ) : (
                (activity?.recentPayments || []).map((pay: any) => (
                  <div key={pay.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors px-1 rounded">
                    <div>
                      <div className="font-semibold text-navy-800 flex items-center space-x-1.5">
                        <span>{pay.first_name} {pay.last_name}</span>
                        <span className="text-textSecondary">&bull;</span>
                        <span className="text-[11px] font-mono text-textSecondary">{pay.employee_code}</span>
                      </div>
                      <div className="text-[11px] text-textSecondary mt-0.5">
                        {pay.payment_number} &bull; {pay.payment_mode} &bull; {new Date(pay.payment_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-700 tabular-nums">
                        +₹{parseFloat(pay.amount).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                        SETTLED
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
