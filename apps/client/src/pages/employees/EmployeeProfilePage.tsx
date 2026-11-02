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
  Upload,
  Trash2,
  Plus,
} from 'lucide-react';

export const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<number>(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Credit configuration state for Tab 7
  const [creditLimitInput, setCreditLimitInput] = useState<number>(10000);
  const [creditEnabledInput, setCreditEnabledInput] = useState<boolean>(true);
  const [isUpdatingCredit, setIsUpdatingCredit] = useState<boolean>(false);
  const [creditUpdateSuccess, setCreditUpdateSuccess] = useState<string | null>(null);

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
    { id: 1, label: 'Overview', icon: User },
    { id: 2, label: 'Personal Information', icon: User },
    { id: 3, label: 'Contact Details', icon: Phone },
    { id: 4, label: 'Employment', icon: Briefcase },
    { id: 5, label: 'Salary Information', icon: IndianRupee },
    { id: 6, label: 'Bank Details', icon: Building2 },
    { id: 7, label: 'Store Credit', icon: CreditCard },
    { id: 8, label: 'Documents', icon: FileText },
    { id: 9, label: 'Purchase History', icon: ShoppingBag },
    { id: 10, label: 'Billing & Recovery', icon: Receipt },
    { id: 11, label: 'Activity History', icon: History },
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
              <span>{emp.department_name || 'Administration'}</span>
              <span>&bull;</span>
              <span>{emp.designation_title || 'Staff'}</span>
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
        </div>
      </div>

      {/* 11 Tabs Navigation */}
      <div className="bg-surface rounded-cfecc border border-borderLine p-1 shadow-subtle overflow-x-auto">
        <div className="flex space-x-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-textSecondary hover:text-navy-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels Content */}
      <div className="bg-surface rounded-cfecc border border-borderLine p-6 shadow-subtle">
        {/* Tab 1: Overview */}
        {activeTab === 1 && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine">
              Executive Profile Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg bg-slate-50 border border-borderLine space-y-2">
                <span className="text-xs text-textSecondary font-semibold">Store Credit Status</span>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-navy-800">
                    {data.storeCredit.creditEnabled ? 'Authorized for Store Credit' : 'Store Credit Blocked'}
                  </span>
                  <StatusBadge status={data.storeCredit.creditEnabled ? 'ACTIVE' : 'SUSPENDED'} />
                </div>
                <p className="text-xs text-textSecondary">
                  Billing cycle cutoff on day {data.storeCredit.billingCycleDay} of each month.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-borderLine space-y-2">
                <span className="text-xs text-textSecondary font-semibold">Base Monthly Gross</span>
                <div className="text-base font-bold text-navy-800 tabular-nums">
                  ₹{data.salary ? (parseFloat(data.salary.basic_salary) + parseFloat(data.salary.da) + parseFloat(data.salary.hra)).toLocaleString('en-IN') : '25,000'}
                </div>
                <p className="text-xs text-textSecondary">
                  Store purchase recovery is auto-deducted from gross monthly salary.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-borderLine space-y-2">
                <span className="text-xs text-textSecondary font-semibold">Recent Store Activity</span>
                <div className="text-base font-bold text-navy-800">
                  {data.purchases?.length || 0} Transactions
                </div>
                <p className="text-xs text-textSecondary">
                  Lifetime purchase records logged via CFECC POS terminal.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Personal Information */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
                Personal KYC Details
              </h3>
              <button
                onClick={() => setIsEditPersonalModalOpen(true)}
                className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Personal Details</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-textSecondary font-medium block">Full Legal Name</span>
                <span className="font-semibold text-navy-800">{data.personal.firstName} {data.personal.lastName}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Employee Code</span>
                <span className="font-semibold text-navy-800 font-mono">{data.personal.employeeCode}</span>
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
        )}

        {/* Tab 3: Contact Details */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
                Contact & Address Information
              </h3>
              <button
                onClick={() => setIsEditPersonalModalOpen(true)}
                className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Contact Details</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-textSecondary font-medium block">Primary Mobile (WhatsApp Statements)</span>
                <span className="font-semibold text-navy-800">{data.contact.mobile}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Alternate Mobile</span>
                <span className="font-semibold text-navy-800">{data.contact.alternateMobile || 'None'}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Official Email Address</span>
                <span className="font-semibold text-navy-800">{data.contact.email || 'None'}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Current Residential Address</span>
                <span className="font-semibold text-navy-800">{data.contact.currentAddress || 'Visakhapatnam, Andhra Pradesh'}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Permanent Address</span>
                <span className="font-semibold text-navy-800">{data.contact.permanentAddress || 'Visakhapatnam, Andhra Pradesh'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Employment */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine">
              Employment Records
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-textSecondary font-medium block">Department</span>
                <span className="font-semibold text-navy-800">{data.employment.departmentName || 'Administration'}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Designation</span>
                <span className="font-semibold text-navy-800">{data.employment.designationTitle || 'Staff'}</span>
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
        )}

        {/* Tab 5: Salary Information */}
        {activeTab === 5 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
                Salary Structure & Allowances
              </h3>
              <button
                onClick={() => setIsEditSalaryModalOpen(true)}
                className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Update Salary Structure</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-textSecondary block">Basic Salary</span>
                <span className="text-sm font-bold text-navy-800 tabular-nums">
                  ₹{parseFloat(data.salary?.basic_salary || '25000').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-textSecondary block">Dearness Allowance (DA)</span>
                <span className="text-sm font-bold text-navy-800 tabular-nums">
                  ₹{parseFloat(data.salary?.da || '5000').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-textSecondary block">HRA</span>
                <span className="text-sm font-bold text-navy-800 tabular-nums">
                  ₹{parseFloat(data.salary?.hra || '6000').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-textSecondary block">Other Allowances</span>
                <span className="text-sm font-bold text-navy-800 tabular-nums">
                  ₹{parseFloat(data.salary?.other_allowances || '2000').toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Bank Details */}
        {activeTab === 6 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
                Authorized Bank Account
              </h3>
              <button
                onClick={() => setIsEditBankModalOpen(true)}
                className="flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Update Bank Details</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-textSecondary font-medium block">Bank Name</span>
                <span className="font-semibold text-navy-800">{data.bank?.bank_name || 'State Bank of India'}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">Account Number</span>
                <span className="font-semibold text-navy-800 font-mono">{data.bank?.account_number || '30129485739'}</span>
              </div>
              <div>
                <span className="text-textSecondary font-medium block">IFSC Code</span>
                <span className="font-semibold text-navy-800 font-mono">{data.bank?.ifsc_code || 'SBIN0001234'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Store Credit Configuration */}
        {activeTab === 7 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
                Store Credit Account & Limits
              </h3>
              {creditUpdateSuccess && (
                <div className="text-xs text-status-success font-semibold flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  {creditUpdateSuccess}
                </div>
              )}
            </div>

            <div className="max-w-xl space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy-800 uppercase mb-1">
                  Monthly Store Credit Limit (₹)
                </label>
                <input
                  type="number"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none tabular-nums font-bold"
                />
                <p className="text-[11px] text-textSecondary mt-1">
                  Maximum credit allowed across a monthly billing cycle.
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={creditEnabledInput}
                    onChange={(e) => setCreditEnabledInput(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-borderLine"
                  />
                  <span className="text-xs font-semibold text-navy-800">
                    Authorize Store Credit Purchases at POS
                  </span>
                </label>
              </div>

              <button
                onClick={handleUpdateCredit}
                disabled={isUpdatingCredit}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-subtle transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isUpdatingCredit ? 'Saving Changes...' : 'Save Credit Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 8: Documents */}
        {activeTab === 8 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-borderLine">
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
                KYC & Employment Documents
              </h3>
              <button
                onClick={() => setIsUploadDocModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-subtle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Attach Document</span>
              </button>
            </div>

            {data.documents?.length === 0 ? (
              <div className="text-xs text-textSecondary py-4">No uploaded documents on record. Click 'Attach Document' to add.</div>
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

        {/* Tab 9: Purchase History */}
        {activeTab === 9 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine">
              POS Store Purchase History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {(data.purchases || []).map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-navy-800">{sale.invoice_number}</td>
                      <td className="py-2.5 px-3 text-textSecondary">{new Date(sale.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3">{sale.item_count} items</td>
                      <td className="py-2.5 px-3">{sale.payment_mode}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-navy-800 tabular-nums">
                        ₹{parseFloat(sale.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 10: Billing & Recovery */}
        {activeTab === 10 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine">
                Double-Entry Store Ledger
              </h3>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Transaction</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3 text-right">Debit (+)</th>
                      <th className="py-2.5 px-3 text-right">Credit (-)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine font-mono">
                    {(data.billing?.ledger || []).map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-textSecondary font-sans">
                          {new Date(entry.transaction_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-navy-800">{entry.transaction_type}</td>
                        <td className="py-2.5 px-3 text-textSecondary">{entry.reference_id || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-rose-700">
                          {parseFloat(entry.debit_amount) > 0 ? `₹${parseFloat(entry.debit_amount).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                          {parseFloat(entry.credit_amount) > 0 ? `₹${parseFloat(entry.credit_amount).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-navy-800">
                          ₹{parseFloat(entry.running_balance).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 11: Activity History */}
        {activeTab === 11 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy-800 uppercase tracking-wider pb-2 border-b border-borderLine">
              Audit Logs & Action Trail
            </h3>
            <div className="divide-y divide-borderLine">
              {(data.activity || []).map((act: any) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-navy-800">{act.action}</span>
                    <span className="text-textSecondary ml-2">by {act.user_name || 'System Admin'}</span>
                  </div>
                  <span className="text-textSecondary">
                    {new Date(act.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
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
