import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Employee } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import { FloatingActionBar } from '../../components/ui/FloatingActionBar.js';
import { TablePagination } from '../../components/ui/TablePagination.js';
import {
  Users,
  Search,
  Plus,
  Download,
  Upload,
  ChevronRight,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  SlidersHorizontal,
  MessageSquare,
  Coins,
  Landmark,
  ShoppingCart,
  CreditCard,
  ShieldCheck,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface MembersSummary {
  totalMembers: number;
  workersCount: number;
  staffCount: number;
  specialCount: number;
  totalShareCapital: number;
  totalCumThrift: number;
  totalMonthlyThrift: number;
  totalMonthBills: number;
  totalDomesticAdvance: number;
  totalFestivalAdvance: number;
  totalOutstanding: number;
  totalCreditLimit: number;
  totalAvailableCredit: number;
}

export const EmployeeDirectoryPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [summary, setSummary] = useState<MembersSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters, Search & Sorting
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [creditEligibility, setCreditEligibility] = useState<string>('ALL');
  const [departmentId, setDepartmentId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('e.id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Column Visibility State for CFECC Cooperative Fields
  const [columnVisibility, setColumnVisibility] = useState({
    csNo: true,
    hrNo: true,
    category: true,
    shareCapital: true,
    monthlyThrift: true,
    monthBills: true,
    domesticAdvance: true,
    creditLimit: true,
    outstanding: true,
    available: true,
    creditStatus: true,
    status: true,
  });
  const [showColMenu, setShowColMenu] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Add Employee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    employeeCode: '',
    csNo: '',
    grade: 'NM',
    hrNo: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    mobile: '',
    alternateMobile: '',
    email: '',
    currentAddress: '',
    departmentId: '',
    designationId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    creditEnabled: true,
    creditLimit: 10000,
    basicSalary: 0,
    da: 0,
    hra: 0,
    otherAllowances: 0,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<any | null>(null);

  // Quick Balance Enquiry Modal State (SALBAL.DBF lookup)
  const [isQuickLookupOpen, setIsQuickLookupOpen] = useState(false);
  const [quickLookupQuery, setQuickLookupQuery] = useState('');
  const [quickLookupResults, setQuickLookupResults] = useState<Employee[]>([]);
  const [selectedQuickMember, setSelectedQuickMember] = useState<Employee | null>(null);
  const [isSearchingQuick, setIsSearchingQuick] = useState(false);

  const [waSendingId, setWaSendingId] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchDepartments();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, category, balanceFilter, status, creditEligibility, departmentId, sortBy, sortOrder, pagination.page, pagination.limit]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/employees/departments');
      if (res.data.success) {
        setDepartments(res.data.departments || []);
        setDesignations(res.data.designations || []);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/employees/summary');
      if (res.data.success) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load members summary', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        category,
        balanceFilter,
        status,
        creditEligibility,
        departmentId,
        sortBy,
        sortOrder,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      const res = await api.get(`/employees?${params.toString()}`);
      if (res.data.success) {
        setEmployees(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = async (val: string) => {
    setQuickLookupQuery(val);
    const query = val.trim();
    if (!query) {
      setQuickLookupResults([]);
      setSelectedQuickMember(null);
      return;
    }
    try {
      setIsSearchingQuick(true);
      const res = await api.get(`/employees?search=${encodeURIComponent(query)}&limit=8`);
      if (res.data.success) {
        const list = res.data.data || [];
        setQuickLookupResults(list);
        if (list.length === 1) {
          setSelectedQuickMember(list[0]);
        }
      }
    } catch (err) {
      console.error('Quick lookup search error:', err);
    } finally {
      setIsSearchingQuick(false);
    }
  };

  const handleQuickWhatsAppBalance = async (emp: Employee) => {
    try {
      setWaSendingId(emp.id);
      setMessage(null);
      const res = await api.post('/whatsapp/send-employee-balance', {
        employeeId: emp.id,
      });
      if (res.data.success) {
        setMessage({
          type: 'success',
          text: res.data.message || `Live store credit balance notice dispatched to ${emp.first_name} (${emp.mobile}) via WhatsApp!`,
        });
      } else {
        setMessage({
          type: 'error',
          text: res.data.message || 'Failed to dispatch WhatsApp statement',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to dispatch message',
      });
    } finally {
      setWaSendingId(null);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
  };

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkAction = async (action: 'SET_CREDIT' | 'SET_STATUS', value: any) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    setMessage(null);
    try {
      const res = await api.post('/employees/bulk-action', {
        employeeIds: selectedIds,
        action,
        value,
      });
      if (res.data.success) {
        setMessage({
          type: 'success',
          text: res.data.message || `Bulk action applied to ${selectedIds.length} member accounts.`,
        });
        setSelectedIds([]);
        fetchEmployees();
        fetchSummary();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Bulk action failed',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const grade = addForm.grade || 'NM';
      const category = grade === 'M' ? 'STAFF' : grade === 'NM' ? 'WORKER' : 'SPECIAL';
      const othersDept = departments.find((d) => d.name.toLowerCase() === 'others' || d.name.toLowerCase() === 'other');
      const othersDesig = designations.find((des) => des.title.toLowerCase() === 'others' || des.title.toLowerCase() === 'other');
      const resolvedDeptId = addForm.departmentId === 'OTHERS'
        ? (othersDept ? othersDept.id : null)
        : (addForm.departmentId ? parseInt(addForm.departmentId, 10) : null);
      const resolvedDesigId = addForm.designationId === 'OTHERS'
        ? (othersDesig ? othersDesig.id : null)
        : (addForm.designationId ? parseInt(addForm.designationId, 10) : null);

      const payload = {
        ...addForm,
        grade,
        category,
        csNo: addForm.csNo ? addForm.csNo.trim() : null,
        hrNo: addForm.hrNo ? addForm.hrNo.trim() : null,
        departmentId: resolvedDeptId,
        designationId: resolvedDesigId,
        creditLimit: parseFloat(addForm.creditLimit.toString()) || 0,
        basicSalary: parseFloat(addForm.basicSalary.toString()) || 0,
        da: parseFloat(addForm.da.toString()) || 0,
        hra: parseFloat(addForm.hra.toString()) || 0,
        otherAllowances: parseFloat(addForm.otherAllowances.toString()) || 0,
      };

      const res = await api.post('/employees', payload);
      if (res.data.success) {
        setIsAddModalOpen(false);
        fetchEmployees();
        fetchSummary();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to add employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportResult(null);
    try {
      const lines = importText.trim().split('\n');
      const rows = lines.map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        return {
          employeeCode: parts[0],
          firstName: parts[1],
          lastName: parts[2] || 'Staff',
          mobile: parts[3],
          email: parts[4] || null,
          creditLimit: parseFloat(parts[5] || '10000'),
        };
      }).filter(r => r.employeeCode && r.firstName && r.mobile);

      if (rows.length === 0) {
        alert('No valid rows found. Format: employeeCode,firstName,lastName,mobile,email,creditLimit');
        return;
      }

      const res = await api.post('/employees/import', { rows });
      setImportResult(res.data);
      if (res.data.success) {
        fetchEmployees();
        fetchSummary();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Import failed');
    }
  };

  const exportToCSV = () => {
    const listToExport = selectedIds.length > 0 
      ? employees.filter(e => selectedIds.includes(e.id))
      : employees;

    const headers = [
      'Member Code',
      'Society CS #',
      'Corporate HR #',
      'Full Name',
      'Category',
      'Share Capital (INR)',
      'Monthly Thrift (INR)',
      'Cum Thrift (INR)',
      'Current Month Bills (INR)',
      'Domestic Advance (INR)',
      'Festival Advance (INR)',
      'Credit Limit (INR)',
      'Total Outstanding (INR)',
      'Available Credit (INR)',
      'Credit Status',
      'Account Status',
    ];

    const rows = listToExport.map(e => [
      `"${e.employee_code}"`,
      `"${e.cs_no || ''}"`,
      `"${e.hr_no || ''}"`,
      `"${e.first_name} ${e.last_name !== '.' ? e.last_name : ''}".trim()`,
      `"${e.category || 'WORKER'}"`,
      parseFloat((e.share_capital || 0).toString()).toFixed(2),
      parseFloat((e.thrift_deposit || 0).toString()).toFixed(2),
      parseFloat((e.cum_thrift || 0).toString()).toFixed(2),
      parseFloat((e.current_month_bills || 0).toString()).toFixed(2),
      parseFloat((e.domestic_balance || 0).toString()).toFixed(2),
      parseFloat((e.festival_advance_balance || 0).toString()).toFixed(2),
      parseFloat((e.credit_limit || 0).toString()).toFixed(2),
      parseFloat((e.current_outstanding || 0).toString()).toFixed(2),
      parseFloat((e.available_credit || 0).toString()).toFixed(2),
      e.credit_enabled ? 'ELIGIBLE' : 'BLOCKED',
      e.employment_status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cfecc_cooperative_members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('ALL');
    setBalanceFilter('ALL');
    setStatus('ALL');
    setCreditEligibility('ALL');
    setDepartmentId('ALL');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const columnLabels: Record<string, string> = {
    csNo: 'Society CS #',
    hrNo: 'Corporate HR #',
    category: 'Category',
    shareCapital: 'Share Capital (₹)',
    monthlyThrift: 'Monthly Thrift (₹)',
    monthBills: 'Month Store Bills (₹)',
    domesticAdvance: 'Domestic Adv (₹)',
    creditLimit: 'Credit Limit (₹)',
    outstanding: 'Total Outstanding (₹)',
    available: 'Available Credit (₹)',
    creditStatus: 'Credit Status',
    status: 'Account Status',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Cooperative Member Directory & Store Balances</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            CFECC consumer co-operative society members, share capital, monthly thrift, current store bills, and credit limits
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Column Visibility Menu */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-textSecondary" />
              <span>Columns</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-surface rounded-lg shadow-elevated border border-borderLine p-2 z-30 space-y-1.5 text-xs">
                <div className="text-[10px] font-bold uppercase text-slate-500 px-2 py-0.5">Visible Columns</div>
                {Object.keys(columnVisibility).map((colKey) => (
                  <label key={colKey} className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(columnVisibility as any)[colKey]}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, [colKey]: e.target.checked })}
                      className="w-3.5 h-3.5 text-primary rounded"
                    />
                    <span className="font-medium text-slate-700">{columnLabels[colKey] || colKey}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Import CSV */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <Upload className="w-3.5 h-3.5 text-textSecondary" />
            <span>Import</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-textSecondary" />
            <span>Export ({selectedIds.length > 0 ? selectedIds.length : 'All'})</span>
          </button>

          {/* Quick Member Balance Enquiry */}
          <button
            onClick={() => {
              setIsQuickLookupOpen(true);
              setQuickLookupQuery('');
              setQuickLookupResults([]);
              setSelectedQuickMember(null);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-subtle hover:shadow-md"
            title="Fast Member Credit & Outstanding Balance Lookup (SALBAL.DBF)"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>Balance Enquiry</span>
          </button>

          {/* Add Member */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Top Cooperative KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Total Members */}
        <div className="bg-surface p-4 rounded-xl border border-borderLine shadow-2xs hover:shadow-subtle transition-shadow">
          <div className="flex items-center justify-between text-textSecondary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Members</span>
            <div className="p-1.5 rounded-lg bg-navy-50 text-navy-800">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-navy-900 tabular-nums">
            {summary ? summary.totalMembers.toLocaleString('en-IN') : '692'}
          </div>
          <div className="text-[10px] text-textSecondary mt-1 flex items-center space-x-1">
            <span className="text-blue-600 font-semibold">{summary?.workersCount ?? 299} W</span>
            <span>•</span>
            <span className="text-purple-600 font-semibold">{summary?.staffCount ?? 378} S</span>
            <span>•</span>
            <span className="text-amber-600 font-semibold">{summary?.specialCount ?? 15} Sp</span>
          </div>
        </div>

        {/* Total Share Capital */}
        <div className="bg-surface p-4 rounded-xl border border-borderLine shadow-2xs hover:shadow-subtle transition-shadow">
          <div className="flex items-center justify-between text-textSecondary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Share Capital</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-blue-900 tabular-nums">
            ₹{summary ? summary.totalShareCapital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '1,48,250.00'}
          </div>
          <div className="text-[10px] text-textSecondary mt-1">Cooperative equity shares</div>
        </div>

        {/* Monthly Thrift Deduction */}
        <div className="bg-surface p-4 rounded-xl border border-borderLine shadow-2xs hover:shadow-subtle transition-shadow">
          <div className="flex items-center justify-between text-textSecondary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly Thrift</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-indigo-900 tabular-nums">
            ₹{summary ? summary.totalMonthlyThrift.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '51,050.00'}
          </div>
          <div className="text-[10px] text-textSecondary mt-1">Monthly member savings</div>
        </div>

        {/* Current Month POS Store Bills */}
        <div className="bg-surface p-4 rounded-xl border border-borderLine shadow-2xs hover:shadow-subtle transition-shadow">
          <div className="flex items-center justify-between text-textSecondary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Current Month Bills</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-amber-900 tabular-nums">
            ₹{summary ? summary.totalMonthBills.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '14,04,599.20'}
          </div>
          <div className="text-[10px] text-amber-700 font-medium mt-1">Store credit sales pending recovery</div>
        </div>

        {/* Recoverable Advances */}
        <div className="bg-surface p-4 rounded-xl border border-borderLine shadow-2xs hover:shadow-subtle transition-shadow">
          <div className="flex items-center justify-between text-textSecondary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Domestic Advances</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-rose-900 tabular-nums">
            ₹{summary ? summary.totalDomesticAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '75,750.00'}
          </div>
          <div className="text-[10px] text-textSecondary mt-1">Recoverable loan balance</div>
        </div>

        {/* Total Store Outstanding & Available */}
        <div className="bg-surface p-4 rounded-xl border border-borderLine shadow-2xs hover:shadow-subtle transition-shadow">
          <div className="flex items-center justify-between text-textSecondary mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Store Credit Limit</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-900 tabular-nums">
            ₹{summary ? summary.totalCreditLimit.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '18,11,412'}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-1">
            ₹{summary ? summary.totalAvailableCredit.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '10,69,421'} Available
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-status-danger'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Name, CS #, HR #, Code..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="ALL">All Categories ({summary?.totalMembers ?? 692})</option>
              <option value="WORKER">Workers / Plant Operations ({summary?.workersCount ?? 299})</option>
              <option value="STAFF">Staff / Management ({summary?.staffCount ?? 378})</option>
              <option value="SPECIAL">Special Institutional Accounts ({summary?.specialCount ?? 15})</option>
            </select>
          </div>

          {/* Balance / Dues Filter */}
          <div>
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Member Balances</option>
              <option value="WITH_DUES">With Store Dues (&gt; ₹0)</option>
              <option value="ZERO_BALANCE">Zero Balance / Settled</option>
              <option value="MAXED_OUT">Credit Limit Exceeded / Maxed</option>
            </select>
          </div>

          {/* Credit Status Filter */}
          <div>
            <select
              value={creditEligibility}
              onChange={(e) => setCreditEligibility(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Credit Statuses</option>
              <option value="ELIGIBLE">Store Credit Enabled</option>
              <option value="INELIGIBLE">Store Credit Blocked</option>
            </select>
          </div>

          {/* Status & Reset Button */}
          <div className="flex items-center space-x-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <button
              onClick={handleResetFilters}
              className="p-2 rounded-lg border border-borderLine hover:bg-slate-100 text-slate-600 transition-colors flex-shrink-0"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Actions Bar when items selected */}
      <FloatingActionBar
        selectedCount={selectedIds.length}
        totalCount={employees.length}
        itemLabel="members"
        onClear={() => setSelectedIds([])}
      >
        <button
          type="button"
          onClick={() => handleBulkAction('SET_CREDIT', true)}
          disabled={isBulkProcessing}
          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-colors shadow-2xs"
        >
          Enable Credit
        </button>
        <button
          type="button"
          onClick={() => handleBulkAction('SET_CREDIT', false)}
          disabled={isBulkProcessing}
          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-lg font-bold transition-colors shadow-2xs"
        >
          Block Credit
        </button>
        <button
          type="button"
          onClick={() => handleBulkAction('SET_STATUS', 'ACTIVE')}
          disabled={isBulkProcessing}
          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors shadow-2xs"
        >
          Mark Active
        </button>
        <button
          type="button"
          onClick={() => handleBulkAction('SET_STATUS', 'SUSPENDED')}
          disabled={isBulkProcessing}
          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg font-bold transition-colors shadow-2xs"
        >
          Suspend
        </button>
      </FloatingActionBar>

      {/* Employee Data Table with Strict Single-Line Rows (No Line Breaks) */}
      <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px] scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs min-w-[1550px]">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                <th className="py-2.5 px-3 text-center w-8 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedIds.length === employees.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 text-primary rounded cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSort('e.employee_code')}
                  className="py-2.5 px-3 cursor-pointer hover:text-navy-800 whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1 whitespace-nowrap">
                    <span>Member / Account</span>
                    <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                  </div>
                </th>
                {columnVisibility.csNo && (
                  <th
                    onClick={() => handleSort('e.cs_no')}
                    className="py-2.5 px-3 text-center cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center space-x-1 whitespace-nowrap">
                      <span>Society CS #</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.hrNo && (
                  <th
                    onClick={() => handleSort('e.hr_no')}
                    className="py-2.5 px-3 cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center space-x-1 whitespace-nowrap">
                      <span>Corporate HR #</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.category && (
                  <th
                    onClick={() => handleSort('e.category')}
                    className="py-2.5 px-3 cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center space-x-1 whitespace-nowrap">
                      <span>Category</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.shareCapital && (
                  <th
                    onClick={() => handleSort('e.share_capital')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Share Capital (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.monthlyThrift && (
                  <th
                    onClick={() => handleSort('e.thrift_deposit')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Thrift / Mo (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.monthBills && (
                  <th
                    onClick={() => handleSort('e.current_month_bills')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Month Bills (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.domesticAdvance && (
                  <th
                    onClick={() => handleSort('e.domestic_balance')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Domestic Adv (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.creditLimit && (
                  <th
                    onClick={() => handleSort('e.credit_limit')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Credit Limit (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.outstanding && (
                  <th
                    onClick={() => handleSort('e.current_outstanding')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Outstanding (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.available && (
                  <th
                    onClick={() => handleSort('e.available_credit')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-navy-800 whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end space-x-1 whitespace-nowrap">
                      <span>Available (₹)</span>
                      <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                    </div>
                  </th>
                )}
                {columnVisibility.creditStatus && <th className="py-2.5 px-3 text-center whitespace-nowrap">Credit Status</th>}
                {columnVisibility.status && <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>}
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-textSecondary whitespace-nowrap">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading cooperative member directory...</div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-textSecondary whitespace-nowrap">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No cooperative member records matching criteria.</div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isSelected = selectedIds.includes(emp.id);
                  const shareCap = parseFloat((emp.share_capital || 0).toString());
                  const thriftDep = parseFloat((emp.thrift_deposit || 0).toString());
                  const monthBills = parseFloat((emp.current_month_bills || 0).toString());
                  const domesticAdv = parseFloat((emp.domestic_balance || 0).toString());
                  const creditLimit = parseFloat((emp.credit_limit || 0).toString());
                  const outstanding = parseFloat((emp.current_outstanding || 0).toString());
                  const available = parseFloat((emp.available_credit || 0).toString());

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className={`hover:bg-slate-50/70 cursor-pointer transition-colors whitespace-nowrap ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(emp.id)}
                          className="w-3.5 h-3.5 text-primary rounded cursor-pointer"
                        />
                      </td>

                      {/* Member Profile, Name & Code on a Single Line */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase flex-shrink-0 text-white ${
                            emp.category === 'STAFF'
                              ? 'bg-purple-700'
                              : emp.category === 'SPECIAL'
                              ? 'bg-amber-600'
                              : 'bg-navy-800'
                          }`}>
                            {emp.first_name ? emp.first_name.charAt(0) : 'M'}
                          </div>
                          <span className="font-bold text-navy-800 hover:text-primary transition-colors whitespace-nowrap">
                            {emp.first_name} {emp.last_name !== '.' ? emp.last_name : ''}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 font-medium whitespace-nowrap">
                            ({emp.employee_code})
                          </span>
                        </div>
                      </td>

                      {/* Society CS # */}
                      {columnVisibility.csNo && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {emp.cs_no ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
                              CS #{emp.cs_no}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Corporate HR # */}
                      {columnVisibility.hrNo && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {emp.hr_no ? (
                            <span className="font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                              {emp.hr_no}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Category */}
                      {columnVisibility.category && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
                            emp.category === 'STAFF'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : emp.category === 'SPECIAL'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {emp.category === 'SPECIAL' ? 'Special' : emp.category || 'Worker'}
                          </span>
                        </td>
                      )}

                      {/* Share Capital */}
                      {columnVisibility.shareCapital && (
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap">
                          ₹{shareCap.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Monthly Thrift */}
                      {columnVisibility.monthlyThrift && (
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold text-indigo-700">
                          ₹{thriftDep.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Current Month Store Bills */}
                      {columnVisibility.monthBills && (
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          <span className={`font-bold ${monthBills > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                            ₹{monthBills.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      )}

                      {/* Domestic Advance */}
                      {columnVisibility.domesticAdvance && (
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium whitespace-nowrap">
                          {domesticAdv > 0 ? (
                            <span className="text-rose-700 font-semibold">
                              ₹{domesticAdv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400">₹0.00</span>
                          )}
                        </td>
                      )}

                      {/* Credit Limit */}
                      {columnVisibility.creditLimit && (
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                          ₹{creditLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Outstanding */}
                      {columnVisibility.outstanding && (
                        <td className="py-2.5 px-3 text-right font-bold text-navy-900 tabular-nums whitespace-nowrap">
                          ₹{outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Available Credit */}
                      {columnVisibility.available && (
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                          {available > 0 ? (
                            <span className="text-emerald-700">
                              ₹{available.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-extrabold">₹0.00</span>
                          )}
                        </td>
                      )}

                      {/* Credit Status */}
                      {columnVisibility.creditStatus && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {emp.credit_enabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />
                              Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                              <XCircle className="w-3 h-3 mr-1 text-rose-600 flex-shrink-0" />
                              Blocked
                            </span>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      {columnVisibility.status && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <StatusBadge status={emp.employment_status} />
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1 whitespace-nowrap">
                          <button
                            disabled={waSendingId === emp.id}
                            onClick={() => handleQuickWhatsAppBalance(emp)}
                            className="p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            title={`Send WhatsApp Credit Balance to ${emp.mobile || emp.first_name}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="p-1 rounded-md text-textSecondary hover:text-primary hover:bg-blue-50 transition-colors"
                            title="View Member Passbook & Profile"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Floating Pagination Footer */}
        <TablePagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          itemLabel="cooperative members"
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onPageSizeChange={(limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))}
        />
      </div>

      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Members in Bulk (CSV / Tabular Data)"
        subtitle="Paste CSV rows to quickly import cooperative member accounts"
        maxWidth="2xl"
      >
        <form onSubmit={handleImportCSV} className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-textSecondary uppercase">CSV Rows Format</label>
              <span className="text-[11px] text-primary font-mono">code,firstName,lastName,mobile,email,creditLimit</span>
            </div>
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`5000335, Sandeep, Nakadi, 9848011223, sandeep@cfecc.org, 15000\n5000336, Ravindra, Edke, 9848022334, ravindra@cfecc.org, 12000`}
              className="w-full p-3 font-mono text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          {importResult && (
            <div className={`p-3 rounded-lg text-xs ${importResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-status-danger'}`}>
              <div>{importResult.message}</div>
              {importResult.errors?.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-[11px]">
                  {importResult.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle"
            >
              Import Members
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Member Balance Enquiry Modal (Legacy SALBAL.DBF Lookup) */}
      <Modal
        isOpen={isQuickLookupOpen}
        onClose={() => setIsQuickLookupOpen(false)}
        title="Member Balance Enquiry & Credit Verification"
        subtitle="Instant lookup by CS #, Employee ID, or Name for available credit balance, monthly bills, and thrift"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search by CS #, Employee Code, or Name (e.g. 1440, 5000335, Sandeep)..."
              value={quickLookupQuery}
              onChange={(e) => handleQuickSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-2 border-primary/30 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:border-primary transition-colors"
            />
            {isSearchingQuick && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching...</span>
            )}
          </div>

          {/* Search Results Dropdown / Picker if multiple */}
          {quickLookupResults.length > 1 && (
            <div className="border border-borderLine rounded-xl max-h-40 overflow-y-auto divide-y divide-borderLine bg-slate-50/50">
              {quickLookupResults.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedQuickMember(emp)}
                  className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors ${
                    selectedQuickMember?.id === emp.id ? 'bg-primary/10 border-l-4 border-primary font-bold' : ''
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-navy-800">CS #{emp.cs_no || '0'}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="font-semibold text-slate-800">{emp.first_name} {emp.last_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({emp.employee_code})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      ₹{parseFloat((emp.available_credit as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Avail
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detailed Member Balance Card */}
          {selectedQuickMember ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-borderLine space-y-4">
              {/* Header Profile Bar */}
              <div className="flex items-start justify-between border-b border-borderLine pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-xl bg-navy-800 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {selectedQuickMember.first_name?.[0] || 'M'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-navy-900">{selectedQuickMember.first_name} {selectedQuickMember.last_name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-navy-100 text-navy-800 border border-navy-200">
                        {selectedQuickMember.category === 'STAFF' ? 'Management (M)' : selectedQuickMember.category === 'SPECIAL' ? 'Special / Other' : 'Worker (NM)'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-textSecondary mt-0.5 font-mono">
                      <span>CS #{selectedQuickMember.cs_no || '0'}</span>
                      <span>&bull;</span>
                      <span>Emp ID: {selectedQuickMember.employee_code}</span>
                      {selectedQuickMember.hr_no && (
                        <>
                          <span>&bull;</span>
                          <span>HR #{selectedQuickMember.hr_no}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                    selectedQuickMember.credit_enabled && selectedQuickMember.employment_status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {selectedQuickMember.credit_enabled && selectedQuickMember.employment_status === 'ACTIVE' ? 'Credit Eligible' : 'Credit Restricted'}
                  </span>
                </div>
              </div>

              {/* 3 Main KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-borderLine shadow-2xs">
                  <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">Approved Credit Limit</span>
                  <div className="text-lg font-bold text-navy-900 font-mono mt-0.5">
                    ₹{parseFloat((selectedQuickMember.credit_limit as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/20 shadow-2xs">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Current Outstanding</span>
                  <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
                    ₹{parseFloat((selectedQuickMember.current_outstanding as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Available Balance</span>
                  <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                    ₹{parseFloat((selectedQuickMember.available_credit as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Society Breakdown Items */}
              <div className="bg-white rounded-lg border border-borderLine p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Month Bills</span>
                  <span className="font-bold font-mono text-navy-800">
                    ₹{parseFloat((selectedQuickMember.current_month_bills as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Domestic Adv.</span>
                  <span className="font-bold font-mono text-navy-800">
                    ₹{parseFloat((selectedQuickMember.domestic_balance as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Monthly Thrift</span>
                  <span className="font-bold font-mono text-indigo-700">
                    ₹{parseFloat((selectedQuickMember.thrift_deposit as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cum. Thrift</span>
                  <span className="font-bold font-mono text-indigo-700">
                    ₹{parseFloat((selectedQuickMember.cum_thrift as any) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickLookupOpen(false);
                    navigate(`/employees/${selectedQuickMember.id}`);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-borderLine bg-white hover:bg-slate-50 text-navy-800 font-semibold text-xs"
                >
                  View Full Profile & Ledger &rarr;
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickLookupOpen(false);
                    navigate(`/pos?memberId=${selectedQuickMember.id}`);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-sm flex items-center space-x-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Open POS Checkout</span>
                </button>
              </div>
            </div>
          ) : quickLookupQuery.trim() && !isSearchingQuick ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-borderLine">
              <Users className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
              <p className="font-semibold">No member found matching "{quickLookupQuery}"</p>
              <p className="text-[11px] text-slate-400 mt-1">Verify CS #, Employee ID, or name and try again.</p>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-borderLine">
              <Zap className="w-6 h-6 mx-auto text-amber-500 mb-1" />
              <p className="font-medium text-slate-600">Type a Member CS # or Employee ID to instantly verify live credit balances.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Cooperative Member"
        subtitle="Register member with store credit allocation and thrift structure"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-6">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-lg">
              {formError}
            </div>
          )}

          {/* Section 1: Personal Details */}
          <div>
            <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3 pb-1 border-b border-borderLine">
              1. Personal & Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Employee / Member ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5000335"
                  value={addForm.employeeCode}
                  onChange={(e) => setAddForm({ ...addForm, employeeCode: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Society CS # (CS No) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1440 or 0"
                  value={addForm.csNo}
                  onChange={(e) => setAddForm({ ...addForm, csNo: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Grade *</label>
                <select
                  value={addForm.grade}
                  onChange={(e) => setAddForm({ ...addForm, grade: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                >
                  <option value="M">M - Management</option>
                  <option value="NM">NM - Non Management</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Corporate HR ID</label>
                <input
                  type="text"
                  placeholder="e.g. 10000973 (optional)"
                  value={addForm.hrNo}
                  onChange={(e) => setAddForm({ ...addForm, hrNo: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="First name"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Last name"
                  value={addForm.lastName}
                  onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile"
                  value={addForm.mobile}
                  onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@coromandel.biz"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Gender</label>
                <select
                  value={addForm.gender}
                  onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Employment & Store Credit */}
          <div>
            <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3 pb-1 border-b border-borderLine">
              2. Employment & Store Credit Allocation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Department</label>
                <select
                  value={addForm.departmentId}
                  onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select Department</option>
                  {departments
                    .filter((d) => d.name.toLowerCase() !== 'others' && d.name.toLowerCase() !== 'other')
                    .map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  <option value={departments.find((d) => d.name.toLowerCase() === 'others' || d.name.toLowerCase() === 'other')?.id || 'OTHERS'}>
                    Others
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Designation</label>
                <select
                  value={addForm.designationId}
                  onChange={(e) => setAddForm({ ...addForm, designationId: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select Designation</option>
                  {designations
                    .filter((des) => des.title.toLowerCase() !== 'others' && des.title.toLowerCase() !== 'other')
                    .map((des) => (
                      <option key={des.id} value={des.id}>{des.title}</option>
                    ))}
                  <option value={designations.find((des) => des.title.toLowerCase() === 'others' || des.title.toLowerCase() === 'other')?.id || 'OTHERS'}>
                    Others
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Joining Date</label>
                <input
                  type="date"
                  value={addForm.joiningDate}
                  onChange={(e) => setAddForm({ ...addForm, joiningDate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Employment Type</label>
                <select
                  value={addForm.employmentType}
                  onChange={(e) => setAddForm({ ...addForm, employmentType: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="PERMANENT">Permanent (Cooperative Member)</option>
                  <option value="CONTRACT">Contractual</option>
                  <option value="PROBATION">Probation</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={addForm.creditLimit}
                  onChange={(e) => setAddForm({ ...addForm, creditLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="creditEnabled"
                  checked={addForm.creditEnabled}
                  onChange={(e) => setAddForm({ ...addForm, creditEnabled: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
                <label htmlFor="creditEnabled" className="text-xs font-semibold text-textPrimary cursor-pointer">
                  Enable POS Store Credit Purchases
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Salary Structure */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-1 border-b border-borderLine">
              <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                3. Salary Structure (Monthly CTC Components)
              </h4>
              <span className="text-[10px] font-medium text-textSecondary bg-slate-100 border border-borderLine px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">
                  Basic Salary (₹) <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (optional)"
                  value={addForm.basicSalary || ''}
                  onChange={(e) => setAddForm({ ...addForm, basicSalary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">
                  DA (₹) <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (optional)"
                  value={addForm.da || ''}
                  onChange={(e) => setAddForm({ ...addForm, da: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">
                  HRA (₹) <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (optional)"
                  value={addForm.hra || ''}
                  onChange={(e) => setAddForm({ ...addForm, hra: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">
                  Other Allowances (₹) <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 (optional)"
                  value={addForm.otherAllowances || ''}
                  onChange={(e) => setAddForm({ ...addForm, otherAllowances: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Bank Details */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-1 border-b border-borderLine">
              <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                4. Bank Account Details
              </h4>
              <span className="text-[10px] font-medium text-textSecondary bg-slate-100 border border-borderLine px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Bank Name</label>
                <input
                  type="text"
                  value={addForm.bankName}
                  onChange={(e) => setAddForm({ ...addForm, bankName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Account Number</label>
                <input
                  type="text"
                  value={addForm.accountNumber}
                  onChange={(e) => setAddForm({ ...addForm, accountNumber: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={addForm.ifscCode}
                  onChange={(e) => setAddForm({ ...addForm, ifscCode: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none uppercase"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
