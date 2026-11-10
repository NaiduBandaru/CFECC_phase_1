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

  // Credit configuration state for Tab 7
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
        setWaNotice(res.data.message || 'WhatsApp balance dispatched!');
      } else {
        alert(res.data.message || 'Failed to dispatch WhatsApp statement');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send WhatsApp message');
    } finally {
      setWaSending(false);
    }
  };

  // Edit Personal & Contact Modal
  const [isEditPersonalModalOpen, setIsEditPersonalModalOpen] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    lastName: '',
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

        setPersonalForm({
          firstName: emp.personal.firstName,
          lastName: emp.personal.lastName,
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

  // Update Store Credit (Tab 7)
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

  // Save Personal & Contact Details (Tabs 2 & 3)
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/employees/${id}`, personalForm);
      if (res.data.success) {
        setIsEditPersonalModalOpen(false);
        fetchEmployeeProfile(id!);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update details');
    }
  };

  // Save Salary Structure (Tab 5)
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

  // Save Bank Details (Tab 6)
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

  // Upload Document (Tab 8)
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

  // Delete Document (Tab 8)
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
    { id: 'profile', label: 'Profile & Employment', icon: User, count: null },
    { id: 'finance', label: 'Finance & Store Credit', icon: IndianRupee, count: null },
    {
      id: 'ledger',
      label: 'Purchases & Store Ledger',
      icon: ShoppingBag,
      count: (data?.purchases?.length || 0) + (data?.billing?.ledger?.length || 0),
    },
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
        <h3 className="text-base font-bold text-navy-800">Employee Profile Error</h3>
        <p className="text-xs text-textSecondary mt-1">{error || 'Record could not be found'}</p>
        <button
          onClick={() => navigate('/employees')}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold"
        >
          Return to Employee Directory
        </button>
      </div>
    );
  }

  const emp = data.overview;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/employees')}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-textSecondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Master</span>
        </button>
      </div>

      {/* Header Profile Card */}
      <div className="bg-surface rounded-cfecc border border-borderLine p-6 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-navy-800 text-white flex items-center justify-center text-2xl font-bold uppercase shadow-sm">
            {emp.first_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-navy-800">
                {emp.first_name} {emp.last_name}
              </h2>
              <StatusBadge status={emp.employment_status} />
            </div>
            <div className="flex items-center space-x-3 text-xs text-textSecondary mt-1">
              <span className="font-mono font-semibold text-primary">{emp.employee_code}</span>
              <span>&bull;</span>
              <span>{emp.department_name || 'Administration & Management'}</span>
              <span>&bull;</span>
              <span>{emp.designation_title || 'General Manager'}</span>
            </div>
          </div>
        </div>

        {/* Live Credit Summary Box */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-lg border border-borderLine w-full md:w-auto">
          <div className="text-right">
            <div className="text-[10px] font-bold text-textSecondary uppercase tracking-wider">Credit Limit</div>
            <div className="text-sm font-bold text-navy-800 tabular-nums">
              ₹{parseFloat(emp.credit_limit).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="h-8 w-px bg-borderLine" />

          <div className="text-right">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Outstanding</div>
            <div className="text-sm font-bold text-amber-700 tabular-nums">
              ₹{parseFloat(emp.current_outstanding).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="h-8 w-px bg-borderLine" />

          <div className="text-right">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Available</div>
            <div className="text-sm font-bold text-emerald-700 tabular-nums">
              ₹{parseFloat(emp.available_credit).toLocaleString('en-IN')}
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

      {/* Consolidated High-Efficiency Tabs Navigation */}
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
        {/* TAB 1: Profile & Employment (Overview + Personal + Contact + Employment) */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Executive Profile Summary */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine">
                Executive Profile Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-borderLine space-y-2">
                  <span className="text-xs text-textSecondary font-semibold">Store Credit Status</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-navy-800">
                      {data.storeCredit.creditEnabled ? 'Authorized for Store Credit' : 'Store Credit Blocked'}
                    </span>
                    <StatusBadge status={data.storeCredit.creditEnabled ? 'ACTIVE' : 'SUSPENDED'} />
                  </div>
                  <p className="text-[11px] text-textSecondary">
                    Billing cycle cutoff on day {data.storeCredit.billingCycleDay} of each month.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-borderLine space-y-2">
                  <span className="text-xs text-textSecondary font-semibold">Base Monthly Gross</span>
                  <div className="text-sm font-bold text-navy-800 tabular-nums">
                    ₹{data.salary ? (parseFloat(data.salary.basic_salary) + parseFloat(data.salary.da) + parseFloat(data.salary.hra)).toLocaleString('en-IN') : '25,000'}
                  </div>
                  <p className="text-[11px] text-textSecondary">
                    Store purchase recovery is auto-deducted from gross monthly salary.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-borderLine space-y-2">
                  <span className="text-xs text-textSecondary font-semibold">Recent Store Activity</span>
                  <div className="text-sm font-bold text-navy-800">
                    {data.purchases?.length || 0} Transactions
                  </div>
                  <p className="text-[11px] text-textSecondary">
                    Lifetime purchase records logged via CFECC POS terminal.
                  </p>
                </div>
              </div>
            </div>

            {/* Personal KYC Details */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Personal KYC & Identity Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditPersonalModalOpen(true)}
                  className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Personal Details</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-textSecondary font-medium block">Full Legal Name</span>
                  <span className="font-bold text-navy-800">{data.personal.firstName} {data.personal.lastName}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Employee Code</span>
                  <span className="font-bold text-navy-800 font-mono">{data.personal.employeeCode}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Date of Birth</span>
                  <span className="font-semibold text-navy-800">{data.personal.dateOfBirth || 'Not Recorded'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Gender</span>
                  <span className="font-semibold text-navy-800">{data.personal.gender || 'Not Specified'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Marital Status</span>
                  <span className="font-semibold text-navy-800">{data.personal.maritalStatus || 'Single'}</span>
                </div>
              </div>
            </div>

            {/* Contact & Address Information */}
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

            {/* Employment & Organization Profile */}
            <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
              <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine flex items-center space-x-2">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                <span>Employment & Organization Profile</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                <div>
                  <span className="text-textSecondary font-medium block">Department</span>
                  <span className="font-bold text-navy-800">{data.employment.departmentName || 'Administration & Management'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Designation</span>
                  <span className="font-bold text-navy-800">{data.employment.designationTitle || 'General Manager'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Joining Date</span>
                  <span className="font-semibold text-navy-800">{data.employment.joiningDate}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Employment Type</span>
                  <span className="font-semibold text-navy-800">{data.employment.employmentType}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Reporting Manager</span>
                  <span className="font-semibold text-navy-800">{data.employment.managerName || 'General Manager'}</span>
                </div>
                <div>
                  <span className="text-textSecondary font-medium block">Employment Status</span>
                  <StatusBadge status={data.employment.employmentStatus} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Finance & Store Credit (Store Credit Limits + Salary + Bank Details) */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {/* Store Credit Configuration Card */}
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
                    ₹{parseFloat(emp.current_outstanding).toLocaleString('en-IN')} / ₹{parseFloat(emp.credit_limit).toLocaleString('en-IN')}
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
                  <span>Available Balance: <strong className="text-emerald-700 font-mono font-bold">₹{parseFloat(emp.available_credit).toLocaleString('en-IN')}</strong></span>
                  <span>Cutoff: Day {data.storeCredit.billingCycleDay} of each month</span>
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
                  <span className="text-textSecondary block text-[11px]">Dearness Allowance (DA)</span>
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
                  <span>Authorized Bank Account for Salary Disbursement</span>
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

        {/* TAB 3: Purchases & Store Ledger (POS Invoices + Double-Entry Ledger) */}
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
                    <span>Limit: <strong className="font-mono font-bold text-white">₹{parseFloat(emp.credit_limit).toLocaleString('en-IN')}</strong></span>
                    <span>&bull;</span>
                    <span>Outstanding: <strong className="font-mono font-bold text-amber-300">₹{parseFloat(emp.current_outstanding).toLocaleString('en-IN')}</strong></span>
                    <span>&bull;</span>
                    <span>Available: <strong className="font-mono font-bold text-emerald-300">₹{parseFloat(emp.available_credit).toLocaleString('en-IN')}</strong></span>
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

            {/* POS Purchase History Table with Standard Format */}
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
                    <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
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
                        <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
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

            {/* Double-Entry Store Credit Ledger with Standard Format */}
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
                    <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
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
                      (data.billing?.ledger || []).map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
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

        {/* TAB 4: Documents & KYC (Documents) */}
        {activeTab === 'documents' && (
          <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>KYC & Employment Documents</span>
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

            {data.documents?.length === 0 ? (
              <div className="text-xs text-textSecondary py-4">No uploaded documents on record. Click &lsquo;Attach Document&rsquo; to add.</div>
            ) : (
              <div className="divide-y divide-borderLine">
                {data.documents?.map((doc: any) => (
                  <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-navy-800">{doc.document_name}</span>
                      <span className="text-textSecondary ml-2 font-mono">({doc.document_type})</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-primary font-semibold hover:underline cursor-pointer">View / Download</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-slate-400 hover:text-status-danger transition-colors p-1"
                        title="Remove Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Activity & Audit Log (Activity History) */}
        {activeTab === 'activity' && (
          <div className="bg-surface rounded-xl border border-borderLine p-5 shadow-subtle space-y-4">
            <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine flex items-center space-x-2">
              <History className="w-3.5 h-3.5 text-primary" />
              <span>Audit Logs & Action Trail</span>
            </h3>
            <div className="divide-y divide-borderLine">
              {(data.activity || []).length === 0 ? (
                <div className="text-xs text-textSecondary py-4">No audit logs recorded for this employee profile.</div>
              ) : (
                (data.activity || []).map((act: any) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-navy-800">{act.action}</span>
                      <span className="text-textSecondary ml-2">by {act.user_name || 'System Admin'}</span>
                    </div>
                    <span className="text-textSecondary font-mono text-[11px]">
                      {new Date(act.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Personal & Contact Details Modal */}
      <Modal
        isOpen={isEditPersonalModalOpen}
        onClose={() => setIsEditPersonalModalOpen(false)}
        title="Edit Personal & Contact Details"
        subtitle={`Update employee record for ${emp.first_name} ${emp.last_name}`}
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
              <label className="block font-semibold text-textSecondary uppercase mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={personalForm.lastName}
                onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                value={personalForm.mobile}
                onChange={(e) => setPersonalForm({ ...personalForm, mobile: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Alternate Mobile</label>
              <input
                type="tel"
                value={personalForm.alternateMobile}
                onChange={(e) => setPersonalForm({ ...personalForm, alternateMobile: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-textSecondary uppercase mb-1">Email</label>
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
              Save Changes
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
            <label className="block font-semibold text-textSecondary uppercase mb-1">Basic Salary (₹) *</label>
            <input
              type="number"
              required
              value={salaryForm.basicSalary}
              onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white font-bold tabular-nums"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Dearness Allowance (DA) (₹)</label>
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
        title="Attach KYC / Employment Document"
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
              placeholder="e.g. Aadhaar_Rajesh_Varma.pdf"
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
