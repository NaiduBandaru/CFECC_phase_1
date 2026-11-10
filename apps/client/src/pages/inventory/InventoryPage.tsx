import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Boxes,
  AlertTriangle,
  History,
  Sliders,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface InventoryPageProps {
  hideHeader?: boolean;
  hideTabs?: boolean;
  initialTab?: 'stock' | 'movements';
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  hideHeader = false,
  hideTabs = false,
  initialTab = 'stock',
}) => {
  const [stock, setStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [adjType, setAdjType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('Stock count discrepancy correction');

  useEffect(() => {
    fetchStock();
    fetchMovements();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/stock');
      if (res.data.success) {
        setStock(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await api.get('/inventory/movements');
      if (res.data.success) {
        setMovements(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !adjQty) return;

    try {
      const res = await api.post('/inventory/adjust', {
        itemId: parseInt(selectedItemId, 10),
        adjustmentType: adjType,
        quantity: parseFloat(adjQty),
        reason: adjReason,
      });
      if (res.data.success) {
        setIsAdjustModalOpen(false);
        fetchStock();
        fetchMovements();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to adjust stock');
    }
  };

  const totalValuation = stock.reduce((sum, i) => sum + parseFloat(i.stock_valuation || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {!hideHeader ? (
          <div>
            <h2 className="text-xl font-bold text-navy-800">Inventory & Stock Ledger</h2>
            <p className="text-xs text-textSecondary mt-0.5">
              Real-time commodity balances, weighted valuation & auditable stock movement trail
            </p>
          </div>
        ) : (
          <div className="text-xs font-semibold text-textSecondary flex items-center space-x-1.5">
            <span className="font-bold text-navy-800">Inventory & Stock Ledger</span>
            <span>&bull;</span>
            <span>Live Balances (₹{Math.round(totalValuation).toLocaleString('en-IN')})</span>
          </div>
        )}

        <button
          onClick={() => setIsAdjustModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-surface border border-borderLine text-xs font-semibold text-textPrimary hover:bg-slate-50 transition-colors shadow-subtle"
        >
          <Sliders className="w-3.5 h-3.5 text-primary" />
          <span>Manual Stock Adjustment</span>
        </button>
      </div>

      {/* Tabs */}
      {!hideTabs && (
        <div className="flex space-x-2 border-b border-borderLine pb-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'stock'
                ? 'bg-navy-800 text-white shadow-sm'
                : 'text-textSecondary hover:text-navy-800 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Live Stock Balances (Valuation: ₹{Math.round(totalValuation).toLocaleString('en-IN')})</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'movements'
                ? 'bg-navy-800 text-white shadow-sm'
                : 'text-textSecondary hover:text-navy-800 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Stock Movement Audit Trail</span>
          </button>
        </div>
      )}

      {/* Tab 1: Live Stock Table with Standard Format and Auto Screen Adjust */}
      {activeTab === 'stock' && (
        <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Item Code & Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Min Stock</th>
                  <th className="py-3 px-4 text-right">Reorder Level</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right font-bold text-navy-800">Total Valuation</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-textSecondary">
                      Loading inventory records...
                    </td>
                  </tr>
                ) : stock.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-textSecondary">
                      No inventory records found.
                    </td>
                  </tr>
                ) : stock.map((item) => {
                  const isLow = parseFloat(item.current_stock) <= parseFloat(item.min_stock);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{item.name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">{item.item_code}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-textPrimary">{item.category_name}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                        {parseFloat(item.current_stock)} {item.unit_code}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                        {parseFloat(item.min_stock)} {item.unit_code}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-textSecondary">
                        {parseFloat(item.reorder_level)} {item.unit_code}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-textSecondary">
                        ₹{parseFloat(item.purchase_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                        ₹{parseFloat(item.stock_valuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Standard Floating Summary Footer */}
          <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
            <div>
              Showing <span className="font-bold text-navy-800 font-mono">{stock.length}</span> inventory commodities &bull; Total Value:{' '}
              <strong className="text-navy-900 font-mono text-sm font-black">
                ₹{stock.reduce((acc, i) => acc + parseFloat(i.stock_valuation || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="text-rose-700 font-medium">
                Below Min Level: {stock.filter((i) => parseFloat(i.current_stock) <= parseFloat(i.min_stock)).length} SKUs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Stock Movement Audit Trail with Standard Format */}
      {activeTab === 'movements' && (
        <div className="bg-surface rounded-xl border border-borderLine shadow-subtle overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[360px]">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
                <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Quantity Delta</th>
                  <th className="py-3 px-4 text-right">Stock After</th>
                  <th className="py-3 px-4">Operator / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {movements.map((m) => {
                  const isPositive = parseFloat(m.quantity) > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-textSecondary">
                        {new Date(m.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-navy-800">{m.item_name}</div>
                        <div className="text-[11px] text-textSecondary font-mono">{m.item_code}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-textPrimary">
                        {m.movement_type}
                      </td>
                      <td className="py-3 px-4 font-mono text-textSecondary">
                        {m.reference_id || '-'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                          {isPositive ? `+${parseFloat(m.quantity)}` : parseFloat(m.quantity)} {m.unit_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-navy-800">
                        {parseFloat(m.balance_after)} {m.unit_code}
                      </td>
                      <td className="py-3 px-4 text-textSecondary">
                        {m.notes || 'Routine inventory update'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Standard Floating Summary Footer */}
          <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-2.5 flex items-center justify-between text-xs text-textSecondary select-none">
            <div>
              Showing <span className="font-bold text-navy-800 font-mono">{movements.length}</span> verified inventory movement transactions
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Real-time FIFO Stock Ledger
            </div>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Manual Stock Adjustment"
        subtitle="Record physical stock discrepancies or wastage adjustments"
        maxWidth="md"
      >
        <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Select Item *</label>
            <select
              required
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="">Select Item</option>
              {stock.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Current: {parseFloat(i.current_stock)} {i.unit_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjType('ADJUSTMENT_IN')}
                className={`p-2 rounded-lg border font-semibold flex items-center justify-center space-x-1 ${
                  adjType === 'ADJUSTMENT_IN' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-borderLine text-textSecondary'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Stock In (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setAdjType('ADJUSTMENT_OUT')}
                className={`p-2 rounded-lg border font-semibold flex items-center justify-center space-x-1 ${
                  adjType === 'ADJUSTMENT_OUT' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'border-borderLine text-textSecondary'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Stock Out (-)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Quantity *</label>
            <input
              type="number"
              required
              value={adjQty}
              onChange={(e) => setAdjQty(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Adjustment Reason *</label>
            <input
              type="text"
              required
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary text-white font-semibold shadow-subtle"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

