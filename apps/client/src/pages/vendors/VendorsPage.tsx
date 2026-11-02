import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Vendor } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import { Truck, Search, Plus, Phone, Mail, Building, MapPin } from 'lucide-react';

export const VendorsPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    fetchVendors();
  }, [search]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/vendors?search=${encodeURIComponent(search)}`);
      if (res.data.success) {
        setVendors(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/vendors', form);
      if (res.data.success) {
        setIsAddModalOpen(false);
        fetchVendors();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add vendor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Vendor & Supplier Master</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Authorized suppliers, payment credit terms and purchase accounts
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Vendor</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor name, GSTIN, code..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
          />
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Vendor Details</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">GSTIN</th>
                <th className="py-3 px-4 text-center">Terms</th>
                <th className="py-3 px-4 text-right">Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading vendors...</div>
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-textSecondary">
                    <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No vendor records found.</div>
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-800">{v.name}</div>
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
                    <td className="py-3 px-4 font-mono font-medium text-textSecondary">
                      {v.gstin || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-textSecondary">
                        {v.payment_terms_days} Days
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                      ₹{parseFloat(v.current_outstanding.toString()).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Vendor / Supplier"
        subtitle="Register vendor with GSTIN and credit terms"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateVendor} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. VND-004"
                value={form.vendorCode}
                onChange={(e) => setForm({ ...form, vendorCode: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor Name *</label>
              <input
                type="text"
                required
                placeholder="Company / Agency Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Contact Person</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Phone *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">GSTIN</label>
              <input
                type="text"
                placeholder="37XXXXX0000X1ZX"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Terms (Days)</label>
              <input
                type="number"
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: parseInt(e.target.value, 10) || 30 })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle"
            >
              Save Vendor
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

