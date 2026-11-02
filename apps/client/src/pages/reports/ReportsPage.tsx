import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import {
  BarChart3,
  Download,
  CreditCard,
  Package,
  TrendingUp,
  FileSpreadsheet,
  Users,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'outstanding' | 'inventory' | 'sales'>('outstanding');
  const [outstandingData, setOutstandingData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any>({ paymentModeSummary: [], topSellingItems: [] });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Financial & Operational Reports Center</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Audit-ready registers, valuation reports & store ledger reconciliations with Excel/CSV export
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

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveReport('outstanding')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'outstanding'
              ? 'bg-blue-50/60 border-primary shadow-subtle'
              : 'bg-surface border-borderLine hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CreditCard className={`w-4 h-4 ${activeReport === 'outstanding' ? 'text-primary' : 'text-textSecondary'}`} />
            <h3 className="font-bold text-navy-800 text-xs">Employee Outstanding Register</h3>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">Live balances due for monthly payroll deduction</p>
        </button>

        <button
          onClick={() => setActiveReport('inventory')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'inventory'
              ? 'bg-blue-50/60 border-primary shadow-subtle'
              : 'bg-surface border-borderLine hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Package className={`w-4 h-4 ${activeReport === 'inventory' ? 'text-primary' : 'text-textSecondary'}`} />
            <h3 className="font-bold text-navy-800 text-xs">Stock Valuation & Reorder Report</h3>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">Cost vs retail valuation with stock threshold alerts</p>
        </button>

        <button
          onClick={() => setActiveReport('sales')}
          className={`p-4 rounded-cfecc border text-left transition-all ${
            activeReport === 'sales'
              ? 'bg-blue-50/60 border-primary shadow-subtle'
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

      {/* Report Table Content */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        {/* Outstanding Report */}
        {activeReport === 'outstanding' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
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
                      ₹{parseFloat(emp.credit_limit).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700">
                      ₹{parseFloat(emp.current_outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700">
                      ₹{parseFloat(emp.available_credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Inventory Report */}
        {activeReport === 'inventory' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
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
                      ₹{parseFloat(item.purchase_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                      ₹{parseFloat(item.valuation_purchase).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-textSecondary">
                      ₹{parseFloat(item.valuation_retail).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
};

