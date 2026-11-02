import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api.js';
import { PurchaseInvoice, Vendor, GoodsReceipt } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import {
  Receipt,
  Search,
  Plus,
  CreditCard,
  Download,
  AlertTriangle,
  Clock,
  Eye,
  CheckCircle,
  Truck,
  Landmark,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export const PurchaseInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [summary, setSummary] = useState({
    total_count: 0,
    total_invoiced: '0.00',
    total_paid: '0.00',
    total_outstanding: '0.00',
    overdue_amount: '0.00',
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Sorting
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('invoice_date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Register Invoice Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [formVendorId, setFormVendorId] = useState('');
  const [formInvNum, setFormInvNum] = useState('');
  const [formGrnId, setFormGrnId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState('');
  const [formSubtotal, setFormSubtotal] = useState<number>(0);
  const [formTax, setFormTax] = useState<number>(0);
  const [formTotal, setFormTotal] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'NEFT_RTGS' | 'CHEQUE' | 'UPI' | 'CASH'>('NEFT_RTGS');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Invoice Details Modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<any | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter, vendorFilter, sortBy, sortOrder]);

  const fetchInitialData = async () => {
    try {
      const [vRes, rRes] = await Promise.all([
        api.get('/vendors'),
        api.get('/purchasing/receipts'),
      ]);
      if (vRes.data.success) setVendors(vRes.data.data);
      if (rRes.data.success) setReceipts(rRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        vendorId: vendorFilter,
        search,
      });
      const res = await api.get(`/purchasing/invoices?${params.toString()}`);
      if (res.data.success) {
        setInvoices(res.data.data);
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

  const handleRegisterInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVendorId || !formInvNum) {
      setError('Vendor and Invoice Number are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/purchasing/invoices', {
        vendorId: parseInt(formVendorId, 10),
        invoiceNumber: formInvNum,
        grnId: formGrnId ? parseInt(formGrnId, 10) : null,
        invoiceDate: formDate,
        dueDate: formDueDate || null,
        subtotal: formSubtotal,
        taxAmount: formTax,
        totalAmount: formTotal || formSubtotal + formTax,
        notes: formNotes || null,
      });

      if (res.data.success) {
        setIsRegisterModalOpen(false);
        setFormInvNum('');
        setFormSubtotal(0);
        setFormTax(0);
        setFormTotal(0);
        fetchInvoices();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentModal = (inv: any) => {
    setSelectedInvoice(inv);
    const balance = parseFloat(inv.total_amount.toString()) - parseFloat(inv.paid_amount.toString());
    setPaymentAmount(balance);
    setPaymentMode('NEFT_RTGS');
    setPaymentReference('');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/purchasing/invoices/${selectedInvoice.id}/payment`, {
        vendorId: selectedInvoice.vendor_id,
        amount: paymentAmount,
        paymentMode,
        referenceNumber: paymentReference || null,
        notes: paymentNotes || null,
      });

      if (res.data.success) {
        setIsPaymentModalOpen(false);
        fetchInvoices();
        alert('Vendor disbursement recorded and ledger updated.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInvoiceDetails = async (invoiceId: number) => {
    setIsDetailsModalOpen(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/purchasing/invoices/${invoiceId}`);
      if (res.data.success) {
        setInvoiceDetails(res.data.data.invoice);
        setInvoicePayments(res.data.data.payments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportCSV = () => {
    if (invoices.length === 0) {
      alert('No invoices to export.');
      return;
    }

    const headers = [
      'System Bill Number',
      'Vendor Invoice Number',
      'Supplier Name',
      'Supplier Code',
      'GRN Reference',
      'Invoice Date',
      'Due Date',
      'Subtotal (₹)',
      'Tax (₹)',
      'Total Amount (₹)',
      'Paid Amount (₹)',
      'Balance Due (₹)',
      'Payment Status',
    ];

    const rows = invoices.map((i: any) => [
      `"${i.system_bill_number}"`,
      `"${i.invoice_number}"`,
      `"${i.vendor_name}"`,
      `"${i.vendor_code}"`,
      `"${i.grn_number || 'Direct'}"`,
      `"${i.invoice_date}"`,
      `"${i.due_date || ''}"`,
      parseFloat(i.subtotal.toString()).toFixed(2),
      parseFloat(i.tax_amount.toString()).toFixed(2),
      parseFloat(i.total_amount.toString()).toFixed(2),
      parseFloat(i.paid_amount.toString()).toFixed(2),
      (parseFloat(i.total_amount.toString()) - parseFloat(i.paid_amount.toString())).toFixed(2),
      `"${i.status}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cfecc_purchase_invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Purchase Invoices & Vendor Bills</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Accounts payable management: 3-way matched supplier invoices, payment aging and bank disbursements
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
            onClick={() => {
              setFormVendorId(vendors[0]?.id?.toString() || '');
              setIsRegisterModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Vendor Bill</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Total Invoiced</span>
            <Receipt className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2 tabular-nums">
            ₹{parseFloat(summary.total_invoiced).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">{summary.total_count} Registered Bills</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase">Paid / Settled</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2 tabular-nums">
            ₹{parseFloat(summary.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Disbursed to suppliers</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase">Outstanding Balance</span>
            <CreditCard className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 mt-2 tabular-nums">
            ₹{parseFloat(summary.total_outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Current accounts payable</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase">Overdue Bills</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 mt-2 tabular-nums">
            ₹{parseFloat(summary.overdue_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Past due payment terms</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Bill #, Vendor Invoice #, Supplier..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </select>

          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
          >
            <option value="ALL">All Suppliers</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchase Invoices Register Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">System Bill #</th>
                <th className="py-3 px-4">Vendor Bill #</th>
                <th className="py-3 px-4">Supplier / Agency</th>
                <th className="py-3 px-4">GRN Ref</th>
                <th className="py-3 px-4">Invoice Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading purchase invoices...</div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-textSecondary">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No purchase invoices found matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  const balance = parseFloat(inv.total_amount.toString()) - parseFloat(inv.paid_amount.toString());
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-navy-800">{inv.system_bill_number}</td>

                      <td className="py-3 px-4 font-mono text-textSecondary font-medium">{inv.invoice_number}</td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{inv.vendor_name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">{inv.vendor_code}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-textSecondary">
                        {inv.grn_number ? (
                          <span className="text-emerald-700 font-semibold">{inv.grn_number}</span>
                        ) : (
                          <span className="text-slate-400">Direct Bill</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-textSecondary">{inv.invoice_date}</td>

                      <td className="py-3 px-4">
                        <span className={inv.is_overdue ? 'text-rose-600 font-bold' : 'text-textSecondary'}>
                          {inv.due_date || '-'}
                        </span>
                        {inv.is_overdue && (
                          <span className="block text-[9px] font-bold text-rose-600 uppercase">OVERDUE</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                        ₹{parseFloat(inv.total_amount.toString()).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-emerald-700 tabular-nums">
                        ₹{parseFloat(inv.paid_amount.toString()).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span className={balance > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                          ₹{balance.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            title="View Invoice & Match Details"
                            onClick={() => openInvoiceDetails(inv.id)}
                            className="p-1 hover:bg-slate-100 rounded text-textSecondary hover:text-navy-800 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {inv.status !== 'PAID' && (
                            <button
                              onClick={() => openPaymentModal(inv)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover shadow-subtle"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay Bill</span>
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
      </div>

      {/* Register Purchase Invoice Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Vendor Purchase Invoice"
        subtitle="Book supplier bill into accounts payable with 3-way GRN matching"
        maxWidth="2xl"
      >
        <form onSubmit={handleRegisterInvoice} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Select Supplier / Vendor *</label>
              <select
                required
                value={formVendorId}
                onChange={(e) => setFormVendorId(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">Select Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor Invoice / Bill # *</label>
              <input
                type="text"
                required
                placeholder="Supplier's printed invoice number"
                value={formInvNum}
                onChange={(e) => setFormInvNum(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Link Goods Receipt (GRN)</label>
              <select
                value={formGrnId}
                onChange={(e) => setFormGrnId(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">Direct Bill (No GRN)</option>
                {receipts.map((r) => (
                  <option key={r.id} value={r.id}>{r.grn_number} ({r.vendor_name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Invoice Date *</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-borderLine">
            <h4 className="font-bold text-navy-800 uppercase mb-2">Financial Amounts (₹)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Subtotal (Excl. Tax)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formSubtotal}
                  onChange={(e) => {
                    const sub = parseFloat(e.target.value) || 0;
                    setFormSubtotal(sub);
                    setFormTotal(sub + formTax);
                  }}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">GST Tax Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formTax}
                  onChange={(e) => {
                    const tax = parseFloat(e.target.value) || 0;
                    setFormTax(tax);
                    setFormTotal(formSubtotal + tax);
                  }}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-800 uppercase mb-1">Total Invoiced Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formTotal}
                  onChange={(e) => setFormTotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-blue-300 rounded-lg bg-blue-50/50 font-bold text-navy-800 tabular-nums text-sm focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Notes / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Terms 30 days, transport freight included"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Save & Register Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Vendor Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Vendor Disbursement"
        subtitle={`Process payment against Bill ${selectedInvoice?.system_bill_number || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-borderLine space-y-1.5">
            <div className="flex justify-between">
              <span className="text-textSecondary">Supplier:</span>
              <span className="font-bold text-navy-800">{selectedInvoice?.vendor_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textSecondary">Total Bill Value:</span>
              <span className="font-mono tabular-nums">₹{parseFloat(selectedInvoice?.total_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textSecondary">Previously Paid:</span>
              <span className="font-mono tabular-nums text-emerald-700">₹{parseFloat(selectedInvoice?.paid_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-rose-600 border-t border-borderLine pt-1">
              <span>Remaining Balance:</span>
              <span className="font-mono tabular-nums">
                ₹{(parseFloat(selectedInvoice?.total_amount || 0) - parseFloat(selectedInvoice?.paid_amount || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Disbursement Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold text-navy-800 tabular-nums text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Method *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="NEFT_RTGS">NEFT / RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">UTR / Cheque Ref #</label>
              <input
                type="text"
                placeholder="Transaction Reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Disbursement Notes</label>
            <input
              type="text"
              placeholder="e.g. Cleared through HDFC Bank main account"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || paymentAmount <= 0}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Authorize Disbursement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Details & 3-Way Match Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Purchase Invoice: ${invoiceDetails?.system_bill_number || ''}`}
        subtitle={`Supplier bill details, 3-way matching and disbursement records`}
        maxWidth="2xl"
      >
        {loadingDetails ? (
          <div className="py-12 text-center text-textSecondary">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <div>Loading invoice match details...</div>
          </div>
        ) : invoiceDetails ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-borderLine">
              <div>
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Supplier Information</span>
                <span className="font-bold text-navy-800 text-sm block mt-0.5">{invoiceDetails.vendor_name}</span>
                <span className="text-textSecondary font-mono">{invoiceDetails.vendor_code} &bull; GSTIN: {invoiceDetails.vendor_gstin || 'N/A'}</span>
                {invoiceDetails.bank_name && (
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    Bank: {invoiceDetails.bank_name} &bull; A/C: {invoiceDetails.account_number} ({invoiceDetails.ifsc_code})
                  </div>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] text-textSecondary uppercase font-bold block">Bill Dates</span>
                <span className="block mt-0.5 font-medium">Invoice Date: <strong>{invoiceDetails.invoice_date}</strong></span>
                <span className="text-textSecondary block">Payment Due Date: {invoiceDetails.due_date || 'N/A'}</span>
                <span className="font-mono text-emerald-700 block mt-1">
                  {invoiceDetails.grn_number ? `Matched with ${invoiceDetails.grn_number}` : 'Direct Bill'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-white border border-borderLine rounded-lg space-y-2">
              <h5 className="font-bold text-navy-800 uppercase text-[11px]">Financial Totals</h5>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-[10px] text-textSecondary block">Subtotal</span>
                  <span className="font-bold font-mono">₹{parseFloat(invoiceDetails.subtotal).toFixed(2)}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-[10px] text-textSecondary block">GST Output Tax</span>
                  <span className="font-bold font-mono">₹{parseFloat(invoiceDetails.tax_amount).toFixed(2)}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <span className="text-[10px] text-primary block font-bold">Total Bill Value</span>
                  <span className="font-bold font-mono text-primary">₹{parseFloat(invoiceDetails.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Disbursements Table */}
            <div>
              <h5 className="font-bold text-navy-800 uppercase text-[11px] mb-2">Disbursement & Settlement History</h5>
              <div className="border border-borderLine rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                      <th className="py-2 px-3">Payment #</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Mode</th>
                      <th className="py-2 px-3 font-mono">Reference / UTR</th>
                      <th className="py-2 px-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine">
                    {invoicePayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-textSecondary">
                          No payment disbursements recorded for this bill yet.
                        </td>
                      </tr>
                    ) : (
                      invoicePayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700">{p.payment_number}</td>
                          <td className="py-2 px-3 text-textSecondary">{new Date(p.payment_date).toLocaleDateString()}</td>
                          <td className="py-2 px-3 font-semibold">{p.payment_mode}</td>
                          <td className="py-2 px-3 font-mono text-textSecondary">{p.reference_number || '-'}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                            ₹{parseFloat(p.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-borderLine">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
