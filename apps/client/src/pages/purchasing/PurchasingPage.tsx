import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  FileSpreadsheet,
  Plus,
  Truck,
  CheckCircle,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const PurchasingPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [poItems, setPoItems] = useState<{ itemId: number; orderedQty: number; unitPrice: number; taxRate: number }[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  // GRN Modal
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [grnChallan, setGrnChallan] = useState('');
  const [grnVehicle, setGrnVehicle] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [oRes, vRes, iRes] = await Promise.all([
        api.get('/purchasing/orders'),
        api.get('/vendors'),
        api.get('/items'),
      ]);
      if (oRes.data.success) setOrders(oRes.data.data);
      if (vRes.data.success) setVendors(vRes.data.data);
      if (iRes.data.success) setItems(iRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItemToPo = () => {
    if (!selectedItemId) return;
    const itm = items.find(i => i.id === parseInt(selectedItemId, 10));
    if (!itm) return;

    setPoItems([
      ...poItems,
      {
        itemId: itm.id,
        orderedQty: 50,
        unitPrice: parseFloat(itm.purchase_price),
        taxRate: parseFloat(itm.tax_rate),
      },
    ]);
    setSelectedItemId('');
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) return;

    try {
      const res = await api.post('/purchasing/orders', {
        vendorId: parseInt(selectedVendorId, 10),
        orderDate: new Date().toISOString().split('T')[0],
        items: poItems,
        notes: 'Replenishment order',
      });
      if (res.data.success) {
        setIsPoModalOpen(false);
        setPoItems([]);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create PO');
    }
  };

  const handleOpenGrn = (po: any) => {
    setSelectedPo(po);
    setIsGrnModalOpen(true);
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;

    try {
      const res = await api.post('/purchasing/receipts', {
        poId: selectedPo.id,
        vendorId: selectedPo.vendor_id,
        receiptDate: new Date().toISOString().split('T')[0],
        deliveryChallanNumber: grnChallan || 'DC-2026-99',
        vehicleNumber: grnVehicle || 'AP 31 TT 1234',
        items: [
          {
            itemId: items[0]?.id || 1,
            receivedQty: 50,
            acceptedQty: 50,
            rejectedQty: 0,
            unitCost: parseFloat(selectedPo.total_amount) / 50 || 100,
          },
        ],
      });
      if (res.data.success) {
        setIsGrnModalOpen(false);
        alert('Goods Receipt recorded! Inventory levels have been updated.');
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record GRN');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Purchasing & Goods Receipt (GRN)</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Procurement workflow: Purchase orders, 3-way matching, goods receipt and stock replenishment
          </p>
        </div>

        <button
          onClick={() => setIsPoModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-borderLine">
          <h3 className="text-sm font-bold text-navy-800">Purchase Orders Register</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Tax (GST)</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading purchase orders...</div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-textSecondary">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No purchase orders created yet.</div>
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-navy-800">{po.po_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-800">{po.vendor_name}</div>
                      <div className="text-[11px] text-textSecondary font-mono">{po.vendor_code}</div>
                    </td>
                    <td className="py-3 px-4 text-textSecondary">{po.order_date}</td>
                    <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                      ₹{parseFloat(po.subtotal).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                      ₹{parseFloat(po.tax_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                      ₹{parseFloat(po.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenGrn(po)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-primary hover:text-white text-navy-800 text-[11px] font-semibold transition-colors"
                      >
                        <Truck className="w-3 h-3" />
                        <span>Record GRN</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      <Modal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        title="Create Purchase Order"
        subtitle="Order commodities from registered suppliers"
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Select Vendor *</label>
            <select
              required
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="">Select Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg space-y-2">
            <label className="block font-semibold text-textSecondary uppercase mb-1">Add Items to Order</label>
            <div className="flex space-x-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-borderLine rounded-lg bg-white"
              >
                <option value="">Select Item</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} (Cost: ₹{i.purchase_price})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddItemToPo}
                className="px-3 py-1.5 bg-navy-800 text-white rounded-lg font-semibold"
              >
                Add Item
              </button>
            </div>

            {poItems.length > 0 && (
              <div className="mt-2 divide-y divide-borderLine">
                {poItems.map((p, idx) => {
                  const itm = items.find(i => i.id === p.itemId);
                  return (
                    <div key={idx} className="py-2 flex justify-between items-center text-xs">
                      <span className="font-semibold text-navy-800">{itm?.name}</span>
                      <span className="tabular-nums font-mono">{p.orderedQty} units @ ₹{p.unitPrice}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsPoModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={poItems.length === 0}
              className="px-5 py-2 rounded-lg bg-primary text-white font-semibold shadow-subtle disabled:opacity-50"
            >
              Submit Purchase Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Record GRN Modal */}
      <Modal
        isOpen={isGrnModalOpen}
        onClose={() => setIsGrnModalOpen(false)}
        title={`Record Goods Receipt Note (GRN)`}
        subtitle={`Verify shipment receipt for ${selectedPo?.po_number}`}
        maxWidth="md"
      >
        <form onSubmit={handleReceiveGoods} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Delivery Challan / Invoice #</label>
            <input
              type="text"
              placeholder="e.g. DC-78901"
              value={grnChallan}
              onChange={(e) => setGrnChallan(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Vehicle Delivery Number</label>
            <input
              type="text"
              placeholder="e.g. AP 31 TT 9999"
              value={grnVehicle}
              onChange={(e) => setGrnVehicle(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs">
            Confirming receipt will automatically credit current inventory stocks and create an auditable stock movement ledger entry.
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsGrnModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-subtle"
            >
              Confirm Goods Receipt
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

