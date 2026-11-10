import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Item, Category, ItemPriceHistory } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Tag,
  Search,
  History,
  TrendingUp,
  Percent,
  Download,
  Edit2,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';

interface ItemPricingPageProps {
  hideHeader?: boolean;
}

export const ItemPricingPage: React.FC<ItemPricingPageProps> = ({ hideHeader = false }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Sorting
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Single Item Price Revision Modal
  const [isReviseModalOpen, setIsReviseModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [newPurchasePrice, setNewPurchasePrice] = useState<number>(0);
  const [newSellingPrice, setNewSellingPrice] = useState<number>(0);
  const [newEmployeePrice, setNewEmployeePrice] = useState<number>(0);
  const [revisionReason, setRevisionReason] = useState<string>('Supplier cost update');

  // Single Item History Modal
  const [isItemHistoryModalOpen, setIsItemHistoryModalOpen] = useState<boolean>(false);
  const [itemHistoryList, setItemHistoryList] = useState<ItemPriceHistory[]>([]);
  const [loadingItemHistory, setLoadingItemHistory] = useState<boolean>(false);

  // Bulk Price Update Wizard Modal
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState<boolean>(false);
  const [bulkCategory, setBulkCategory] = useState<string>('ALL');
  const [bulkTargetField, setBulkTargetField] = useState<'selling_price' | 'employee_price'>('selling_price');
  const [bulkPercentage, setBulkPercentage] = useState<number>(5);
  const [bulkReason, setBulkReason] = useState<string>('Annual price revision');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, categoryId, sortBy, sortOrder]);

  const fetchInitialData = async () => {
    try {
      const catRes = await api.get('/items/categories');
      if (catRes.data.success) setCategories(catRes.data.categories);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        categoryId,
        sortBy,
        sortOrder,
        limit: '100',
      });
      const res = await api.get(`/items?${params.toString()}`);
      if (res.data.success) {
        setItems(res.data.data);
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

  const openReviseModal = (item: Item) => {
    setSelectedItem(item);
    setNewPurchasePrice(parseFloat(item.purchase_price.toString()));
    setNewSellingPrice(parseFloat(item.selling_price.toString()));
    setNewEmployeePrice(parseFloat(item.employee_price.toString()));
    setRevisionReason('Vendor cost hike & monthly adjustment');
    setFormError(null);
    setIsReviseModalOpen(true);
  };

  const handleSavePriceRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await api.put(`/items/${selectedItem.id}`, {
        purchasePrice: newPurchasePrice,
        sellingPrice: newSellingPrice,
        employeePrice: newEmployeePrice,
        priceChangeReason: revisionReason,
      });

      if (res.data.success) {
        setIsReviseModalOpen(false);
        fetchItems();
        fetchInitialData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update item pricing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openItemHistory = async (item: Item) => {
    setSelectedItem(item);
    setIsItemHistoryModalOpen(true);
    setLoadingItemHistory(true);
    try {
      const res = await api.get(`/items/${item.id}/price-history`);
      if (res.data.success) {
        setItemHistoryList(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItemHistory(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkPercentage) return;

    if (!window.confirm(`Are you sure you want to apply a ${bulkPercentage > 0 ? '+' : ''}${bulkPercentage}% adjustment to ${bulkTargetField.replace('_', ' ')}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/items/pricing/bulk-update', {
        categoryId: bulkCategory,
        percentageChange: bulkPercentage,
        targetField: bulkTargetField,
        reason: bulkReason,
      });

      if (res.data.success) {
        setIsBulkWizardOpen(false);
        alert(res.data.message);
        fetchItems();
        fetchInitialData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Bulk price update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      alert('No items to export.');
      return;
    }

    const headers = [
      'Item Code',
      'Commodity Name',
      'Category',
      'Unit',
      'Purchase Cost (₹)',
      'Retail Standard Price (₹)',
      'Retail Margin (%)',
      'Subsidized Employee Price (₹)',
      'Employee Subsidy Discount (%)',
      'Subsidy Absorbed (₹/unit)',
      'GST Tax (%)',
    ];

    const rows = items.map((i) => {
      const purchase = parseFloat(i.purchase_price.toString());
      const selling = parseFloat(i.selling_price.toString());
      const emp = parseFloat(i.employee_price.toString());
      const retailMargin = purchase > 0 ? (((selling - purchase) / purchase) * 100).toFixed(1) : '0.0';
      const empDiscount = selling > 0 ? (((selling - emp) / selling) * 100).toFixed(1) : '0.0';
      const absorbed = Math.max(0, selling - emp).toFixed(2);

      return [
        `"${i.item_code}"`,
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.category_name || 'General'}"`,
        `"${i.unit_code}"`,
        purchase.toFixed(2),
        selling.toFixed(2),
        `"${retailMargin}%"`,
        emp.toFixed(2),
        `"${empDiscount}%"`,
        absorbed,
        parseFloat(i.tax_rate.toString()).toFixed(2),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cfecc_pricing_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {!hideHeader ? (
          <div>
            <h2 className="text-xl font-bold text-navy-800">Item Pricing & Margin Control</h2>
            <p className="text-xs text-textSecondary mt-0.5">
              Dual-tier price governance: Standard retail vs Subsidized staff pricing, gross profit margins and audit logs
            </p>
          </div>
        ) : (
          <div className="text-xs font-semibold text-textSecondary flex items-center space-x-1.5">
            <span className="font-bold text-navy-800">Dual-Tier Price Governance</span>
            <span>&bull;</span>
            <span>Retail MRP vs Subsidized Staff Pricing & Gross Margin</span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Price List CSV</span>
          </button>

          <button
            onClick={() => setIsBulkWizardOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bulk Price Adjustment</span>
          </button>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="space-y-4">
          {/* Search & Category Filter */}
          <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search commodity name, item code, barcode..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-textSecondary font-semibold">Category:</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing Table with Standard Format and Auto Screen Adjust */}
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
                        <span>Commodity Details</span>
                        {sortBy === 'name' && (
                          sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4">Category & Unit</th>
                    <th
                      onClick={() => handleSort('purchase_price')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Purchase Cost</span>
                        {sortBy === 'purchase_price' && (
                          sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('selling_price')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Standard Retail</span>
                        {sortBy === 'selling_price' && (
                          sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Retail Margin</th>
                    <th
                      onClick={() => handleSort('employee_price')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-navy-800"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Subsidized Staff Price</span>
                        {sortBy === 'employee_price' && (
                          sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Staff Subsidy</th>
                    <th className="py-3 px-4 text-right">Store Subsidy (₹)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-textSecondary">
                        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                        <div>Loading pricing catalog...</div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-textSecondary">
                        <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <div>No commodities found matching filter criteria.</div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const cost = parseFloat(item.purchase_price.toString());
                      const selling = parseFloat(item.selling_price.toString());
                      const emp = parseFloat(item.employee_price.toString());
                      const marginPct = cost > 0 ? (((selling - cost) / cost) * 100) : 0;
                      const subsidyPct = selling > 0 ? (((selling - emp) / selling) * 100) : 0;
                      const absorbedPerUnit = Math.max(0, selling - emp);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-navy-800">{item.name}</div>
                            <div className="text-[11px] text-textSecondary font-mono">{item.item_code} &bull; {item.brand || 'CFECC'}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-textPrimary">{item.category_name || 'General'}</span>
                            <div className="text-[11px] text-textSecondary font-mono">{item.unit_code}</div>
                          </td>

                          <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                            ₹{cost.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                            ₹{selling.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                marginPct >= 15
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : marginPct > 0
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              +{marginPct.toFixed(1)}%
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className="inline-block px-2 py-0.5 rounded font-bold bg-blue-50 text-primary border border-blue-200">
                              ₹{emp.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {subsidyPct.toFixed(1)}% OFF
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-semibold text-textSecondary tabular-nums">
                            ₹{absorbedPerUnit.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                title="Revise Price Rates"
                                onClick={() => openReviseModal(item)}
                                className="p-1 hover:bg-slate-100 rounded text-textSecondary hover:text-primary transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Price History Log"
                                onClick={() => openItemHistory(item)}
                                className="p-1 hover:bg-slate-100 rounded text-textSecondary hover:text-navy-800 transition-colors"
                              >
                                <History className="w-3.5 h-3.5" />
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

            {/* Standard Floating Summary Footer */}
            <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
              <div>
                Showing <span className="font-bold text-navy-800 font-mono">{items.length}</span> commodities under pricing control
              </div>
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="text-slate-600 font-medium">
                  Dual Pricing: <strong className="text-navy-800">100% Active</strong>
                </span>
                <span className="text-emerald-700 font-medium font-mono">
                  Subsidy Configured: {items.filter((i: any) => parseFloat(String(i.employee_price || 0)) < parseFloat(String(i.selling_price || 0))).length} items
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* Revise Price Rates Modal */}
      <Modal
        isOpen={isReviseModalOpen}
        onClose={() => setIsReviseModalOpen(false)}
        title={`Revise Prices: ${selectedItem?.name || ''}`}
        subtitle={`Adjust cost, retail and staff subsidized pricing for ${selectedItem?.item_code || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSavePriceRevision} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Purchase Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newPurchasePrice}
                onChange={(e) => setNewPurchasePrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Standard Retail (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newSellingPrice}
                onChange={(e) => setNewSellingPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums font-mono font-bold text-navy-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-primary uppercase mb-1">Subsidized Staff (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newEmployeePrice}
                onChange={(e) => setNewEmployeePrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-blue-300 rounded-lg bg-blue-50/50 focus:bg-white focus:outline-none tabular-nums font-mono font-bold text-primary"
              />
            </div>
          </div>

          {/* Live Margin Preview Box */}
          <div className="bg-slate-50 p-3 rounded-lg border border-borderLine grid grid-cols-2 gap-3 text-center">
            <div>
              <span className="text-[10px] text-textSecondary uppercase font-bold block">Gross Retail Margin</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {newPurchasePrice > 0 ? `+${(((newSellingPrice - newPurchasePrice) / newPurchasePrice) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-primary uppercase font-bold block">Employee Subsidy Discount</span>
              <span className="text-sm font-bold text-primary font-mono">
                {newSellingPrice > 0 ? `${(((newSellingPrice - newEmployeePrice) / newSellingPrice) * 100).toFixed(1)}% OFF` : '0%'}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Revision Reason (for Audit Log) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Supplier invoice revision, Wholesale price cut"
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsReviseModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Authorize Price Revision'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Price Update Wizard Modal */}
      <Modal
        isOpen={isBulkWizardOpen}
        onClose={() => setIsBulkWizardOpen(false)}
        title="Bulk Price Adjustment Wizard"
        subtitle="Apply percentage markups or discounts across categories with audit tracking"
        maxWidth="md"
      >
        <form onSubmit={handleBulkUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Target Category *</label>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">Entire Store Inventory (All Items)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Pricing Tier to Adjust *</label>
            <select
              value={bulkTargetField}
              onChange={(e) => setBulkTargetField(e.target.value as any)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="selling_price">Standard Retail Selling Price</option>
              <option value="employee_price">Subsidized Employee Store Price</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Percentage Change (%) *</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="0.5"
                required
                value={bulkPercentage}
                onChange={(e) => setBulkPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold tabular-nums"
              />
              <span className="font-bold text-navy-800 text-sm">%</span>
            </div>
            <p className="text-[10px] text-textSecondary mt-1">
              Enter positive value to increase prices (e.g. 5 for +5%) or negative value to reduce prices (e.g. -10 for -10%).
            </p>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Reason for Revision *</label>
            <input
              type="text"
              required
              placeholder="e.g. General inflation rate revision, Annual subsidy festival discount"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsBulkWizardOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Applying...' : 'Apply Bulk Adjustment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Single Item History Modal */}
      <Modal
        isOpen={isItemHistoryModalOpen}
        onClose={() => setIsItemHistoryModalOpen(false)}
        title={`Price History: ${selectedItem?.name || ''}`}
        subtitle={`Audit log of all price revisions for ${selectedItem?.item_code || ''}`}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {loadingItemHistory ? (
            <div className="py-8 text-center text-textSecondary">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <div>Loading revision history...</div>
            </div>
          ) : itemHistoryList.length === 0 ? (
            <div className="py-8 text-center text-textSecondary bg-slate-50 rounded-lg">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <div>No price revisions recorded yet for this item.</div>
            </div>
          ) : (
            <div className="divide-y divide-borderLine border border-borderLine rounded-lg overflow-hidden">
              {itemHistoryList.map((h) => (
                <div key={h.id} className="p-3 bg-white hover:bg-slate-50 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-800">{h.reason || 'Price Revision'}</span>
                    <span className="text-[11px] text-textSecondary font-mono">{new Date(h.created_at).toLocaleString()}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-borderLine/50 text-[11px]">
                    <div>
                      <div className="text-textSecondary uppercase text-[9px] font-bold">Purchase Cost</div>
                      <div className="font-mono mt-0.5">
                        <span className="text-slate-400 line-through">₹{parseFloat(h.old_purchase_price.toString()).toFixed(2)}</span>
                        <span className="mx-1 text-slate-400">&rarr;</span>
                        <span className="font-bold text-navy-800">₹{parseFloat(h.new_purchase_price.toString()).toFixed(2)}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-textSecondary uppercase text-[9px] font-bold">Selling Price</div>
                      <div className="font-mono mt-0.5">
                        <span className="text-slate-400 line-through">₹{parseFloat(h.old_selling_price.toString()).toFixed(2)}</span>
                        <span className="mx-1 text-slate-400">&rarr;</span>
                        <span className="font-bold text-navy-800">₹{parseFloat(h.new_selling_price.toString()).toFixed(2)}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-primary uppercase text-[9px] font-bold">Employee Price</div>
                      <div className="font-mono mt-0.5">
                        <span className="text-blue-300 line-through">₹{parseFloat(h.old_employee_price.toString()).toFixed(2)}</span>
                        <span className="mx-1 text-slate-400">&rarr;</span>
                        <span className="font-bold text-primary">₹{parseFloat(h.new_employee_price.toString()).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {h.changed_by_name && (
                    <div className="text-[10px] text-textSecondary text-right">
                      Authorized by: <strong className="text-navy-800">{h.changed_by_name}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-borderLine">
            <button
              onClick={() => setIsItemHistoryModalOpen(false)}
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

