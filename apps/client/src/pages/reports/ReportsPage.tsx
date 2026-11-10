import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import {
  Download,
  CreditCard,
  Package,
  TrendingUp,
  FileSpreadsheet,
  Truck,
  Receipt,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  PurchaseReportItem,
  VendorPurchaseSummary,
  ItemPurchaseSummary,
  GrnReportItem,
  GstItcReportItem,
} from '../../types/index.js';

const formatCurrency = (val: number | string | undefined | null) => {
  const num = parseFloat((val ?? 0).toString());
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const ReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'purchases';

  const [activeReport, setActiveReport] = useState<'outstanding' | 'inventory' | 'sales' | 'purchases'>(
    initialTab === 'purchases' ? 'purchases' : initialTab
  );

  // Purchase Sub-Report State
  const [purchaseSubReport, setPurchaseSubReport] = useState<
    'register' | 'vendor-summary' | 'item-summary' | 'grn-register' | 'gst-itc'
  >('register');

  // Filter States for Purchase Reports
  const [startDate, setStartDate] = useState<string>('2026-03-01');
  const [endDate, setEndDate] = useState<string>('2026-03-31');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vendorsList, setVendorsList] = useState<any[]>([]);

  const setDatePreset = (preset: 'ALL' | 'MARCH26' | 'MONTH' | 'TODAY') => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'MARCH26') {
      setStartDate('2026-03-01');
      setEndDate('2026-03-31');
    } else if (preset === 'MONTH') {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(today);
    } else if (preset === 'TODAY') {
      setStartDate(today);
      setEndDate(today);
    }
  };

  // Data States
  const [outstandingData, setOutstandingData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any>({ paymentModeSummary: [], topSellingItems: [] });

  // Purchase Reports Data States
  const [purchaseRegisterData, setPurchaseRegisterData] = useState<PurchaseReportItem[]>([]);
  const [purchaseRegisterSummary, setPurchaseRegisterSummary] = useState<any>({});

  const [vendorSummaryData, setVendorSummaryData] = useState<VendorPurchaseSummary[]>([]);
  const [vendorSummaryMeta, setVendorSummaryMeta] = useState<any>({});

  const [itemSummaryData, setItemSummaryData] = useState<ItemPurchaseSummary[]>([]);
  const [itemSummaryMeta, setItemSummaryMeta] = useState<any>({});

  const [grnRegisterData, setGrnRegisterData] = useState<GrnReportItem[]>([]);
  const [grnSummaryMeta, setGrnSummaryMeta] = useState<any>({});

  const [gstItcData, setGstItcData] = useState<GstItcReportItem[]>([]);
  const [gstItcSummary, setGstItcSummary] = useState<any>({});

  const [loading, setLoading] = useState<boolean>(true);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['outstanding', 'inventory', 'sales', 'purchases'].includes(tab)) {
      setActiveReport(tab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [activeReport, purchaseSubReport]);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      if (res.data.success) {
        setVendorsList(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching vendors for filter:', err);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      if (activeReport === 'outstanding') {
        const res = await api.get('/reports/employee-outstanding');
        if (res.data.success) setOutstandingData(res.data.data);
      } else if (activeReport === 'inventory') {
        const res = await api.get('/reports/inventory-valuation');
        if (res.data.success) setInventoryData(res.data.data);
      } else if (activeReport === 'sales') {
        const res = await api.get('/reports/sales-performance');
        if (res.data.success) setSalesData(res.data);
      } else if (activeReport === 'purchases') {
        await fetchActivePurchaseReport();
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePurchaseReport = async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedVendorId && selectedVendorId !== 'ALL') params.append('vendorId', selectedVendorId);
    if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);
    if (searchQuery) params.append('search', searchQuery);

    const qs = params.toString() ? `?${params.toString()}` : '';

    if (purchaseSubReport === 'register') {
      const res = await api.get(`/reports/purchases/register${qs}`);
      if (res.data.success) {
        setPurchaseRegisterData(res.data.data);
        setPurchaseRegisterSummary(res.data.summary);
      }
    } else if (purchaseSubReport === 'vendor-summary') {
      const res = await api.get(`/reports/purchases/vendor-summary${qs}`);
      if (res.data.success) {
        setVendorSummaryData(res.data.data);
        setVendorSummaryMeta(res.data.summary);
      }
    } else if (purchaseSubReport === 'item-summary') {
      const res = await api.get(`/reports/purchases/item-summary${qs}`);
      if (res.data.success) {
        setItemSummaryData(res.data.data);
        setItemSummaryMeta(res.data.summary);
      }
    } else if (purchaseSubReport === 'grn-register') {
      const res = await api.get(`/reports/purchases/grn-register${qs}`);
      if (res.data.success) {
        setGrnRegisterData(res.data.data);
        setGrnSummaryMeta(res.data.summary);
      }
    } else if (purchaseSubReport === 'gst-itc') {
      const res = await api.get(`/reports/purchases/gst-itc${qs}`);
      if (res.data.success) {
        setGstItcData(res.data.data);
        setGstItcSummary(res.data.summary);
      }
    }
  };

  const handleTabChange = (tab: 'outstanding' | 'inventory' | 'sales' | 'purchases') => {
    setActiveReport(tab);
    setSearchParams({ tab });
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `cfecc_report_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeReport === 'outstanding') {
      headers = ['Employee Code', 'Employee Name', 'Department', 'Designation', 'Mobile', 'Credit Limit', 'Current Outstanding', 'Available Credit'];
      rows = outstandingData.map(r => [
        r.employee_code,
        `"${r.first_name} ${r.last_name}"`,
        `"${r.department_name || ''}"`,
        `"${r.designation_title || ''}"`,
        r.mobile,
        r.credit_limit,
        r.current_outstanding,
        r.available_credit,
      ]);
    } else if (activeReport === 'inventory') {
      headers = ['Item Code', 'Item Name', 'Category', 'Current Stock', 'Min Stock', 'Purchase Cost', 'Valuation Purchase', 'Valuation Retail'];
      rows = inventoryData.map(r => [
        r.item_code,
        `"${r.name}"`,
        `"${r.category_name}"`,
        r.current_stock,
        r.min_stock,
        r.purchase_price,
        r.valuation_purchase,
        r.valuation_retail,
      ]);
    } else if (activeReport === 'purchases') {
      filename = `cfecc_purchase_report_${purchaseSubReport}_${new Date().toISOString().split('T')[0]}.csv`;

      if (purchaseSubReport === 'register') {
        headers = ['Bill Ref #', 'Vendor Invoice #', 'Date', 'Vendor Code', 'Vendor Name', 'GSTIN', 'Taxable Subtotal', 'GST', 'Total Invoice', 'Paid Amount', 'Balance Due', 'Status'];
        rows = purchaseRegisterData.map(r => [
          r.system_bill_number,
          r.invoice_number,
          r.invoice_date,
          r.vendor_code,
          `"${r.vendor_name}"`,
          r.vendor_gstin || '',
          r.subtotal,
          r.tax_amount,
          r.total_amount,
          r.paid_amount,
          r.balance_due,
          r.status,
        ]);
      } else if (purchaseSubReport === 'vendor-summary') {
        headers = ['Vendor Code', 'Vendor Name', 'Contact Person', 'Phone', 'GSTIN', 'Total Invoices', 'Total Purchased', 'Total Paid', 'Current Outstanding'];
        rows = vendorSummaryData.map(r => [
          r.vendor_code,
          `"${r.vendor_name}"`,
          `"${r.contact_person || ''}"`,
          r.phone,
          r.gstin || '',
          r.total_invoices,
          r.total_purchased,
          r.total_paid,
          r.current_outstanding,
        ]);
      } else if (purchaseSubReport === 'item-summary') {
        headers = ['Item Code', 'Item Name', 'Category', 'Brand', 'Current Stock', 'Ordered Qty', 'Received Qty', 'Weighted Avg Cost', 'Retail Price', 'Total Spend'];
        rows = itemSummaryData.map(r => [
          r.item_code,
          `"${r.item_name}"`,
          `"${r.category_name || ''}"`,
          `"${r.brand || ''}"`,
          r.current_stock,
          r.total_ordered_qty,
          r.total_received_qty,
          parseFloat(r.weighted_avg_cost as any).toFixed(2),
          r.current_selling_price,
          r.total_purchase_spend,
        ]);
      } else if (purchaseSubReport === 'grn-register') {
        headers = ['GRN #', 'Receipt Date', 'Vendor Code', 'Vendor Name', 'PO #', 'Challan #', 'Vehicle #', 'Total Items', 'Received Qty', 'Accepted Qty', 'Rejected Qty', 'Status'];
        rows = grnRegisterData.map(r => [
          r.grn_number,
          r.receipt_date,
          r.vendor_code,
          `"${r.vendor_name}"`,
          r.po_number || '',
          r.delivery_challan_number || '',
          r.vehicle_number || '',
          r.item_count,
          r.total_received_qty,
          r.total_accepted_qty,
          r.total_rejected_qty,
          r.status,
        ]);
      } else if (purchaseSubReport === 'gst-itc') {
        headers = ['Bill Ref #', 'Vendor Invoice #', 'Date', 'Vendor Name', 'GSTIN', 'Taxable Amount', 'CGST', 'SGST', 'Total GST (ITC)', 'Total Invoice', 'Payment Status'];
        rows = gstItcData.map(r => [
          r.system_bill_number,
          r.invoice_number,
          r.invoice_date,
          `"${r.vendor_name}"`,
          r.vendor_gstin || '',
          r.taxable_amount,
          r.cgst_amount,
          r.sgst_amount,
          r.total_gst,
          r.invoice_total,
          r.payment_status,
        ]);
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Export Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Financial & Operational Reports Center</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Audit-ready registers, inward purchasing & payables, stock valuation, and tax reconciliation with CSV export
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle"
        >
          <Download className="w-3.5 h-3.5 text-primary" />
          <span>Export Current Register (CSV)</span>
        </button>
      </div>

      {/* Primary Report Category Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Purchase Reports Suite */}
        <button
          onClick={() => handleTabChange('purchases')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'purchases'
              ? 'bg-blue-50/70 border-primary shadow-subtle ring-1 ring-primary/20'
              : 'bg-surface border-borderLine hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className={`w-4 h-4 ${activeReport === 'purchases' ? 'text-primary' : 'text-textSecondary'}`} />
            <h3 className="font-bold text-navy-800 text-xs">Purchase & Procurement Suite</h3>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">Inward invoices, vendor payables, GRN logs & GST ITC</p>
        </button>

        {/* 2. Employee Outstanding */}
        <button
          onClick={() => handleTabChange('outstanding')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'outstanding'
              ? 'bg-blue-50/70 border-primary shadow-subtle ring-1 ring-primary/20'
              : 'bg-surface border-borderLine hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CreditCard className={`w-4 h-4 ${activeReport === 'outstanding' ? 'text-primary' : 'text-textSecondary'}`} />
            <h3 className="font-bold text-navy-800 text-xs">Employee Outstanding Register</h3>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">Live balances due for monthly payroll deduction</p>
        </button>

        {/* 3. Inventory Valuation */}
        <button
          onClick={() => handleTabChange('inventory')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'inventory'
              ? 'bg-blue-50/70 border-primary shadow-subtle ring-1 ring-primary/20'
              : 'bg-surface border-borderLine hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Package className={`w-4 h-4 ${activeReport === 'inventory' ? 'text-primary' : 'text-textSecondary'}`} />
            <h3 className="font-bold text-navy-800 text-xs">Stock Valuation & Reorder</h3>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">Cost vs retail valuation with stock threshold alerts</p>
        </button>

        {/* 4. Sales Tender Performance */}
        <button
          onClick={() => handleTabChange('sales')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'sales'
              ? 'bg-blue-50/70 border-primary shadow-subtle ring-1 ring-primary/20'
              : 'bg-surface border-borderLine hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <TrendingUp className={`w-4 h-4 ${activeReport === 'sales' ? 'text-primary' : 'text-textSecondary'}`} />
            <h3 className="font-bold text-navy-800 text-xs">Sales Tender Performance</h3>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">Breakdown by cash, UPI, credit & top moving items</p>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: PURCHASE & PROCUREMENT ALL REPORTS                               */}
      {/* ========================================================================= */}
      {activeReport === 'purchases' && (
        <div className="space-y-4">
          {/* Sub-Report Navigation Pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-borderLine pb-2">
            <button
              onClick={() => setPurchaseSubReport('register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                purchaseSubReport === 'register'
                  ? 'bg-navy-800 text-white shadow-xs'
                  : 'bg-surface text-textSecondary border border-borderLine hover:text-navy-800 hover:bg-slate-50'
              }`}
            >
              1. Inward Purchase Register
            </button>
            <button
              onClick={() => setPurchaseSubReport('vendor-summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                purchaseSubReport === 'vendor-summary'
                  ? 'bg-navy-800 text-white shadow-xs'
                  : 'bg-surface text-textSecondary border border-borderLine hover:text-navy-800 hover:bg-slate-50'
              }`}
            >
              2. Vendor Payables Summary
            </button>
            <button
              onClick={() => setPurchaseSubReport('item-summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                purchaseSubReport === 'item-summary'
                  ? 'bg-navy-800 text-white shadow-xs'
                  : 'bg-surface text-textSecondary border border-borderLine hover:text-navy-800 hover:bg-slate-50'
              }`}
            >
              3. Item Procurement & Cost Analysis
            </button>
            <button
              onClick={() => setPurchaseSubReport('grn-register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                purchaseSubReport === 'grn-register'
                  ? 'bg-navy-800 text-white shadow-xs'
                  : 'bg-surface text-textSecondary border border-borderLine hover:text-navy-800 hover:bg-slate-50'
              }`}
            >
              4. GRN Receiving Audit Log
            </button>
            <button
              onClick={() => setPurchaseSubReport('gst-itc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                purchaseSubReport === 'gst-itc'
                  ? 'bg-navy-800 text-white shadow-xs'
                  : 'bg-surface text-textSecondary border border-borderLine hover:text-navy-800 hover:bg-slate-50'
              }`}
            >
              5. GST Input Tax Credit (ITC - GSTR-2B)
            </button>
          </div>

          {/* Filtering Bar */}
          <div className="bg-surface p-3.5 rounded-cfecc border border-borderLine shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-1.5">
                <span className="text-textSecondary font-semibold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-borderLine rounded-md font-mono"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-textSecondary font-semibold">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-borderLine rounded-md font-mono"
                />
              </div>

              {/* Date Quick Presets */}
              <div className="flex items-center space-x-1 border-r border-borderLine pr-2">
                <button
                  type="button"
                  onClick={() => setDatePreset('MARCH26')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    startDate === '2026-03-01' && endDate === '2026-03-31'
                      ? 'bg-navy-800 text-white'
                      : 'bg-slate-100 text-textSecondary hover:bg-slate-200'
                  }`}
                >
                  March 2026
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('MONTH')}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-textSecondary hover:bg-slate-200 transition-colors"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('ALL')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    !startDate && !endDate
                      ? 'bg-navy-800 text-white'
                      : 'bg-slate-100 text-textSecondary hover:bg-slate-200'
                  }`}
                >
                  All Dates
                </button>
              </div>

              {purchaseSubReport === 'register' && (
                <>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-textSecondary font-semibold">Vendor:</span>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value)}
                      className="px-2.5 py-1 bg-slate-50 border border-borderLine rounded-md font-medium"
                    >
                      <option value="ALL">All Vendors</option>
                      {vendorsList.map((v) => (
                        <option key={v.id} value={v.id.toString()}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-textSecondary font-semibold">Status:</span>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-2.5 py-1 bg-slate-50 border border-borderLine rounded-md font-medium"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="PARTIALLY_PAID">Partially Paid</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={fetchActivePurchaseReport}
                className="flex items-center space-x-1 px-3 py-1 rounded-md bg-navy-800 text-white font-semibold hover:bg-navy-900 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Apply Filter</span>
              </button>
            </div>

            {purchaseSubReport === 'register' && (
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search invoice #, vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchActivePurchaseReport()}
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-borderLine rounded-md focus:bg-white"
                />
              </div>
            )}
          </div>

          {/* Sub-Report 1: Inward Purchase Invoices Register */}
          {purchaseSubReport === 'register' && (
            <div className="space-y-4">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
                  <span className="text-xs text-textSecondary font-semibold">Total Inward Invoices</span>
                  <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                    {purchaseRegisterSummary.invoiceCount || 0} Bills
                  </div>
                  <span className="text-[11px] text-textSecondary">Recorded in period</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
                  <span className="text-xs text-textSecondary font-semibold">Gross Purchase Value</span>
                  <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                    {formatCurrency(purchaseRegisterSummary.totalInvoiced)}
                  </div>
                  <span className="text-[11px] text-textSecondary">
                    Includes GST {formatCurrency(purchaseRegisterSummary.totalTax)}
                  </span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-emerald-200 bg-emerald-50/20 shadow-subtle">
                  <span className="text-xs text-emerald-800 font-semibold">Total Vendor Disbursements</span>
                  <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatCurrency(purchaseRegisterSummary.totalPaid)}
                  </div>
                  <span className="text-[11px] text-emerald-800/80">Cleared via Bank / Cheque</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-amber-200 bg-amber-50/20 shadow-subtle">
                  <span className="text-xs text-amber-800 font-semibold">Total Payables Outstanding</span>
                  <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">
                    {formatCurrency(purchaseRegisterSummary.totalOutstanding)}
                  </div>
                  <span className="text-[11px] text-amber-800/80">Balance due to suppliers</span>
                </div>
              </div>

              {/* Inward Invoices Table */}
              <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                      <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4">Bill Ref / Inv #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Vendor Details</th>
                        <th className="py-3 px-4 text-right">Taxable Subtotal (₹)</th>
                        <th className="py-3 px-4 text-right">GST (₹)</th>
                        <th className="py-3 px-4 text-right font-bold text-navy-800">Total Value (₹)</th>
                        <th className="py-3 px-4 text-right text-emerald-700">Paid (₹)</th>
                        <th className="py-3 px-4 text-right font-bold text-amber-700">Balance Due (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {loading ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-textSecondary">
                            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <div>Loading purchase register...</div>
                          </td>
                        </tr>
                      ) : purchaseRegisterData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-textSecondary">
                            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <div>No purchase invoices found matching the selected filters.</div>
                          </td>
                        </tr>
                      ) : (
                        purchaseRegisterData.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-navy-800 font-mono">{inv.system_bill_number}</div>
                              <div className="text-[11px] text-textSecondary">Vendor Inv: {inv.invoice_number}</div>
                            </td>
                            <td className="py-3 px-4 text-textSecondary whitespace-nowrap">
                              {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-navy-800">{inv.vendor_name}</div>
                              <div className="text-[11px] text-textSecondary font-mono">{inv.vendor_code} &bull; GSTIN: {inv.vendor_gstin || 'Unregistered'}</div>
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-textSecondary font-medium">
                              {formatCurrency(inv.subtotal)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                              {formatCurrency(inv.tax_amount)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                              {formatCurrency(inv.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">
                              {formatCurrency(inv.paid_amount)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700">
                              {formatCurrency(inv.balance_due)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <StatusBadge status={inv.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Standard Floating Summary Footer */}
                <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                  <div>
                    Showing <span className="font-bold text-navy-800 font-mono">{purchaseRegisterData.length}</span> inward purchase bills
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span>Total Value: <strong className="text-navy-800 font-mono">{formatCurrency(purchaseRegisterSummary.totalInvoiced)}</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Disbursed: <strong className="text-emerald-700 font-mono">{formatCurrency(purchaseRegisterSummary.totalPaid)}</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Outstanding: <strong className="text-amber-700 font-mono">{formatCurrency(purchaseRegisterSummary.totalOutstanding)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Report 2: Vendor-wise Payables Summary */}
          {purchaseSubReport === 'vendor-summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
                  <span className="text-xs text-textSecondary font-semibold">Active Trade Creditors</span>
                  <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                    {vendorSummaryMeta.vendorCount || 0} Vendors
                  </div>
                  <span className="text-[11px] text-textSecondary">Suppliers with procurement history</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
                  <span className="text-xs text-textSecondary font-semibold">Cumulative Procurement Volume</span>
                  <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                    ₹{parseFloat(vendorSummaryMeta.totalPurchased || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-textSecondary">Total value of goods supplied</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-amber-200 bg-amber-50/20 shadow-subtle">
                  <span className="text-xs text-amber-800 font-semibold">Total Accounts Payable Liability</span>
                  <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">
                    ₹{parseFloat(vendorSummaryMeta.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-amber-800/80">Pending vendor balance</span>
                </div>
              </div>

              <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                      <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4">Vendor Code & Name</th>
                        <th className="py-3 px-4">Contact & Phone</th>
                        <th className="py-3 px-4">GSTIN & Terms</th>
                        <th className="py-3 px-4 text-center">Invoices</th>
                        <th className="py-3 px-4 text-right font-bold text-navy-800">Total Supplied (₹)</th>
                        <th className="py-3 px-4 text-right text-emerald-700">Total Settled (₹)</th>
                        <th className="py-3 px-4 text-right font-bold text-amber-700">Outstanding Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-textSecondary">
                            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <div>Loading vendor summaries...</div>
                          </td>
                        </tr>
                      ) : vendorSummaryData.map((v) => (
                        <tr key={v.vendor_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-navy-800">{v.vendor_name}</div>
                            <div className="text-[11px] text-textSecondary font-mono">{v.vendor_code}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-textPrimary font-medium">{v.contact_person || 'N/A'}</div>
                            <div className="text-[11px] text-textSecondary font-mono">{v.phone}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-textPrimary text-[11px]">{v.gstin || 'Unregistered'}</div>
                            <div className="text-[11px] text-textSecondary">{v.payment_terms_days} Days Credit</div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {v.total_invoices}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                            {formatCurrency(v.total_purchased)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">
                            {formatCurrency(v.total_paid)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700">
                            {formatCurrency(v.current_outstanding)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Standard Floating Summary Footer */}
                <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                  <div>
                    Showing <span className="font-bold text-navy-800 font-mono">{vendorSummaryData.length}</span> trade vendors & suppliers
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span>Total Inward: <strong className="text-navy-800 font-mono">{formatCurrency(vendorSummaryData.reduce((s, v) => s + parseFloat((v.total_purchased as any) || 0), 0))}</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Disbursed: <strong className="text-emerald-700 font-mono">{formatCurrency(vendorSummaryData.reduce((s, v) => s + parseFloat((v.total_paid as any) || 0), 0))}</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Payables Due: <strong className="text-amber-700 font-mono">{formatCurrency(vendorSummaryData.reduce((s, v) => s + parseFloat((v.current_outstanding as any) || 0), 0))}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Report 3: Item-wise Purchase & Rate Analysis */}
          {purchaseSubReport === 'item-summary' && (
            <div className="space-y-4">
              <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
                <div className="p-4 border-b border-borderLine flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-navy-800">Item Procurement Spend & Price Variance</h3>
                    <p className="text-[11px] text-textSecondary mt-0.5">
                      Weighted average purchase costs vs. current retail price and total volume purchased
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-textSecondary">
                    Total Spend: <span className="text-navy-800 font-bold tabular-nums">₹{parseFloat(itemSummaryMeta.totalSpend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                      <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4">Item Details</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">In-Stock Qty</th>
                        <th className="py-3 px-4 text-right">Ordered Qty</th>
                        <th className="py-3 px-4 text-right">Received Qty</th>
                        <th className="py-3 px-4 text-right font-bold text-navy-800">Weighted Avg Cost (₹)</th>
                        <th className="py-3 px-4 text-right text-textSecondary">Current Retail (₹)</th>
                        <th className="py-3 px-4 text-right font-bold text-primary">Total Spend (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-textSecondary">
                            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <div>Loading item procurement report...</div>
                          </td>
                        </tr>
                      ) : itemSummaryData.map((item) => (
                        <tr key={item.item_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-navy-800">{item.item_name}</div>
                            <div className="text-[11px] text-textSecondary font-mono">{item.item_code} &bull; {item.brand || 'CFECC'}</div>
                          </td>
                          <td className="py-3 px-4 text-textPrimary font-medium">
                            {item.category_name}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                            {parseFloat(item.current_stock as any).toFixed(0)} {item.unit_code}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                            {parseFloat(item.total_ordered_qty as any).toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-700">
                            {parseFloat(item.total_received_qty as any).toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                            {formatCurrency(item.weighted_avg_cost)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-textSecondary font-medium">
                            {formatCurrency(item.current_selling_price)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-primary">
                            {formatCurrency(item.total_purchase_spend)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Standard Floating Summary Footer */}
                <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                  <div>
                    Showing <span className="font-bold text-navy-800 font-mono">{itemSummaryData.length}</span> procurement item commodities
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span>Total Received: <strong className="text-navy-800 font-mono">{itemSummaryData.reduce((s, i) => s + parseFloat((i.total_received_qty as any) || 0), 0)} Units</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Total Spend: <strong className="text-primary font-mono">{formatCurrency(itemSummaryData.reduce((s, i) => s + parseFloat((i.total_purchase_spend as any) || 0), 0))}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Report 4: Goods Receipt Notes (GRN) Inward Register */}
          {purchaseSubReport === 'grn-register' && (
            <div className="space-y-4">
              <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
                <div className="p-4 border-b border-borderLine flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-navy-800">Goods Receipt Note (GRN) Inward Receiving Audit</h3>
                    <p className="text-[11px] text-textSecondary mt-0.5">
                      Physical warehouse receipts, delivery challan verification, and accepted vs. rejected quantities
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-textSecondary">
                    Total GRNs: <span className="text-navy-800 font-bold">{grnSummaryMeta.grnCount || 0}</span>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                      <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4">GRN #</th>
                        <th className="py-3 px-4">Receipt Date</th>
                        <th className="py-3 px-4">Vendor & PO Ref</th>
                        <th className="py-3 px-4">Delivery Challan & Vehicle</th>
                        <th className="py-3 px-4 text-center">Items</th>
                        <th className="py-3 px-4 text-right font-semibold text-textSecondary">Received Qty</th>
                        <th className="py-3 px-4 text-right font-bold text-emerald-700">Accepted Qty</th>
                        <th className="py-3 px-4 text-right font-bold text-rose-600">Rejected Qty</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {loading ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-textSecondary">
                            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <div>Loading GRN audit register...</div>
                          </td>
                        </tr>
                      ) : grnRegisterData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-textSecondary">
                            <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <div>No GRN receipts found for the selected period.</div>
                          </td>
                        </tr>
                      ) : grnRegisterData.map((grn) => (
                        <tr key={grn.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold font-mono text-navy-800">
                            {grn.grn_number}
                          </td>
                          <td className="py-3 px-4 text-textSecondary whitespace-nowrap">
                            {new Date(grn.receipt_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-navy-800">{grn.vendor_name}</div>
                            <div className="text-[11px] text-textSecondary font-mono">{grn.po_number ? `PO: ${grn.po_number}` : 'Direct Receipt'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-textPrimary text-[11px]">{grn.delivery_challan_number || 'No Challan #'}</div>
                            <div className="text-[11px] text-textSecondary">{grn.vehicle_number || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {grn.item_count}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                            {parseFloat(grn.total_received_qty as any).toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700">
                            {parseFloat(grn.total_accepted_qty as any).toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-rose-600">
                            {parseFloat(grn.total_rejected_qty as any).toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={grn.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Standard Floating Summary Footer */}
                <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                  <div>
                    Showing <span className="font-bold text-navy-800 font-mono">{grnRegisterData.length}</span> Goods Receipt Notes
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span>Total Accepted: <strong className="text-emerald-700 font-mono">{grnRegisterData.reduce((s, g) => s + parseFloat((g.total_accepted_qty as any) || 0), 0)} Units</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Total Rejected: <strong className="text-rose-600 font-mono">{grnRegisterData.reduce((s, g) => s + parseFloat((g.total_rejected_qty as any) || 0), 0)} Units</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Report 5: GST Input Tax Credit (ITC - GSTR-2B) Reconciliation */}
          {purchaseSubReport === 'gst-itc' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
                  <span className="text-xs text-textSecondary font-semibold">Taxable Inward Purchases</span>
                  <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                    ₹{parseFloat(gstItcSummary.totalTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-textSecondary">Net base procurement value</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-blue-200 bg-blue-50/20 shadow-subtle">
                  <span className="text-xs text-blue-800 font-semibold">CGST Input Tax Credit (50%)</span>
                  <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">
                    ₹{parseFloat(gstItcSummary.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-blue-800/80">Central GST claimable</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-blue-200 bg-blue-50/20 shadow-subtle">
                  <span className="text-xs text-blue-800 font-semibold">SGST Input Tax Credit (50%)</span>
                  <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">
                    ₹{parseFloat(gstItcSummary.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-blue-800/80">State GST claimable (AP)</span>
                </div>

                <div className="bg-surface p-4 rounded-cfecc border border-emerald-200 bg-emerald-50/20 shadow-subtle">
                  <span className="text-xs text-emerald-800 font-semibold">Total Claimable ITC (GST)</span>
                  <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                    ₹{parseFloat(gstItcSummary.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-emerald-800/80">Available against output tax</span>
                </div>
              </div>

              <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
                <div className="p-4 border-b border-borderLine">
                  <h3 className="text-sm font-bold text-navy-800">GST Input Tax Credit (ITC - GSTR-2B) Register</h3>
                  <p className="text-[11px] text-textSecondary mt-0.5">
                    Official tax audit reconciliation matching supplier GSTINs, invoice numbers, and inward tax credits
                  </p>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                      <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4">Supplier GSTIN</th>
                        <th className="py-3 px-4">Supplier Name</th>
                        <th className="py-3 px-4">Invoice # & Date</th>
                        <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
                        <th className="py-3 px-4 text-right">CGST (₹)</th>
                        <th className="py-3 px-4 text-right">SGST (₹)</th>
                        <th className="py-3 px-4 text-right font-bold text-emerald-700">Total ITC (₹)</th>
                        <th className="py-3 px-4 text-right font-bold text-navy-800">Invoice Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-textSecondary">
                            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <div>Loading GST ITC reconciliation...</div>
                          </td>
                        </tr>
                      ) : gstItcData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-textSecondary">
                            <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <div>No GST taxable purchase invoices recorded in this period.</div>
                          </td>
                        </tr>
                      ) : gstItcData.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-navy-800">
                            {row.vendor_gstin || '37AAAAA1234A1Z1'}
                          </td>
                          <td className="py-3 px-4 font-medium text-textPrimary">
                            {row.vendor_name}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-navy-800 font-bold">{row.invoice_number}</div>
                            <div className="text-[11px] text-textSecondary">
                              {new Date(row.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium text-textSecondary">
                            {formatCurrency(row.taxable_amount)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-blue-700 font-mono">
                            {formatCurrency(row.cgst_amount)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-blue-700 font-mono">
                            {formatCurrency(row.sgst_amount)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700">
                            {formatCurrency(row.total_gst)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                            {formatCurrency(row.invoice_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Standard Floating Summary Footer */}
                <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                  <div>
                    Showing <span className="font-bold text-navy-800 font-mono">{gstItcData.length}</span> tax audit records
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span>Taxable Purchases: <strong className="text-navy-800 font-mono">{formatCurrency(gstItcSummary.totalTaxable)}</strong></span>
                    <span className="text-slate-400">&bull;</span>
                    <span>Total Claimable ITC: <strong className="text-emerald-700 font-mono">{formatCurrency(gstItcSummary.totalGst)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION: OTHER REPORTS (OUTSTANDING, INVENTORY, SALES)                    */}
      {/* ========================================================================= */}
      {activeReport !== 'purchases' && (
        <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
          {/* Outstanding Report */}
          {activeReport === 'outstanding' && (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                  <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department & Designation</th>
                    <th className="py-3 px-4">Mobile</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4 text-right font-bold text-amber-700">Outstanding Balance (₹)</th>
                    <th className="py-3 px-4 text-right text-emerald-700">Remaining Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {outstandingData.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{emp.first_name} {emp.last_name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">{emp.employee_code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-textPrimary">{emp.department_name}</div>
                        <div className="text-[11px] text-textSecondary">{emp.designation_title}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">{emp.mobile}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-textSecondary font-medium">
                        {formatCurrency(emp.credit_limit)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700">
                        {formatCurrency(emp.current_outstanding)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700">
                        {formatCurrency(emp.available_credit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Standard Floating Summary Footer */}
              <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                <div>
                  Showing <span className="font-bold text-navy-800 font-mono">{outstandingData.length}</span> staff members with outstanding store balances
                </div>
                <div className="flex items-center space-x-3 text-[11px]">
                  <span>Total Due: <strong className="text-amber-700 font-mono">{formatCurrency(outstandingData.reduce((s, r) => s + parseFloat(r.current_outstanding || 0), 0))}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Report */}
          {activeReport === 'inventory' && (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                  <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-4">Commodity Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">In-Stock Qty</th>
                    <th className="py-3 px-4 text-right">Unit Purchase Cost</th>
                    <th className="py-3 px-4 text-right font-bold text-navy-800">Total Purchase Valuation</th>
                    <th className="py-3 px-4 text-right">Retail Potential</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {inventoryData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{item.name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">{item.item_code}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-textPrimary">{item.category_name}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                        {parseFloat(item.current_stock)} {item.unit_code}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                        {formatCurrency(item.purchase_price)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                        {formatCurrency(item.valuation_purchase)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-textSecondary">
                        {formatCurrency(item.valuation_retail)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Standard Floating Summary Footer */}
              <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
                <div>
                  Showing <span className="font-bold text-navy-800 font-mono">{inventoryData.length}</span> warehouse commodity items
                </div>
                <div className="flex items-center space-x-3 text-[11px]">
                  <span>Purchase Valuation: <strong className="text-navy-800 font-mono">{formatCurrency(inventoryData.reduce((s, item) => s + parseFloat((item.valuation_purchase as any) || 0), 0))}</strong></span>
                  <span className="text-slate-400">&bull;</span>
                  <span>Retail Potential: <strong className="text-emerald-700 font-mono">{formatCurrency(inventoryData.reduce((s, item) => s + parseFloat((item.valuation_retail as any) || 0), 0))}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Sales Tender Report */}
          {activeReport === 'sales' && (
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3">
                  Sales Volume by Payment Tender
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(salesData.paymentModeSummary || []).map((m: any) => (
                    <div key={m.payment_mode} className="p-4 rounded-lg bg-slate-50 border border-borderLine">
                      <div className="text-xs text-textSecondary font-semibold uppercase">{m.payment_mode.replace('_', ' ')}</div>
                      <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                        ₹{parseFloat(m.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-textSecondary mt-0.5">{m.invoice_count} transactions logged</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3">
                  Top Moving Fast-Seller Commodities
                </h4>
                <div className="divide-y divide-borderLine">
                  {(salesData.topSellingItems || []).map((itm: any, idx: number) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="w-5 font-bold text-textSecondary">#{idx + 1}</span>
                        <div>
                          <span className="font-semibold text-navy-800">{itm.item_name}</span>
                          <span className="text-[11px] text-textSecondary font-mono ml-2">{itm.item_code}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-navy-800 tabular-nums">₹{parseFloat(itm.total_revenue).toFixed(2)}</span>
                        <span className="text-[11px] text-textSecondary block">({parseFloat(itm.total_quantity_sold)} units sold)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
