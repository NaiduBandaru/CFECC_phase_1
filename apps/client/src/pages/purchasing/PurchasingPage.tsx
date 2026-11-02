import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api.js';
import { PurchaseOrder, GoodsReceipt, PurchaseInvoice, Vendor, Item } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  FileSpreadsheet,
  Plus,
  Truck,
  Package,
  Layers,
  ArrowRight,
  Receipt,
  RotateCcw,
  CreditCard,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Calendar,
  Building2,
  Search,
} from 'lucide-react';

export const PurchasingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'GRN' | 'INVOICES' | 'RETURNS'>('ORDERS');
  
  // Data States
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poLines, setPoLines] = useState<Array<{
    itemId: number;
    itemName: string;
    itemCode: string;
    orderedQty: number;
    unitPrice: number;
    taxRate: number;
  }>>([]);
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState<number>(50);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newTaxRate, setNewTaxRate] = useState<number>(0);

  // PO Details Modal
  const [isViewPoModalOpen, setIsViewPoModalOpen] = useState(false);
  const [selectedPoDetails, setSelectedPoDetails] = useState<any | null>(null);

  // GRN Modal
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [activePoForGrn, setActivePoForGrn] = useState<any | null>(null);
  const [grnChallan, setGrnChallan] = useState('');
  const [grnVehicle, setGrnVehicle] = useState('');
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnLines, setGrnLines] = useState<Array<{
    itemId: number;
    itemName: string;
    itemCode: string;
    orderedQty: number;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty: number;
    unitCost: number;
    rejectionReason: string;
  }>>([]);

  // Vendor Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'NEFT_RTGS' | 'CHEQUE' | 'UPI' | 'CASH'>('NEFT_RTGS');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Purchase Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnVendorId, setReturnVendorId] = useState('');
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnUnitPrice, setReturnUnitPrice] = useState<number>(0);
  const [returnReason, setReturnReason] = useState('Damaged goods received from supplier');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'ORDERS') fetchOrders();
    if (activeTab === 'GRN') fetchReceipts();
    if (activeTab === 'INVOICES') fetchInvoices();
  }, [activeTab, statusFilter]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [vRes, iRes] = await Promise.all([
        api.get('/vendors'),
        api.get('/items?limit=100'),
      ]);
      if (vRes.data.success) setVendors(vRes.data.data);
      if (iRes.data.success) setItems(iRes.data.data);
      await fetchOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/purchasing/orders?${params.toString()}`);
      if (res.data.success) setOrders(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReceipts = async () => {
    try {
      const res = await api.get('/purchasing/receipts');
      if (res.data.success) setReceipts(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/purchasing/invoices');
      if (res.data.success) setInvoices(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Add item line to new PO
  const handleAddLineToPo = () => {
    if (!newItemId) return;
    const itm = items.find((i) => i.id === parseInt(newItemId, 10));
    if (!itm) return;

    if (poLines.some((p) => p.itemId === itm.id)) {
      alert('This commodity is already in the order list.');
      return;
    }

    setPoLines([
      ...poLines,
      {
        itemId: itm.id,
        itemName: itm.name,
        itemCode: itm.item_code,
        orderedQty: newQty || 1,
        unitPrice: newPrice || parseFloat(itm.purchase_price.toString()) || 0,
        taxRate: newTaxRate !== undefined ? newTaxRate : parseFloat(itm.tax_rate.toString()) || 0,
      },
    ]);

    setNewItemId('');
    setNewQty(50);
    setNewPrice(0);
    setNewTaxRate(0);
  };

  const handleSelectItemForPo = (itemIdStr: string) => {
    setNewItemId(itemIdStr);
    const itm = items.find((i) => i.id === parseInt(itemIdStr, 10));
    if (itm) {
      setNewPrice(parseFloat(itm.purchase_price.toString()));
      setNewTaxRate(parseFloat(itm.tax_rate.toString()));
    }
  };

  const handleRemovePoLine = (index: number) => {
    setPoLines(poLines.filter((_, idx) => idx !== index));
  };

  const poTotals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    poLines.forEach((l) => {
      const lineSub = l.orderedQty * l.unitPrice;
      const lineTax = lineSub * (l.taxRate / 100);
      subtotal += lineSub;
      taxAmount += lineTax;
    });
    return {
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
    };
  }, [poLines]);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poLines.length === 0) {
      setError('Please add at least one line item to the order.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/purchasing/orders', {
        vendorId: parseInt(selectedVendorId, 10),
        orderDate,
        expectedDeliveryDate: expectedDate || null,
        notes: poNotes || 'Commodity replenishment',
        items: poLines.map((l) => ({
          itemId: l.itemId,
          orderedQty: l.orderedQty,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      });

      if (res.data.success) {
        setIsPoModalOpen(false);
        setPoLines([]);
        setSelectedVendorId('');
        setPoNotes('');
        fetchOrders();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPo = async (poId: number) => {
    try {
      const res = await api.get(`/purchasing/orders/${poId}`);
      if (res.data.success) {
        setSelectedPoDetails(res.data.data);
        setIsViewPoModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open GRN Modal and preload PO lines
  const handleOpenGrn = async (po: PurchaseOrder) => {
    try {
      const res = await api.get(`/purchasing/orders/${po.id}`);
      if (res.data.success) {
        const poDetails = res.data.data;
        setActivePoForGrn(poDetails);
        setGrnChallan('');
        setGrnVehicle('');
        setGrnDate(new Date().toISOString().split('T')[0]);

        const lines = (poDetails.items || []).map((i: any) => {
          const remaining = Math.max(0, parseFloat(i.ordered_qty) - parseFloat(i.received_qty));
          return {
            itemId: i.item_id,
            itemName: i.item_name,
            itemCode: i.item_code,
            orderedQty: parseFloat(i.ordered_qty),
            receivedQty: remaining,
            acceptedQty: remaining,
            rejectedQty: 0,
            unitCost: parseFloat(i.unit_price),
            rejectionReason: '',
          };
        });
        setGrnLines(lines);
        setIsGrnModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePoForGrn) return;

    setIsSubmitting(true);
    try {
      const res = await api.post('/purchasing/receipts', {
        poId: activePoForGrn.id,
        vendorId: activePoForGrn.vendor_id,
        receiptDate: grnDate,
        deliveryChallanNumber: grnChallan || `DC-${Date.now().toString().slice(-6)}`,
        vehicleNumber: grnVehicle || 'AP 31 TT 9999',
        notes: `Received against ${activePoForGrn.po_number}`,
        items: grnLines.map((l) => ({
          itemId: l.itemId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          unitCost: l.unitCost,
          rejectionReason: l.rejectionReason || null,
        })),
      });

      if (res.data.success) {
        setIsGrnModalOpen(false);
        alert('Goods Receipt recorded! Inventory levels updated and Purchase Invoice generated.');
        fetchOrders();
        fetchReceipts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record GRN');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Payment Modal
  const handleOpenPayment = (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    const balance = parseFloat(inv.total_amount.toString()) - parseFloat(inv.paid_amount.toString());
    setPaymentAmount(balance);
    setPaymentMode('NEFT_RTGS');
    setPaymentReference('');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/purchasing/invoices/${selectedInvoice.id}/payment`, {
        vendorId: selectedInvoice.vendor_id,
        amount: paymentAmount,
        paymentMode,
        referenceNumber: paymentReference || null,
        notes: paymentNotes || null,
      });

      if (res.data.success) {
        setIsPaymentModalOpen(false);
        fetchInvoices();
        alert('Vendor payment recorded successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Purchase Return
  const handleSelectItemForReturn = (idStr: string) => {
    setReturnItemId(idStr);
    const itm = items.find((i) => i.id === parseInt(idStr, 10));
    if (itm) {
      setReturnUnitPrice(parseFloat(itm.purchase_price.toString()));
    }
  };

  const handleRecordReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnVendorId || !returnItemId) return;

    setIsSubmitting(true);
    try {
      const res = await api.post('/purchasing/returns', {
        vendorId: parseInt(returnVendorId, 10),
        itemId: parseInt(returnItemId, 10),
        returnQty,
        unitPrice: returnUnitPrice,
        reason: returnReason,
      });

      if (res.data.success) {
        setIsReturnModalOpen(false);
        alert('Purchase return recorded! Stock has been deducted and vendor balance adjusted.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record purchase return');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics
  const totalPoValue = useMemo(() => orders.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0), [orders]);
  const pendingOrdersCount = useMemo(() => orders.filter((o) => o.status === 'PENDING' || o.status === 'APPROVED').length, [orders]);
  const unpaidInvoicesBalance = useMemo(
    () => invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount.toString()) - parseFloat(inv.paid_amount.toString())), 0),
    [invoices]
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Purchasing & Goods Receipt (GRN)</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Procurement workflow: Purchase orders, 3-way matching, goods receipts, invoice settlement and vendor returns
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsReturnModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>Purchase Return</span>
          </button>

          <button
            onClick={() => {
              setSelectedVendorId(vendors[0]?.id?.toString() || '');
              setPoLines([]);
              setIsPoModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Total PO Value</span>
            <FileSpreadsheet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2 tabular-nums">₹{totalPoValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="text-[11px] text-textSecondary mt-1">{orders.length} Purchase Orders</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Pending Deliveries</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 mt-2 tabular-nums">{pendingOrdersCount}</div>
          <div className="text-[11px] text-textSecondary mt-1">Awaiting receipt or verification</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Goods Receipts</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-2 tabular-nums">{receipts.length}</div>
          <div className="text-[11px] text-textSecondary mt-1">Completed shipments</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Vendor Payables</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 mt-2 tabular-nums">₹{unpaidInvoicesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="text-[11px] text-textSecondary mt-1">Unpaid purchase bills</div>
        </div>
      </div>

      {/* Workflow Navigation Tabs */}
      <div className="flex space-x-2 border-b border-borderLine">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-2.5 px-4 text-xs font-bold transition-colors flex items-center space-x-1.5 ${
            activeTab === 'ORDERS' ? 'border-b-2 border-primary text-primary' : 'text-textSecondary hover:text-navy-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Purchase Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('GRN')}
          className={`pb-2.5 px-4 text-xs font-bold transition-colors flex items-center space-x-1.5 ${
            activeTab === 'GRN' ? 'border-b-2 border-primary text-primary' : 'text-textSecondary hover:text-navy-800'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Goods Receipts (GRN) ({receipts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-2.5 px-4 text-xs font-bold transition-colors flex items-center space-x-1.5 ${
            activeTab === 'INVOICES' ? 'border-b-2 border-primary text-primary' : 'text-textSecondary hover:text-navy-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Purchase Invoices & Bills ({invoices.length})</span>
        </button>
      </div>

      {/* Tab 1: Purchase Orders */}
      {activeTab === 'ORDERS' && (
        <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                placeholder="Search PO #, vendor name..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-textSecondary font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">PO #</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Delivery Date</th>
                  <th className="py-3 px-4 text-center">Items</th>
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
                    <td colSpan={10} className="py-8 text-center text-textSecondary">
                      <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                      <div>Loading purchase orders...</div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-textSecondary">
                      <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <div>No purchase orders found matching filter criteria.</div>
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
                      <td className="py-3 px-4 text-textSecondary">{po.expected_delivery_date || '-'}</td>
                      <td className="py-3 px-4 text-center font-medium">{po.item_count || 1} line(s)</td>
                      <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                        ₹{parseFloat(po.subtotal.toString()).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                        ₹{parseFloat(po.tax_amount.toString()).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                        ₹{parseFloat(po.total_amount.toString()).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            title="View PO Details"
                            onClick={() => handleViewPo(po.id)}
                            className="p-1 hover:bg-slate-100 rounded text-textSecondary hover:text-navy-800 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleOpenGrn(po)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 text-primary border border-blue-200 hover:bg-primary hover:text-white text-[11px] font-semibold transition-colors"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Record GRN</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Goods Receipts (GRN) */}
      {activeTab === 'GRN' && (
        <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden p-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">GRN #</th>
                  <th className="py-3 px-4">PO Reference</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Delivery Challan</th>
                  <th className="py-3 px-4">Vehicle #</th>
                  <th className="py-3 px-4 text-center">Items Received</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-textSecondary">
                      <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <div>No goods receipts recorded yet.</div>
                    </td>
                  </tr>
                ) : (
                  receipts.map((gr) => (
                    <tr key={gr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">{gr.grn_number}</td>
                      <td className="py-3 px-4 font-mono text-textSecondary">{gr.po_number || 'Direct GRN'}</td>
                      <td className="py-3 px-4 font-semibold text-navy-800">{gr.vendor_name}</td>
                      <td className="py-3 px-4 text-textSecondary">{gr.receipt_date}</td>
                      <td className="py-3 px-4 font-mono text-textSecondary">{gr.delivery_challan_number || '-'}</td>
                      <td className="py-3 px-4 font-mono text-textSecondary">{gr.vehicle_number || '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-navy-800">{gr.item_count || 1} item(s)</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {gr.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Purchase Invoices */}
      {activeTab === 'INVOICES' && (
        <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden p-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">System Bill #</th>
                  <th className="py-3 px-4">Vendor Invoice</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">GRN Ref</th>
                  <th className="py-3 px-4">Invoice Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-textSecondary">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <div>No purchase invoices registered yet.</div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const balance = parseFloat(inv.total_amount.toString()) - parseFloat(inv.paid_amount.toString());
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-navy-800">{inv.system_bill_number}</td>
                        <td className="py-3 px-4 font-mono text-textSecondary">{inv.invoice_number}</td>
                        <td className="py-3 px-4 font-semibold text-navy-800">{inv.vendor_name}</td>
                        <td className="py-3 px-4 font-mono text-textSecondary">{inv.grn_number || '-'}</td>
                        <td className="py-3 px-4 text-textSecondary">{inv.invoice_date}</td>
                        <td className="py-3 px-4 text-textSecondary">{inv.due_date || '-'}</td>
                        <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                          ₹{parseFloat(inv.total_amount.toString()).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-700 tabular-nums">
                          ₹{parseFloat(inv.paid_amount.toString()).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 tabular-nums">
                          ₹{balance.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {inv.status !== 'PAID' && (
                            <button
                              onClick={() => handleOpenPayment(inv)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover shadow-subtle"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay Bill</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        title="Create Purchase Order"
        subtitle="Order commodities from registered suppliers with automated tax calculations"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Select Supplier / Vendor *</label>
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

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Order Date *</label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Add Line Items Section */}
          <div className="p-3 bg-slate-50 rounded-lg border border-borderLine space-y-3">
            <h4 className="font-bold text-navy-800 uppercase text-[11px]">Add Items to Purchase Order</h4>
            
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block font-semibold text-textSecondary uppercase mb-1">Store Item</label>
                <select
                  value={newItemId}
                  onChange={(e) => handleSelectItemForPo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
                >
                  <option value="">Select Item to Order</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-textSecondary uppercase mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={newQty}
                  onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-textSecondary uppercase mb-1">Unit Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-textSecondary uppercase mb-1">GST Tax %</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums"
                />
              </div>

              <div className="col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleAddLineToPo}
                  disabled={!newItemId}
                  className="w-full py-1.5 bg-navy-800 hover:bg-navy-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Table of PO Lines */}
            {poLines.length > 0 ? (
              <div className="border border-borderLine rounded-lg overflow-hidden bg-white mt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                      <th className="py-2 px-3">Item Details</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">GST %</th>
                      <th className="py-2 px-3 text-right">Total Line (₹)</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine">
                    {poLines.map((line, idx) => {
                      const lineSub = line.orderedQty * line.unitPrice;
                      const lineTax = lineSub * (line.taxRate / 100);
                      const lineTotal = lineSub + lineTax;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div className="font-bold text-navy-800">{line.itemName}</div>
                            <div className="text-[10px] font-mono text-textSecondary">{line.itemCode}</div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold">{line.orderedQty}</td>
                          <td className="py-2 px-3 text-right tabular-nums">₹{line.unitPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{line.taxRate}%</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-navy-800">₹{lineTotal.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePoLine(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-textSecondary bg-white rounded border border-borderLine/50">
                No items added yet. Select an item above and click Add.
              </div>
            )}
          </div>

          {/* PO Summary & Notes */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Purchase Order Notes</label>
              <textarea
                rows={3}
                placeholder="Terms of delivery, payment schedules, shipment instructions..."
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-borderLine space-y-1.5 text-xs">
              <div className="flex justify-between text-textSecondary">
                <span>Subtotal Cost:</span>
                <span className="font-mono tabular-nums">₹{poTotals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-textSecondary">
                <span>Estimated Tax (GST):</span>
                <span className="font-mono tabular-nums">₹{poTotals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-navy-800 text-sm pt-1 border-t border-borderLine">
                <span>Grand Total PO Value:</span>
                <span className="font-mono tabular-nums text-primary">₹{poTotals.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsPoModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || poLines.length === 0}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting PO...' : 'Confirm & Issue Purchase Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record GRN Modal (Interactive Inspection) */}
      <Modal
        isOpen={isGrnModalOpen}
        onClose={() => setIsGrnModalOpen(false)}
        title={`Record Goods Receipt Note (GRN)`}
        subtitle={`Verify shipment receipt against Purchase Order ${activePoForGrn?.po_number || ''}`}
        maxWidth="4xl"
      >
        <form onSubmit={handleReceiveGoods} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Delivery Challan / Invoice # *</label>
              <input
                type="text"
                required
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

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Receipt Date *</label>
              <input
                type="date"
                required
                value={grnDate}
                onChange={(e) => setGrnDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-borderLine rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                  <th className="py-2.5 px-3">Item Details</th>
                  <th className="py-2.5 px-3 text-right">Ordered</th>
                  <th className="py-2.5 px-3 text-right">Received Qty</th>
                  <th className="py-2.5 px-3 text-right">Accepted Qty</th>
                  <th className="py-2.5 px-3 text-right">Rejected Qty</th>
                  <th className="py-2.5 px-3">Rejection Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {grnLines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <div className="font-bold text-navy-800">{line.itemName}</div>
                      <div className="text-[10px] font-mono text-textSecondary">{line.itemCode}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-medium tabular-nums text-textSecondary">
                      {line.orderedQty}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.receivedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...grnLines];
                          updated[idx].receivedQty = val;
                          updated[idx].acceptedQty = Math.max(0, val - updated[idx].rejectedQty);
                          setGrnLines(updated);
                        }}
                        className="w-20 px-2 py-1 text-right border border-borderLine rounded bg-white tabular-nums font-semibold"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.acceptedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...grnLines];
                          updated[idx].acceptedQty = val;
                          updated[idx].rejectedQty = Math.max(0, updated[idx].receivedQty - val);
                          setGrnLines(updated);
                        }}
                        className="w-20 px-2 py-1 text-right border border-emerald-300 rounded bg-emerald-50 text-emerald-800 tabular-nums font-bold"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.rejectedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...grnLines];
                          updated[idx].rejectedQty = val;
                          updated[idx].acceptedQty = Math.max(0, updated[idx].receivedQty - val);
                          setGrnLines(updated);
                        }}
                        className="w-20 px-2 py-1 text-right border border-rose-300 rounded bg-rose-50 text-rose-800 tabular-nums font-bold"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="Damage, leak, expiry..."
                        value={line.rejectionReason}
                        onChange={(e) => {
                          const updated = [...grnLines];
                          updated[idx].rejectionReason = e.target.value;
                          setGrnLines(updated);
                        }}
                        className="w-full px-2 py-1 border border-borderLine rounded bg-white text-[11px]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Confirming receipt will automatically credit warehouse inventory, record an auditable stock movement, mark PO as Partially Received or Completed, and register a Purchase Invoice for vendor accounts.
            </span>
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Processing Receipt...' : 'Confirm Goods Receipt & Update Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PO View Details Modal */}
      <Modal
        isOpen={isViewPoModalOpen}
        onClose={() => setIsViewPoModalOpen(false)}
        title={`Purchase Order: ${selectedPoDetails?.po_number || ''}`}
        subtitle="Full procurement specifications, vendor information and fulfillment progress"
        maxWidth="2xl"
      >
        {selectedPoDetails && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-borderLine">
              <div>
                <span className="text-textSecondary uppercase text-[10px] font-bold block">Vendor Details</span>
                <span className="font-bold text-navy-800 text-sm block mt-0.5">{selectedPoDetails.vendor_name}</span>
                <span className="text-textSecondary font-mono">{selectedPoDetails.vendor_code} &bull; GSTIN: {selectedPoDetails.vendor_gstin || 'N/A'}</span>
              </div>
              <div className="text-right">
                <span className="text-textSecondary uppercase text-[10px] font-bold block">Order Dates</span>
                <span className="block mt-0.5 font-medium">Order Date: <strong>{selectedPoDetails.order_date}</strong></span>
                <span className="text-textSecondary block">Expected Delivery: {selectedPoDetails.expected_delivery_date || 'N/A'}</span>
              </div>
            </div>

            <div className="border border-borderLine rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                    <th className="py-2.5 px-3">Item Details</th>
                    <th className="py-2.5 px-3 text-right">Ordered</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {(selectedPoDetails.items || []).map((itm: any) => (
                    <tr key={itm.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-navy-800">{itm.item_name}</div>
                        <div className="text-[10px] font-mono text-textSecondary">{itm.item_code}</div>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">{itm.ordered_qty} {itm.unit_code}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700">{itm.received_qty} {itm.unit_code}</td>
                      <td className="py-2 px-3 text-right tabular-nums">₹{parseFloat(itm.unit_price).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-navy-800">₹{parseFloat(itm.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-borderLine">
              <div className="flex items-center space-x-2">
                <span className="text-textSecondary font-semibold">Status:</span>
                <StatusBadge status={selectedPoDetails.status} />
              </div>

              <div className="text-right">
                <span className="text-xs text-textSecondary mr-2">Grand Total:</span>
                <span className="text-base font-bold text-navy-800 font-mono">
                  ₹{parseFloat(selectedPoDetails.total_amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Vendor Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Vendor Payment"
        subtitle={`Process disbursement for Bill ${selectedInvoice?.system_bill_number || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-borderLine space-y-1.5">
            <div className="flex justify-between">
              <span className="text-textSecondary">Vendor:</span>
              <span className="font-bold text-navy-800">{selectedInvoice?.vendor_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textSecondary">Invoice Amount:</span>
              <span className="font-mono tabular-nums">₹{parseFloat(selectedInvoice?.total_amount.toString() || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textSecondary">Already Paid:</span>
              <span className="font-mono tabular-nums text-emerald-700">₹{parseFloat(selectedInvoice?.paid_amount.toString() || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-rose-600 border-t border-borderLine pt-1">
              <span>Remaining Balance:</span>
              <span className="font-mono tabular-nums">
                ₹{(parseFloat(selectedInvoice?.total_amount.toString() || '0') - parseFloat(selectedInvoice?.paid_amount.toString() || '0')).toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold text-navy-800 tabular-nums text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Mode *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="NEFT_RTGS">NEFT / RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Transaction / Cheque #</label>
              <input
                type="text"
                placeholder="UTR / Ref Number"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Payment Remarks</label>
            <input
              type="text"
              placeholder="e.g. Bank settlement batch #4"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || paymentAmount <= 0}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Authorize & Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Purchase Return Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Record Purchase Return to Vendor"
        subtitle="Return defective commodities, deduct warehouse stock and credit supplier ledger"
        maxWidth="md"
      >
        <form onSubmit={handleRecordReturn} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Select Supplier *</label>
            <select
              required
              value={returnVendorId}
              onChange={(e) => setReturnVendorId(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="">Select Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Select Commodity *</label>
            <select
              required
              value={returnItemId}
              onChange={(e) => handleSelectItemForReturn(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            >
              <option value="">Select Item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock} {i.unit_code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Return Quantity *</label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={returnQty}
                onChange={(e) => setReturnQty(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Unit Credit Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={returnUnitPrice}
                onChange={(e) => setReturnUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">Return Reason *</label>
            <input
              type="text"
              required
              placeholder="e.g. Expired batch, packaging puncture, moisture damage"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
            Confirming this return will automatically decrement store inventory by {returnQty} and debit/credit the supplier account balance by ₹{(returnQty * returnUnitPrice).toFixed(2)}.
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || returnQty <= 0}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Authorize Purchase Return'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
