import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  FileText,
  AlertOctagon,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PackageX,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export const StockAdjustmentsRegister: React.FC = () => {
  const [legacyAdjustments, setLegacyAdjustments] = useState<any[]>([]);
  const [liveAdjustments, setLiveAdjustments] = useState<any[]>([]);
  const [totalLegacy, setTotalLegacy] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [expandedBill, setExpandedBill] = useState<number | null>(null);

  // New Adjustment Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'ADJUSTMENT_OUT' | 'ADJUSTMENT_IN'>('ADJUSTMENT_OUT');
  const [quantity, setQuantity] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('Damaged / Spoilage');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAdjustments();
    fetchItems();
  }, []);

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/adjustments');
      if (res.data.success) {
        setLegacyAdjustments(res.data.legacyAdjustments || []);
        setLiveAdjustments(res.data.liveAdjustments || []);
        setTotalLegacy(res.data.totalLegacy || 0);
      }
    } catch (err) {
      console.error('Failed to load adjustments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await api.get('/items');
      if (res.data.success) {
        setItemsList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity || parseFloat(quantity) <= 0) {
      alert('Please select an item and enter a valid quantity.');
      return;
    }

    try {
      setSubmitting(true);
      const fullReason = `${reasonCategory}: ${remarks}`.trim();
      const res = await api.post('/inventory/adjust', {
        itemId: parseInt(selectedItemId, 10),
        adjustmentType,
        quantity: parseFloat(quantity),
        reason: fullReason,
      });

      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: `Adjustment recorded successfully! Updated stock is ${res.data.newStock}`,
        });
        setIsModalOpen(false);
        setSelectedItemId('');
        setQuantity('');
        setRemarks('');
        fetchAdjustments();
      } else {
        alert(res.data.message || 'Failed to record adjustment');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error creating adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLegacy = legacyAdjustments.filter((adj) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      adj.billNo.toString().includes(q) ||
      (adj.empNo && adj.empNo.toLowerCase().includes(q)) ||
      (adj.csNo && adj.csNo.toString().includes(q)) ||
      (adj.lines && adj.lines.some((l: any) => l.itemCode.includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-borderLine shadow-sm">
        <div>
          <h3 className="text-base font-bold text-navy-800 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Stock Adjustments, Wastage & Audit Corrections</span>
          </h3>
          <p className="text-xs text-textSecondary mt-1">
            Complete register of inventory reconciliation vouchers, damaged goods write-offs, and FoxPro historical adjustment slips (ADJMAST / ADJDETL)
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Adjustment</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider block">Total Historical Vouchers</span>
          <span className="text-2xl font-bold text-navy-800 mt-1 block">{totalLegacy.toLocaleString('en-IN')}</span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Recorded in CFECC legacy store archives</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider block">Live System Adjustments</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">{liveAdjustments.length.toLocaleString('en-IN')}</span>
          <span className="text-[11px] text-textSecondary mt-0.5 block">Audit & damage vouchers processed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-borderLine shadow-sm">
          <span className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider block">Adjustment Verification Mode</span>
          <span className="text-sm font-bold text-primary mt-2 flex items-center space-x-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Dual-Batch FIFO Inventory Protected</span>
          </span>
          <span className="text-[11px] text-textSecondary mt-1 block">Automatic ledger & stock balance synchronization</span>
        </div>
      </div>

      {/* Live Recent System Adjustments */}
      {liveAdjustments.length > 0 && (
        <div className="bg-white rounded-xl border border-borderLine shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-borderLine bg-slate-50/70 flex items-center justify-between">
            <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider">
              Recent Live System Stock Movements & Adjustments
            </h4>
            <span className="text-[11px] text-textSecondary">{liveAdjustments.length} adjustment entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-textSecondary uppercase border-b border-borderLine">
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Item Code & Name</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Adjusted Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Cost</th>
                  <th className="px-4 py-2.5 text-right">New Balance</th>
                  <th className="px-4 py-2.5">Reason / Audit Remarks</th>
                  <th className="px-4 py-2.5">Author</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {liveAdjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-2.5 text-textSecondary whitespace-nowrap">
                      {new Date(adj.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-navy-800">
                      <span className="font-mono text-primary mr-1.5">[{adj.item_code}]</span>
                      {adj.item_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          adj.movement_type === 'ADJUSTMENT_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {adj.movement_type === 'ADJUSTMENT_IN' ? '+ Stock Added' : '- Write-Off / Out'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">
                      {parseFloat(adj.quantity) > 0 ? `+${adj.quantity}` : adj.quantity} {adj.unit_code || 'PCS'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-textSecondary">
                      ₹{parseFloat(adj.unit_cost || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-navy-800">
                      {parseFloat(adj.balance_after || 0).toFixed(3)}
                    </td>
                    <td className="px-4 py-2.5 text-textSecondary italic max-w-xs truncate">{adj.reason || 'General correction'}</td>
                    <td className="px-4 py-2.5 text-textSecondary">{adj.user_name || 'System Admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical FoxPro Adjustment Register (ADJMAST / ADJDETL) */}
      <div className="bg-white rounded-xl border border-borderLine shadow-sm overflow-hidden">
        <div className="p-4 border-b border-borderLine flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h4 className="text-xs font-bold text-navy-800 uppercase tracking-wider">
              CFECC Legacy Store Adjustments Register (ADJMAST.DBF)
            </h4>
            <p className="text-[11px] text-textSecondary mt-0.5">
              Historical physical audit adjustments, damage vouchers, and bill reconciliation slips
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-textSecondary" />
            <input
              type="text"
              placeholder="Search Voucher #, CS #, or Item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-borderLine rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-textSecondary">Loading stock adjustments register...</div>
        ) : filteredLegacy.length === 0 ? (
          <div className="p-8 text-center text-xs text-textSecondary">No adjustment records matched your search query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-textSecondary uppercase border-b border-borderLine">
                  <th className="px-4 py-2.5 w-12 text-center"></th>
                  <th className="px-4 py-2.5">Voucher / Slip #</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Account / CS #</th>
                  <th className="px-4 py-2.5 text-center">Items Count</th>
                  <th className="px-4 py-2.5 text-right">Net Adjustment Value (₹)</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {filteredLegacy.map((adj) => {
                  const isExpanded = expandedBill === adj.billNo;
                  return (
                    <React.Fragment key={adj.billNo}>
                      <tr
                        onClick={() => setExpandedBill(isExpanded ? null : adj.billNo)}
                        className={`hover:bg-blue-50/50 cursor-pointer transition ${isExpanded ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="px-4 py-2.5 text-center text-textSecondary">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary">
                          ADJ-{adj.billNo.toString().padStart(5, '0')}
                        </td>
                        <td className="px-4 py-2.5 text-textSecondary whitespace-nowrap">{adj.date || '-'}</td>
                        <td className="px-4 py-2.5 text-navy-800 font-medium">
                          {adj.empNo === '2008' ? (
                            <span className="inline-flex items-center space-x-1">
                              <span className="font-mono text-slate-500">Store Internal Stock Account</span>
                            </span>
                          ) : (
                            <span className="font-mono">
                              Emp #{adj.empNo} (CS #{adj.csNo})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-navy-800">{adj.itemCount} line(s)</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-navy-800">
                          ₹{adj.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            Reconciled (DBF)
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Line Items (ADJDETL) */}
                      {isExpanded && adj.lines && adj.lines.length > 0 && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7} className="p-4 pl-12">
                            <div className="bg-white rounded-lg border border-borderLine p-3 shadow-inner">
                              <div className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Adjustment Itemized Breakdown (ADJDETL.DBF)</span>
                                <span>Voucher ADJ-{adj.billNo}</span>
                              </div>
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-borderLine text-textSecondary text-[10px] uppercase font-bold">
                                    <th className="py-1.5 px-3">Line #</th>
                                    <th className="py-1.5 px-3">Item Code</th>
                                    <th className="py-1.5 px-3 text-right">Adjusted Qty</th>
                                    <th className="py-1.5 px-3 text-right">Unit Rate (₹)</th>
                                    <th className="py-1.5 px-3 text-right">Line Total (₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-borderLine">
                                  {adj.lines.map((l: any, idx: number) => {
                                    const lineTotal = l.qty * l.rate;
                                    return (
                                      <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="py-1.5 px-3 text-textSecondary font-mono">{l.itemNo || idx + 1}</td>
                                        <td className="py-1.5 px-3 font-mono font-bold text-primary">Item #{l.itemCode}</td>
                                        <td className="py-1.5 px-3 text-right font-mono font-bold">
                                          {l.qty > 0 ? `+${l.qty}` : l.qty}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono">₹{l.rate.toFixed(2)}</td>
                                        <td className="py-1.5 px-3 text-right font-mono font-bold text-navy-800">
                                          ₹{lineTotal.toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Adjustment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Stock Adjustment / Damage Write-Off"
        subtitle="Reconcile physical stock counts, log damaged goods, or adjust discrepancies"
        maxWidth="md"
      >
        <form onSubmit={handleCreateAdjustment} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Select Store Item *</label>
            <select
              required
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="">-- Choose Item from Store Catalog --</option>
              {itemsList.map((itm) => (
                <option key={itm.id} value={itm.id}>
                  [{itm.item_code}] {itm.name} (Stock: {itm.current_stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Adjustment Type *</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-medium"
              >
                <option value="ADJUSTMENT_OUT">Decrease Stock (Write-Off / Damage / Spoilage)</option>
                <option value="ADJUSTMENT_IN">Increase Stock (Surplus Found / Count Audit)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Quantity to Adjust *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="e.g. 5.0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Adjustment Category *</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="Damaged / Spoilage">Damaged in Transit / Spoilage</option>
              <option value="Expired Lot">Expired Batch Write-off</option>
              <option value="Physical Count Shortage">Annual Physical Count Shortage</option>
              <option value="Physical Count Surplus">Annual Physical Count Surplus</option>
              <option value="Internal Store Consumption">Internal Store Consumption / Canteen Issue</option>
              <option value="Customer Return / Adjustment">Bill Return / Price Correction</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-textSecondary uppercase mb-1">Notes / Voucher Reference</label>
            <textarea
              rows={2}
              placeholder="e.g. Authorized by Store Manager, inspection slip #104..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-borderLine rounded-lg text-textSecondary hover:bg-slate-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover font-semibold shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Applying...' : 'Post Stock Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

