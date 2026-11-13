import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api.js';
import { Vendor, GoodsReceipt } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Receipt,
  Search,
  Plus,
  CreditCard,
  Download,
  Clock,
  Eye,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatCurrency = (val: number | string | undefined | null) => {
  const num = parseFloat((val ?? 0).toString());
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Register Invoice Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [formVendorId, setFormVendorId] = useState('');
  const [formVendorSearch, setFormVendorSearch] = useState('');
  const [isFormVendorSearchOpen, setIsFormVendorSearchOpen] = useState(false);
  const [formInvNum, setFormInvNum] = useState('');
  const [formGrnId, setFormGrnId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState('');
  const [formSubtotal, setFormSubtotal] = useState<number>(0);
  const [formCgst, setFormCgst] = useState<number>(0);
  const [formSgst, setFormSgst] = useState<number>(0);
  const [formIgst, setFormIgst] = useState<number>(0);
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

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, vendorFilter]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [vRes, rRes, iRes] = await Promise.all([
        api.get('/vendors'),
        api.get('/purchasing/receipts'),
        api.get('/purchasing/invoices'),
      ]);
      if (vRes.data.success) setVendors(vRes.data.data);
      if (rRes.data.success) setReceipts(rRes.data.data);
      if (iRes.data.success) {
        setInvoices(iRes.data.data);
        if (iRes.data.summary) {
          setSummary(iRes.data.summary);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/purchasing/invoices');
      if (res.data.success) {
        setInvoices(res.data.data);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error(err);
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
      const calculatedTax = formCgst + formSgst + formIgst;
      const finalTotal = formTotal > 0 ? formTotal : (formSubtotal + calculatedTax);

      const res = await api.post('/purchasing/invoices', {
        vendorId: parseInt(formVendorId, 10),
        invoiceNumber: formInvNum,
        grnId: formGrnId ? parseInt(formGrnId, 10) : null,
        invoiceDate: formDate,
        dueDate: formDueDate || null,
        subtotal: formSubtotal,
        taxAmount: calculatedTax,
        totalAmount: finalTotal,
        notes: formNotes || null,
      });

      if (res.data.success) {
        setIsRegisterModalOpen(false);
        setFormVendorId('');
        setFormVendorSearch('');
        setFormInvNum('');
        setFormGrnId('');
        setFormSubtotal(0);
        setFormCgst(0);
        setFormSgst(0);
        setFormIgst(0);
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

  // Helper for Tax Breakdown based on Vendor State/GSTIN
  const getInvoiceTax = (inv: any) => {
    const sub = parseFloat(inv.subtotal?.toString() || '0');
    const tax = parseFloat(inv.tax_amount?.toString() || '0');
    const total = parseFloat(inv.total_amount?.toString() || '0');
    const paid = parseFloat(inv.paid_amount?.toString() || '0');
    const balance = Math.max(0, total - paid);
    const gstin = inv.vendor_gstin?.trim() || '';
    const isInter = gstin && !gstin.startsWith('37');

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (tax > 0) {
      if (isInter) {
        igst = tax;
      } else {
        cgst = tax / 2;
        sgst = tax / 2;
      }
    }

    return { sub, tax, cgst, sgst, igst, total, paid, balance, isInter };
  };

  // Instant In-Memory Filtered Invoices (0ms typing latency)
  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (statusFilter !== 'ALL') {
      result = result.filter((inv) => inv.status === statusFilter);
    }
    if (vendorFilter !== 'ALL') {
      result = result.filter((inv) => inv.vendor_id?.toString() === vendorFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (inv) =>
          inv.system_bill_number?.toLowerCase().includes(q) ||
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.vendor_name?.toLowerCase().includes(q) ||
          inv.vendor_code?.toLowerCase().includes(q) ||
          (inv.vendor_gstin && inv.vendor_gstin.toLowerCase().includes(q)) ||
          (inv.grn_number && inv.grn_number.toLowerCase().includes(q)) ||
          (inv.notes && inv.notes.toLowerCase().includes(q))
      );
    }
    return result;
  }, [invoices, statusFilter, vendorFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Aggregate Tax Summary across filtered invoices
  const invoiceTaxSummary = useMemo(() => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    filteredInvoices.forEach((inv) => {
      const t = getInvoiceTax(inv);
      subtotal += t.sub;
      cgst += t.cgst;
      sgst += t.sgst;
      igst += t.igst;
      totalTax += t.tax;
      totalAmount += t.total;
      totalPaid += t.paid;
      totalBalance += t.balance;
    });

    return { subtotal, cgst, sgst, igst, totalTax, totalAmount, totalPaid, totalBalance };
  }, [filteredInvoices]);

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      alert('No invoices to export.');
      return;
    }

    const headers = [
      'System Bill Number',
      'Vendor Invoice Number',
      'Supplier Name',
      'Supplier Code',
      'Vendor GSTIN',
      'Tax Jurisdiction',
      'GRN Reference',
      'Invoice Date',
      'Due Date',
      'Subtotal (INR)',
      'CGST (INR)',
      'SGST (INR)',
      'IGST (INR)',
      'Total GST (INR)',
      'Total Invoiced (INR)',
      'Paid Amount (INR)',
      'Balance Due (INR)',
      'Payment Status',
    ];

    const rows = filteredInvoices.map((i: any) => {
      const t = getInvoiceTax(i);
      return [
        `"${i.system_bill_number}"`,
        `"${i.invoice_number}"`,
        `"${(i.vendor_name || '').replace(/"/g, '""')}"`,
        `"${i.vendor_code}"`,
        `"${i.vendor_gstin || ''}"`,
        `"${t.isInter ? 'Inter-State (IGST)' : 'Intra-State AP (CGST+SGST)'}"`,
        `"${i.grn_number || 'Direct'}"`,
        `"${formatDate(i.invoice_date)}"`,
        `"${formatDate(i.due_date)}"`,
        t.sub.toFixed(2),
        t.cgst.toFixed(2),
        t.sgst.toFixed(2),
        t.igst.toFixed(2),
        t.tax.toFixed(2),
        t.total.toFixed(2),
        t.paid.toFixed(2),
        t.balance.toFixed(2),
        `"${i.status}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
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

      {/* Purchase Invoices Register Table with Standard Format and Horizontal Scroller */}
      <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col space-y-2 p-4">
        {/* Horizontal Scroll Guide & GST Banner */}
        <div className="flex items-center justify-between text-[11px] text-textSecondary bg-slate-50/80 px-3.5 py-2 rounded-lg border border-borderLine">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Detailed Accounts Payable Register with <strong>CGST + SGST (Intra-State AP - 37)</strong> & <strong>IGST (Inter-State)</strong> breakdown
            </span>
          </div>
          <div className="text-slate-500 hidden sm:flex items-center space-x-1 text-[11px] font-medium">
            <span>Scroll horizontally &harr; to view all tax & payment columns comfortably</span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px] border border-borderLine rounded-lg scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse min-w-[1700px]">
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3.5 sticky left-0 z-30 bg-slate-100 min-w-[130px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-r border-borderLine">
                  System Bill #
                </th>
                <th className="py-3 px-3 min-w-[120px]">Vendor Bill #</th>
                <th className="py-3 px-3 min-w-[200px]">Supplier / Agency</th>
                <th className="py-3 px-3 min-w-[150px]">Vendor GSTIN</th>
                <th className="py-3 px-3 min-w-[120px]">GRN Ref</th>
                <th className="py-3 px-3 min-w-[105px]">Invoice Date</th>
                <th className="py-3 px-3 min-w-[105px]">Due Date</th>
                <th className="py-3 px-3 text-right min-w-[120px]">Taxable Subtotal</th>
                <th className="py-3 px-3 text-right min-w-[95px] text-blue-700 bg-blue-50/50">CGST (₹)</th>
                <th className="py-3 px-3 text-right min-w-[95px] text-indigo-700 bg-indigo-50/50">SGST (₹)</th>
                <th className="py-3 px-3 text-right min-w-[95px] text-purple-700 bg-purple-50/50">IGST (₹)</th>
                <th className="py-3 px-3 text-right min-w-[105px] text-navy-800 bg-slate-200/50">Total GST</th>
                <th className="py-3 px-3 text-right min-w-[125px]">Total Invoiced</th>
                <th className="py-3 px-3 text-right min-w-[115px] text-emerald-700">Paid Amount</th>
                <th className="py-3 px-3 text-right min-w-[115px]">Balance Due</th>
                <th className="py-3 px-3 text-center min-w-[100px]">Status</th>
                <th className="py-3 px-3.5 text-center sticky right-0 z-30 bg-slate-100 min-w-[125px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.08)] border-l border-borderLine">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={17} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading purchase invoices...</div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-8 text-center text-textSecondary">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No purchase invoices found matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv: any) => {
                  const t = getInvoiceTax(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Sticky System Bill # */}
                      <td className="py-3 px-3.5 font-mono font-bold text-navy-800 sticky left-0 z-10 bg-white/95 backdrop-blur-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] border-r border-borderLine">
                        {inv.system_bill_number}
                      </td>

                      {/* Vendor Bill # */}
                      <td className="py-3 px-3 font-mono text-textSecondary font-semibold">
                        {inv.invoice_number}
                      </td>

                      {/* Supplier / Agency */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-navy-800">{inv.vendor_name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">Code: {inv.vendor_code}</div>
                      </td>

                      {/* Vendor GSTIN */}
                      <td className="py-3 px-3 font-mono text-textSecondary text-[11px]">
                        {inv.vendor_gstin || '37AAAAA0000A1Z5'}
                      </td>

                      {/* GRN Ref */}
                      <td className="py-3 px-3 font-mono text-textSecondary">
                        {inv.grn_number ? (
                          <span className="text-emerald-700 font-semibold">{inv.grn_number}</span>
                        ) : (
                          <span className="text-slate-400">Direct Bill</span>
                        )}
                      </td>

                      {/* Invoice Date */}
                      <td className="py-3 px-3 text-textSecondary whitespace-nowrap font-medium">
                        {formatDate(inv.invoice_date)}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={inv.is_overdue ? 'text-rose-600 font-bold' : 'text-textSecondary'}>
                          {formatDate(inv.due_date)}
                        </span>
                        {inv.is_overdue && (
                          <span className="block text-[9px] font-bold text-rose-600 uppercase">OVERDUE</span>
                        )}
                      </td>

                      {/* Taxable Subtotal */}
                      <td className="py-3 px-3 text-right font-medium text-slate-800 tabular-nums">
                        {formatCurrency(t.sub)}
                      </td>

                      {/* CGST */}
                      <td className="py-3 px-3 text-right tabular-nums bg-blue-50/30">
                        {t.cgst > 0 ? (
                          <span className="font-bold text-blue-800">{formatCurrency(t.cgst)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* SGST */}
                      <td className="py-3 px-3 text-right tabular-nums bg-indigo-50/30">
                        {t.sgst > 0 ? (
                          <span className="font-bold text-indigo-800">{formatCurrency(t.sgst)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* IGST */}
                      <td className="py-3 px-3 text-right tabular-nums bg-purple-50/30">
                        {t.igst > 0 ? (
                          <span className="font-bold text-purple-800">{formatCurrency(t.igst)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Total GST */}
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-navy-800 bg-slate-100/50">
                        {t.tax > 0 ? formatCurrency(t.tax) : '-'}
                      </td>

                      {/* Total Invoiced Amount */}
                      <td className="py-3 px-3 text-right font-bold text-navy-800 tabular-nums">
                        {formatCurrency(t.total)}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-3 text-right font-medium text-emerald-700 tabular-nums">
                        {formatCurrency(t.paid)}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        <span className={t.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                          {formatCurrency(t.balance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
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

                      {/* Sticky Actions */}
                      <td className="py-3 px-3.5 text-center sticky right-0 z-10 bg-white/95 backdrop-blur-xs shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.06)] border-l border-borderLine">
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
                              <span>Pay</span>
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

        {/* Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 pb-1 text-xs text-textSecondary px-1">
          <div className="flex items-center space-x-2">
            <span>Showing</span>
            <span className="font-bold text-navy-800 font-mono">
              {filteredInvoices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-bold text-navy-800 font-mono">
              {Math.min(currentPage * pageSize, filteredInvoices.length)}
            </span>
            <span>of</span>
            <span className="font-bold text-navy-800 font-mono">{filteredInvoices.length}</span>
            <span>purchase invoices</span>
            {filteredInvoices.length !== invoices.length && (
              <span className="text-[11px] text-primary font-mono">(filtered from {invoices.length} total)</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white border border-borderLine rounded text-xs focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px]"
                title="First Page"
              >
                &laquo;
              </button>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px] flex items-center space-x-1"
                title="Previous Page"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>
              <span className="px-2 font-mono font-bold text-navy-800 text-[11px]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px] flex items-center space-x-1"
                title="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px]"
                title="Last Page"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>

        {/* Standard Floating Summary Footer with Full Tax Breakdown */}
        <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between text-xs text-textSecondary select-none gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              Taxable: <strong className="text-navy-800 font-mono">{formatCurrency(invoiceTaxSummary.subtotal)}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-blue-700">
              CGST: <strong className="font-mono">{formatCurrency(invoiceTaxSummary.cgst)}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-indigo-700">
              SGST: <strong className="font-mono">{formatCurrency(invoiceTaxSummary.sgst)}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-purple-700">
              IGST: <strong className="font-mono">{formatCurrency(invoiceTaxSummary.igst)}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-navy-800">
              Total GST: <strong className="font-mono font-bold">{formatCurrency(invoiceTaxSummary.totalTax)}</strong>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs self-end md:self-auto">
            <span className="text-navy-900 font-bold">
              Total Invoiced:{' '}
              <strong className="text-navy-900 font-mono text-sm font-black">
                {formatCurrency(invoiceTaxSummary.totalAmount)}
              </strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-rose-700 font-bold">
              Outstanding AP:{' '}
              <strong className="text-rose-700 font-mono text-sm font-black">
                {formatCurrency(invoiceTaxSummary.totalBalance)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Register Purchase Invoice Modal with Searchable Vendor & CGST/SGST/IGST */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Vendor Purchase Invoice"
        subtitle="Book supplier bill into accounts payable with automated tax calculations & 3-way GRN matching"
        maxWidth="2xl"
      >
        <form onSubmit={handleRegisterInvoice} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Searchable Vendor Selector */}
            <div className="relative">
              <label className="block font-semibold text-textSecondary uppercase mb-1">Select Supplier / Vendor *</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search vendor by name, code..."
                  value={
                    isFormVendorSearchOpen
                      ? formVendorSearch
                      : formVendorId
                        ? `${vendors.find((v) => v.id.toString() === formVendorId)?.name} (${vendors.find((v) => v.id.toString() === formVendorId)?.vendor_code})`
                        : ''
                  }
                  onFocus={() => {
                    setIsFormVendorSearchOpen(true);
                    setFormVendorSearch('');
                  }}
                  onChange={(e) => {
                    setFormVendorSearch(e.target.value);
                    setIsFormVendorSearchOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsFormVendorSearchOpen(false), 200);
                  }}
                  className="w-full pl-8 pr-7 py-1.5 border border-borderLine rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
                {formVendorId && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormVendorId('');
                      setFormVendorSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                    title="Clear selected vendor"
                  >
                    &times;
                  </button>
                )}
              </div>

              {isFormVendorSearchOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-borderLine rounded-lg shadow-xl divide-y divide-slate-100 min-w-[280px]">
                  {vendors
                    .filter(
                      (v) =>
                        !formVendorSearch.trim() ||
                        v.name.toLowerCase().includes(formVendorSearch.toLowerCase()) ||
                        v.vendor_code.toLowerCase().includes(formVendorSearch.toLowerCase()) ||
                        (v.gstin && v.gstin.toLowerCase().includes(formVendorSearch.toLowerCase()))
                    )
                    .slice(0, 30)
                    .map((v) => {
                      const isAP = v.gstin?.startsWith('37');
                      return (
                        <div
                          key={v.id}
                          onMouseDown={() => {
                            setFormVendorId(v.id.toString());
                            setIsFormVendorSearchOpen(false);
                            setFormVendorSearch('');
                          }}
                          className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                        >
                          <div>
                            <div className="font-bold text-navy-800">{v.name}</div>
                            <div className="text-[10px] text-textSecondary font-mono">
                              Code: <strong>{v.vendor_code}</strong> &bull; GSTIN: {v.gstin || 'Unregistered'}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              isAP ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {isAP ? 'Intra-State AP' : 'Inter-State'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor Invoice / Bill # *</label>
              <input
                type="text"
                required
                placeholder="Supplier's printed invoice number"
                value={formInvNum}
                onChange={(e) => setFormInvNum(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Link Goods Receipt (GRN)</label>
              <select
                value={formGrnId}
                onChange={(e) => setFormGrnId(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
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
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-borderLine">
            <h4 className="font-bold text-navy-800 uppercase mb-2">Financial & GST Tax Amounts (₹)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
              <div className="col-span-2 sm:col-span-2">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1">Subtotal (Excl. Tax)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formSubtotal}
                  onChange={(e) => {
                    const sub = parseFloat(e.target.value) || 0;
                    setFormSubtotal(sub);
                    setFormTotal(sub + formCgst + formSgst + formIgst);
                  }}
                  className="w-full px-2.5 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none tabular-nums text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-blue-700 uppercase text-[10px] mb-1">CGST (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formCgst}
                  onChange={(e) => {
                    const cgst = parseFloat(e.target.value) || 0;
                    setFormCgst(cgst);
                    setFormTotal(formSubtotal + cgst + formSgst + formIgst);
                  }}
                  className="w-full px-2 py-1.5 border border-blue-200 rounded-lg bg-blue-50/40 text-blue-900 tabular-nums text-xs font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block font-semibold text-indigo-700 uppercase text-[10px] mb-1">SGST (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formSgst}
                  onChange={(e) => {
                    const sgst = parseFloat(e.target.value) || 0;
                    setFormSgst(sgst);
                    setFormTotal(formSubtotal + formCgst + sgst + formIgst);
                  }}
                  className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg bg-indigo-50/40 text-indigo-900 tabular-nums text-xs font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block font-semibold text-purple-700 uppercase text-[10px] mb-1">IGST (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formIgst}
                  onChange={(e) => {
                    const igst = parseFloat(e.target.value) || 0;
                    setFormIgst(igst);
                    setFormTotal(formSubtotal + formCgst + formSgst + igst);
                  }}
                  className="w-full px-2 py-1.5 border border-purple-200 rounded-lg bg-purple-50/40 text-purple-900 tabular-nums text-xs font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-textSecondary text-[10px] uppercase font-bold block">Total GST:</span>
                <span className="font-mono font-bold text-navy-800 text-xs">
                  ₹{(formCgst + formSgst + formIgst).toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-textSecondary text-[10px] uppercase font-bold block">Grand Total Invoiced:</span>
                <span className="font-mono font-black text-primary text-sm">
                  ₹{(formSubtotal + formCgst + formSgst + formIgst).toFixed(2)}
                </span>
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
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none text-xs"
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
              <span className="font-mono tabular-nums font-bold">{formatCurrency(selectedInvoice?.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textSecondary">Previously Paid:</span>
              <span className="font-mono tabular-nums text-emerald-700 font-semibold">{formatCurrency(selectedInvoice?.paid_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-rose-600 border-t border-borderLine pt-1">
              <span>Remaining Balance:</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(parseFloat(selectedInvoice?.total_amount || 0) - parseFloat(selectedInvoice?.paid_amount || 0))}
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
                <span className="block mt-0.5 font-medium">Invoice Date: <strong>{formatDate(invoiceDetails.invoice_date)}</strong></span>
                <span className="text-textSecondary block">Payment Due Date: {formatDate(invoiceDetails.due_date)}</span>
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
                  <span className="font-bold font-mono">{formatCurrency(invoiceDetails.subtotal)}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-[10px] text-textSecondary block">GST Output Tax</span>
                  <span className="font-bold font-mono">{formatCurrency(invoiceDetails.tax_amount)}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <span className="text-[10px] text-primary block font-bold">Total Bill Value</span>
                  <span className="font-bold font-mono text-primary">{formatCurrency(invoiceDetails.total_amount)}</span>
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
                          <td className="py-2 px-3 text-textSecondary whitespace-nowrap">{formatDate(p.payment_date)}</td>
                          <td className="py-2 px-3 font-semibold">{p.payment_mode}</td>
                          <td className="py-2 px-3 font-mono text-textSecondary">{p.reference_number || '-'}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                            {formatCurrency(p.amount)}
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

