import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  ArrowLeft,
  CreditCard,
  User,
  Phone,
  Briefcase,
  IndianRupee,
  Building2,
  FileText,
  ShoppingBag,
  Receipt,
  History,
  CheckCircle,
  AlertCircle,
  Save,
  Edit,
  Trash2,
  Plus,
  MessageSquare,
  Coins,
  Landmark,
  ShoppingCart,
  ShieldCheck,
} from 'lucide-react';

const formatCurrency = (val: number | string | undefined | null) => {
  const num = parseFloat((val ?? 0).toString());
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>('profile');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Credit configuration state for Tab 2
  const [creditLimitInput, setCreditLimitInput] = useState<number>(10000);
  const [creditEnabledInput, setCreditEnabledInput] = useState<boolean>(true);
  const [isUpdatingCredit, setIsUpdatingCredit] = useState<boolean>(false);
  const [creditUpdateSuccess, setCreditUpdateSuccess] = useState<string | null>(null);

  // WhatsApp Balance Statement
  const [waSending, setWaSending] = useState(false);
  const [waNotice, setWaNotice] = useState<string | null>(null);

  const handleSendWhatsAppBalance = async () => {
    const employeeId = data?.overview?.id || id;
    if (!employeeId) return;
    try {
      setWaSending(true);
      setWaNotice(null);
      const res = await api.post('/whatsapp/send-employee-balance', {
        employeeId: parseInt(employeeId.toString(), 10),
      });
      if (res.data.success) {
        setWaNotice(res.data.message || 'Live store credit balance notice dispatched via WhatsApp!');
      } else {
        alert(res.data.message || 'Failed to dispatch WhatsApp statement');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send WhatsApp message');
    } finally {
      setWaSending(false);
    }
  };

  // Edit Personal & Cooperative Member Details Modal
  const [isEditPersonalModalOpen, setIsEditPersonalModalOpen] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    lastName: '',
    csNo: '',
    grade: 'NM',
    category: 'WORKER',
    hrNo: '',
    mobile: '',
    alternateMobile: '',
    email: '',
    currentAddress: '',
    permanentAddress: '',
    employmentStatus: 'ACTIVE',
  });

  // Edit Salary Modal
  const [isEditSalaryModalOpen, setIsEditSalaryModalOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    basicSalary: 25000,
    da: 5000,
    hra: 6000,
    otherAllowances: 2000,
    statutoryDeductions: 2400,
  });

  // Edit Bank Modal
  const [isEditBankModalOpen, setIsEditBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
  });

  // Upload Document Modal
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    documentType: 'AADHAAR',
    documentName: '',
    documentUrl: '#',
  });

  useEffect(() => {
    if (id) {
      fetchEmployeeProfile(id);
    }
  }, [id]);

  const fetchEmployeeProfile = async (empId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/employees/${empId}`);
      if (res.data.success) {
        const emp = res.data.data;
        setData(emp);
        setCreditLimitInput(emp.storeCredit.creditLimit);
        setCreditEnabledInput(emp.storeCredit.creditEnabled);

        const initialGrade = emp.overview.grade || (emp.overview.category === 'STAFF' ? 'M' : emp.overview.category === 'SPECIAL' ? 'Other' : 'NM');
        setPersonalForm({
          firstName: emp.personal.firstName,
          lastName: emp.personal.lastName,
          csNo: emp.overview.cs_no || '',
          grade: initialGrade,
          category: emp.overview.category || (initialGrade === 'M' ? 'STAFF' : initialGrade === 'Other' ? 'SPECIAL' : 'WORKER'),
          hrNo: emp.overview.hr_no || '',
          mobile: emp.contact.mobile,
          alternateMobile: emp.contact.alternateMobile || '',
          email: emp.contact.email || '',
          currentAddress: emp.contact.currentAddress || '',
          permanentAddress: emp.contact.permanentAddress || '',
          employmentStatus: emp.employment.employmentStatus,
        });

        if (emp.salary) {
          setSalaryForm({
            basicSalary: parseFloat(emp.salary.basic_salary),
            da: parseFloat(emp.salary.da),
            hra: parseFloat(emp.salary.hra),
            otherAllowances: parseFloat(emp.salary.other_allowances),
            statutoryDeductions: parseFloat(emp.salary.statutory_deductions),
          });
        }

        if (emp.bank) {
          setBankForm({
            accountHolderName: emp.bank.account_holder_name,
            bankName: emp.bank.bank_name,
            accountNumber: emp.bank.account_number,
            ifscCode: emp.bank.ifsc_code,
            branch: emp.bank.branch || '',
          });
        } else {
          setBankForm({
            accountHolderName: `${emp.personal.firstName} ${emp.personal.lastName}`,
            bankName: 'State Bank of India',
            accountNumber: '',
            ifscCode: 'SBIN0001234',
            branch: 'Visakhapatnam',
          });
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  // Update Store Credit
  const handleUpdateCredit = async () => {
    try {
      setIsUpdatingCredit(true);
      setCreditUpdateSuccess(null);
      const res = await api.put(`/employees/${id}/credit`, {
        creditEnabled: creditEnabledInput,
        creditLimit: creditLimitInput,
      });
      if (res.data.success) {
        setCreditUpdateSuccess('Store credit limit and eligibility successfully updated.');
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update credit');
    } finally {
      setIsUpdatingCredit(false);
    }
  };

  // Save Personal & Contact Details
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const g = personalForm.grade || 'NM';
      const cat = g === 'M' ? 'STAFF' : g === 'NM' ? 'WORKER' : 'SPECIAL';
      const payload = {
        ...personalForm,
        grade: g,
        category: cat,
      };
      const res = await api.put(`/employees/${id}`, payload);
      if (res.data.success) {
        setIsEditPersonalModalOpen(false);
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update details');
    }
  };

  // Save Salary Structure
  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/employees/${id}/salary`, salaryForm);
      if (res.data.success) {
        setIsEditSalaryModalOpen(false);
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update salary');
    }
  };

  // Save Bank Details
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/employees/${id}/bank`, bankForm);
      if (res.data.success) {
        setIsEditBankModalOpen(false);
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update bank details');
    }
  };

  // Upload Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.documentName) return;
    try {
      const res = await api.post(`/employees/${id}/documents`, docForm);
      if (res.data.success) {
        setIsUploadDocModalOpen(false);
        setDocForm({ documentType: 'AADHAAR', documentName: '', documentUrl: '#' });
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to upload document');
    }
  };

  // Delete Document
  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Are you sure you want to remove this document?')) return;
    try {
      const res = await api.delete(`/employees/${id}/documents/${docId}`);
      if (res.data.success) {
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Cooperative Profile & Ledger', icon: Landmark, count: null },
    { id: 'credit', label: 'Store Credit & POS Limits', icon: CreditCard, count: null },
    {
      id: 'ledger',
      label: 'Purchases & Store Ledger',
      icon: ShoppingBag,
      count: (data?.purchases?.length || 0) + (data?.billing?.ledger?.length || 0),
    },
    { id: 'finance', label: 'Salary & Bank Details', icon: IndianRupee, count: null },
    { id: 'documents', label: 'Documents & KYC', icon: FileText, count: data?.documents?.length || 0 },
    { id: 'activity', label: 'Activity & Audit Log', icon: History, count: data?.activity?.length || 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-surface p-8 rounded-cfecc border border-borderLine text-center">
        <AlertCircle className="w-10 h-10 text-status-danger mx-auto mb-2" />
        <h3 className="text-base font-bold text-navy-800">Member Profile Error</h3>
        <p className="text-xs text-textSecondary mt-1">{error || 'Record could not be found'}</p>
        <button
          onClick={() => navigate('/employees')}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
        >
          Return to Member Directory
        </button>
      </div>
    );
  }

  const emp = data.overview;
  const isSpecial = emp.category === 'SPECIAL';
  const isStaff = emp.category === 'STAFF';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/employees')}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-textSecondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Member Directory</span>
        </button>
      </div>

      {/* Header Profile Card */}
      <div className="bg-surface rounded-cfecc border border-borderLine p-6 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold uppercase shadow-sm text-white ${
            isStaff ? 'bg-purple-700' : isSpecial ? 'bg-amber-600' : 'bg-navy-800'
          }`}>
            {emp.first_name ? emp.first_name.charAt(0) : 'M'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-navy-800">
                {emp.first_name} {emp.last_name !== '.' ? emp.last_name : ''}
              </h2>
              <StatusBadge status={emp.employment_status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-textSecondary mt-1.5">
              <span className="font-mono font-semibold text-primary">{emp.employee_code}</span>
              {emp.cs_no && (
                <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  CS #{emp.cs_no}
                </span>
              )}
              {emp.category && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  isStaff
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : isSpecial
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {isSpecial ? 'Special Account' : emp.category}
                </span>
              )}
              {emp.hr_no && (
                <span className="font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                  Corporate HR #{emp.hr_no}
                </span>
              )}
              <span>&bull;</span>
              <span className="font-medium text-slate-600">Coromandel International Ltd (Visakhapatnam Unit)</span>
            </div>
          </div>
        </div>

        {/* Live Credit Summary Box */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-lg border border-borderLine w-full md:w-auto">
          <div className="text-right">
            <div className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Credit Limit</div>
            <div className="text-sm font-bold text-navy-800 tabular-nums">
              ₹{parseFloat(emp.credit_limit || '0').toLocaleString('en-IN')}
            </div>
          </div>

          <div className="h-8 w-px bg-borderLine" />

          <div className="text-right">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Month Bills</div>
            <div className="text-sm font-bold text-amber-700 tabular-nums">
              ₹{parseFloat(emp.current_month_bills || '0').toLocaleString('en-IN')}
            </div>
          </div>

          <div className="h-8 w-px bg-borderLine" />

          <div className="text-right">
            <div className="text-[10px] font-bold text-navy-800 uppercase tracking-wider">Outstanding</div>
            <div className="text-sm font-bold text-navy-900 tabular-nums">
              ₹{parseFloat(emp.current_outstanding || '0').toLocaleString('en-IN')}
            </div>
          </div>

          <div className="h-8 w-px bg-borderLine" />

          <div className="text-right">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Available</div>
            <div className={`text-sm font-bold tabular-nums ${parseFloat(emp.available_credit || '0') > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ₹{parseFloat(emp.available_credit || '0').toLocaleString('en-IN')}
            </div>
          </div>

          <div className="h-8 w-px bg-borderLine hidden sm:block" />

          <button
            onClick={handleSendWhatsAppBalance}
            disabled={waSending}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors disabled:opacity-50"
            title={`Dispatch WhatsApp balance statement to ${data.contact.mobile}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{waSending ? 'Sending...' : 'WhatsApp Balance'}</span>
          </button>
        </div>
      </div>

      {waNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{waNotice}</span>
          </div>
          <button onClick={() => setWaNotice(null)} className="text-emerald-700 font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* High-Efficiency Tabs Navigation */}
      <div className="bg-surface rounded-xl border border-borderLine p-1.5 shadow-subtle overflow-x-auto">
        <div className="flex space-x-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm ring-1 ring-primary/20'
                    : 'text-textSecondary hover:text-navy-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels Content */}
      <div className="space-y-6">
        {/* TAB 1: Cooperative Member Profile & Society Accounts */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Cooperative Key Metrics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              {/* Store Credit Status */}
              <div className="p-4 rounded-xl bg-surface border border-borderLine shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider">Credit Access</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-base font-extrabold text-navy-800">
                  {data.storeCredit.creditEnabled ? 'POS Authorized' : 'POS Blocked'}
                </div>
                <p className="text-[10px] text-textSecondary">
                  Cutoff on day {data.storeCredit.billingCycleDay || 25} of each month
                </p>
              </div>

              {/* Current Month POS Store Bills */}
              <div className="p-4 rounded-xl bg-surface border border-borderLine shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Current Month Bills</span>
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-base font-extrabold text-amber-900 tabular-nums">
                  {formatCurrency(emp.current_month_bills || 0)}
                </div>
                <p className="text-[10px] text-amber-700 font-medium">
                  Active POS store credit purchases
                </p>
              </div>

              {/* Share Capital */}
              <div className="p-4 rounded-xl bg-surface border border-borderLine shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Share Capital</span>
                  <Coins className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-base font-extrabold text-blue-900 tabular-nums">
                  {formatCurrency(emp.share_capital || 0)}
                </div>
                <p className="text-[10px] text-textSecondary">
                  Cooperative equity shares
                </p>
              </div>

              {/* Monthly Thrift */}
              <div className="p-4 rounded-xl bg-surface border border-borderLine shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Monthly Thrift</span>
                  <Landmark className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-base font-extrabold text-indigo-900 tabular-nums">
                  {formatCurrency(emp.thrift_deposit || 0)}
                </div>
                <p className="text-[10px] text-textSecondary">
                  Cum: {formatCurrency(emp.cum_thrift || 0)}
                </p>
              </div>

              {/* Domestic Advance */}
              <div className="p-4 rounded-xl bg-surface border border-borderLine shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Domestic Adv.</span>
                  <CreditCard className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-base font-extrabold text-rose-900 tabular-nums">
                  {formatCurrency(emp.domestic_balance || 0)}
                </div>
                <p className="text-[10px] text-textSecondary">
                  Appliance loan recovery
                </p>
              </div>

              {/* Total Net Store Outstanding */}
              <div className="p-4 rounded-xl bg-surface border border-borderLine shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-navy-800 uppercase tracking-wider">Total Outstanding</span>
                  <Receipt className="w-4 h-4 text-navy-700" />
                </div>
                <div className="text-base font-extrabold text-navy-900 tabular-nums">
                  {formatCurrency(emp.current_outstanding || 0)}
                </div>
                <p className="text-[10px] text-emerald-700 font-semibold">
                  Avail: {formatCurrency(emp.available_credit || 0)}
                </p>
              </div>
            </div>

            {/* Cooperative Society Accounts & FoxPro Balances Card */}
            <div className="bg-surface rounded-xl border border-amber-200 bg-amber-50/15 p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                <div>
                  <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                    <Landmark className="w-3.5 h-3.5 text-amber-700" />
                    <span>Cooperative Society Accounts & FoxPro Balances (EMPMAST.DBF)</span>
                  </h3>
                  <p className="text-[11px] text-textSecondary mt-0.5">
                    Member thrift, society capital, loans, advances and recovery heads synchronized from CFECC Stores database.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold">
                    CS #{emp.cs_no || '0'}
                  </span>
                  <span className="text-[10px] uppercase px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded font-bold">
                    {emp.category || 'WORKER'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Share Capital</span>
                  <span className="text-sm font-bold text-navy-800 tabular-nums font-mono">
                    {formatCurrency(emp.share_capital || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Society shareholding</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Cum. Thrift Fund</span>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums font-mono">
                    {formatCurrency(emp.cum_thrift || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Total thrift savings</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Monthly Thrift</span>
                  <span className="text-sm font-bold text-navy-800 tabular-nums font-mono">
                    {formatCurrency(emp.thrift_deposit || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Monthly deposit deduction</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Domestic Appliance Loan</span>
                  <span className="text-sm font-bold text-amber-700 tabular-nums font-mono">
                    {formatCurrency(emp.domestic_balance || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Consumer goods balance</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Festival Advance</span>
                  <span className="text-sm font-bold text-amber-700 tabular-nums font-mono">
                    {formatCurrency(emp.festival_advance_balance || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Festival advance balance</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Old Domestic Balance</span>
                  <span className="text-sm font-bold text-textSecondary tabular-nums font-mono">
                    {formatCurrency(emp.old_domestic_balance || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Prior domestic dues</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Unrecovered Dues</span>
                  <span className="text-sm font-bold text-rose-700 tabular-nums font-mono">
                    {formatCurrency(emp.unrecovered_dues || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Carried forward dues</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Current Month Store Bills</span>
                  <span className="text-sm font-bold text-primary tabular-nums font-mono">
                    {formatCurrency(emp.current_month_bills || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Active POS purchases</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Direct Bank/Cash Pay</span>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums font-mono">
                    {formatCurrency(emp.direct_receipt_payments || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Direct counter payments</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-textSecondary block text-[11px]">Total Net Outstandings</span>
                  <span className="text-sm font-bold text-amber-800 tabular-nums font-mono">
                    {formatCurrency(emp.current_outstanding || 0)}
                  </span>
                  <span className="text-[10px] text-textSecondary block mt-0.5">Live store credit due</span>
                </div>
              </div>
            </div>

            {/* Personal KYC & Cooperative Identity Details */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Personal KYC & Cooperative Identification Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditPersonalModalOpen(true)}
                  className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-textSecondary font-medium block">Full Member Name</span>
                  <span className="font-bold text-navy-800">{emp.first_name} {emp.last_name !== '.' ? emp.last_name : ''}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Member / Employee Code</span>
                  <span className="font-bold text-navy-800 font-mono">{emp.employee_code}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Society Share No (CS #)</span>
                  <span className="font-bold text-navy-800 font-mono">CS #{emp.cs_no || '0'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Corporate HR Number</span>
                  <span className="font-semibold text-navy-800 font-mono">{emp.hr_no || 'Not Assigned'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Member Category</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isStaff ? 'bg-purple-100 text-purple-800' : isSpecial ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isSpecial ? 'Special Institutional Account' : isStaff ? 'Staff (Management)' : 'Worker (Plant Operations)'}
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Organization / Unit</span>
                  <span className="font-semibold text-navy-800">Coromandel International Ltd</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Membership Status</span>
                  <span className="font-semibold text-emerald-700">Active Shareholder Member</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Joining Date</span>
                  <span className="font-semibold text-navy-800">{emp.joining_date || 'Not Recorded'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Date of Birth</span>
                  <span className="font-semibold text-navy-800">{emp.date_of_birth || 'Not Recorded'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Gender</span>
                  <span className="font-semibold text-navy-800">{emp.gender || 'Not Specified'}</span>
                </div>
              </div>
            </div>

            {/* Contact & Communication Channels */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Contact & Communication Channels</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditPersonalModalOpen(true)}
                  className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Contact Details</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-textSecondary font-medium block">Primary Mobile (WhatsApp Statements)</span>
                  <span className="font-bold text-navy-800 font-mono flex items-center space-x-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{data.contact.mobile}</span>
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Alternate Mobile</span>
                  <span className="font-semibold text-navy-800 font-mono">{data.contact.alternateMobile || 'None'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Official Email Address</span>
                  <span className="font-semibold text-navy-800">{data.contact.email || 'None'}</span>
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                  <span className="text-textSecondary font-medium block">Current Residential Address</span>
                  <span className="font-semibold text-navy-800">{data.contact.currentAddress || 'Visakhapatnam, Andhra Pradesh'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-textSecondary font-medium block">Permanent Legal Address</span>
                  <span className="font-semibold text-navy-800">{data.contact.permanentAddress || 'Visakhapatnam, Andhra Pradesh'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Store Credit & POS Limits */}
        {activeTab === 'credit' && (
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                <div>
                  <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    <span>Store Credit Account & POS Authorization</span>
                  </h3>
                  <p className="text-[11px] text-textSecondary mt-0.5">
                    Configure monthly credit limits, POS billing eligibility, and store credit cutoff.
                  </p>
                </div>
                {creditUpdateSuccess && (
                  <div className="text-xs text-status-success font-semibold flex items-center bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    <span>{creditUpdateSuccess}</span>
                  </div>
                )}
              </div>

              {/* Credit Meter */}
              <div className="p-4 bg-slate-50 rounded-lg border border-borderLine space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-navy-800">Live Credit Utilization</span>
                  <span className="font-mono font-bold text-textSecondary">
                    ₹{parseFloat(emp.current_outstanding || '0').toLocaleString('en-IN')} / ₹{parseFloat(emp.credit_limit || '0').toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (parseFloat(emp.current_outstanding || '0') / Math.max(1, parseFloat(emp.credit_limit || '1'))) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-textSecondary pt-1">
                  <span>Available Balance: <strong className="text-emerald-700 font-mono font-bold">₹{parseFloat(emp.available_credit || '0').toLocaleString('en-IN')}</strong></span>
                  <span>Cutoff: Day {data.storeCredit.billingCycleDay || 25} of each month</span>
                </div>
              </div>

              <div className="max-w-xl space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase mb-1">
                    Monthly Store Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none tabular-nums font-bold"
                  />
                  <p className="text-[11px] text-textSecondary mt-1">
                    Maximum credit ceiling allowed across a monthly billing cycle.
                  </p>
                </div>

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer p-2 bg-slate-50 rounded-lg border border-borderLine hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={creditEnabledInput}
                      onChange={(e) => setCreditEnabledInput(e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-borderLine"
                    />
                    <span className="text-xs font-bold text-navy-800">
                      Authorize Store Credit Purchases at POS Checkout
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleUpdateCredit}
                  disabled={isUpdatingCredit}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-subtle transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isUpdatingCredit ? 'Saving Changes...' : 'Save Credit Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Purchases & Store Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Live Store Credit Quick Summary Banner */}
            <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 rounded-lg bg-white/10 text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-300 font-medium">CFECC Member Store Balance</div>
                  <div className="flex items-center space-x-3 text-sm mt-0.5">
                    <span>Limit: <strong className="font-mono font-bold text-white">₹{parseFloat(emp.credit_limit || '0').toLocaleString('en-IN')}</strong></span>
                    <span>&bull;</span>
                    <span>Outstanding: <strong className="font-mono font-bold text-amber-300">₹{parseFloat(emp.current_outstanding || '0').toLocaleString('en-IN')}</strong></span>
                    <span>&bull;</span>
                    <span>Available: <strong className="font-mono font-bold text-emerald-300">₹{parseFloat(emp.available_credit || '0').toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSendWhatsAppBalance}
                disabled={waSending}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{waSending ? 'Sending...' : 'Send WhatsApp Statement'}</span>
              </button>
            </div>

            {/* POS Purchase History Table */}
            <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-borderLine bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                  <span>POS Store Purchase History ({data.purchases?.length || 0})</span>
                </h3>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                    <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                      <th className="py-2.5 px-4">Invoice #</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Items Count</th>
                      <th className="py-2.5 px-4">Payment Tender</th>
                      <th className="py-2.5 px-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine">
                    {(data.purchases || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-textSecondary">
                          No store purchases recorded yet for this member.
                        </td>
                      </tr>
                    ) : (
                      (data.purchases || []).map((sale: any) => (
                        <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors whitespace-nowrap">
                          <td className="py-2.5 px-4 font-mono font-bold text-navy-800">{sale.invoice_number}</td>
                          <td className="py-2.5 px-4 text-textSecondary">{new Date(sale.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="py-2.5 px-4">{sale.item_count} items</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-navy-800">
                              {sale.payment_mode}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-navy-800 tabular-nums font-mono">
                            {formatCurrency(sale.total_amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Double-Entry Store Credit Ledger */}
            <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-borderLine bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Receipt className="w-3.5 h-3.5 text-primary" />
                  <span>Double-Entry Member Store Ledger & Recoveries</span>
                </h3>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                    <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Transaction Type</th>
                      <th className="py-2.5 px-4">Reference ID</th>
                      <th className="py-2.5 px-4 text-right">Debit (+)</th>
                      <th className="py-2.5 px-4 text-right">Credit (-)</th>
                      <th className="py-2.5 px-4 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine font-mono">
                    {(data.billing?.ledger || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-textSecondary font-sans">
                          No ledger postings logged yet for this member.
                        </td>
                      </tr>
                    ) : (
                      (data.billing?.ledger || []).map((entry: any, idx: number) => (
                        <tr key={`${entry.id || 'led'}-${idx}`} className="hover:bg-slate-50/70 transition-colors whitespace-nowrap">
                          <td className="py-2.5 px-4 text-textSecondary font-sans">
                            {new Date(entry.transaction_date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 font-sans font-semibold text-navy-800">{entry.transaction_type}</td>
                          <td className="py-2.5 px-4 text-textSecondary">{entry.reference_id || '-'}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-rose-700">
                            {parseFloat(entry.debit_amount) > 0 ? formatCurrency(entry.debit_amount) : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                            {parseFloat(entry.credit_amount) > 0 ? formatCurrency(entry.credit_amount) : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-navy-800">
                            {formatCurrency(entry.running_balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Salary & Bank Details */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {/* Salary Structure Card */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  <span>Salary Structure & Monthly Allowances</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditSalaryModalOpen(true)}
                  className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Update Salary Structure</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-textSecondary block text-[11px]">Basic Salary</span>
                  <span className="text-sm font-bold text-navy-800 tabular-nums font-mono">
                    ₹{parseFloat(data.salary?.basic_salary || '25000').toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-textSecondary block text-[11px]">DA</span>
                  <span className="text-sm font-bold text-navy-800 tabular-nums font-mono">
                    ₹{parseFloat(data.salary?.da || '5000').toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-textSecondary block text-[11px]">HRA</span>
                  <span className="text-sm font-bold text-navy-800 tabular-nums font-mono">
                    ₹{parseFloat(data.salary?.hra || '6000').toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-textSecondary block text-[11px]">Other Allowances</span>
                  <span className="text-sm font-bold text-navy-800 tabular-nums font-mono">
                    ₹{parseFloat(data.salary?.other_allowances || '2000').toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-emerald-800 block text-[11px] font-bold">Gross Monthly</span>
                  <span className="text-sm font-black text-emerald-900 tabular-nums font-mono">
                    ₹{data.salary ? (parseFloat(data.salary.basic_salary) + parseFloat(data.salary.da) + parseFloat(data.salary.hra) + parseFloat(data.salary.other_allowances)).toLocaleString('en-IN') : '38,000'}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="text-rose-800 block text-[11px] font-bold">Statutory Deductions</span>
                  <span className="text-sm font-black text-rose-900 tabular-nums font-mono">
                    ₹{parseFloat(data.salary?.statutory_deductions || '2400').toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Details Card */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>Authorized Bank Account for Salary / Recovery</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditBankModalOpen(true)}
                  className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Update Bank Details</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-textSecondary font-medium block">Bank Name</span>
                  <span className="font-bold text-navy-800">{data.bank?.bank_name || 'State Bank of India'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Account Number</span>
                  <span className="font-bold text-navy-800 font-mono">{data.bank?.account_number || '30129485739'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">IFSC Code</span>
                  <span className="font-bold text-navy-800 font-mono">{data.bank?.ifsc_code || 'SBIN0001234'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Branch</span>
                  <span className="font-semibold text-navy-800">{data.bank?.branch || 'Visakhapatnam'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Documents & KYC */}
        {activeTab === 'documents' && (
          <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>KYC & Membership Documents</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadDocModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-subtle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Attach Document</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(data.documents || []).length === 0 ? (
                <div className="col-span-full py-8 text-center text-textSecondary text-xs">
                  No verified KYC documents attached yet for this member.
                </div>
              ) : (
                (data.documents || []).map((doc: any) => (
                  <div key={doc.id} className="p-3 rounded-lg border border-borderLine bg-slate-50 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <div className="font-bold text-navy-800">{doc.document_name}</div>
                        <div className="text-[10px] text-textSecondary uppercase font-mono">{doc.document_type}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1 text-slate-400 hover:text-status-danger transition-colors"
                      title="Remove document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: Activity & Audit Log */}
        {activeTab === 'activity' && (
          <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
            <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine flex items-center space-x-2">
              <History className="w-3.5 h-3.5 text-primary" />
              <span>Audit Trail & Activity Log</span>
            </h3>
            <div className="space-y-2">
              {(data.activity || []).length === 0 ? (
                <div className="py-8 text-center text-textSecondary text-xs">
                  No audit log records tracked for this member yet.
                </div>
              ) : (
                (data.activity || []).map((act: any) => (
                  <div key={act.id} className="p-3 rounded-lg border border-borderLine bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-navy-800">{act.action} by {act.user_name || 'System Administrator'}</div>
                      <div className="text-[11px] text-textSecondary font-mono">{new Date(act.created_at).toLocaleString('en-IN')}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                      {act.entity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Personal & Cooperative Member Details Modal */}
      <Modal
        isOpen={isEditPersonalModalOpen}
        onClose={() => setIsEditPersonalModalOpen(false)}
        title="Edit Member & Contact Details"
        subtitle={`Update cooperative record for ${emp.first_name} ${emp.last_name !== '.' ? emp.last_name : ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSavePersonal} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">First Name *</label>
              <input
                type="text"
                required
                value={personalForm.firstName}
                onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Last Name</label>
              <input
                type="text"
                value={personalForm.lastName}
                onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Society Share No (CS #)</label>
              <input
                type="text"
                value={personalForm.csNo}
                onChange={(e) => setPersonalForm({ ...personalForm, csNo: e.target.value })}
                placeholder="e.g. 1440 or 0"
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Grade (Co-op Class)</label>
              <select
                value={personalForm.grade}
                onChange={(e) => {
                  const g = e.target.value;
                  const cat = g === 'M' ? 'STAFF' : g === 'NM' ? 'WORKER' : 'SPECIAL';
                  setPersonalForm({ ...personalForm, grade: g, category: cat });
                }}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-medium"
              >
                <option value="M">M - Management</option>
                <option value="NM">NM - Non Management</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Corporate HR ID</label>
              <input
                type="text"
                value={personalForm.hrNo}
                onChange={(e) => setPersonalForm({ ...personalForm, hrNo: e.target.value })}
                placeholder="e.g. 10000973"
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">WhatsApp Mobile *</label>
              <input
                type="tel"
                required
                value={personalForm.mobile}
                onChange={(e) => setPersonalForm({ ...personalForm, mobile: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-textSecondary uppercase mb-1">Official Email</label>
              <input
                type="email"
                value={personalForm.email}
                onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-textSecondary uppercase mb-1">Residential Address</label>
              <textarea
                rows={2}
                value={personalForm.currentAddress}
                onChange={(e) => setPersonalForm({ ...personalForm, currentAddress: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsEditPersonalModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle"
            >
              Save Member Details
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Salary Modal */}
      <Modal
        isOpen={isEditSalaryModalOpen}
        onClose={() => setIsEditSalaryModalOpen(false)}
        title="Update Salary Structure"
        subtitle={`Set approved compensation components for ${emp.first_name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveSalary} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              Basic Salary (₹) <span className="text-[10px] font-normal lowercase text-textSecondary">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={salaryForm.basicSalary || ''}
              onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white font-bold tabular-nums"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">DA (₹)</label>
            <input
              type="number"
              value={salaryForm.da}
              onChange={(e) => setSalaryForm({ ...salaryForm, da: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white tabular-nums"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">HRA (₹)</label>
            <input
              type="number"
              value={salaryForm.hra}
              onChange={(e) => setSalaryForm({ ...salaryForm, hra: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white tabular-nums"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Other Allowances (₹)</label>
            <input
              type="number"
              value={salaryForm.otherAllowances}
              onChange={(e) => setSalaryForm({ ...salaryForm, otherAllowances: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white tabular-nums"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsEditSalaryModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle"
            >
              Update Salary
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Bank Modal */}
      <Modal
        isOpen={isEditBankModalOpen}
        onClose={() => setIsEditBankModalOpen(false)}
        title="Update Bank Details"
        subtitle={`Authorized disbursement account for ${emp.first_name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveBank} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Account Holder Name *</label>
            <input
              type="text"
              required
              value={bankForm.accountHolderName}
              onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Bank Name *</label>
            <input
              type="text"
              required
              value={bankForm.bankName}
              onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Account Number *</label>
            <input
              type="text"
              required
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">IFSC Code *</label>
            <input
              type="text"
              required
              value={bankForm.ifscCode}
              onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white font-mono uppercase"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsEditBankModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle"
            >
              Save Bank Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadDocModalOpen}
        onClose={() => setIsUploadDocModalOpen(false)}
        title="Attach KYC / Membership Document"
        subtitle={`Upload verified records for ${emp.first_name}`}
        maxWidth="md"
      >
        <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Document Type *</label>
            <select
              value={docForm.documentType}
              onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white"
            >
              <option value="AADHAAR">Aadhaar Card</option>
              <option value="PAN">PAN Card</option>
              <option value="SHARE_CERTIFICATE">Cooperative Share Certificate</option>
              <option value="APPOINTMENT_LETTER">Appointment Letter</option>
              <option value="PHOTO">Passport Photograph</option>
              <option value="OTHER">Other Supporting Document</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Document Title / File Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Share_Certificate_CS1440.pdf"
              value={docForm.documentName}
              onChange={(e) => setDocForm({ ...docForm, documentName: e.target.value })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsUploadDocModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle"
            >
              Attach Document
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
