import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { FileSpreadsheet, Download, Calendar, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';

export const Gstr3bSlabReport: React.FC = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('102026');
  const [slabs, setSlabs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSlabData();
  }, [selectedMonth]);

  const fetchSlabData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/gst-slab-summary?monthCode=${selectedMonth}`);
      if (res.data.success) {
        setMonths(res.data.months || []);
        if (!selectedMonth && res.data.selectedMonth) {
          setSelectedMonth(res.data.selectedMonth);
        }
        setSlabs(res.data.slabs || []);
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      console.error('Error fetching GSTR-3B slab summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (slabs.length === 0) return;
    const headers = [
      'GST Rate Bracket',
      'Tax Rate (%)',
      'Inward / Purchase Taxable Value (Rs)',
      'Eligible Input Tax Credit (Rs)',
      'Outward / Sales Taxable Value (Rs)',
      'Output Tax Liability (Rs)',
      'Net Tax Balance (Rs)',
    ];

    const lines = [headers.join(',')];
    for (const s of slabs) {
      const netTax = s.salesTax - s.purchaseTax;
      lines.push(
        [
          `"${s.rate}"`,
          s.taxRate,
          s.purchaseTaxable.toFixed(2),
          s.purchaseTax.toFixed(2),
          s.salesTaxable.toFixed(2),
          s.salesTax.toFixed(2),
          netTax.toFixed(2),
        ].join(',')
      );
    }

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CFECC_GSTR3B_Slab_Summary_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatMonthLabel = (m: string) => {
    if (m.length === 6) {
      const monthNum = parseInt(m.slice(0, 2), 10);
      const year = m.slice(2);
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return `${monthNames[monthNum - 1] || 'Month ' + monthNum} ${year} (${m})`;
    }
    return m;
  };

  return (
    <div className="space-y-4">
      {/* Month Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-borderLine">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-navy-800 whitespace-nowrap">Tax Return Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1 text-xs font-bold text-navy-800 bg-white border border-borderLine rounded-md focus:outline-none"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-textSecondary hidden md:inline">
            Monthly slab-wise tax breakdown compiled from historical VAT/GST returns (VAT.DBF)
          </span>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-navy-800 text-xs font-semibold rounded-lg border border-borderLine transition whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-textSecondary" />
          <span>Export GSTR-3B CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Total Inward (Purchases)</span>
          <span className="text-xl font-bold text-navy-800 mt-1 block">
            ₹{(summary.totalPurchaseTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Taxable supply value</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Eligible Input Tax Credit (ITC)</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">
            ₹{(summary.totalPurchaseTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Total GST paid to vendors</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Total Outward (Sales)</span>
          <span className="text-xl font-bold text-primary mt-1 block">
            ₹{(summary.totalSalesTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Consumer store sales</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Output Tax Liability</span>
          <span className="text-xl font-bold text-amber-700 mt-1 block">
            ₹{(summary.totalSalesTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">
            {summary.netPayable > 0 ? `Net Tax Payable: ₹${summary.netPayable.toFixed(2)}` : `ITC Surplus: ₹${(summary.netItcCarryForward || 0).toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-borderLine shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-textSecondary">Loading GSTR-3B tax return summary...</div>
        ) : slabs.length === 0 ? (
          <div className="p-8 text-center text-xs text-textSecondary">No tax return records found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-textSecondary uppercase border-b border-borderLine tracking-wider">
                  <th className="px-4 py-3">GST Rate Bracket & Category</th>
                  <th className="px-4 py-3 text-right">Inward Taxable (Purchases)</th>
                  <th className="px-4 py-3 text-right">Input Tax Credit (ITC)</th>
                  <th className="px-4 py-3 text-right">Outward Taxable (Sales)</th>
                  <th className="px-4 py-3 text-right">Output Tax Collected</th>
                  <th className="px-4 py-3 text-right font-extrabold text-navy-800">Net Tax Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {slabs.map((s, idx) => {
                  const net = s.salesTax - s.purchaseTax;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-semibold text-navy-800 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span>{s.rate}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-textSecondary">
                        ₹{s.purchaseTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700 font-medium">
                        ₹{s.purchaseTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-textSecondary">
                        ₹{s.salesTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-700 font-medium">
                        ₹{s.salesTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {net > 0 ? (
                          <span className="text-rose-600">Payable ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        ) : net < 0 ? (
                          <span className="text-emerald-700">ITC Credit ₹{(-net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-textSecondary">₹0.00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-borderLine font-bold text-navy-800">
                <tr>
                  <td className="px-4 py-3">Total Consolidated Supply & Tax</td>
                  <td className="px-4 py-3 text-right font-mono">
                    ₹{(summary.totalPurchaseTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">
                    ₹{(summary.totalPurchaseTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    ₹{(summary.totalSalesTaxable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700">
                    ₹{(summary.totalSalesTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-navy-900 text-sm">
                    {summary.netPayable > 0
                      ? `Net Payable ₹${summary.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      : `Net ITC Carry Forward ₹${(summary.netItcCarryForward || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

