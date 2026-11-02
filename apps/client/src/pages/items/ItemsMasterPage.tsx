import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Item, Category, Unit } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  Tag,
  Barcode,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

export const ItemsMasterPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // Add Item Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [form, setForm] = useState({
    itemCode: '',
    name: '',
    categoryId: '',
    brand: '',
    unitId: '',
    barcode: '',
    purchasePrice: 0,
    sellingPrice: 0,
    employeePrice: 0,
    minStock: 5,
    reorderLevel: 10,
    taxRate: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, categoryId, lowStockOnly]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/items/categories');
      if (res.data.success) {
        setCategories(res.data.categories);
        setUnits(res.data.units);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        categoryId,
        lowStockOnly: lowStockOnly.toString(),
      });
      const res = await api.get(`/items?${params.toString()}`);
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load items', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...form,
        categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
        unitId: form.unitId ? parseInt(form.unitId, 10) : null,
        purchasePrice: parseFloat(form.purchasePrice.toString()),
        sellingPrice: parseFloat(form.sellingPrice.toString()),
        employeePrice: parseFloat(form.employeePrice.toString()),
        minStock: parseFloat(form.minStock.toString()),
        reorderLevel: parseFloat(form.reorderLevel.toString()),
        taxRate: parseFloat(form.taxRate.toString()),
      };

      const res = await api.post('/items', payload);
      if (res.data.success) {
        setIsAddModalOpen(false);
        fetchItems();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Store Items Master</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Commodity catalog, dual pricing (Regular vs Subsidized Employee Price) and reorder thresholds
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Store Item</span>
        </button>
      </div>

      {/* Filter and Category Pills */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, item name, barcode..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                lowStockOnly
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-surface text-textSecondary border-borderLine hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Low Stock Alerts Only</span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex space-x-2 overflow-x-auto pt-2 border-t border-borderLine">
          <button
            onClick={() => setCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              categoryId === 'ALL'
                ? 'bg-navy-800 text-white'
                : 'bg-slate-100 text-textSecondary hover:text-textPrimary'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id.toString())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                categoryId === c.id.toString()
                  ? 'bg-navy-800 text-white'
                  : 'bg-slate-100 text-textSecondary hover:text-textPrimary'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Item Details</th>
                <th className="py-3 px-4">Category & Unit</th>
                <th className="py-3 px-4">Barcode / SKU</th>
                <th className="py-3 px-4 text-right">Purchase Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">Employee Price</th>
                <th className="py-3 px-4 text-right">Stock Level</th>
                <th className="py-3 px-4 text-center">Tax %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading store items...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-textSecondary">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No items found matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isLow = parseFloat(item.current_stock.toString()) <= parseFloat(item.min_stock.toString());
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{item.name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">{item.item_code} &bull; {item.brand || 'CFECC'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-textPrimary">{item.category_name || 'General'}</span>
                        <div className="text-[11px] text-textSecondary">{item.unit_code}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-textSecondary">
                        {item.barcode ? (
                          <span className="flex items-center space-x-1">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.barcode}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                        ₹{parseFloat(item.purchase_price.toString()).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-navy-800 tabular-nums">
                        ₹{parseFloat(item.selling_price.toString()).toFixed(2)}
                      </td>

                      {/* Subsidized Employee Price highlighted */}
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className="inline-block px-2 py-0.5 rounded font-bold bg-blue-50 text-primary border border-blue-200">
                          ₹{parseFloat(item.employee_price.toString()).toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right tabular-nums">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-bold ${
                            isLow
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />}
                          {parseFloat(item.current_stock.toString())} {item.unit_code}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-medium text-textSecondary">
                        {parseFloat(item.tax_rate.toString())}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Store Item"
        subtitle="Configure item codes, dual pricing and inventory control thresholds"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Item Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. ITM-011"
                value={form.itemCode}
                onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Item Name *</label>
              <input
                type="text"
                required
                placeholder="Item Name & Specification"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Unit of Measurement</label>
              <select
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Brand</label>
              <input
                type="text"
                placeholder="Manufacturer or Brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Barcode</label>
              <input
                type="text"
                placeholder="Scan or Enter EAN"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-borderLine">
            <h4 className="font-bold text-navy-800 uppercase mb-2">Dual Pricing Configuration (₹)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Purchase Cost</label>
                <input
                  type="number"
                  required
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Standard Selling Price</label>
                <input
                  type="number"
                  required
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary uppercase mb-1">Employee Subsidized Price</label>
                <input
                  type="number"
                  required
                  value={form.employeePrice}
                  onChange={(e) => setForm({ ...form, employeePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-blue-300 rounded-lg bg-blue-50/50 focus:bg-white focus:outline-none tabular-nums font-bold text-primary"
                />
              </div>
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Store Item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

