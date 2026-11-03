import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Banknote,
  Plus,
  Play,
  CheckCircle,
  FileText,
  Printer,
  ShieldCheck,
  Receipt,
  Download,
  Search,
  MessageSquare,
} from 'lucide-react';
import { PayrollPeriod, PayrollEntry, RecoveryRecord } from '../../types/index.js';

interface PayrollPageProps {
  initialTab?: 'PAYROLL' | 'RECOVERY';
}

export const PayrollPage: React.FC<PayrollPageProps> = ({ initialTab = 'PAYROLL' }) => {
  const [activeTab, setActiveTab] = useState<'PAYROLL' | 'RECOVERY'>(initialTab);

  // Payroll Period State
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [billingPeriods, setBillingPeriods] = useState<any[]>([]);
  const [selectedBillingPeriodId, setSelectedBillingPeriodId] = useState<string>('');
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDisbursing, setIsDisbursing] = useState<boolean>(false);

  // New Cycle Modal State
  const [isNewCycleModalOpen, setIsNewCycleModalOpen] = useState<boolean>(false);
  const [newPeriodCode, setNewPeriodCode] = useState<string>('PAY-2026-04');
  const [newMonthYear, setNewMonthYear] = useState<string>('2026-04');
  const [newStartDate, setNewStartDate] = useState<string>('2026-04-01');
  const [newEndDate, setNewEndDate] = useState<string>('2026-04-30');
  const [newPayoutDate, setNewPayoutDate] = useState<string>('2026-05-01');

  // Recovery Records State
  const [recoveryRecords, setRecoveryRecords] = useState<RecoveryRecord[]>([]);
  const [recoverySearch, setRecoverySearch] = useState<string>('');
  const [recoveryLoading, setRecoveryLoading] = useState<boolean>(false);

  // Payslip Modal State
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchPayrollPeriods();
    fetchBillingPeriods();
    fetchRecoveryRecords();
  }, []);

  const fetchBillingPeriods = async () => {
    try {
      const res = await api.get('/billing/periods');
      if (res.data.success && res.data.data.length > 0) {
        setBillingPeriods(res.data.data);
        const openPeriod = res.data.data.find((b: any) => b.status === 'OPEN') || res.data.data[0];
        if (openPeriod) {
          setSelectedBillingPeriodId(openPeriod.id.toString());
        }
      }
    } catch (err) {
      console.error('Error fetching billing periods:', err);
    }
  };

  useEffect(() => {
    if (selectedPeriodId) {
      fetchPayrollEntries(selectedPeriodId);
    }
  }, [selectedPeriodId]);

  const fetchPayrollPeriods = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payroll/periods');
      if (res.data.success && res.data.data.length > 0) {
        setPeriods(res.data.data);
        if (!selectedPeriodId) {
          setSelectedPeriodId(res.data.data[0].id.toString());
        }
      } else {
        // Create initial default payroll period if none exists
        const createRes = await api.post('/payroll/periods', {
          periodCode: 'PAY-2026-03',
          monthYear: '2026-03',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          payoutDate: '2026-04-01',
        });
        if (createRes.data.success) {
          fetchPayrollPeriods();
        }
      }
    } catch (err) {
      console.error('Error fetching payroll periods:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollEntries = async (periodId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/payroll/entries?periodId=${periodId}`);
      if (res.data.success) {
        setEntries(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching payroll entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecoveryRecords = async () => {
    try {
      setRecoveryLoading(true);
      const res = await api.get('/payroll/recovery-records');
      if (res.data.success) {
        setRecoveryRecords(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching recovery records:', err);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleComputePayroll = async () => {
    if (!selectedPeriodId) return;
    setIsProcessing(true);

    try {
      const res = await api.post('/payroll/calculate', {
        payrollPeriodId: parseInt(selectedPeriodId, 10),
        billingPeriodId: selectedBillingPeriodId ? parseInt(selectedBillingPeriodId, 10) : undefined,
      });
      if (res.data.success) {
        alert(res.data.message || 'Payroll calculations and store recoveries successfully computed!');
        await fetchPayrollEntries(selectedPeriodId);
        await fetchPayrollPeriods();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to compute payroll');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisbursePayroll = async () => {
    if (!selectedPeriodId) return;
    const confirmDisburse = window.confirm(
      'Are you sure you want to approve and disburse this payroll?\n\n' +
      'This will:\n' +
      '1. Mark salaries as PAID\n' +
      '2. Generate official store Recovery Records (REC-2026-XXXX)\n' +
      '3. Automatically decrement employees outstanding balances and replenish their store credit limits\n' +
      '4. Record PAYROLL_RECOVERY transactions in the employee audit ledger'
    );
    if (!confirmDisburse) return;

    setIsDisbursing(true);
    try {
      const res = await api.post('/payroll/disburse', {
        payrollPeriodId: parseInt(selectedPeriodId, 10),
        billingPeriodId: selectedBillingPeriodId ? parseInt(selectedBillingPeriodId, 10) : undefined,
      });
      if (res.data.success) {
        alert(res.data.message || 'Payroll disbursed and Store Credit Recoveries executed successfully!');
        await fetchPayrollEntries(selectedPeriodId);
        await fetchPayrollPeriods();
        await fetchRecoveryRecords();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disburse payroll');
    } finally {
      setIsDisbursing(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/payroll/periods', {
        periodCode: newPeriodCode,
        monthYear: newMonthYear,
        startDate: newStartDate,
        endDate: newEndDate,
        payoutDate: newPayoutDate,
      });
      if (res.data.success) {
        setIsNewCycleModalOpen(false);
        await fetchPayrollPeriods();
        setSelectedPeriodId(res.data.data.id.toString());
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create payroll period');
    }
  };

  const handleViewPayslip = (entry: PayrollEntry) => {
    setSelectedEntry(entry);
    setIsPayslipModalOpen(true);
  };

  const [waSendingEntryId, setWaSendingEntryId] = useState<number | null>(null);
  const [waBulkSending, setWaBulkSending] = useState(false);

  const handleSendWhatsAppPayslip = async (entryId: number) => {
    try {
      setWaSendingEntryId(entryId);
      const res = await api.post('/whatsapp/send-payroll-advice', { payrollEntryId: entryId });
      alert(res.data.message || 'WhatsApp recovery advice dispatched!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch WhatsApp message');
    } finally {
      setWaSendingEntryId(null);
    }
  };

  const handleBulkSendWhatsAppPayroll = async () => {
    if (!selectedPeriodId) return;
    if (!window.confirm('Dispatch WhatsApp payroll deduction notices to all employees in this period?')) return;
    try {
      setWaBulkSending(true);
      const res = await api.post('/whatsapp/bulk-payroll-advice', { payrollPeriodId: parseInt(selectedPeriodId, 10) });
      alert(res.data.message || 'WhatsApp notices dispatched successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch bulk notices');
    } finally {
      setWaBulkSending(false);
    }
  };

  const handleExportRecoveriesCSV = () => {
    if (recoveryRecords.length === 0) {
      alert('No recovery records to export.');
      return;
    }
    const headers = [
      'Recovery Number',
      'Date',
      'Employee Code',
      'Employee Name',
      'Department',
      'Payroll Period',
      'Recovery Source',
      'Amount Deducted (INR)',
      'Status',
      'Remarks',
    ];
    const rows = recoveryRecords.map((r) => [
      r.recovery_number,
      new Date(r.recovered_at).toLocaleDateString('en-IN'),
      r.employee_code,
      `"${r.first_name} ${r.last_name}"`,
      r.department_name || '',
      r.payroll_period_code || '',
      r.recovery_source,
      r.amount_deducted,
      r.status,
      `"${r.remarks || ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CFECC_Recovery_Records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activePeriod = periods.find((p) => p.id.toString() === selectedPeriodId);
  const isPeriodDisbursed = activePeriod?.status === 'DISBURSED';

  const totalGross = entries.reduce((s, e) => s + parseFloat((e.gross_salary as any) || 0), 0);
  const totalStoreRecovery = entries.reduce((s, e) => s + parseFloat((e.store_recovery_amount as any) || 0), 0);
  const totalStatutory = entries.reduce((s, e) => s + parseFloat((e.statutory_deductions as any) || 0), 0);
  const totalNet = entries.reduce((s, e) => s + parseFloat((e.net_salary as any) || 0), 0);

  // Filtered recovery records
  const filteredRecoveries = recoveryRecords.filter((r) => {
    const q = recoverySearch.toLowerCase().trim();
    if (!q) return true;
    return (
      r.recovery_number.toLowerCase().includes(q) ||
      r.employee_code.toLowerCase().includes(q) ||
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      (r.department_name && r.department_name.toLowerCase().includes(q))
    );
  });

  const totalHistoricalRecoveries = recoveryRecords.reduce(
    (s, r) => s + parseFloat((r.amount_deducted as any) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header and Workflow Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Payroll & Store Purchase Recovery</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Synchronized payroll deduction linking monthly store credit bills to employee salary disbursement
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-borderLine">
          <button
            onClick={() => setActiveTab('PAYROLL')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'PAYROLL'
                ? 'bg-white text-navy-800 shadow-xs'
                : 'text-textSecondary hover:text-navy-800'
              }`}
          >
            <Banknote className="w-3.5 h-3.5 text-primary" />
            <span>Payroll & Salary Register</span>
          </button>
          <button
            onClick={() => setActiveTab('RECOVERY')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'RECOVERY'
                ? 'bg-white text-navy-800 shadow-xs'
                : 'text-textSecondary hover:text-navy-800'
              }`}
          >
            <Receipt className="w-3.5 h-3.5 text-amber-600" />
            <span>Store Recovery Records ({recoveryRecords.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PAYROLL & SALARY REGISTER */}
      {activeTab === 'PAYROLL' && (
        <div className="space-y-6">
          {/* Cycle Selection & Actions Bar */}
          <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-navy-800">Payroll Cycle:</span>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold text-navy-800 bg-white border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id.toString()}>
                      {p.period_code} ({p.month_year}) - {p.status}
                    </option>
                  ))}
                </select>
              </div>

              {activePeriod && (
                <div className="flex items-center space-x-2">
                  <StatusBadge status={activePeriod.status} />
                  <span className="text-[11px] text-textSecondary">
                    Payout Date: {new Date(activePeriod.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Linked Store Billing Statement Period */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-800">Store Bill Cycle:</span>
                <select
                  value={selectedBillingPeriodId}
                  onChange={(e) => setSelectedBillingPeriodId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50/60 border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  title="Monthly store credit purchases statement linked for salary deductions"
                >
                  {billingPeriods.length === 0 ? (
                    <option value="">Default Active Billing</option>
                  ) : (
                    billingPeriods.map((bp) => (
                      <option key={bp.id} value={bp.id.toString()}>
                        {bp.period_code} ({bp.period_name}) - {bp.status}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                onClick={() => setIsNewCycleModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-borderLine bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-navy-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Cycle</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2.5 w-full md:w-auto">
              <button
                onClick={handleComputePayroll}
                disabled={isProcessing || isPeriodDisbursed}
                className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white border border-primary text-primary hover:bg-primary/5 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Computing...' : 'Calculate Payroll & Deductions'}</span>
              </button>

              <button
                onClick={handleDisbursePayroll}
                disabled={isDisbursing || entries.length === 0 || isPeriodDisbursed}
                className={`flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg text-white text-xs font-semibold transition-colors shadow-subtle ${isPeriodDisbursed
                    ? 'bg-emerald-600 opacity-90 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                  }`}
              >
                {isPeriodDisbursed ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Disbursed & Recovered</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isDisbursing ? 'Disbursing...' : 'Approve & Disburse Payroll'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBulkSendWhatsAppPayroll}
                disabled={waBulkSending || entries.length === 0}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50"
                title="Dispatch WhatsApp recovery slips to all employees"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>{waBulkSending ? 'Sending...' : 'WhatsApp Slips'}</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
              <span className="text-xs text-textSecondary font-semibold">Total Gross Salaries</span>
              <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                ₹{totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-textSecondary">Base + DA + HRA + Allowances</span>
            </div>

            <div className="bg-surface p-4 rounded-cfecc border border-amber-200 bg-amber-50/20 shadow-subtle">
              <span className="text-xs text-amber-800 font-semibold flex items-center justify-between">
                <span>Store Purchases Recovered</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">CFECC Bills</span>
              </span>
              <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">
                ₹{totalStoreRecovery.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-amber-800/80">Direct credit deduction from salary</span>
            </div>

            <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
              <span className="text-xs text-textSecondary font-semibold">Statutory Deductions</span>
              <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                ₹{totalStatutory.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-textSecondary">Provident Fund & ESI contributions</span>
            </div>

            <div className="bg-surface p-4 rounded-cfecc border border-emerald-200 bg-emerald-50/20 shadow-subtle">
              <span className="text-xs text-emerald-800 font-semibold">Net Payout Amount</span>
              <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-emerald-800/80">Bank NEFT/RTGS disbursement</span>
            </div>
          </div>

          {/* Salary Register Table */}
          <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-borderLine flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-navy-800">Monthly Salary Register with Store Recoveries</h3>
                <p className="text-[11px] text-textSecondary mt-0.5">
                  Employees with active store purchase balances have their dues deducted directly before bank disbursement
                </p>
              </div>
              <div className="text-xs text-textSecondary font-semibold">
                Total Employees: <span className="text-navy-800 font-bold">{entries.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
              <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                  <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4 text-right">Basic (₹)</th>
                    <th className="py-3 px-4 text-right">DA + HRA (₹)</th>
                    <th className="py-3 px-4 text-right">Gross (₹)</th>
                    <th className="py-3 px-4 text-right font-bold text-amber-700 bg-amber-50/50">Store Recovery (₹)</th>
                    <th className="py-3 px-4 text-right">Statutory (₹)</th>
                    <th className="py-3 px-4 text-right font-bold text-emerald-700">Net Payable (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-textSecondary">
                        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                        <div>Loading payroll register...</div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-textSecondary">
                        <Banknote className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <div className="font-semibold text-navy-800">No payroll entries computed for this cycle</div>
                        <div className="text-xs mt-1">Click &lsquo;Calculate Payroll & Deductions&rsquo; to compute salaries and extract store balances.</div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-navy-800">{entry.first_name} {entry.last_name}</div>
                          <div className="text-[11px] text-textSecondary font-mono flex items-center gap-1">
                            <span>{entry.employee_code}</span>
                            <span>&bull;</span>
                            <span>{entry.department_name}</span>
                            {entry.mobile && (
                              <>
                                <span>&bull;</span>
                                <span className="text-emerald-700 font-sans font-medium">{entry.mobile}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                          ₹{parseFloat((entry.basic_salary as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                          ₹{(parseFloat((entry.da as any) || 0) + parseFloat((entry.hra as any) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-navy-800">
                          ₹{parseFloat((entry.gross_salary as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {/* Store Recovery Highlight */}
                        <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700 bg-amber-50/30">
                          ₹{parseFloat((entry.store_recovery_amount as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                          ₹{parseFloat((entry.statutory_deductions as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700 text-sm">
                          ₹{parseFloat((entry.net_salary as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={entry.payment_status} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              disabled={waSendingEntryId === entry.id}
                              onClick={() => handleSendWhatsAppPayslip(entry.id)}
                              className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                              title={entry.mobile ? `Send WhatsApp Advice to ${entry.mobile}` : 'Send WhatsApp Salary & Recovery Advice'}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleViewPayslip(entry)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-navy-800 hover:text-white text-navy-800 text-[11px] font-semibold transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Payslip</span>
                            </button>
                          </div>
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
                Showing <span className="font-bold text-navy-800 font-mono">{entries.length}</span> staff payslip entries for cycle{' '}
                <span className="font-bold text-navy-800 font-mono">{activePeriod?.period_code || 'Active Cycle'}</span>
              </div>
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="text-amber-700 font-medium font-mono">
                  Total Store Recoveries: ₹{entries.reduce((acc, e) => acc + parseFloat((e.store_recovery_amount as any) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-emerald-700 font-medium font-mono">
                  Net Payout: ₹{entries.reduce((acc, e) => acc + parseFloat((e.net_salary as any) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STORE RECOVERY RECORDS REGISTER */}
      {activeTab === 'RECOVERY' && (
        <div className="space-y-6">
          {/* Top Control & KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
              <span className="text-xs text-textSecondary font-semibold">Total Recovered from Salaries</span>
              <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">
                ₹{totalHistoricalRecoveries.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-textSecondary">Cumulative CFECC store credit recoveries</span>
            </div>

            <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
              <span className="text-xs text-textSecondary font-semibold">Recovery Transactions Logged</span>
              <div className="text-xl font-bold text-navy-800 mt-1 tabular-nums">
                {recoveryRecords.length} Records
              </div>
              <span className="text-[11px] text-textSecondary">Verified payroll deductions</span>
            </div>

            <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
              <span className="text-xs text-textSecondary font-semibold">Ledger Integration</span>
              <div className="text-xl font-bold text-emerald-700 mt-1 flex items-center space-x-1">
                <CheckCircle className="w-5 h-5" />
                <span>100% Synchronized</span>
              </div>
              <span className="text-[11px] text-textSecondary">Balances automatically replenished in real-time</span>
            </div>
          </div>

          {/* Search and Export Bar */}
          <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by REC number, employee code, name..."
                value={recoverySearch}
                onChange={(e) => setRecoverySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
              />
            </div>

            <button
              onClick={handleExportRecoveriesCSV}
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-lg border border-borderLine bg-white hover:bg-slate-50 text-xs font-semibold text-navy-800 transition-colors shadow-subtle"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Recovery Ledger (CSV)</span>
            </button>
          </div>

          {/* Recovery Records Table */}
          <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800">Store Credit Recovery Audit Ledger</h3>
              <p className="text-[11px] text-textSecondary mt-0.5">
                Official recovery records generated during monthly payroll disbursements. Each deduction is credited against the employee&apos;s store liability.
              </p>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
              <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                  <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-4">Recovery Ref #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Payroll Cycle</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-right">Amount Deducted (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Audit Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {recoveryLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-textSecondary">
                        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                        <div>Loading recovery records...</div>
                      </td>
                    </tr>
                  ) : filteredRecoveries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-textSecondary">
                        <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <div className="font-semibold text-navy-800">No Store Recovery Records Found</div>
                        <div className="text-xs mt-1">
                          When you approve &amp; disburse a payroll cycle with store deductions, recovery records (REC-2026-XXXX) will appear here.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecoveries.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-navy-800">
                          {rec.recovery_number}
                        </td>
                        <td className="py-3 px-4 text-textSecondary whitespace-nowrap">
                          {new Date(rec.recovered_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-navy-800">{rec.first_name} {rec.last_name}</div>
                          <div className="text-[11px] text-textSecondary font-mono">{rec.employee_code} &bull; {rec.department_name}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-textSecondary">
                          {rec.payroll_period_code || 'PAY-2026-03'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {rec.recovery_source}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700">
                          ₹{parseFloat(rec.amount_deducted as any).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-textSecondary text-[11px] max-w-xs truncate">
                          {rec.remarks || 'Deducted via payroll disbursement'}
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
                Showing <span className="font-bold text-navy-800 font-mono">{filteredRecoveries.length}</span> store credit recovery ledger records
              </div>
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="text-amber-700 font-medium font-mono">
                  Total Deductions: ₹{filteredRecoveries.reduce((acc, r) => acc + parseFloat((r.amount_deducted as any) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Payroll Cycle Modal */}
      <Modal
        isOpen={isNewCycleModalOpen}
        onClose={() => setIsNewCycleModalOpen(false)}
        title="Create New Monthly Payroll Cycle"
        subtitle="Initialize salary computation cycle for CFECC employees"
        maxWidth="md"
      >
        <form onSubmit={handleCreatePeriod} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Period Code
            </label>
            <input
              type="text"
              required
              value={newPeriodCode}
              onChange={(e) => setNewPeriodCode(e.target.value)}
              className="w-full px-3 py-2 border border-borderLine rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. PAY-2026-04"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Month & Year (YYYY-MM)
            </label>
            <input
              type="month"
              required
              value={newMonthYear}
              onChange={(e) => setNewMonthYear(e.target.value)}
              className="w-full px-3 py-2 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Disbursement / Payout Date
            </label>
            <input
              type="date"
              required
              value={newPayoutDate}
              onChange={(e) => setNewPayoutDate(e.target.value)}
              className="w-full px-3 py-2 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsNewCycleModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-borderLine text-textSecondary hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle"
            >
              Initialize Period
            </button>
          </div>
        </form>
      </Modal>

      {/* Official CFECC Printable Payslip Modal */}
      <Modal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        title="Official Employee Salary Payslip"
        subtitle="CFECC Employees Consumer Co-operative Society Ltd, Visakhapatnam"
        maxWidth="4xl"
      >
        {selectedEntry && (
          <div className="space-y-4 text-xs font-sans print:p-0">
            {/* Payslip Header */}
            <div className="border-b-2 border-navy-800 pb-3 flex justify-between items-start">
              <div>
                <h1 className="text-base font-bold text-navy-800 uppercase tracking-wide">
                  CFECC EMPLOYEES CONSUMER CO-OPERATIVE SOCIETY LTD.
                </h1>
                <p className="text-[11px] text-textSecondary">
                  Reg No: MSCS/CR/2026 &bull; D.No 14-38-12, Near Port Stadium, Visakhapatnam, AP - 530008
                </p>
                <div className="text-[11px] font-bold text-primary mt-1">
                  SALARY & STORE CREDIT RECOVERY SLIP &mdash; {activePeriod?.month_year || 'MARCH 2026'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-mono font-bold text-navy-800">
                  SLIP REF: {selectedEntry.employee_code}-{(activePeriod?.period_code || 'PAY-2026-03')}
                </div>
                <div className="text-[10px] text-textSecondary">
                  Payout Date: {activePeriod?.payout_date || '2026-04-01'}
                </div>
              </div>
            </div>

            {/* Employee Particulars Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-lg border border-borderLine text-[11px]">
              <div>
                <span className="text-textSecondary block text-[10px] uppercase font-bold">Employee Name</span>
                <span className="font-bold text-navy-800">{selectedEntry.first_name} {selectedEntry.last_name}</span>
              </div>
              <div>
                <span className="text-textSecondary block text-[10px] uppercase font-bold">Employee ID / Code</span>
                <span className="font-mono font-bold text-navy-800">{selectedEntry.employee_code}</span>
              </div>
              <div>
                <span className="text-textSecondary block text-[10px] uppercase font-bold">Department</span>
                <span className="font-semibold text-navy-800">{selectedEntry.department_name || 'Operations'}</span>
              </div>
              <div>
                <span className="text-textSecondary block text-[10px] uppercase font-bold">Mobile / WhatsApp</span>
                <span className="font-semibold text-emerald-800">{selectedEntry.mobile || 'Not Registered'}</span>
              </div>
              <div>
                <span className="text-textSecondary block text-[10px] uppercase font-bold">Bank Name & A/C</span>
                <span className="font-mono text-navy-800">
                  {selectedEntry.bank_name || 'State Bank of India'} &bull; {selectedEntry.account_number ? `...${selectedEntry.account_number.slice(-4)}` : 'XXXX5739'}
                </span>
              </div>
            </div>

            {/* Earnings & Deductions Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Earnings Table */}
              <div className="border border-borderLine rounded-lg overflow-hidden">
                <div className="bg-navy-800 text-white font-bold text-[11px] px-3 py-1.5 flex justify-between">
                  <span>EARNINGS HEAD</span>
                  <span>AMOUNT (₹)</span>
                </div>
                <div className="divide-y divide-borderLine p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Basic Salary</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.basic_salary as any) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-textSecondary">Dearness Allowance (DA)</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.da as any) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-textSecondary">House Rent Allowance (HRA)</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.hra as any) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-textSecondary">Special Allowances</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.other_allowances as any) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t-2 border-borderLine font-bold text-navy-800">
                    <span>GROSS EARNINGS</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.gross_salary as any) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div className="border border-borderLine rounded-lg overflow-hidden">
                <div className="bg-amber-700 text-white font-bold text-[11px] px-3 py-1.5 flex justify-between">
                  <span>DEDUCTIONS & STORE RECOVERIES</span>
                  <span>AMOUNT (₹)</span>
                </div>
                <div className="divide-y divide-borderLine p-3 space-y-2 text-xs">
                  {/* Store Purchase Recovery */}
                  <div className="flex justify-between font-bold text-amber-800 bg-amber-50/60 p-1.5 rounded">
                    <span>CFECC Store Credit Purchases Recovery</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.store_recovery_amount as any) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-textSecondary">Provident Fund (PF) & Statutory</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.statutory_deductions as any) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5">
                    <span className="text-textSecondary">Professional Tax (PT)</span>
                    <span className="font-mono tabular-nums">₹0.00</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t-2 border-borderLine font-bold text-amber-800">
                    <span>TOTAL DEDUCTIONS</span>
                    <span className="font-mono tabular-nums">₹{parseFloat((selectedEntry.total_deductions as any) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Summary */}
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs font-bold text-emerald-900 block">NET TAKE-HOME SALARY</span>
                <span className="text-[11px] text-emerald-700">Amount transferred directly to employee bank account</span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
                ₹{parseFloat((selectedEntry.net_salary as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Note & Signatures */}
            <div className="pt-4 border-t border-borderLine text-[10px] text-textSecondary flex justify-between items-end">
              <div>
                <p>Note: CFECC Store Credit Recovery has been settled against active store billing statements.</p>
                <p>Computer generated statement &mdash; valid without physical signature for internal audit.</p>
              </div>
              <div className="text-right">
                <div className="w-40 border-b border-navy-800 mb-1" />
                <span className="font-bold text-navy-800">Authorized Accounts Officer</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-borderLine print:hidden">
              <div className="flex items-center space-x-2 text-xs text-textSecondary w-full sm:w-auto">
                <span>WhatsApp Notice:</span>
                <span className="font-semibold text-emerald-800">
                  {selectedEntry.mobile ? selectedEntry.mobile : 'No Mobile Registered'}
                </span>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={waSendingEntryId === selectedEntry.id}
                  onClick={() => handleSendWhatsAppPayslip(selectedEntry.id)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-subtle transition-colors disabled:opacity-50"
                  title="Dispatch payslip and store deduction details to employee's WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{waSendingEntryId === selectedEntry.id ? 'Sending...' : 'Send WhatsApp Payslip'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs shadow-subtle transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Payslip</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
