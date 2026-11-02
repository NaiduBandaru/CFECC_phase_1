import React, { useState, useEffect } from 'react';
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
        api.get('/dashboard/metrics'),
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

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Executive Overview</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Real-time operations, inventory valuation & employee store credit metrics
          </p>
        </div>

        <div className="flex items-center bg-surface p-1 rounded-lg border border-borderLine shadow-subtle">
          <Calendar className="w-3.5 h-3.5 text-textSecondary ml-2 mr-1" />
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timeRange === 'today' ? 'bg-primary text-white' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timeRange === 'week' ? 'bg-primary text-white' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              timeRange === 'month' ? 'bg-primary text-white' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Store Sales"
          value={`₹${(metrics?.monthlySales || 0).toLocaleString('en-IN')}`}
          subtitle="All POS transactions"
          icon={TrendingUp}
          variant="primary"
          trend={{ value: '+14.2%', isPositive: true }}
        />
        <StatCard
          title="Employee Outstanding"
          value={`₹${(metrics?.totalEmployeeOutstanding || 0).toLocaleString('en-IN')}`}
          subtitle="Recoverable store credit"
          icon={CreditCard}
          variant="warning"
        />
        <StatCard
          title="Inventory Valuation"
          value={`₹${(metrics?.inventoryValuation || 0).toLocaleString('en-IN')}`}
          subtitle="At weighted purchase cost"
          icon={Package}
          variant="success"
        />
        <StatCard
          title="Total Collections"
          value={`₹${(metrics?.totalCollections || 0).toLocaleString('en-IN')}`}
          subtitle="Cash/UPI & Payroll recoveries"
          icon={IndianRupee}
          variant="default"
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <Users className="w-3.5 h-3.5 mr-1.5 text-primary" />
            <span>Active Employees</span>
          </div>
          <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
            {metrics?.activeEmployees || 0} <span className="text-xs text-textSecondary font-normal">/ {metrics?.totalEmployees || 0}</span>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>Monthly Purchases</span>
          </div>
          <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
            ₹{(metrics?.monthlyPurchases || 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            <span>Low Stock Alerts</span>
          </div>
          <div className="text-xl font-bold text-status-warning mt-1 tabular-nums">
            {metrics?.lowStockItemsCount || 0} <span className="text-xs text-textSecondary font-normal">items below reorder</span>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine">
          <div className="flex items-center text-xs text-textSecondary font-medium">
            <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            <span>Total Sales Invoices</span>
          </div>
          <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
            {activity?.recentSales?.length || 0} <span className="text-xs text-textSecondary font-normal">logged</span>
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

      {/* Recent Sales & Low Stock Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Store Transactions */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-navy-800">Recent Point of Sale Transactions</h3>
            <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">View All</span>
          </div>
          <div className="divide-y divide-borderLine">
            {(activity?.recentSales || []).map((s: any) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-navy-800 flex items-center space-x-1.5">
                    <span>{s.invoice_number}</span>
                    <span className="text-textSecondary">&bull;</span>
                    <span className="text-textPrimary">{s.first_name ? `${s.first_name} ${s.last_name}` : 'Walk-in Customer'}</span>
                  </div>
                  <div className="text-[11px] text-textSecondary mt-0.5">
                    {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} &bull; {s.payment_mode.replace('_', ' ')}
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

        {/* Low Stock Alerts */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-navy-800">Low Stock Threshold Warnings</h3>
            </div>
            <span className="text-xs text-primary font-semibold hover:underline cursor-pointer">Manage Inventory</span>
          </div>
          <div className="divide-y divide-borderLine">
            {(activity?.lowStockAlerts || []).map((item: any) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-navy-800">{item.name}</div>
                  <div className="text-[11px] text-textSecondary mt-0.5">
                    Code: {item.item_code} &bull; Min Stock: {parseFloat(item.min_stock)} {item.unit_code}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 tabular-nums">
                    {parseFloat(item.current_stock)} {item.unit_code} left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

