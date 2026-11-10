import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api.js';
import { Vendor, VendorSuppliedItem } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import {
  Truck,
  Search,
  Plus,
  Phone,
  Building,
  FileSpreadsheet,
  Receipt,
  Eye,
  Edit2,
  Download,
  Landmark,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
} from 'lucide-react';

export const VendorsPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Add / Edit Modal
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState({
    vendorCode: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    gstin: '',
    paymentTermsDays: 30,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    openingBalance: 0,
    isActive: true,
  });

  // 360° Profile Modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'PRODUCTS' | 'OVERVIEW' | 'POS' | 'INVOICES' | 'PAYMENTS' | 'ACTIVITY'>('PRODUCTS');
  const [productSearch, setProductSearch] = useState<string>('');
  const [profileData, setProfileData] = useState<{
    vendor: Vendor;
    suppliedItems?: VendorSuppliedItem[];
    purchaseOrders: any[];
    invoices: any[];
    payments: any[];
    activityHistory: any[];
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, [search, includeInactive, sortBy, sortOrder]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        includeInactive: includeInactive.toString(),
        sortBy,
        sortOrder,
      });
      const res = await api.get(`/vendors?${params.toString()}`);
      if (res.data.success) {
        setVendors(res.data.data);
      }
    } catch (err) {
      console.error(err);
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

  const openCreateModal = () => {
    setEditingVendor(null);
    setVendorForm({
      vendorCode: `VND-${String(vendors.length + 1).padStart(3, '0')}`,
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      gstin: '',
      paymentTermsDays: 30,
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      openingBalance: 0,
      isActive: true,
    });
    setFormError(null);
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (v: Vendor) => {
    setEditingVendor(v);
    setVendorForm({
      vendorCode: v.vendor_code,
      name: v.name,
      contactPerson: v.contact_person || '',
      phone: v.phone,
      email: v.email || '',
      address: v.address || '',
      city: v.city || 'Visakhapatnam',
      state: v.state || 'Andhra Pradesh',
      gstin: v.gstin || '',
      paymentTermsDays: v.payment_terms_days,
      bankName: v.bank_name || '',
      accountNumber: v.account_number || '',
      ifscCode: v.ifsc_code || '',
      openingBalance: parseFloat(v.opening_balance.toString()),
      isActive: v.is_active,
    });
    setFormError(null);
    setIsAddEditModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingVendor) {
        const res = await api.put(`/vendors/${editingVendor.id}`, vendorForm);
        if (res.data.success) {
          setIsAddEditModalOpen(false);
          fetchVendors();
        }
      } else {
        const res = await api.post('/vendors', vendorForm);
        if (res.data.success) {
          setIsAddEditModalOpen(false);
          fetchVendors();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openVendorProfile = async (vendorId: number) => {
    setIsProfileModalOpen(true);
    setLoadingProfile(true);
    setProfileTab('PRODUCTS');
    setProductSearch('');
    try {
      const res = await api.get(`/vendors/${vendorId}/profile`);
      if (res.data.success) {
        setProfileData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleExportCSV = () => {
    if (vendors.length === 0) {
      alert('No vendors to export.');
      return;
    }

    const headers = [
      'Vendor Code',
      'Name',
      'Contact Person',
      'Phone',
      'Email',
      'City',
      'State',
      'GSTIN',
      'Payment Terms (Days)',
      'Bank Name',
      'Account Number',
      'IFSC',
      'Current Outstanding (₹)',
      'Status',
    ];

    const rows = vendors.map((v) => [
      `"${v.vendor_code}"`,
      `"${v.name.replace(/"/g, '""')}"`,
      `"${v.contact_person || ''}"`,
      `"${v.phone}"`,
      `"${v.email || ''}"`,
      `"${v.city || ''}"`,
      `"${v.state || ''}"`,
      `"${v.gstin || ''}"`,
      v.payment_terms_days,
      `"${v.bank_name || ''}"`,
      `"${v.account_number || ''}"`,
      `"${v.ifsc_code || ''}"`,
      parseFloat(v.current_outstanding.toString()).toFixed(2),
      v.is_active ? 'Active' : 'Inactive',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cfecc_vendors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const totalOutstanding = useMemo(
    () => vendors.reduce((sum, v) => sum + (parseFloat(String(v.current_outstanding || 0)) || 0), 0),
    [vendors]
  );
  const totalPos = useMemo(
    () => vendors.reduce((sum, v) => sum + (parseInt(String(v.po_count || 0), 10) || 0), 0),
    [vendors]
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Vendor & Supplier Master</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Registered wholesale suppliers, commercial terms, bank records and 360° procurement histories
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Vendor</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Active Suppliers</span>
            <Building className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2">{vendors.filter((v) => v.is_active).length}</div>
          <div className="text-[11px] text-textSecondary mt-1">Authorized store vendors</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Purchase Orders</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-2">{totalPos}</div>
          <div className="text-[11px] text-textSecondary mt-1">Total procurement contracts</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Total Payables</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 mt-2 tabular-nums">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Current outstanding balances</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Default Terms</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2">30 Days</div>
          <div className="text-[11px] text-textSecondary mt-1">Average supplier credit window</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor name, code, contact person, GSTIN, phone..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIncludeInactive(!includeInactive)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              includeInactive
                ? 'bg-slate-200 text-navy-800 border-slate-300'
                : 'bg-surface text-textSecondary border-borderLine hover:bg-slate-50'
            }`}
          >
            <span>{includeInactive ? 'Showing Inactive Vendors' : 'Active Vendors Only'}</span>
          </button>
        </div>
      </div>

      {/* Vendors Table with Standard Format and Auto Screen Adjust */}
      <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Vendor Details</span>
                    {sortBy === 'name' ? (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">GSTIN & Banking</th>
                <th className="py-3 px-4 text-center">Credit Terms</th>
                <th className="py-3 px-4 text-center">Orders & Bills</th>
                <th
                  onClick={() => handleSort('current_outstanding')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Outstanding (₹)</span>
                    {sortBy === 'current_outstanding' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading vendors...</div>
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No vendor records found matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div
                        onClick={() => openVendorProfile(v.id)}
                        className="font-bold text-navy-800 hover:text-primary cursor-pointer transition-colors flex items-center space-x-1.5 group"
                        title="Click to view full products and data sold by this vendor"
                      >
                        <span className="group-hover:underline">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-primary font-semibold border border-blue-200">
                          View Products
                        </span>
                      </div>
                      <div className="text-[11px] text-textSecondary font-mono">{v.vendor_code}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-textPrimary flex items-center">
                        <Phone className="w-3 h-3 text-textSecondary mr-1" />
                        <span>{v.phone}</span>
                      </div>
                      <div className="text-[11px] text-textSecondary">{v.contact_person || 'Accounts Dept'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-textPrimary">{v.city || 'Visakhapatnam'}</div>
                      <div className="text-[11px] text-textSecondary">{v.state || 'Andhra Pradesh'}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-textSecondary">
                      <div>{v.gstin || 'Unregistered'}</div>
                      {v.bank_name && (
                        <div className="text-[10px] text-slate-500 font-sans flex items-center mt-0.5">
                          <Landmark className="w-3 h-3 mr-1 text-slate-400" />
                          <span>{v.bank_name}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-textSecondary">
                        {v.payment_terms_days} Days
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-medium">
                      <span className="text-navy-800">{v.po_count || 0} POs</span>
                      <span className="text-textSecondary mx-1">&bull;</span>
                      <span className="text-textSecondary">{v.invoice_count || 0} Bills</span>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                      <span className={parseFloat(v.current_outstanding.toString()) > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                        ₹{parseFloat(v.current_outstanding.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          title="View 360° Profile & History"
                          onClick={() => openVendorProfile(v.id)}
                          className="p-1 hover:bg-slate-100 rounded text-textSecondary hover:text-navy-800 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Edit Vendor Details"
                          onClick={() => openEditModal(v)}
                          className="p-1 hover:bg-slate-100 rounded text-textSecondary hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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
            Showing <span className="font-bold text-navy-800 font-mono">{vendors.length}</span> registered vendors / trade partners
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-slate-600 font-medium">
              Total AP Outstanding:{' '}
              <strong className="text-navy-900 font-mono text-sm font-black">
                ₹{vendors.reduce((acc: number, v: any) => acc + parseFloat(v.current_outstanding?.toString() || '0'), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Add / Edit Vendor Modal */}
      <Modal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        title={editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Add New Vendor / Supplier'}
        subtitle="Configure supplier master details, GSTIN, credit limits and bank account"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveVendor} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor Code *</label>
              <input
                type="text"
                required
                disabled={!!editingVendor}
                placeholder="e.g. VND-004"
                value={vendorForm.vendorCode}
                onChange={(e) => setVendorForm({ ...vendorForm, vendorCode: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor / Enterprise Name *</label>
              <input
                type="text"
                required
                placeholder="Company / Agency Name"
                value={vendorForm.name}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Sales Representative / Manager"
                value={vendorForm.contactPerson}
                onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Email Address</label>
              <input
                type="email"
                placeholder="accounts@vendor.com"
                value={vendorForm.email}
                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">GSTIN</label>
              <input
                type="text"
                placeholder="37XXXXX0000X1ZX"
                value={vendorForm.gstin}
                onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none uppercase font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">City</label>
              <input
                type="text"
                value={vendorForm.city}
                onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">State</label>
              <input
                type="text"
                value={vendorForm.state}
                onChange={(e) => setVendorForm({ ...vendorForm, state: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-semibold text-textSecondary uppercase mb-1">Office / Warehouse Address</label>
              <input
                type="text"
                placeholder="Door No, Street, Industrial Area"
                value={vendorForm.address}
                onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Banking & Credit Terms */}
          <div className="pt-3 border-t border-borderLine">
            <h4 className="font-bold text-navy-800 uppercase mb-2">Banking & Commercial Terms</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Terms (Days)</label>
                <input
                  type="number"
                  required
                  value={vendorForm.paymentTermsDays}
                  onChange={(e) => setVendorForm({ ...vendorForm, paymentTermsDays: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India"
                  value={vendorForm.bankName}
                  onChange={(e) => setVendorForm({ ...vendorForm, bankName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Bank Account Number</label>
                <input
                  type="text"
                  placeholder="Account Number"
                  value={vendorForm.accountNumber}
                  onChange={(e) => setVendorForm({ ...vendorForm, accountNumber: e.target.value })}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  value={vendorForm.ifscCode}
                  onChange={(e) => setVendorForm({ ...vendorForm, ifscCode: e.target.value })}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono uppercase"
                />
              </div>

              {!editingVendor && (
                <div>
                  <label className="block font-semibold text-textSecondary uppercase mb-1">Opening Payable Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={vendorForm.openingBalance}
                    onChange={(e) => setVendorForm({ ...vendorForm, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-borderLine">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vendorForm.isActive}
                onChange={(e) => setVendorForm({ ...vendorForm, isActive: e.target.checked })}
                className="rounded border-borderLine text-primary focus:ring-primary"
              />
              <span className="font-semibold text-navy-800">Vendor is Active for Purchase Orders</span>
            </label>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsAddEditModalOpen(false)}
                className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Save Vendor'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 360° Vendor Profile Modal (Section 8 Requirement) */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title={`Vendor Profile: ${profileData?.vendor?.name || ''}`}
        subtitle={`Supplier 360° view: Products sold, purchase history, invoices, disbursements and financial balances (${profileData?.vendor?.vendor_code || ''})`}
        maxWidth="6xl"
      >
        <div className="space-y-4 text-xs">
          {loadingProfile ? (
            <div className="py-12 text-center text-textSecondary">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <div>Loading vendor profile & histories...</div>
            </div>
          ) : profileData ? (
            <>
              {/* Profile Top Stats */}
              <div className="bg-slate-50 p-3 rounded-lg border border-borderLine grid grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-textSecondary uppercase font-bold block">Current Outstanding</span>
                  <span className="text-base font-bold text-rose-600 font-mono">
                    ₹{parseFloat(profileData.vendor.current_outstanding.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase font-bold block">Payment Terms</span>
                  <span className="font-semibold text-navy-800">{profileData.vendor.payment_terms_days} Days Net</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase font-bold block">GSTIN</span>
                  <span className="font-mono text-textPrimary">{profileData.vendor.gstin || 'Unregistered'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary uppercase font-bold block">Supplier Status</span>
                  <span className="font-bold text-emerald-700">{profileData.vendor.is_active ? 'Active Supplier' : 'Inactive'}</span>
                </div>
              </div>

              {/* Profile Tabs */}
              <div className="flex space-x-2 border-b border-borderLine">
                <button
                  onClick={() => setProfileTab('PRODUCTS')}
                  className={`pb-2 px-3 font-semibold transition-colors flex items-center space-x-1.5 ${
                    profileTab === 'PRODUCTS' ? 'border-b-2 border-primary text-primary font-bold' : 'text-textSecondary hover:text-navy-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Products Sold / Supplied ({profileData.suppliedItems?.length || 0})</span>
                </button>
                <button
                  onClick={() => setProfileTab('OVERVIEW')}
                  className={`pb-2 px-3 font-semibold transition-colors ${
                    profileTab === 'OVERVIEW' ? 'border-b-2 border-primary text-primary font-bold' : 'text-textSecondary hover:text-navy-800'
                  }`}
                >
                  Overview & Banking
                </button>
                <button
                  onClick={() => setProfileTab('POS')}
                  className={`pb-2 px-3 font-semibold transition-colors ${
                    profileTab === 'POS' ? 'border-b-2 border-primary text-primary font-bold' : 'text-textSecondary hover:text-navy-800'
                  }`}
                >
                  Purchase Orders ({profileData.purchaseOrders.length})
                </button>
                <button
                  onClick={() => setProfileTab('INVOICES')}
                  className={`pb-2 px-3 font-semibold transition-colors ${
                    profileTab === 'INVOICES' ? 'border-b-2 border-primary text-primary font-bold' : 'text-textSecondary hover:text-navy-800'
                  }`}
                >
                  Invoices ({profileData.invoices.length})
                </button>
                <button
                  onClick={() => setProfileTab('PAYMENTS')}
                  className={`pb-2 px-3 font-semibold transition-colors ${
                    profileTab === 'PAYMENTS' ? 'border-b-2 border-primary text-primary font-bold' : 'text-textSecondary hover:text-navy-800'
                  }`}
                >
                  Payment History ({profileData.payments.length})
                </button>
                <button
                  onClick={() => setProfileTab('ACTIVITY')}
                  className={`pb-2 px-3 font-semibold transition-colors ${
                    profileTab === 'ACTIVITY' ? 'border-b-2 border-primary text-primary font-bold' : 'text-textSecondary hover:text-navy-800'
                  }`}
                >
                  Activity Trail ({profileData.activityHistory.length})
                </button>
              </div>

              {/* Tab 0: Products Sold / Supplied by Vendor */}
              {profileTab === 'PRODUCTS' && (
                <div className="space-y-3">
                  {(() => {
                    const items = profileData.suppliedItems || [];
                    const filteredItems = items.filter((itm) => {
                      const q = productSearch.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        itm.item_name.toLowerCase().includes(q) ||
                        itm.item_code.toLowerCase().includes(q) ||
                        (itm.brand && itm.brand.toLowerCase().includes(q)) ||
                        (itm.category_name && itm.category_name.toLowerCase().includes(q))
                      );
                    });

                    const totalSpend = items.reduce((s, itm) => s + parseFloat((itm.total_spend as any) || 0), 0);
                    const totalUnits = items.reduce((s, itm) => s + parseFloat((itm.total_received_qty as any) || 0), 0);
                    const avgMargin =
                      items.length > 0
                        ? items.reduce((s, itm) => {
                            const cost = parseFloat((itm.purchase_price as any) || 0);
                            const sell = parseFloat((itm.selling_price as any) || 0);
                            const margin = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
                            return s + margin;
                          }, 0) / items.length
                        : 0;

                    const handleExportVendorProductsCSV = () => {
                      if (items.length === 0) {
                        alert('No products to export for this vendor.');
                        return;
                      }
                      const headers = [
                        'Item Code',
                        'Item Name',
                        'Category',
                        'Brand',
                        'Current Stock',
                        'Units Ordered',
                        'Units Received',
                        'Unit Purchase Cost (INR)',
                        'Total Spend (INR)',
                        'Retail Price (INR)',
                        'Employee Price (INR)',
                        'Margin %',
                        'Last Order Date',
                      ];
                      const rows = items.map((itm) => {
                        const cost = parseFloat((itm.purchase_price as any) || 0);
                        const sell = parseFloat((itm.selling_price as any) || 0);
                        const margin = cost > 0 ? (((sell - cost) / cost) * 100).toFixed(1) : '0.0';
                        return [
                          itm.item_code,
                          `"${itm.item_name}"`,
                          `"${itm.category_name || ''}"`,
                          `"${itm.brand || ''}"`,
                          itm.current_stock,
                          itm.total_ordered_qty,
                          itm.total_received_qty,
                          cost.toFixed(2),
                          parseFloat((itm.total_spend as any) || 0).toFixed(2),
                          sell.toFixed(2),
                          parseFloat((itm.employee_price as any) || 0).toFixed(2),
                          `${margin}%`,
                          itm.last_order_date || '',
                        ];
                      });
                      const csvContent =
                        'data:text/csv;charset=utf-8,' +
                        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute(
                        'download',
                        `${profileData.vendor.vendor_code}_Supplied_Products_${new Date().toISOString().slice(0, 10)}.csv`
                      );
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    };

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-3 rounded-lg border border-borderLine">
                            <span className="text-[10px] text-textSecondary uppercase font-bold block">Commodities Supplied</span>
                            <span className="text-base font-bold text-navy-800">{items.length} Products</span>
                            <span className="text-[10px] text-textSecondary block">Distinct catalog items</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-borderLine">
                            <span className="text-[10px] text-textSecondary uppercase font-bold block">Total Received Qty</span>
                            <span className="text-base font-bold text-navy-800 tabular-nums">
                              {totalUnits.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Units
                            </span>
                            <span className="text-[10px] text-textSecondary block">Delivered into store</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-borderLine">
                            <span className="text-[10px] text-textSecondary uppercase font-bold block">Total Procurement Spend</span>
                            <span className="text-base font-bold text-navy-800 tabular-nums">
                              ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-textSecondary block">Cumulative order volume</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/20">
                            <span className="text-[10px] text-emerald-800 uppercase font-bold block">Average Store Margin</span>
                            <span className="text-base font-bold text-emerald-700 font-mono">
                              +{avgMargin.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-emerald-800/80 block">Retail markup</span>
                          </div>
                        </div>

                        {/* Search & Actions Bar */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="relative w-72">
                            <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search item name, code, brand, category..."
                              value={productSearch}
                              onChange={(e) => setProductSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-borderLine rounded-md text-xs focus:bg-white focus:outline-none"
                            />
                          </div>

                          <button
                            onClick={handleExportVendorProductsCSV}
                            className="flex items-center space-x-1.5 px-3 py-1 rounded-md border border-borderLine bg-white hover:bg-slate-50 text-xs font-semibold text-navy-800 transition-colors shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export Products (CSV)</span>
                          </button>
                        </div>

                        {/* Products Table */}
                        <div className="border border-borderLine rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase sticky top-0 z-10 border-b border-borderLine">
                                <th className="py-2.5 px-3">Commodity Item</th>
                                <th className="py-2.5 px-3">Category</th>
                                <th className="py-2.5 px-3 text-right">In-Stock</th>
                                <th className="py-2.5 px-3 text-right">Units Supplied</th>
                                <th className="py-2.5 px-3 text-right">Purchase Rate (₹)</th>
                                <th className="py-2.5 px-3 text-right font-bold text-navy-800">Total Spend (₹)</th>
                                <th className="py-2.5 px-3 text-right">Retail (₹)</th>
                                <th className="py-2.5 px-3 text-right">Employee (₹)</th>
                                <th className="py-2.5 px-3 text-center">Margin %</th>
                                <th className="py-2.5 px-3 text-center">Last Order</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-borderLine">
                              {filteredItems.length === 0 ? (
                                <tr>
                                  <td colSpan={10} className="py-8 text-center text-textSecondary">
                                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                    <div className="font-semibold text-navy-800">No products recorded for this supplier</div>
                                    <div className="text-[11px] mt-0.5">When purchase orders are issued to this vendor, items will appear here automatically.</div>
                                  </td>
                                </tr>
                              ) : (
                                filteredItems.map((itm) => {
                                  const cost = parseFloat((itm.purchase_price as any) || 0);
                                  const sell = parseFloat((itm.selling_price as any) || 0);
                                  const margin = cost > 0 ? (((sell - cost) / cost) * 100).toFixed(1) : '0.0';
                                  const isLowStock =
                                    parseFloat((itm.current_stock as any) || 0) <=
                                    parseFloat((itm.min_stock as any) || 5);

                                  return (
                                    <tr key={itm.item_id} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-2 px-3">
                                        <div className="font-bold text-navy-800">{itm.item_name}</div>
                                        <div className="text-[10px] text-textSecondary font-mono">
                                          {itm.item_code} &bull; {itm.brand || 'CFECC'}
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 text-textPrimary">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-medium">
                                          {itm.category_name}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums font-bold">
                                        <span className={isLowStock ? 'text-amber-600' : 'text-navy-800'}>
                                          {parseFloat((itm.current_stock as any) || 0).toFixed(0)} {itm.unit_code}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums text-textSecondary">
                                        <div className="font-medium text-navy-800">
                                          {parseFloat((itm.total_received_qty as any) || 0).toFixed(0)} rec&apos;d
                                        </div>
                                        <div className="text-[10px] text-textSecondary">
                                          ({parseFloat((itm.total_ordered_qty as any) || 0).toFixed(0)} ord)
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums text-textSecondary">
                                        ₹{cost.toFixed(2)}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums font-bold text-navy-800">
                                        ₹{parseFloat((itm.total_spend as any) || 0).toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                        })}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums text-textPrimary">
                                        ₹{sell.toFixed(2)}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums font-medium text-primary">
                                        ₹{parseFloat((itm.employee_price as any) || 0).toFixed(2)}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                          +{margin}%
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-center text-textSecondary whitespace-nowrap text-[10px]">
                                        {itm.last_order_date || '-'}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Tab 1: Overview */}
              {profileTab === 'OVERVIEW' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-borderLine space-y-2">
                    <h5 className="font-bold text-navy-800 uppercase text-[11px]">Contact & Address</h5>
                    <div className="space-y-1 text-textSecondary">
                      <div>Contact Person: <strong className="text-navy-800">{profileData.vendor.contact_person || 'N/A'}</strong></div>
                      <div>Phone: <strong className="text-navy-800">{profileData.vendor.phone}</strong></div>
                      <div>Email: <strong className="text-navy-800">{profileData.vendor.email || 'N/A'}</strong></div>
                      <div>Address: <span className="text-navy-800">{profileData.vendor.address || 'N/A'}, {profileData.vendor.city}, {profileData.vendor.state}</span></div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-borderLine space-y-2">
                    <h5 className="font-bold text-navy-800 uppercase text-[11px]">Bank Settlement Account</h5>
                    <div className="space-y-1 text-textSecondary font-mono text-[11px]">
                      <div>Bank: <strong className="text-navy-800 font-sans">{profileData.vendor.bank_name || 'Not provided'}</strong></div>
                      <div>Account #: <strong className="text-navy-800">{profileData.vendor.account_number || 'Not provided'}</strong></div>
                      <div>IFSC Code: <strong className="text-navy-800">{profileData.vendor.ifsc_code || 'Not provided'}</strong></div>
                      <div>Opening Balance: <span className="text-navy-800 font-sans">₹{parseFloat(profileData.vendor.opening_balance.toString()).toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Purchase Orders */}
              {profileTab === 'POS' && (
                <div className="border border-borderLine rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                        <th className="py-2 px-3">PO #</th>
                        <th className="py-2 px-3">Order Date</th>
                        <th className="py-2 px-3">Delivery Date</th>
                        <th className="py-2 px-3 text-center">Items</th>
                        <th className="py-2 px-3 text-right">Amount (₹)</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {profileData.purchaseOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-textSecondary">
                            No purchase orders issued to this supplier yet.
                          </td>
                        </tr>
                      ) : (
                        profileData.purchaseOrders.map((po) => (
                          <tr key={po.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-navy-800">{po.po_number}</td>
                            <td className="py-2 px-3 text-textSecondary">{po.order_date}</td>
                            <td className="py-2 px-3 text-textSecondary">{po.expected_delivery_date || '-'}</td>
                            <td className="py-2 px-3 text-center">{po.item_count} item(s)</td>
                            <td className="py-2 px-3 text-right font-bold text-navy-800 tabular-nums">
                              ₹{parseFloat(po.total_amount).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge status={po.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Invoices */}
              {profileTab === 'INVOICES' && (
                <div className="border border-borderLine rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                        <th className="py-2 px-3">Bill #</th>
                        <th className="py-2 px-3">Vendor Inv #</th>
                        <th className="py-2 px-3">Invoice Date</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3 text-right">Total Amount</th>
                        <th className="py-2 px-3 text-right">Paid Amount</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {profileData.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-textSecondary">
                            No purchase invoices registered for this supplier.
                          </td>
                        </tr>
                      ) : (
                        profileData.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-navy-800">{inv.system_bill_number}</td>
                            <td className="py-2 px-3 font-mono text-textSecondary">{inv.invoice_number}</td>
                            <td className="py-2 px-3 text-textSecondary">{inv.invoice_date}</td>
                            <td className="py-2 px-3 text-textSecondary">{inv.due_date || '-'}</td>
                            <td className="py-2 px-3 text-right font-bold text-navy-800 tabular-nums">
                              ₹{parseFloat(inv.total_amount).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-emerald-700 tabular-nums">
                              ₹{parseFloat(inv.paid_amount).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 4: Payments */}
              {profileTab === 'PAYMENTS' && (
                <div className="border border-borderLine rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                        <th className="py-2 px-3">Payment #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Mode</th>
                        <th className="py-2 px-3">Reference / UTR</th>
                        <th className="py-2 px-3">Bill Ref</th>
                        <th className="py-2 px-3 text-right">Amount Paid (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {profileData.payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-textSecondary">
                            No payment disbursements recorded for this vendor yet.
                          </td>
                        </tr>
                      ) : (
                        profileData.payments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-emerald-700">{pay.payment_number}</td>
                            <td className="py-2 px-3 text-textSecondary">{new Date(pay.payment_date).toLocaleDateString()}</td>
                            <td className="py-2 px-3 font-semibold text-navy-800">{pay.payment_mode}</td>
                            <td className="py-2 px-3 font-mono text-textSecondary">{pay.reference_number || '-'}</td>
                            <td className="py-2 px-3 font-mono text-textSecondary">{pay.system_bill_number || '-'}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                              ₹{parseFloat(pay.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 5: Activity History */}
              {profileTab === 'ACTIVITY' && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {profileData.activityHistory.length === 0 ? (
                    <div className="py-6 text-center text-textSecondary bg-slate-50 rounded-lg">
                      No system audit entries logged for this vendor.
                    </div>
                  ) : (
                    profileData.activityHistory.map((a) => (
                      <div key={a.id} className="p-2.5 bg-slate-50 border border-borderLine rounded-lg flex items-center justify-between">
                        <div>
                          <div className="font-bold text-navy-800">{a.action} Action</div>
                          <div className="text-[10px] text-textSecondary">User: {a.user_name || 'System Admin'} &bull; IP: {a.ip_address || 'localhost'}</div>
                        </div>
                        <span className="text-[10px] text-textSecondary font-mono">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}

          <div className="flex justify-end pt-3 border-t border-borderLine">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
