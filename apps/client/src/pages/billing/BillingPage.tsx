import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { BillingPeriod, EmployeeStatement } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  CreditCard,
  Play,
  CheckCircle,
  Plus,
  Send,
  IndianRupee,
  Calendar,
  AlertCircle,
  Search,
  Download,
  Eye,
  Printer,
  FileText,
  Clock,
  User,
  ShoppingBag,
} from 'lucide-react';

const formatCurrency = (val: number | string | undefined | null) => {
  const num = parseFloat((val ?? 0).toString());
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const BillingPage: React.FC = () => {
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [statements, setStatements] = useState<EmployeeStatement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Statement Detail Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [statementDetails, setStatementDetails] = useState<{
    statement: any;
    sales: any[];
    payments: any[];
    recoveries: any[];
  } | null>(null);

  // New Period Modal
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState<boolean>(false);
  const [periodForm, setPeriodForm] = useState({
    periodCode: `BILL-2026-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    periodName: `${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })} Store Billing`,
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    billingDate: new Date().toISOString().split('T')[0],
  });

  // Direct Payment Collection Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({
    employeeId: '',
    paymentMode: 'UPI',
    amount: '',
    transactionReference: '',
    remarks: 'Monthly settlement payment',
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchStatements(selectedPeriodId);
    }
  }, [selectedPeriodId]);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await api.get('/billing/periods');
      if (res.data.success && res.data.data.length > 0) {
        setPeriods(res.data.data);
        if (!selectedPeriodId) {
          setSelectedPeriodId(res.data.data[0].id.toString());
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatements = async (periodId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/billing/statements?periodId=${periodId}`);
      if (res.data.success) {
        setStatements(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Run Billing Engine
  const handleGenerateBilling = async () => {
    if (!selectedPeriodId) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await api.post('/billing/generate', { periodId: parseInt(selectedPeriodId, 10) });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        await fetchPeriods();
        await fetchStatements(selectedPeriodId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to generate billing' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Finalize Billing
  const handleFinalizeBilling = async () => {
    if (!selectedPeriodId) return;
    if (!confirm('Are you sure you want to finalize this billing period? Finalized periods cannot be modified.')) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await api.post('/billing/finalize', { periodId: parseInt(selectedPeriodId, 10) });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        await fetchPeriods();
        await fetchStatements(selectedPeriodId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to finalize billing' });
    } finally {
      setIsProcessing(false);
    }
  };

  // View Statement Details
  const handleViewStatement = async (statementId: number) => {
    setIsDetailModalOpen(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/billing/statements/${statementId}`);
      if (res.data.success) {
        setStatementDetails(res.data.data);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load statement details' });
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // WhatsApp Dispatch
  const handleSendWhatsApp = async (statementId: number) => {
    setDispatchingId(statementId);
    try {
      const res = await api.post('/whatsapp/send-statement', { invoiceId: statementId });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        await fetchStatements(selectedPeriodId);
      } else {
        setMessage({ type: 'error', text: res.data.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to dispatch statement' });
    } finally {
      setDispatchingId(null);
    }
  };

  // Bulk WhatsApp Dispatch
  const handleBulkSendWhatsApp = async () => {
    if (!selectedPeriodId) return;
    if (!confirm('Are you sure you want to dispatch WhatsApp statements to all employees in this period?')) return;
    try {
      setIsProcessing(true);
      const res = await api.post('/whatsapp/bulk-dispatch-statements', { billingPeriodId: selectedPeriodId });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        await fetchStatements(selectedPeriodId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to dispatch bulk statements' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Record Direct Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/billing/payments', {
        employeeId: parseInt(paymentForm.employeeId, 10),
        paymentMode: paymentForm.paymentMode,
        amount: parseFloat(paymentForm.amount),
        transactionReference: paymentForm.transactionReference,
        remarks: paymentForm.remarks,
      });
      if (res.data.success) {
        setIsPaymentModalOpen(false);
        setMessage({ type: 'success', text: res.data.message });
        fetchStatements(selectedPeriodId);
        setPaymentForm({
          employeeId: '',
          paymentMode: 'UPI',
          amount: '',
          transactionReference: '',
          remarks: 'Monthly settlement payment',
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record payment');
    }
  };

  // Create New Billing Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/billing/periods', periodForm);
      setMessage({ type: 'success', text: `Billing period ${periodForm.periodCode} created successfully!` });
      setIsNewPeriodModalOpen(false);
      await fetchPeriods();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create billing period.' });
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (statements.length === 0) return;
    const periodCode = selectedPeriod?.period_code || 'BILLING';
    const headers = [
      'Statement #',
      'Society CS #',
      'Employee Code',
      'Grade',
      'Employee Name',
      'Mobile',
      'Opening (INR)',
      'Purchases (INR)',
      'Payments (INR)',
      'Recoveries (INR)',
      'Closing Outstanding (INR)',
      'Status',
      'WhatsApp Status',
    ];
    const rows = statements.map((s) => [
      s.invoice_number,
      s.cs_no || '',
      s.employee_code,
      s.grade || (s.category === 'STAFF' ? 'M' : s.category === 'SPECIAL' ? 'Other' : 'NM'),
      `"${s.first_name} ${s.last_name}"`,
      s.mobile || '',
      parseFloat(s.opening_balance?.toString() || '0').toFixed(2),
      parseFloat(s.current_purchases?.toString() || '0').toFixed(2),
      parseFloat(s.payments_received?.toString() || '0').toFixed(2),
      parseFloat(s.recoveries_deducted?.toString() || '0').toFixed(2),
      parseFloat(s.closing_outstanding?.toString() || '0').toFixed(2),
      s.status,
      s.whatsapp_status || 'PENDING',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CFECC_Employee_Billing_${periodCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedPeriod = periods.find((p) => p.id.toString() === selectedPeriodId);

  const totalPeriodBilled = statements.reduce(
    (acc, s) => acc + parseFloat(s.closing_outstanding?.toString() || '0'),
    0
  );

  const filteredStatements = statements.filter((stmt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      stmt.invoice_number?.toLowerCase().includes(q) ||
      stmt.first_name?.toLowerCase().includes(q) ||
      stmt.last_name?.toLowerCase().includes(q) ||
      stmt.employee_code?.toLowerCase().includes(q) ||
      stmt.cs_no?.toLowerCase().includes(q) ||
      stmt.mobile?.includes(q)
    );
  });

  const deliveredCount = statements.filter(
    (s) => ['SENT', 'DELIVERED', 'READ'].includes(s.whatsapp_status || '')
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Monthly Employee Billing Engine</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            End-of-month credit consolidation, statement computation, reconciliation & WhatsApp delivery
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCsv}
            disabled={statements.length === 0}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle disabled:opacity-50"
            title="Export billing schedule to CSV"
          >
            <Download className="w-3.5 h-3.5 text-textSecondary" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={() => setIsNewPeriodModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Billing Period</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-status-danger'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-bold opacity-60 hover:opacity-100 ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Period Selection & Control Panel */}
      <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="w-full sm:w-80">
            <label className="block text-[10px] font-bold text-textSecondary uppercase tracking-wider mb-1">
              Active Billing Cycle
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold text-navy-800 bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.period_name} ({p.period_code}) &bull; {p.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPeriod && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right pr-4 border-r border-borderLine">
              <span className="text-[10px] text-textSecondary uppercase block font-semibold">Total Outstanding Billed</span>
              <span className="text-sm font-bold text-navy-800 tabular-nums">
                {formatCurrency(totalPeriodBilled)}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleGenerateBilling}
                disabled={isProcessing || selectedPeriod.status === 'FINALIZED'}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-navy-800 text-white text-xs font-semibold hover:bg-navy-900 transition-colors shadow-subtle disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-primary" />
                <span>{isProcessing ? 'Computing...' : 'Run Billing Engine'}</span>
              </button>

              <button
                onClick={handleFinalizeBilling}
                disabled={isProcessing || selectedPeriod.status === 'FINALIZED'}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-subtle disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Finalize & Approve</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Statements Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-borderLine flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-navy-800">
              Consolidated Employee Statements & Ledger Reconciliations
            </h3>
            <span className="text-xs text-textSecondary">
              {filteredStatements.length} statements {searchQuery && `matching "${searchQuery}"`}
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input
                type="text"
                placeholder="Search employee, ID, mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 text-xs focus:bg-white focus:outline-none w-56"
              />
            </div>

            <button
              onClick={handleBulkSendWhatsApp}
              disabled={isProcessing || statements.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-subtle disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispatch All WhatsApp Statements</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Statement #</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4 text-right">Opening (₹)</th>
                <th className="py-3 px-4 text-right">Purchases (₹)</th>
                <th className="py-3 px-4 text-right">Payments (₹)</th>
                <th className="py-3 px-4 text-right">Recoveries (₹)</th>
                <th className="py-3 px-4 text-right font-bold text-navy-800">Closing Outstanding (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">WhatsApp Delivery</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading statements...</div>
                  </td>
                </tr>
              ) : filteredStatements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-textSecondary">
                    <CreditCard className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>
                      {searchQuery
                        ? `No statements matching "${searchQuery}"`
                        : "No statements for this period. Click 'Run Billing Engine' to compute."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStatements.map((stmt) => {
                  const isDelivered = ['SENT', 'DELIVERED', 'READ'].includes(stmt.whatsapp_status || '');
                  const isDispatchingThis = dispatchingId === stmt.id;

                  return (
                    <tr
                      key={stmt.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => handleViewStatement(stmt.id)}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-navy-800">
                        {stmt.invoice_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800 flex items-center space-x-1.5">
                          <span>{stmt.first_name} {stmt.last_name}</span>
                          {stmt.cs_no && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              CS #{stmt.cs_no}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-textSecondary font-mono flex items-center space-x-1.5 mt-0.5">
                          <span>{stmt.employee_code}</span>
                          <span>&bull;</span>
                          <span>{stmt.mobile || 'No Mobile'}</span>
                          {stmt.grade && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-navy-50 text-navy-800 border border-navy-200">
                              {stmt.grade === 'M' ? 'Mgmt (M)' : stmt.grade === 'NM' ? 'Worker (NM)' : stmt.grade}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-textSecondary font-medium">
                        {formatCurrency(stmt.opening_balance)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">
                        {formatCurrency(stmt.current_purchases)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-700">
                        {formatCurrency(stmt.payments_received)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-700">
                        {formatCurrency(stmt.recoveries_deducted)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                        {formatCurrency(stmt.closing_outstanding)}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={stmt.status} />
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {isDelivered ? (
                          <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                            Delivered
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendWhatsApp(stmt.id)}
                            disabled={isDispatchingThis}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors shadow-subtle disabled:opacity-50"
                            title="Dispatch statement via WhatsApp Cloud API"
                          >
                            <Send className="w-3 h-3" />
                            <span>{isDispatchingThis ? 'Sending...' : 'Dispatch'}</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewStatement(stmt.id)}
                          className="p-1 rounded text-textSecondary hover:text-navy-800 hover:bg-slate-100 transition-colors"
                          title="View statement breakdown & receipts"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
            Showing <span className="font-bold text-navy-800 font-mono">{filteredStatements.length}</span> member statements &bull; Total Closing Outstanding:{' '}
            <strong className="text-navy-900 font-mono text-sm font-black">
              {formatCurrency(totalPeriodBilled)}
            </strong>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-emerald-700 font-medium font-mono">
              Delivered via WhatsApp: {deliveredCount} / {statements.length}
            </span>
          </div>
        </div>
      </div>

      {/* Statement Detail / Breakdown Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Employee Monthly Store Statement"
        subtitle={statementDetails?.statement?.invoice_number || 'Statement Details'}
        maxWidth="xl"
      >
        {loadingDetails ? (
          <div className="py-12 text-center text-textSecondary">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <div>Loading statement details...</div>
          </div>
        ) : statementDetails ? (
          <div className="space-y-4 text-xs">
            {/* Printable Statement Container */}
            <div className="p-4 border border-borderLine rounded-lg bg-white space-y-4 print:border-none print:p-0">
              {/* Header */}
              <div className="text-center pb-3 border-b border-borderLine">
                <h3 className="font-bold text-navy-800 text-base tracking-wide uppercase">CFECC STORES</h3>
                <p className="text-[11px] text-textSecondary">Visakhapatnam, Andhra Pradesh &bull; Employee Credit Ledger</p>
                <span className="inline-block mt-1 font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {statementDetails.statement.period_name} ({statementDetails.statement.period_code})
                </span>
              </div>

              {/* Employee Info Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-borderLine text-[11px]">
                <div className="space-y-1">
                  <div className="text-textSecondary flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Employee:</span>
                  </div>
                  <div className="font-bold text-navy-800 text-xs flex items-center space-x-1.5">
                    <span>{statementDetails.statement.first_name} {statementDetails.statement.last_name}</span>
                    {statementDetails.statement.cs_no && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                        CS #{statementDetails.statement.cs_no}
                      </span>
                    )}
                  </div>
                  <div className="text-textSecondary font-mono text-[10px]">
                    ID: {statementDetails.statement.employee_code}
                    {statementDetails.statement.grade && (
                      <span className="ml-1 px-1 py-0.2 rounded font-semibold bg-navy-100 text-navy-800">
                        {statementDetails.statement.grade === 'M' ? 'Mgmt (M)' : statementDetails.statement.grade === 'NM' ? 'Worker (NM)' : statementDetails.statement.grade}
                      </span>
                    )}
                    &bull; Dept: {statementDetails.statement.department_name || 'N/A'}
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <div className="text-textSecondary flex items-center justify-end space-x-1">
                    <Clock className="w-3.5 h-3.5 text-textSecondary" />
                    <span>Billing Window:</span>
                  </div>
                  <div className="font-mono font-medium text-navy-800">
                    {statementDetails.statement.period_start_date} to {statementDetails.statement.period_end_date}
                  </div>
                  <div className="text-textSecondary font-mono">
                    Phone: {statementDetails.statement.mobile || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Ledger Summary Cards */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2.5 bg-slate-50 border border-borderLine rounded-lg">
                  <span className="text-[10px] text-textSecondary block uppercase font-bold">Opening Balance</span>
                  <span className="font-mono font-bold text-xs text-textSecondary">
                    {formatCurrency(statementDetails.statement.opening_balance)}
                  </span>
                </div>
                <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                  <span className="text-[10px] text-primary block uppercase font-bold">+ Month Purchases</span>
                  <span className="font-mono font-bold text-xs text-primary">
                    {formatCurrency(statementDetails.statement.current_purchases)}
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] text-emerald-800 block uppercase font-bold">- Payments / Recoveries</span>
                  <span className="font-mono font-bold text-xs text-emerald-700">
                    {formatCurrency(
                      parseFloat(statementDetails.statement.payments_received || '0') +
                      parseFloat(statementDetails.statement.recoveries_deducted || '0')
                    )}
                  </span>
                </div>
                <div className="p-2.5 bg-navy-50 border border-navy-200 rounded-lg">
                  <span className="text-[10px] text-navy-800 block uppercase font-bold">= Net Closing Due</span>
                  <span className="font-mono font-bold text-xs text-navy-900">
                    {formatCurrency(statementDetails.statement.closing_outstanding)}
                  </span>
                </div>
              </div>

              {/* Credit Purchases Breakdown */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-navy-800 text-xs flex items-center space-x-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                    <span>Monthly Store Invoices / Purchases ({statementDetails.sales.length})</span>
                  </h4>
                  <span className="text-[11px] text-textSecondary font-mono">
                    Total: {formatCurrency(statementDetails.statement.current_purchases)}
                  </span>
                </div>

                {statementDetails.sales.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-borderLine rounded-lg text-center text-textSecondary text-[11px]">
                    No store credit receipts logged in this billing window.
                  </div>
                ) : (
                  <div className="border border-borderLine rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-700 border-b border-borderLine">
                        <tr>
                          <th className="py-2 px-3">Invoice #</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3 text-center">Items</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                          <th className="py-2 px-3 text-right">Tax</th>
                          <th className="py-2 px-3 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borderLine">
                        {statementDetails.sales.map((sl: any) => (
                          <tr key={sl.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-semibold text-primary">{sl.invoice_number}</td>
                            <td className="py-2 px-3 text-textSecondary">
                              {new Date(sl.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">{sl.item_count || 1} line(s)</td>
                            <td className="py-2 px-3 text-right font-mono text-textSecondary">{formatCurrency(sl.subtotal)}</td>
                            <td className="py-2 px-3 text-right font-mono text-textSecondary">{formatCurrency(sl.tax_amount)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-navy-800">{formatCurrency(sl.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-borderLine">
              <div className="text-[11px] text-textSecondary flex items-center space-x-1">
                <span>WhatsApp Status:</span>
                <span className="font-bold text-navy-800 uppercase">
                  {statementDetails.statement.whatsapp_status || 'NOT_DISPATCHED'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSendWhatsApp(statementDetails.statement.id);
                    setIsDetailModalOpen(false);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-subtle"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs transition-colors shadow-subtle"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Record Direct Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Direct Employee Payment / Collection"
        subtitle="Post cash/UPI settlement against employee store ledger"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Select Employee *</label>
            <select
              required
              value={paymentForm.employeeId}
              onChange={(e) => setPaymentForm({ ...paymentForm, employeeId: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="">Select Employee</option>
              {statements.map((s) => (
                <option key={s.employee_id} value={s.employee_id}>
                  {s.first_name} {s.last_name} {s.cs_no ? `(CS #${s.cs_no} • ${s.employee_code})` : `(${s.employee_code})`} - Outstanding: {formatCurrency(s.closing_outstanding)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Method</label>
            <select
              value={paymentForm.paymentMode}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="UPI">UPI / QR Code</option>
              <option value="CASH">Cash Deposit</option>
              <option value="BANK_TRANSFER">Direct Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="Enter amount in ₹"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold tabular-nums"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Transaction Ref / UTR</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref / Cash Memo No"
              value={paymentForm.transactionReference}
              onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle"
            >
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Create New Billing Period Modal */}
      <Modal
        isOpen={isNewPeriodModalOpen}
        onClose={() => setIsNewPeriodModalOpen(false)}
        title="Create New Billing Period"
      >
        <form onSubmit={handleCreatePeriod} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Period Code *</label>
            <input
              type="text"
              required
              value={periodForm.periodCode}
              onChange={(e) => setPeriodForm({ ...periodForm, periodCode: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Period Name *</label>
            <input
              type="text"
              required
              value={periodForm.periodName}
              onChange={(e) => setPeriodForm({ ...periodForm, periodName: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={periodForm.startDate}
                onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">End Date *</label>
              <input
                type="date"
                required
                value={periodForm.endDate}
                onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Billing Date *</label>
            <input
              type="date"
              required
              value={periodForm.billingDate}
              onChange={(e) => setPeriodForm({ ...periodForm, billingDate: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsNewPeriodModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle"
            >
              Create Period
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
