import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Sale } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Receipt,
  Search,
  Eye,
  Printer,
  CreditCard,
  Download,
  RotateCcw,
  Send,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';

const formatCurrency = (val: number | string | undefined | null) => {
  const num = parseFloat((val ?? 0).toString());
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const SalesRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState({
    total_count: 0,
    total_revenue: '0.00',
    credit_revenue: '0.00',
    direct_revenue: '0.00',
    total_tax: '0.00',
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Sorting
  const [search, setSearch] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // View / Print Invoice Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState<boolean>(false);
  const [whatsappSending, setWhatsappSending] = useState<boolean>(false);
  const [whatsappSuccess, setWhatsappSuccess] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Cancel Invoice Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Customer return / billing mistake');
  const [cancelling, setCancelling] = useState<boolean>(false);

  useEffect(() => {
    fetchSales();
  }, [search, paymentMode, paymentStatus, startDate, endDate, sortBy, sortOrder]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        paymentMode,
        paymentStatus,
        sortBy,
        sortOrder,
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/sales?${params.toString()}`);
      if (res.data.success) {
        setSales(res.data.data);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('DESC');
    }
  };

  const handleViewInvoice = async (id: number) => {
    setLoadingInvoice(true);
    setWhatsappSuccess(null);
    setWhatsappError(null);
    setIsInvoiceModalOpen(true);
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.data.success) {
        setSelectedSale(res.data.sale);
        setSaleItems(res.data.items);
        setSaleReturns(res.data.returns || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedSale) return;
    setWhatsappSending(true);
    setWhatsappSuccess(null);
    setWhatsappError(null);
    try {
      const res = await api.post(`/sales/${selectedSale.id}/send-whatsapp`);
      if (res.data.success) {
        setWhatsappSuccess(res.data.message);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to send WhatsApp receipt';
      setWhatsappError(msg);
    } finally {
      setWhatsappSending(false);
    }
  };

  const openCancelModal = (sale: any) => {
    setSelectedSale(sale);
    setCancelReason('Customer return / billing mistake');
    setIsCancelModalOpen(true);
  };

  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    setCancelling(true);
    try {
      const res = await api.post(`/sales/${selectedSale.id}/cancel`, {
        reason: cancelReason,
      });
      if (res.data.success) {
        setIsCancelModalOpen(false);
        setIsInvoiceModalOpen(false);
        alert(res.data.message);
        fetchSales();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setCancelling(false);
    }
  };

  const setDateFilter = (type: 'TODAY' | 'MONTH' | 'ALL') => {
    const today = new Date().toISOString().split('T')[0];
    if (type === 'TODAY') {
      setStartDate(today);
      setEndDate(today);
    } else if (type === 'MONTH') {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(today);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleExportCSV = () => {
    if (sales.length === 0) {
      alert('No sales records to export.');
      return;
    }

    const headers = [
      'Invoice Number',
      'Date & Time',
      'Customer / Employee Name',
      'Employee Code',
      'Department',
      'Payment Mode',
      'Payment Status',
      'Subtotal (₹)',
      'Tax Amount (₹)',
      'Total Amount (₹)',
      'Billed By',
    ];

    const rows = sales.map((s: any) => [
      `"${s.invoice_number}"`,
      `"${new Date(s.created_at).toLocaleString('en-IN')}"`,
      `"${(s.first_name ? `${s.first_name} ${s.last_name}` : s.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      `"${s.employee_code || ''}"`,
      `"${s.department_name || ''}"`,
      `"${s.payment_mode}"`,
      `"${s.payment_status}"`,
      parseFloat(s.subtotal.toString()).toFixed(2),
      parseFloat(s.tax_amount.toString()).toFixed(2),
      parseFloat(s.total_amount.toString()).toFixed(2),
      `"${s.billed_by_name || 'Cashier'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cfecc_sales_register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Sales Register & Invoices</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Audit trail of store retail invoices, subsidized employee credit settlements, tax breakdowns and receipts
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => navigate('/pos')}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Total Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2 tabular-nums">
            ₹{parseFloat(summary.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">{summary.total_count} Completed Invoices</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase">Employee Store Credit</span>
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-primary mt-2 tabular-nums">
            ₹{parseFloat(summary.credit_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">
            {parseFloat(summary.total_revenue) > 0
              ? `${((parseFloat(summary.credit_revenue) / parseFloat(summary.total_revenue)) * 100).toFixed(1)}% of total volume`
              : 'Recovered via monthly billing'}
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase">Direct Cash / UPI</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2 tabular-nums">
            ₹{parseFloat(summary.direct_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Instant counter collections</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">GST Tax Collected</span>
            <Receipt className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2 tabular-nums">
            ₹{parseFloat(summary.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Statutory output tax</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice #, employee name, ID, or phone..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="EMPLOYEE_CREDIT">Employee Credit</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
            </select>

            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled / Refunded</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Quick Shortcuts */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-borderLine gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-textSecondary font-semibold">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 border border-borderLine rounded bg-slate-50 text-xs"
            />
            <span className="text-textSecondary">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 border border-borderLine rounded bg-slate-50 text-xs"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setDateFilter('TODAY')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-navy-800 rounded font-semibold text-xs transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('MONTH')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-navy-800 rounded font-semibold text-xs transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => setDateFilter('ALL')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-textSecondary rounded font-semibold text-xs transition-colors"
            >
              Clear Dates
            </button>
          </div>
        </div>
      </div>

      {/* Sales Invoices Table with Standard Format and Auto Screen Adjust */}
      <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('invoice_number')}
                  className="py-3 px-4 cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Invoice #</span>
                    {sortBy === 'invoice_number' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('created_at')}
                  className="py-3 px-4 cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Date & Time</span>
                    {sortBy === 'created_at' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Billed To (Customer / Employee)</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Tax (GST)</th>
                <th
                  onClick={() => handleSort('total_amount')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total Amount (₹)</span>
                    {sortBy === 'total_amount' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading sales history...</div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-textSecondary">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No sales transactions found matching criteria.</div>
                  </td>
                </tr>
              ) : (
                sales.map((sale: any) => {
                  const isCredit = sale.payment_mode === 'EMPLOYEE_CREDIT';
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy-800">{sale.invoice_number}</td>

                      <td className="py-3 px-4 text-textSecondary">
                        {new Date(sale.created_at).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">
                          {sale.first_name ? `${sale.first_name} ${sale.last_name}` : sale.customer_name || 'Walk-in'}
                        </div>
                        {sale.employee_code && (
                          <div className="text-[11px] text-textSecondary font-mono">
                            {sale.employee_code} &bull; {sale.department_name || 'Staff'}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCredit
                              ? 'bg-blue-50 text-primary border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {sale.payment_mode.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-medium">{sale.item_count || 1} line(s)</td>

                      <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                        {formatCurrency(sale.subtotal)}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                        {formatCurrency(sale.tax_amount)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                        {formatCurrency(sale.total_amount)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={sale.payment_status} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleViewInvoice(sale.id)}
                            className="p-1.5 rounded text-textSecondary hover:text-navy-800 hover:bg-slate-100 transition-colors"
                            title="View & Print Official Receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {sale.payment_status === 'COMPLETED' && (
                            <button
                              onClick={() => openCancelModal(sale)}
                              className="p-1.5 rounded text-textSecondary hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Cancel / Void Invoice"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Floating Summary Footer */}
        <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
          <div>
            Showing <span className="font-bold text-navy-800 font-mono">{sales.length}</span> invoices &bull; Total Sales:{' '}
            <strong className="text-navy-900 font-mono text-sm font-black">
              ₹{parseFloat(summary.total_revenue || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-primary font-medium font-mono">
              Credit: ₹{parseFloat(summary.credit_revenue || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-emerald-700 font-medium font-mono">
              Direct/UPI: ₹{parseFloat(summary.direct_revenue || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Official Tax Invoice & Receipt Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={selectedSale?.invoice_number || 'Tax Invoice & Receipt'}
        subtitle="CFECC Stores Official Sales Receipt & Employee Credit Statement"
        maxWidth="2xl"
      >
        {loadingInvoice ? (
          <div className="py-12 text-center text-textSecondary">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <div>Loading invoice specifications...</div>
          </div>
        ) : selectedSale ? (
          <div className="space-y-4 text-xs">
            {whatsappSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{whatsappSuccess}</span>
              </div>
            )}

            {whatsappError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{whatsappError}</span>
              </div>
            )}

            {/* Printable Receipt Container */}
            <div className="p-4 border border-borderLine rounded-lg bg-white space-y-4 print:border-none print:p-0">
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-borderLine">
                <h3 className="font-bold text-navy-800 text-base tracking-wide uppercase">CFECC STORES</h3>
                <p className="text-[11px] text-textSecondary">Visakhapatnam, Andhra Pradesh, India</p>
                <p className="text-[10px] text-textSecondary font-mono mt-0.5">GSTIN: 37AAAAA0000A1Z5 &bull; Store Code: VSKP-01</p>
                <div className="mt-2 inline-block px-3 py-0.5 bg-slate-100 rounded-full font-bold text-[10px] uppercase text-navy-800">
                  Retail Sales Receipt / Tax Invoice
                </div>
              </div>

              {/* Invoice & Customer Meta */}
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-borderLine">
                <div>
                  <span className="text-[10px] text-textSecondary uppercase font-bold block">Billed To</span>
                  <span className="font-bold text-navy-800 text-sm block">
                    {selectedSale.first_name ? `${selectedSale.first_name} ${selectedSale.last_name}` : selectedSale.customer_name || 'Walk-in Customer'}
                  </span>
                  {selectedSale.employee_code && (
                    <div className="text-[11px] text-textSecondary font-mono mt-0.5">
                      Emp ID: {selectedSale.employee_code} &bull; {selectedSale.department_name} ({selectedSale.designation_title || 'Staff'})
                    </div>
                  )}
                  {selectedSale.employee_mobile && (
                    <div className="text-[11px] text-textSecondary">Mobile: {selectedSale.employee_mobile}</div>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-textSecondary uppercase font-bold block">Invoice Information</span>
                  <span className="font-mono font-bold text-navy-800 block">{selectedSale.invoice_number}</span>
                  <span className="text-textSecondary block mt-0.5">
                    {new Date(selectedSale.created_at).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-textSecondary block">Payment: <strong className="text-navy-800">{selectedSale.payment_mode.replace('_', ' ')}</strong></span>
                  <span className="text-[10px] text-textSecondary block">Billed By: {selectedSale.billed_by_name || 'Store Cashier'}</span>
                </div>
              </div>

              {/* Employee Store Credit Ledger Box */}
              {selectedSale.payment_mode === 'EMPLOYEE_CREDIT' && selectedSale.employee_code && (
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200/70 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-primary uppercase font-bold block">Previous Outstanding</span>
                    <span className="font-mono font-bold text-navy-800">
                      {formatCurrency(parseFloat(selectedSale.current_outstanding || '0') - parseFloat(selectedSale.total_amount || '0'))}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-primary uppercase font-bold block">Current Bill Amount</span>
                    <span className="font-mono font-bold text-primary">
                      +{formatCurrency(selectedSale.total_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-primary uppercase font-bold block">Updated Store Balance</span>
                    <span className="font-mono font-bold text-rose-600">
                      {formatCurrency(selectedSale.current_outstanding)}
                    </span>
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-borderLine text-[10px] font-bold text-textSecondary uppercase">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Price (₹)</th>
                    <th className="py-2 px-3 text-right">GST %</th>
                    <th className="py-2 px-3 text-right">Tax (₹)</th>
                    <th className="py-2 px-3 text-right">Line Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {saleItems.map((itm, idx) => (
                    <tr key={itm.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 text-center text-textSecondary">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-navy-800">{itm.item_name}</div>
                        <div className="text-[10px] font-mono text-textSecondary">
                          {itm.item_code} {itm.brand ? `• ${itm.brand}` : ''} {itm.hsn_code ? `• HSN: ${itm.hsn_code}` : ''}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {parseFloat(itm.quantity)} {itm.unit_code}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {formatCurrency(itm.unit_price)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-textSecondary">
                        {parseFloat(itm.tax_rate)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-textSecondary">
                        {formatCurrency(itm.tax_amount)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold font-mono text-navy-800">
                        {formatCurrency(itm.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bill Totals Summary */}
              <div className="pt-3 border-t border-borderLine space-y-1 text-right text-xs">
                <div className="flex justify-between text-textSecondary">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono tabular-nums">{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {parseFloat(selectedSale.discount_amount || '0') > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount Applied:</span>
                    <span className="font-mono tabular-nums">-{formatCurrency(selectedSale.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-textSecondary">
                  <span>GST Output Tax:</span>
                  <span className="font-mono tabular-nums">{formatCurrency(selectedSale.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-navy-800 text-sm pt-2 border-t border-borderLine">
                  <span>Grand Total (Net Payable):</span>
                  <span className="font-mono tabular-nums text-primary font-bold">{formatCurrency(selectedSale.total_amount)}</span>
                </div>
              </div>

              {/* Return / Cancel Note if present */}
              {selectedSale.payment_status === 'CANCELLED' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>THIS INVOICE HAS BEEN CANCELLED & VOIDED</span>
                  </div>
                  {saleReturns.length > 0 && (
                    <div className="mt-1 text-[11px]">
                      Reason: {saleReturns[0].reason} &bull; Processed on: {new Date(saleReturns[0].created_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-borderLine">
              <div>
                {selectedSale.payment_status === 'COMPLETED' && (
                  <button
                    onClick={() => {
                      setIsInvoiceModalOpen(false);
                      openCancelModal(selectedSale);
                    }}
                    className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Void / Return Sale</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={whatsappSending}
                  onClick={handleSendWhatsApp}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-subtle disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{whatsappSending ? 'Sending...' : 'Send via WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs transition-colors shadow-subtle"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Cancel / Void Invoice Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`Cancel Invoice: ${selectedSale?.invoice_number || ''}`}
        subtitle="Reverse sales transaction, restock inventory items and restore employee credit"
        maxWidth="md"
      >
        <form onSubmit={handleCancelInvoice} className="space-y-4 text-xs">
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-900 space-y-1">
            <div className="font-bold flex items-center space-x-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Are you sure you want to cancel this invoice?</span>
            </div>
            <p className="text-[11px] text-rose-700">
              Total Amount: <strong>{formatCurrency(selectedSale?.total_amount)}</strong> via{' '}
              <strong>{selectedSale?.payment_mode}</strong>
            </p>
            <p className="text-[10px] text-rose-600">
              All line items will be restocked in warehouse inventory with an auditable stock movement. If billed under Employee Credit, the employee's outstanding balance will be credited automatically.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Reason for Cancellation *</label>
            <input
              type="text"
              required
              placeholder="e.g. Returned items, billing error, wrong employee selected"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={cancelling}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-subtle disabled:opacity-50"
            >
              {cancelling ? 'Voiding...' : 'Confirm Void & Restock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
