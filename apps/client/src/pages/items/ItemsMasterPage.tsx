import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Item, Category, Unit, ItemPriceHistory } from '../../types/index.js';
import { Modal } from '../../components/ui/Modal.js';
import { BarcodeSvg } from '../../components/ui/BarcodeSvg.js';
import { FloatingActionBar } from '../../components/ui/FloatingActionBar.js';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  Barcode,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  History,
  Edit2,
  SlidersHorizontal,
  CheckSquare,
  Square,
  FolderPlus,
  CheckCircle,
  Printer,
} from 'lucide-react';

interface ItemsMasterPageProps {
  hideHeader?: boolean;
}

export const ItemsMasterPage: React.FC<ItemsMasterPageProps> = ({ hideHeader = false }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Sorting
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Selected rows for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState<boolean>(false);

  // Column Visibility
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState({
    hsn: true,
    batch1: true,
    batch2: true,
    purchasePrice: true,
    sellingPrice: true,
    stockLevel: true,
    stockValue: true,
    cgst: true,
    sgst: true,
    igst: true,
    status: true,
  });

  const columnLabels: Record<string, string> = {
    hsn: 'HSN Code',
    batch1: 'Batch 1 (Rate & Qty)',
    batch2: 'Batch 2 (Rate & Qty)',
    purchasePrice: 'Purchase Cost (PRATE)',
    sellingPrice: 'Selling Rate (SRATE)',
    stockLevel: 'Stock QTY (Balance)',
    stockValue: 'Stock Value (₹)',
    cgst: 'CGST %',
    sgst: 'SGST %',
    igst: 'IGST %',
    status: 'Active Status',
  };

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({
    itemCode: '',
    name: '',
    categoryId: '',
    subcategory: '',
    brand: '',
    description: '',
    unitId: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    purchasePrice: 0,
    sellingPrice: 0,
    employeePrice: 0,
    minStock: 5,
    reorderLevel: 10,
    taxRate: 0,
    imageUrl: '',
    isActive: true,
    priceChangeReason: '',
  });

  // Price History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<Item | null>(null);
  const [priceHistory, setPriceHistory] = useState<ItemPriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Manage Categories & Units Modal
  const [isCatUnitModalOpen, setIsCatUnitModalOpen] = useState<boolean>(false);
  const [catUnitTab, setCatUnitTab] = useState<'CATEGORIES' | 'UNITS'>('CATEGORIES');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitPrec, setNewUnitPrec] = useState(0);
  const [catUnitError, setCatUnitError] = useState<string | null>(null);

  // Barcode Sticker Printing Modal
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [stickerCopies, setStickerCopies] = useState<number>(2);
  const [stickerFormat, setStickerFormat] = useState<'ROLL_50x25' | 'A4_24' | 'A4_30'>('ROLL_50x25');
  const [barcodeTargetItems, setBarcodeTargetItems] = useState<Item[]>([]);

  // Form Submission
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, categoryId, lowStockOnly, includeInactive, sortBy, sortOrder]);

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
        includeInactive: includeInactive.toString(),
        sortBy,
        sortOrder,
        limit: '100',
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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setItemForm({
      itemCode: '',
      name: '',
      categoryId: categories[0]?.id?.toString() || '',
      subcategory: '',
      brand: '',
      description: '',
      unitId: units[0]?.id?.toString() || '',
      sku: '',
      barcode: '',
      hsnCode: '',
      purchasePrice: 0,
      sellingPrice: 0,
      employeePrice: 0,
      minStock: 5,
      reorderLevel: 10,
      taxRate: 0,
      imageUrl: '',
      isActive: true,
      priceChangeReason: '',
    });
    setFormError(null);
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      itemCode: item.item_code,
      name: item.name,
      categoryId: item.category_id?.toString() || '',
      subcategory: item.subcategory || '',
      brand: item.brand || '',
      description: item.description || '',
      unitId: item.unit_id?.toString() || '',
      sku: item.sku || '',
      barcode: item.barcode || '',
      hsnCode: item.hsn_code || '',
      purchasePrice: parseFloat(item.purchase_price.toString()),
      sellingPrice: parseFloat(item.selling_price.toString()),
      employeePrice: parseFloat(item.employee_price.toString()),
      minStock: parseFloat(item.min_stock.toString()),
      reorderLevel: parseFloat(item.reorder_level.toString()),
      taxRate: parseFloat(item.tax_rate.toString()),
      imageUrl: item.image_url || '',
      isActive: item.is_active,
      priceChangeReason: 'Scheduled Price Revision',
    });
    setFormError(null);
    setIsAddEditModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        itemCode: itemForm.itemCode,
        name: itemForm.name,
        categoryId: itemForm.categoryId ? parseInt(itemForm.categoryId, 10) : null,
        subcategory: itemForm.subcategory || null,
        brand: itemForm.brand || null,
        description: itemForm.description || null,
        unitId: itemForm.unitId ? parseInt(itemForm.unitId, 10) : null,
        sku: itemForm.sku || null,
        barcode: itemForm.barcode || null,
        hsnCode: itemForm.hsnCode || null,
        purchasePrice: parseFloat(itemForm.purchasePrice.toString()) || 0,
        sellingPrice: parseFloat(itemForm.sellingPrice.toString()) || 0,
        employeePrice: parseFloat(itemForm.employeePrice.toString()) || 0,
        minStock: parseFloat(itemForm.minStock.toString()) || 0,
        reorderLevel: parseFloat(itemForm.reorderLevel.toString()) || 0,
        taxRate: parseFloat(itemForm.taxRate.toString()) || 0,
        imageUrl: itemForm.imageUrl || null,
        isActive: itemForm.isActive,
        priceChangeReason: itemForm.priceChangeReason || undefined,
      };

      if (editingItem) {
        const res = await api.put(`/items/${editingItem.id}`, payload);
        if (res.data.success) {
          setIsAddEditModalOpen(false);
          fetchItems();
        }
      } else {
        const res = await api.post('/items', payload);
        if (res.data.success) {
          setIsAddEditModalOpen(false);
          fetchItems();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save item details');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPriceHistory = async (item: Item) => {
    setSelectedItemForHistory(item);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/items/${item.id}/price-history`);
      if (res.data.success) {
        setPriceHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load price history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatUnitError(null);
    try {
      const res = await api.post('/items/categories', {
        code: newCatCode,
        name: newCatName,
        description: newCatDesc,
      });
      if (res.data.success) {
        setNewCatCode('');
        setNewCatName('');
        setNewCatDesc('');
        fetchCategories();
      }
    } catch (err: any) {
      setCatUnitError(err.response?.data?.message || 'Failed to create category');
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatUnitError(null);
    try {
      const res = await api.post('/items/units', {
        code: newUnitCode,
        name: newUnitName,
        precision: newUnitPrec,
      });
      if (res.data.success) {
        setNewUnitCode('');
        setNewUnitName('');
        setNewUnitPrec(0);
        fetchCategories();
      }
    } catch (err: any) {
      setCatUnitError(err.response?.data?.message || 'Failed to create unit');
    }
  };

  const handleBulkAction = async (action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE') => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} ${selectedIds.length} selected item(s)?`)) return;

    setIsBulkOperating(true);
    try {
      const res = await api.post('/items/bulk-action', {
        itemIds: selectedIds,
        action,
      });
      if (res.data.success) {
        setSelectedIds([]);
        fetchItems();
      }
    } catch (err) {
      console.error('Failed bulk action', err);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleSelectRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleOpenBulkBarcodePrint = () => {
    const selected = items.filter((i) => selectedIds.includes(i.id));
    setBarcodeTargetItems(selected);
    setIsBarcodeModalOpen(true);
  };

  const handleOpenSingleBarcodePrint = (item: Item) => {
    setBarcodeTargetItems([item]);
    setIsBarcodeModalOpen(true);
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      alert('No items to export.');
      return;
    }

    const headers = [
      'Item Code',
      'Item Name',
      'HSN Code',
      'Batch 1 Rate',
      'Batch 1 Qty',
      'Batch 2 Rate',
      'Batch 2 Qty',
      'Purchase Cost',
      'Selling Rate',
      'Current Stock',
      'Stock Value',
      'CGST %',
      'SGST %',
      'IGST %',
      'Status',
    ];

    const rows = items.map((i) => [
      `"${i.item_code}"`,
      `"${i.name.replace(/"/g, '""')}"`,
      `"${i.hsn_code || ''}"`,
      parseFloat(String(i.batch1_rate || i.selling_price || 0)).toFixed(2),
      parseFloat(String(i.batch1_qty || 0)).toFixed(3),
      parseFloat(String(i.batch2_rate || 0)).toFixed(2),
      parseFloat(String(i.batch2_qty || 0)).toFixed(3),
      parseFloat(String(i.purchase_rate1 || i.purchase_price || 0)).toFixed(2),
      parseFloat(String(i.selling_price || i.batch1_rate || 0)).toFixed(2),
      parseFloat(String(i.current_stock || 0)).toFixed(3),
      parseFloat(String(i.stock_value || 0)).toFixed(2),
      parseFloat(String(i.cgst_rate || 0)).toFixed(2),
      parseFloat(String(i.sgst_rate || 0)).toFixed(2),
      parseFloat(String(i.igst_rate || 0)).toFixed(2),
      i.is_active ? 'Active' : 'Inactive',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cfecc_store_items_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderBatchExpiry = (expiryDate?: string | null) => {
    if (!expiryDate) return null;
    const raw = String(expiryDate).split('T')[0];
    const parts = raw.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const expDate = new Date(year, month, day);
    if (isNaN(expDate.getTime())) return null;

    const formatted = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-1 whitespace-nowrap" title={`Expired on ${formatted}`}>
          <span>⛔ Exp: {formatted}</span>
        </div>
      );
    }

    if (diffDays <= 30) {
      return (
        <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 mt-1 whitespace-nowrap" title={`Expiring in ${diffDays} days (${formatted})`}>
          <span>⚠️ Exp: {formatted}</span>
        </div>
      );
    }

    return (
      <div className="text-[10px] text-slate-500 font-mono mt-0.5 whitespace-nowrap" title={`Expiry: ${formatted}`}>
        Exp: {formatted}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {!hideHeader ? (
          <div>
            <h2 className="text-xl font-bold text-navy-800">Store Items Master</h2>
            <p className="text-xs text-textSecondary mt-0.5">
              Commodity catalog, dual pricing (Regular vs Subsidized Employee Price) and inventory control thresholds
            </p>
          </div>
        ) : (
          <div className="text-xs font-semibold text-textSecondary flex items-center space-x-1.5">
            <span className="font-bold text-navy-800">Commodity Master Catalog</span>
            <span>&bull;</span>
            <span>{items.length} Registered Products</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCatUnitModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <FolderPlus className="w-3.5 h-3.5 text-navy-800" />
            <span>Categories & Units</span>
          </button>
        </div>
      </div>

      {/* Filter and Category Pills */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, barcode, brand, SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${lowStockOnly
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-surface text-textSecondary border-borderLine hover:bg-slate-50'
                }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Low Stock Alerts</span>
            </button>

            <button
              onClick={() => setIncludeInactive(!includeInactive)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${includeInactive
                ? 'bg-slate-200 text-navy-800 border-slate-300'
                : 'bg-surface text-textSecondary border-borderLine hover:bg-slate-50'
                }`}
            >
              <span>{includeInactive ? 'Showing Inactive' : 'Active Only'}</span>
            </button>

            {/* Column Visibility Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Columns</span>
              </button>

              {showColumnDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-borderLine rounded-lg shadow-lg z-20 p-2 space-y-1 text-xs">
                  {Object.entries(visibleColumns).map(([key, isVis]) => (
                    <label key={key} className="flex items-center space-x-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVis}
                        onChange={() => setVisibleColumns({ ...visibleColumns, [key]: !isVis })}
                        className="rounded border-borderLine text-primary focus:ring-primary"
                      />
                      <span>{columnLabels[key] || key}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex space-x-2 overflow-x-auto pt-2 border-t border-borderLine scrollbar-none">
          <button
            onClick={() => setCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${categoryId === 'ALL'
              ? 'bg-navy-800 text-white'
              : 'bg-slate-100 text-textSecondary hover:text-textPrimary'
              }`}
          >
            All Categories ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id.toString())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${categoryId === c.id.toString()
                ? 'bg-navy-800 text-white'
                : 'bg-slate-100 text-textSecondary hover:text-textPrimary'
                }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      <FloatingActionBar
        selectedCount={selectedIds.length}
        totalCount={items.length}
        itemLabel="items"
        onClear={() => setSelectedIds([])}
      >
        <button
          type="button"
          onClick={handleOpenBulkBarcodePrint}
          className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5 border border-navy-700"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" />
          <span>Print Barcodes</span>
        </button>
        <button
          type="button"
          disabled={isBulkOperating}
          onClick={() => handleBulkAction('ACTIVATE')}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
        >
          Mark Active
        </button>
        <button
          type="button"
          disabled={isBulkOperating}
          onClick={() => handleBulkAction('DEACTIVATE')}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
        >
          Mark Inactive
        </button>
      </FloatingActionBar>

      {/* Items Table with Standard Format and Auto Screen Adjust */}
      <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3 w-8 text-center">
                  <button onClick={toggleSelectAll} className="text-textSecondary hover:text-navy-800">
                    {selectedIds.length > 0 && selectedIds.length === items.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('item_code')}
                  className="py-3 px-3 cursor-pointer hover:text-navy-800 whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>Item Code</span>
                    {sortBy === 'item_code' ? (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-navy-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Item Name</span>
                    {sortBy === 'name' ? (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                {visibleColumns.hsn && <th className="py-3 px-3">HSN Code</th>}
                {visibleColumns.batch1 && <th className="py-3 px-3 text-right">Batch 1 (Rate / Qty / Exp)</th>}
                {visibleColumns.batch2 && <th className="py-3 px-3 text-right">Batch 2 (Rate / Qty / Exp)</th>}
                {visibleColumns.purchasePrice && (
                  <th
                    onClick={() => handleSort('purchase_price')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Purchase Cost</span>
                      {sortBy === 'purchase_price' && (
                        sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.sellingPrice && (
                  <th
                    onClick={() => handleSort('selling_price')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Selling Rate</span>
                      {sortBy === 'selling_price' && (
                        sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.stockLevel && (
                  <th
                    onClick={() => handleSort('current_stock')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Stock QTY</span>
                      {sortBy === 'current_stock' && (
                        sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.stockValue && (
                  <th
                    onClick={() => handleSort('stock_value')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-navy-800"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Stock Value (₹)</span>
                      {sortBy === 'stock_value' && (
                        sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.cgst && <th className="py-3 px-2 text-center">CGST %</th>}
                {visibleColumns.sgst && <th className="py-3 px-2 text-center">SGST %</th>}
                {visibleColumns.igst && <th className="py-3 px-2 text-center font-bold text-blue-900 bg-blue-50/70">IGST %</th>}
                {visibleColumns.status && <th className="py-3 px-3 text-center">Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading store items...</div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-textSecondary">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No items found matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const b1Qty = parseFloat(String(item.batch1_qty || 0));
                  const b2Qty = parseFloat(String(item.batch2_qty || 0));
                  const effectiveStock = b1Qty + b2Qty;
                  const isLow = effectiveStock <= parseFloat(String(item.min_stock || 0));
                  const isSelected = selectedIds.includes(item.id);
                  const sellingRate = parseFloat(String(item.selling_price || item.batch1_rate || 0));
                  const b1Rate = parseFloat(String(item.batch1_rate || 0)) || sellingRate;
                  const b2Rate = parseFloat(String(item.batch2_rate || 0)) || sellingRate;
                  const effectiveStockValue = (b1Qty * b1Rate) + (b2Qty * b2Rate);

                  // Active Selling Rate & Purchase Cost follow FIFO:
                  // 1) If Batch 1 has stock, Batch 1 is being actively sold.
                  // 2) If Batch 1 is 0 and Batch 2 has stock, Batch 2 is the active stock in store.
                  // 3) If out of stock, use catalog reference prices.
                  const activeSellingRate = b1Qty > 0
                    ? b1Rate
                    : b2Qty > 0
                      ? b2Rate
                      : sellingRate;

                  const pRate1 = parseFloat(String(item.purchase_rate1 || 0));
                  const pRate2 = parseFloat(String(item.purchase_rate2 || 0));
                  const basePur = parseFloat(String(item.purchase_price || 0));

                  const activePurchaseCost = b1Qty > 0
                    ? (pRate1 > 0 ? pRate1 : basePur)
                    : b2Qty > 0
                      ? (pRate2 > 0 ? pRate2 : basePur)
                      : (basePur > 0 ? basePur : (pRate1 > 0 ? pRate1 : pRate2));
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => toggleSelectRow(item.id)} className="text-textSecondary hover:text-navy-800">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-primary text-xs">
                          {item.item_code}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{item.name}</div>
                        <div className="text-[11px] text-textSecondary flex items-center space-x-1.5 mt-0.5">
                          {/* <span>{item.category_name || item.brand || 'CFECC'}</span> */}
                          {item.unit_code && (
                            <>
                              <span>&bull;</span>
                              <span className="text-slate-500 font-mono">{item.unit_code}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {visibleColumns.hsn && (
                        <td className="py-3 px-3">
                          <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                            {item.hsn_code || '-'}
                          </span>
                        </td>
                      )}

                      {visibleColumns.batch1 && (
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <div className="font-bold text-navy-900">
                            ₹{parseFloat(String(item.batch1_rate || item.selling_price || 0)).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Qty: {parseFloat(String(item.batch1_qty || 0)).toFixed(1)}
                          </div>
                          {renderBatchExpiry(item.batch1_expiry)}
                        </td>
                      )}

                      {visibleColumns.batch2 && (
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {parseFloat(String(item.batch2_rate || 0)) > 0 || parseFloat(String(item.batch2_qty || 0)) > 0 ? (
                            <>
                              <div className="font-bold text-amber-800">
                                ₹{parseFloat(String(item.batch2_rate || 0)).toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Qty: {parseFloat(String(item.batch2_qty || 0)).toFixed(1)}
                              </div>
                              {renderBatchExpiry(item.batch2_expiry)}
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {visibleColumns.purchasePrice && (
                        <td className="py-3 px-3 text-right font-medium text-textSecondary font-mono tabular-nums">
                          ₹{activePurchaseCost.toFixed(2)}
                        </td>
                      )}

                      {visibleColumns.sellingPrice && (
                        <td className="py-3 px-3 text-right font-bold text-navy-900 font-mono tabular-nums">
                          ₹{activeSellingRate.toFixed(2)}
                        </td>
                      )}

                      {visibleColumns.stockLevel && (
                        <td className="py-3 px-3 text-right tabular-nums">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded font-bold font-mono text-xs ${isLow
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700'
                              }`}
                          >
                            {isLow && <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />}
                            {effectiveStock.toFixed(1)}
                          </span>
                        </td>
                      )}

                      {visibleColumns.stockValue && (
                        <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                          ₹{effectiveStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}

                      {visibleColumns.cgst && (
                        <td className="py-3 px-2 text-center font-mono text-slate-700 tabular-nums text-xs">
                          {parseFloat(String(item.cgst_rate || 0)).toFixed(2)}%
                        </td>
                      )}

                      {visibleColumns.sgst && (
                        <td className="py-3 px-2 text-center font-mono text-slate-700 tabular-nums text-xs">
                          {parseFloat(String(item.sgst_rate || 0)).toFixed(2)}%
                        </td>
                      )}

                      {visibleColumns.igst && (
                        <td className="py-3 px-2 text-center font-mono font-bold text-blue-900 bg-blue-50/50 tabular-nums text-xs">
                          {parseFloat(String(item.igst_rate || 0)).toFixed(2)}%
                        </td>
                      )}

                      {visibleColumns.status && (
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}
                          >
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      )}
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
            Showing <span className="font-bold text-navy-800 font-mono">{items.length}</span> items across{' '}
            <span className="font-bold text-navy-800 font-mono">{categories.length}</span> active categories
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>In Stock: {items.filter((i) => (parseFloat(String(i.batch1_qty || 0)) + parseFloat(String(i.batch2_qty || 0))) > 0).length}</span>
            </span>
            <span className="flex items-center space-x-1 text-rose-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Low Stock: {items.filter((i) => (parseFloat(String(i.batch1_qty || 0)) + parseFloat(String(i.batch2_qty || 0))) <= parseFloat(String(i.min_stock || 0))).length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Price History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Price Revision History: ${selectedItemForHistory?.name || ''}`}
        subtitle={`Audit trail of all retail and subsidized employee pricing adjustments (${selectedItemForHistory?.item_code || ''})`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          {loadingHistory ? (
            <div className="py-8 text-center text-textSecondary">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <div>Loading price revision history...</div>
            </div>
          ) : priceHistory.length === 0 ? (
            <div className="py-8 text-center text-textSecondary bg-slate-50 rounded-lg">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <div>No price revisions recorded yet for this item.</div>
              <div className="text-[11px] text-slate-400 mt-1">Changes made to purchase, retail, or employee price will be logged here.</div>
            </div>
          ) : (
            <div className="divide-y divide-borderLine border border-borderLine rounded-lg overflow-hidden">
              {priceHistory.map((h) => (
                <div key={h.id} className="p-3 bg-white hover:bg-slate-50 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-800">{h.reason || 'Price Revision'}</span>
                    <span className="text-[11px] text-textSecondary font-mono">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
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
                    <div className="text-[10px] text-textSecondary flex items-center justify-end">
                      <span>Changed by: <strong className="text-navy-800">{h.changed_by_name}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-borderLine">
            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Categories & Units Management Modal */}
      <Modal
        isOpen={isCatUnitModalOpen}
        onClose={() => setIsCatUnitModalOpen(false)}
        title="Manage Categories & Units"
        subtitle="Configure classification hierarchy and measurement standards for inventory"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          {catUnitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {catUnitError}
            </div>
          )}

          <div className="flex space-x-2 border-b border-borderLine">
            <button
              onClick={() => setCatUnitTab('CATEGORIES')}
              className={`pb-2 px-3 font-semibold transition-colors ${catUnitTab === 'CATEGORIES'
                ? 'border-b-2 border-primary text-primary font-bold'
                : 'text-textSecondary hover:text-textPrimary'
                }`}
            >
              Item Categories ({categories.length})
            </button>
            <button
              onClick={() => setCatUnitTab('UNITS')}
              className={`pb-2 px-3 font-semibold transition-colors ${catUnitTab === 'UNITS'
                ? 'border-b-2 border-primary text-primary font-bold'
                : 'text-textSecondary hover:text-textPrimary'
                }`}
            >
              Units of Measurement ({units.length})
            </button>
          </div>

          {catUnitTab === 'CATEGORIES' ? (
            <div className="space-y-4">
              <form onSubmit={handleCreateCategory} className="bg-slate-50 p-3 rounded-lg border border-borderLine space-y-3">
                <h5 className="font-bold text-navy-800 uppercase text-[11px]">Add New Category</h5>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. DAIRY, SPICES)"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    className="px-3 py-1.5 border border-borderLine rounded bg-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Name (e.g. Dairy & Frozen)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="px-3 py-1.5 border border-borderLine rounded bg-white"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Description (Optional)"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-borderLine rounded bg-white"
                  />
                  <button type="submit" className="px-4 py-1.5 bg-primary text-white font-semibold rounded hover:bg-primary-hover">
                    Add Category
                  </button>
                </div>
              </form>

              <div className="border border-borderLine rounded-lg max-h-56 overflow-y-auto divide-y divide-borderLine">
                {categories.map((c) => (
                  <div key={c.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-navy-800">{c.name}</div>
                      <div className="text-[10px] text-textSecondary font-mono">{c.code} &bull; {c.description || 'No description'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">Active</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleCreateUnit} className="bg-slate-50 p-3 rounded-lg border border-borderLine space-y-3">
                <h5 className="font-bold text-navy-800 uppercase text-[11px]">Add New Measurement Unit</h5>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. BTL, CRT)"
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    className="px-3 py-1.5 border border-borderLine rounded bg-white font-mono uppercase"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Name (e.g. Bottle, Carton)"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    className="px-3 py-1.5 border border-borderLine rounded bg-white"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="3"
                      value={newUnitPrec}
                      onChange={(e) => setNewUnitPrec(parseInt(e.target.value, 10) || 0)}
                      className="w-16 px-2 py-1.5 border border-borderLine rounded bg-white text-center"
                    />
                    <button type="submit" className="flex-1 px-3 py-1.5 bg-primary text-white font-semibold rounded hover:bg-primary-hover">
                      Add Unit
                    </button>
                  </div>
                </div>
              </form>

              <div className="border border-borderLine rounded-lg max-h-56 overflow-y-auto divide-y divide-borderLine">
                {units.map((u) => (
                  <div key={u.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-navy-800">{u.name}</div>
                      <div className="text-[10px] text-textSecondary font-mono">Code: {u.code} &bull; Decimals: {u.precision}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold font-mono">{u.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-borderLine">
            <button
              onClick={() => setIsCatUnitModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Barcode Sticker Generator Modal */}
      <Modal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        title="Print Barcode Labels & Shelf Stickers"
        subtitle="Generate scannable Code128 barcodes formatted for 50x25mm thermal rolls or standard A4 sheets"
        maxWidth="4xl"
      >
        <div className="space-y-4 text-xs">
          {/* Controls toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-borderLine no-print">
            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase mb-1">Sticker Format</label>
              <select
                value={stickerFormat}
                onChange={(e) => setStickerFormat(e.target.value as any)}
                className="w-full p-2 border border-borderLine rounded bg-white font-medium text-xs focus:outline-none"
              >
                <option value="ROLL_50x25">50mm x 25mm Thermal Roll (TSC / Zebra / Argox)</option>
                <option value="A4_24">A4 Sheet - 24 Labels (3 x 8 Grid)</option>
                <option value="A4_30">A4 Sheet - 30 Labels (3 x 10 Grid)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase mb-1">Copies Per Item</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={stickerCopies}
                  onChange={(e) => setStickerCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 p-2 border border-borderLine rounded bg-white font-bold text-center text-xs focus:outline-none"
                />
                <span className="text-[11px] text-textSecondary">
                  Total: <strong className="text-navy-800">{barcodeTargetItems.length * stickerCopies}</strong> labels
                </span>
              </div>
            </div>

            <div className="flex items-end justify-end space-x-2">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg shadow-subtle transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print All Labels</span>
              </button>
            </div>
          </div>

          {/* Printable Barcode Sheet Container */}
          <div className="border border-borderLine rounded-lg bg-slate-100 p-4 max-h-[500px] overflow-y-auto">
            <div
              id="printable-barcodes"
              className={
                stickerFormat === 'ROLL_50x25'
                  ? 'flex flex-col items-center gap-3 bg-white p-2 mx-auto max-w-[240px]'
                  : 'grid grid-cols-3 gap-2 bg-white p-4'
              }
            >
              {barcodeTargetItems.flatMap((item) =>
                Array.from({ length: stickerCopies }).map((_, copyIdx) => (
                  <div
                    key={`${item.id}-copy-${copyIdx}`}
                    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                    className="border border-dashed border-slate-300 rounded p-2 text-center bg-white flex flex-col justify-between items-center w-[188px] min-h-[95px] shadow-sm"
                  >
                    <div className="w-full">
                      <div className="text-[9px] font-black tracking-widest text-navy-800 uppercase leading-none">
                        CFECC STORE
                      </div>
                      <div className="text-[10px] font-bold text-slate-800 truncate mt-0.5" title={item.name}>
                        {item.name}
                      </div>
                    </div>

                    <div className="my-1 flex items-center justify-center">
                      <BarcodeSvg
                        value={item.barcode?.trim() || item.item_code}
                        barWidth={1.2}
                        height={32}
                        showText={true}
                      />
                    </div>

                    <div className="w-full flex items-center justify-between border-t border-slate-200 pt-1 text-[9px]">
                      <div className="text-slate-500">
                        MRP: <span className="line-through">₹{parseFloat(item.selling_price.toString()).toFixed(2)}</span>
                      </div>
                      <div className="font-black text-navy-800">
                        MEMBER: <span className="text-primary font-bold">₹{parseFloat(item.employee_price.toString()).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-textSecondary pt-2 border-t border-borderLine no-print">
            <div>
              Tip: For thermal roll printers, set print margins to <strong>None</strong> in the browser print dialog.
            </div>
            <button
              onClick={() => setIsBarcodeModalOpen(false)}
              className="px-4 py-1.5 border border-borderLine rounded-lg bg-surface hover:bg-slate-50 font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
