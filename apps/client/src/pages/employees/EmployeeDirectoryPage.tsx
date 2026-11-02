import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Employee } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  CreditCard,
  ChevronRight,
  Phone,
  Building,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  SlidersHorizontal,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';

export const EmployeeDirectoryPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters, Search & Sorting
  const [search, setSearch] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [creditEligibility, setCreditEligibility] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('e.id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    department: true,
    contact: true,
    joiningDate: true,
    creditStatus: true,
    creditLimit: true,
    outstanding: true,
    available: true,
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
    basicSalary: 25000,
    da: 5000,
    hra: 6000,
    otherAllowances: 2000,
    bankName: 'State Bank of India',
    accountNumber: '',
    ifscCode: 'SBIN0001234',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<any | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, departmentId, status, creditEligibility, sortBy, sortOrder, pagination.page]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/employees/departments');
      if (res.data.success) {
        setDepartments(res.data.departments);
        setDesignations(res.data.designations);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        departmentId,
        status,
        creditEligibility,
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
    try {
      const res = await api.post('/employees/bulk-action', {
        employeeIds: selectedIds,
        action,
        value,
      });
      if (res.data.success) {
        alert(res.data.message);
        setSelectedIds([]);
        fetchEmployees();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Bulk action failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        ...addForm,
        departmentId: addForm.departmentId ? parseInt(addForm.departmentId, 10) : null,
        designationId: addForm.designationId ? parseInt(addForm.designationId, 10) : null,
        creditLimit: parseFloat(addForm.creditLimit.toString()),
        basicSalary: parseFloat(addForm.basicSalary.toString()),
        da: parseFloat(addForm.da.toString()),
        hra: parseFloat(addForm.hra.toString()),
        otherAllowances: parseFloat(addForm.otherAllowances.toString()),
      };

      const res = await api.post('/employees', payload);
      if (res.data.success) {
        setIsAddModalOpen(false);
        fetchEmployees();
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
      // Parse CSV rows
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
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Import failed');
    }
  };

  const exportToCSV = () => {
    const listToExport = selectedIds.length > 0 
      ? employees.filter(e => selectedIds.includes(e.id))
      : employees;

    const headers = ['Employee Code', 'Full Name', 'Department', 'Designation', 'Mobile', 'Status', 'Credit Limit', 'Outstanding', 'Available'];
    const rows = listToExport.map(e => [
      e.employee_code,
      `"${e.first_name} ${e.last_name}"`,
      `"${e.department_name || ''}"`,
      `"${e.designation_title || ''}"`,
      e.mobile,
      e.employment_status,
      e.credit_limit,
      e.current_outstanding,
      e.available_credit,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cfecc_employees_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Employee Master Directory</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Complete employee master data, credit limits, department assignments, and KYC records
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
              <div className="absolute right-0 mt-1 w-48 bg-surface rounded-lg shadow-elevated border border-borderLine p-2 z-30 space-y-1.5 text-xs">
                {Object.keys(columnVisibility).map((colKey) => (
                  <label key={colKey} className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(columnVisibility as any)[colKey]}
                      onChange={(e) => setColumnVisibility({ ...columnVisibility, [colKey]: e.target.checked })}
                      className="w-3.5 h-3.5 text-primary rounded"
                    />
                    <span className="capitalize">{colKey.replace(/([A-Z])/g, ' $1')}</span>
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

          {/* Add Employee */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, mobile..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="RESIGNED">Resigned</option>
            </select>
          </div>

          {/* Credit Eligibility Filter */}
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
        </div>
      </div>

      {/* Floating Bulk Actions Bar when items selected */}
      {selectedIds.length > 0 && (
        <div className="bg-navy-800 text-white p-3 rounded-lg flex items-center justify-between text-xs animate-in fade-in shadow-elevated">
          <div className="flex items-center space-x-2 font-medium">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span>{selectedIds.length} employees selected</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleBulkAction('SET_CREDIT', true)}
              disabled={isBulkProcessing}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 rounded font-semibold transition-colors"
            >
              Enable Credit
            </button>
            <button
              onClick={() => handleBulkAction('SET_CREDIT', false)}
              disabled={isBulkProcessing}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 rounded font-semibold transition-colors"
            >
              Block Credit
            </button>
            <button
              onClick={() => handleBulkAction('SET_STATUS', 'ACTIVE')}
              disabled={isBulkProcessing}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition-colors"
            >
              Mark Active
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-slate-300 hover:text-white"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Employee Data Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-8">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedIds.length === employees.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 text-primary rounded cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSort('e.employee_code')}
                  className="py-3 px-4 cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Employee</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                {columnVisibility.department && (
                  <th
                    onClick={() => handleSort('d.name')}
                    className="py-3 px-4 cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Department & Designation</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {columnVisibility.contact && <th className="py-3 px-4">Contact</th>}
                {columnVisibility.joiningDate && (
                  <th
                    onClick={() => handleSort('e.joining_date')}
                    className="py-3 px-4 cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Joining Date</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {columnVisibility.creditStatus && <th className="py-3 px-4 text-center">Credit Status</th>}
                {columnVisibility.creditLimit && (
                  <th
                    onClick={() => handleSort('e.credit_limit')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Credit Limit</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {columnVisibility.outstanding && (
                  <th
                    onClick={() => handleSort('e.current_outstanding')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Outstanding</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}
                {columnVisibility.available && <th className="py-3 px-4 text-right">Available</th>}
                {columnVisibility.status && <th className="py-3 px-4">Status</th>}
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading employee records...</div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-textSecondary">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No employee records matching criteria.</div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isSelected = selectedIds.includes(emp.id);
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className={`hover:bg-slate-50/70 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(emp.id)}
                          className="w-3.5 h-3.5 text-primary rounded cursor-pointer"
                        />
                      </td>

                      {/* Employee Profile & Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {emp.first_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-navy-800 hover:text-primary transition-colors">
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div className="text-[11px] text-textSecondary font-mono">{emp.employee_code}</div>
                          </div>
                        </div>
                      </td>

                      {/* Department & Designation */}
                      {columnVisibility.department && (
                        <td className="py-3 px-4">
                          <div className="font-medium text-textPrimary">{emp.department_name || 'Unassigned'}</div>
                          <div className="text-[11px] text-textSecondary">{emp.designation_title || 'General'}</div>
                        </td>
                      )}

                      {/* Contact */}
                      {columnVisibility.contact && (
                        <td className="py-3 px-4">
                          <div className="font-medium text-textPrimary flex items-center">
                            <Phone className="w-3 h-3 text-textSecondary mr-1" />
                            <span>{emp.mobile}</span>
                          </div>
                          <div className="text-[11px] text-textSecondary truncate max-w-[140px]">{emp.email || '-'}</div>
                        </td>
                      )}

                      {/* Joining Date */}
                      {columnVisibility.joiningDate && (
                        <td className="py-3 px-4 font-medium text-textSecondary">
                          {new Date(emp.joining_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      )}

                      {/* Credit Enabled */}
                      {columnVisibility.creditStatus && (
                        <td className="py-3 px-4 text-center">
                          {emp.credit_enabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                              Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 mr-1 text-rose-600" />
                              Blocked
                            </span>
                          )}
                        </td>
                      )}

                      {/* Credit Limit */}
                      {columnVisibility.creditLimit && (
                        <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                          ₹{parseFloat(emp.credit_limit.toString()).toLocaleString('en-IN')}
                        </td>
                      )}

                      {/* Outstanding */}
                      {columnVisibility.outstanding && (
                        <td className="py-3 px-4 text-right font-bold text-amber-700 tabular-nums">
                          ₹{parseFloat(emp.current_outstanding.toString()).toLocaleString('en-IN')}
                        </td>
                      )}

                      {/* Available */}
                      {columnVisibility.available && (
                        <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                          ₹{parseFloat(emp.available_credit.toString()).toLocaleString('en-IN')}
                        </td>
                      )}

                      {/* Status */}
                      {columnVisibility.status && (
                        <td className="py-3 px-4">
                          <StatusBadge status={emp.employment_status} />
                        </td>
                      )}

                      {/* Action Arrow */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/employees/${emp.id}`);
                          }}
                          className="p-1 rounded text-textSecondary hover:text-primary hover:bg-blue-50 transition-colors"
                          title="View Full Profile"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-borderLine text-xs text-textSecondary">
          <div>
            Showing <span className="font-semibold">{employees.length}</span> of <span className="font-semibold">{pagination.total}</span> employees
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              className="px-2.5 py-1 rounded bg-surface border border-borderLine disabled:opacity-50 hover:bg-slate-100 font-medium"
            >
              Previous
            </button>
            <span className="font-semibold text-navy-800">Page {pagination.page} of {pagination.totalPages || 1}</span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              className="px-2.5 py-1 rounded bg-surface border border-borderLine disabled:opacity-50 hover:bg-slate-100 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Employees in Bulk (CSV / Tabular Data)"
        subtitle="Paste CSV rows to quickly import staff accounts into the system"
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
              placeholder={`CFE-1010, Ramesh, Kumar, 9848011223, ramesh@cfecc.org, 15000\nCFE-1011, Sunitha, Devi, 9848022334, sunitha@cfecc.org, 12000`}
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
              Import Employees
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee"
        subtitle="Register employee with store credit allocation and salary structure"
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
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Employee ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CFE-1006"
                  value={addForm.employeeCode}
                  onChange={(e) => setAddForm({ ...addForm, employeeCode: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">First Name *</label>
                <input
                  type="text"
                  required
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
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
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
                  {designations.map((des) => (
                    <option key={des.id} value={des.id}>{des.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Joining Date *</label>
                <input
                  type="date"
                  required
                  value={addForm.joiningDate}
                  onChange={(e) => setAddForm({ ...addForm, joiningDate: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Store Credit Limit (₹) *</label>
                <input
                  type="number"
                  required
                  value={addForm.creditLimit}
                  onChange={(e) => setAddForm({ ...addForm, creditLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none tabular-nums font-semibold"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.creditEnabled}
                    onChange={(e) => setAddForm({ ...addForm, creditEnabled: e.target.checked })}
                    className="w-4 h-4 text-primary rounded border-borderLine focus:ring-primary"
                  />
                  <span className="text-xs font-semibold text-navy-800">Enable Monthly Store Credit</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Salary & Bank Structure */}
          <div>
            <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider mb-3 pb-1 border-b border-borderLine">
              3. Salary Structure & Bank Account
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Basic Salary (₹)</label>
                <input
                  type="number"
                  value={addForm.basicSalary}
                  onChange={(e) => setAddForm({ ...addForm, basicSalary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:outline-none tabular-nums"
                />
              </div>

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
                  placeholder="e.g. 30123456789"
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

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-subtle transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Save & Register Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
