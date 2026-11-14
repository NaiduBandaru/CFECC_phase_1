import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Search, Download, Calendar, Users, Landmark, CreditCard, RotateCcw } from 'lucide-react';

export const HistoricalRecoveryArchive: React.FC = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('102026');
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  useEffect(() => {
    fetchArchiveData();
  }, [selectedMonth, page]);

  const fetchArchiveData = async (query = search, targetPage = page) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/payroll/historical-archive?monthCode=${selectedMonth}&search=${encodeURIComponent(query)}&page=${targetPage}&limit=50`
      );
      if (res.data.success) {
        setMonths(res.data.months || []);
        if (!selectedMonth && res.data.selectedMonth) {
          setSelectedMonth(res.data.selectedMonth);
        }
        setRecords(res.data.records || []);
        setSummary(res.data.summary || {});
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching historical recovery archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchArchiveData(search, 1);
  };

  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = [
      'Emp No',
      'CS No',
      'Member Name',
      'Category',
      'Bills Amt (Rs)',
      'Domestic (Rs)',
      'Old Dome (Rs)',
      'Festival (Rs)',
      'Misc Ded (Rs)',
      'Unrecovered (Rs)',
      'Bank Paid (Rs)',
      'Add Shares (Rs)',
      'Thrift (Rs)',
      'Coupons (Rs)',
      'Total Deduction (Rs)',
    ];

    const lines = [headers.join(',')];
    for (const r of records) {
      lines.push(
        [
          `"${r.eno}"`,
          `"${r.csno}"`,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.category}"`,
          r.billamt.toFixed(2),
          r.domestic.toFixed(2),
          r.olddome.toFixed(2),
          r.fest.toFixed(2),
          r.miscded.toFixed(2),
          r.unrec.toFixed(2),
          r.recpay.toFixed(2),
          r.addshare.toFixed(2),
          r.thrift.toFixed(2),
          r.coupamt.toFixed(2),
          r.deduction.toFixed(2),
        ].join(',')
      );
    }

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CFECC_Historical_Recovery_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatMonthLabel = (m: string) => {
    if (m.length === 6) {
      const monthNum = parseInt(m.slice(0, 2), 10);
      const year = m.slice(2);
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return `${monthNames[monthNum - 1] || 'Month ' + monthNum} ${year} (${m})`;
    }
    return m;
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards for Selected Month */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Total Deductions</span>
          <span className="text-xl font-bold text-navy-800 mt-1 block">
            ₹{(summary.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">{summary.totalMembers || 0} Member Accounts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Store Purchases Billed</span>
          <span className="text-xl font-bold text-primary mt-1 block">
            ₹{(summary.totalBills || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Store credit recovery</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Domestic Advances</span>
          <span className="text-xl font-bold text-amber-700 mt-1 block">
            ₹{(summary.totalDomestic || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Loan installment deductions</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider block">Thrift & Savings</span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">
            ₹{(summary.totalThrift || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Monthly co-op thrift deposits</span>
        </div>
      </div>

      {/* Filter and Month Selection Bar */}
      <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-borderLine">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-navy-800 whitespace-nowrap">Month Archive:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 text-xs font-bold text-navy-800 bg-white border border-borderLine rounded-md focus:outline-none"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-textSecondary" />
            <input
              type="text"
              placeholder="Search CS No, Emp No, Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </form>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-navy-800 text-xs font-semibold rounded-lg border border-borderLine transition"
        >
          <Download className="w-3.5 h-3.5 text-textSecondary" />
          <span>Export Archive CSV</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-borderLine shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-textSecondary">Loading historical recovery records...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-textSecondary">No records found for the selected period and query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-textSecondary uppercase border-b border-borderLine tracking-wider">
                  <th className="px-3 py-2.5">Member Code</th>
                  <th className="px-3 py-2.5">CS #</th>
                  <th className="px-3 py-2.5">Member Name</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Bills Amt</th>
                  <th className="px-3 py-2.5 text-right">Domestic</th>
                  <th className="px-3 py-2.5 text-right">Festival</th>
                  <th className="px-3 py-2.5 text-right">Thrift</th>
                  <th className="px-3 py-2.5 text-right">Add Shares</th>
                  <th className="px-3 py-2.5 text-right">Misc Ded</th>
                  <th className="px-3 py-2.5 text-right">Unrec</th>
                  <th className="px-3 py-2.5 text-right">Bank Paid</th>
                  <th className="px-3 py-2.5 text-right">Coupons</th>
                  <th className="px-3 py-2.5 text-right font-extrabold text-navy-800">Total Deduction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {records.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2 font-mono font-bold text-primary">{r.eno}</td>
                    <td className="px-3 py-2 font-mono font-medium text-textSecondary">CS #{r.csno}</td>
                    <td className="px-3 py-2 font-medium text-navy-800">{r.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          r.category === 'STAFF'
                            ? 'bg-purple-100 text-purple-800'
                            : r.category === 'SPECIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {r.grade}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-navy-800">₹{r.billamt.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-textSecondary">
                      {r.domestic + r.olddome > 0 ? `₹${(r.domestic + r.olddome).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-textSecondary">
                      {r.fest > 0 ? `₹${r.fest.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {r.thrift > 0 ? `₹${r.thrift.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-textSecondary">
                      {r.addshare > 0 ? `₹${r.addshare.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-textSecondary">
                      {r.miscded > 0 ? `₹${r.miscded.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-rose-600">
                      {r.unrec > 0 ? `₹${r.unrec.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600">
                      {r.recpay > 0 ? `₹${r.recpay.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-600">
                      {r.coupamt > 0 ? `₹${r.coupamt.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-navy-800 bg-slate-50/50">
                      ₹{r.deduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-3 border-t border-borderLine bg-slate-50/60 flex items-center justify-between text-xs text-textSecondary">
          <span>
            Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} records
          </span>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white border border-borderLine rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="font-bold text-navy-800">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-white border border-borderLine rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

