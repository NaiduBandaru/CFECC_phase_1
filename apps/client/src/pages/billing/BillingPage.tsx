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
  FileSpreadsheet,
  Download,
} from 'lucide-react';

export const BillingPage: React.FC = () => {
  const [periods, setPeriods] = useState<BillingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [statements, setStatements] = useState<EmployeeStatement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setSelectedPeriodId(res.data.data[0].id.toString());
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
        fetchPeriods();
        fetchStatements(selectedPeriodId);
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
        fetchPeriods();
        fetchStatements(selectedPeriodId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to finalize billing' });
    } finally {
      setIsProcessing(false);
    }
  };

  // WhatsApp Dispatch
  const handleSendWhatsApp = async (statementId: number) => {
    try {
      const res = await api.post('/whatsapp/send-statement', { invoiceId: statementId });
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        fetchStatements(selectedPeriodId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to dispatch statement' });
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
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const selectedPeriod = periods.find(p => p.id.toString() === selectedPeriodId);

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
          className={`p-3.5 rounded-lg border text-xs flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-status-danger'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Period Selection & Control Panel */}
      <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="w-full sm:w-72">
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right pr-4 border-r border-borderLine">
              <span className="text-[10px] text-textSecondary uppercase block font-semibold">Total Outstanding Billed</span>
              <span className="text-sm font-bold text-navy-800 tabular-nums">
                ₹{parseFloat(selectedPeriod.total_billed_amount.toString()).toLocaleString('en-IN')}
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
        <div className="p-4 border-b border-borderLine flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-800">
            Consolidated Employee Statements & Ledger Reconciliations
          </h3>
          <span className="text-xs text-textSecondary">{statements.length} statements generated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Statement #</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4 text-right">Opening (₹)</th>
                <th className="py-3 px-4 text-right">Purchases (₹)</th>
                <th className="py-3 px-4 text-right">Payments (₹)</th>
                <th className="py-3 px-4 text-right">Recoveries (₹)</th>
                <th className="py-3 px-4 text-right font-bold text-navy-800">Closing Outstanding (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">WhatsApp Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading statements...</div>
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <CreditCard className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No statements for this period. Click 'Run Billing Engine' to compute.</div>
                  </td>
                </tr>
              ) : (
                statements.map((stmt) => (
                  <tr key={stmt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-navy-800">{stmt.invoice_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-800">{stmt.first_name} {stmt.last_name}</div>
                      <div className="text-[11px] text-textSecondary font-mono">{stmt.employee_code} &bull; {stmt.mobile}</div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-textSecondary font-medium">
                      ₹{parseFloat(stmt.opening_balance.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">
                      ₹{parseFloat(stmt.current_purchases.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-700">
                      ₹{parseFloat(stmt.payments_received.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-700">
                      ₹{parseFloat(stmt.recoveries_deducted.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                      ₹{parseFloat(stmt.closing_outstanding.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={stmt.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {stmt.whatsapp_status === 'SENT' ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Delivered
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendWhatsApp(stmt.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors shadow-subtle"
                          title="Dispatch via WhatsApp Cloud API"
                        >
                          <Send className="w-3 h-3" />
                          <span>Dispatch</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  {s.first_name} {s.last_name} ({s.employee_code}) - Outstanding: ₹{s.closing_outstanding}
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
              required
              placeholder="Enter amount"
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
    </div>
  );
};

