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
  Calendar,
  IndianRupee,
  ShieldAlert,
} from 'lucide-react';

export const PayrollPage: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Payslip Modal
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);

  useEffect(() => {
    fetchPayrollPeriods();
  }, []);

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
        setSelectedPeriodId(res.data.data[0].id.toString());
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
      console.error(err);
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleComputePayroll = async () => {
    if (!selectedPeriodId) return;
    setIsProcessing(true);

    try {
      const res = await api.post('/payroll/calculate', {
        payrollPeriodId: parseInt(selectedPeriodId, 10),
        billingPeriodId: 1, // Link to active March 2026 store billing
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchPayrollEntries(selectedPeriodId);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to compute payroll');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPayslip = (entry: any) => {
    setSelectedEntry(entry);
    setIsPayslipModalOpen(true);
  };

  const totalStoreRecovery = entries.reduce((s, e) => s + parseFloat(e.store_recovery_amount || 0), 0);
  const totalNet = entries.reduce((s, e) => s + parseFloat(e.net_salary || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Payroll & Store Purchase Recovery</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Synchronized payroll deduction linking monthly store credit bills to employee salary disbursement
          </p>
        </div>

        <button
          onClick={handleComputePayroll}
          disabled={isProcessing}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'Computing...' : 'Calculate Payroll & Deductions'}</span>
        </button>
      </div>

      {/* Control Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <span className="text-xs text-textSecondary font-semibold">Active Payroll Cycle</span>
          <div className="text-base font-bold text-navy-800 mt-1">March 2026 (PAY-2026-03)</div>
          <span className="text-[11px] text-textSecondary">Payout date: April 1, 2026</span>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <span className="text-xs text-textSecondary font-semibold">Total Store Purchases Recovered</span>
          <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">
            ₹{totalStoreRecovery.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-textSecondary">Linked directly to CFECC store bills</span>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <span className="text-xs text-textSecondary font-semibold">Total Net Salary Disbursed</span>
          <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-textSecondary">Post-recovery bank transfer total</span>
        </div>
      </div>

      {/* Payroll Register Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-borderLine">
          <h3 className="text-sm font-bold text-navy-800">Monthly Salary Register with Store Recoveries</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4 text-right">Basic (₹)</th>
                <th className="py-3 px-4 text-right">DA + HRA (₹)</th>
                <th className="py-3 px-4 text-right">Gross Salary (₹)</th>
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
                    <div>Loading payroll entries...</div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <Banknote className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No calculated entries. Click 'Calculate Payroll & Deductions' to run.</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-800">{entry.first_name} {entry.last_name}</div>
                      <div className="text-[11px] text-textSecondary font-mono">{entry.employee_code} &bull; {entry.department_name}</div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                      ₹{parseFloat(entry.basic_salary).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                      ₹{(parseFloat(entry.da) + parseFloat(entry.hra)).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-navy-800">
                      ₹{parseFloat(entry.gross_salary).toLocaleString('en-IN')}
                    </td>
                    {/* Store Recovery Highlight */}
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-amber-700 bg-amber-50/30">
                      ₹{parseFloat(entry.store_recovery_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                      ₹{parseFloat(entry.statutory_deductions).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-700 text-sm">
                      ₹{parseFloat(entry.net_salary).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={entry.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleViewPayslip(entry)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-navy-800 hover:text-white text-navy-800 text-[11px] font-semibold transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Payslip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
      <Modal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        title="Official Employee Salary Payslip"
        subtitle="CFECC Stores & Services, Visakhapatnam"
        maxWidth="lg"
      >
        {selectedEntry && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center border border-borderLine">
              <div>
                <div className="font-bold text-sm text-navy-800">{selectedEntry.first_name} {selectedEntry.last_name}</div>
                <div className="text-[11px] text-textSecondary font-mono">
                  Code: {selectedEntry.employee_code} &bull; Dept: {selectedEntry.department_name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-navy-800">Month: March 2026</div>
                <div className="text-[11px] text-textSecondary">Bank: {selectedEntry.bank_name || 'SBI'} ({selectedEntry.account_number || '30129485739'})</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Earnings */}
              <div className="p-3 border border-borderLine rounded-lg space-y-1.5">
                <span className="font-bold text-navy-800 uppercase text-[10px] block pb-1 border-b border-borderLine">
                  Earnings
                </span>
                <div className="flex justify-between">
                  <span>Basic Salary:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.basic_salary).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>DA:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.da).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>HRA:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.hra).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Allowances:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.other_allowances).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-borderLine">
                  <span>Gross Earnings:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.gross_salary).toFixed(2)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div className="p-3 border border-borderLine rounded-lg space-y-1.5">
                <span className="font-bold text-navy-800 uppercase text-[10px] block pb-1 border-b border-borderLine">
                  Deductions & Store Recovery
                </span>
                <div className="flex justify-between font-semibold text-amber-700">
                  <span>Store Purchase Recovery:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.store_recovery_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-textSecondary">
                  <span>PF & ESI Statutory:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.statutory_deductions).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-4 border-t border-borderLine">
                  <span>Total Deductions:</span>
                  <span className="font-mono">₹{parseFloat(selectedEntry.total_deductions).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center text-sm font-bold text-emerald-800">
              <span>Net Take-Home Salary:</span>
              <span className="text-base font-mono">₹{parseFloat(selectedEntry.net_salary).toFixed(2)}</span>
            </div>

            <div className="flex justify-end pt-3 border-t border-borderLine">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-navy-800 text-white font-semibold text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Payslip</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

