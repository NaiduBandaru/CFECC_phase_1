import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { PurchaseOrder, GoodsReceipt, PurchaseInvoice, Vendor, Item } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  FileSpreadsheet,
  Plus,
  Truck,
  Receipt,
  RotateCcw,
  CreditCard,
  Eye,
  CheckCircle,
  Clock,
  Trash2,
  Search,
  Printer,
  MessageSquare,
  Download,
  ChevronLeft,
  ChevronRight,
  Copy,
  Zap,
  Sparkles,
  History,
  Tag,
  ChevronDown,
  ChevronUp,
  Percent,
  SlidersHorizontal,
} from 'lucide-react';

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const PurchasingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [successBanner, setSuccessBanner] = useState<string | null>(location.state?.successMessage || null);

  // Data States
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Column Visibility
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    grnNumber: false,
    billDate: false,
    vendorGstin: false,
    cgst: false,
    sgst: false,
    igst: false,
    taxableValue: true,
    totalGst: true,
  });

  const columnLabels: Record<string, string> = {
    grnNumber: 'GRN Number',
    billDate: 'Vendor Bill Date',
    vendorGstin: 'Vendor GSTIN',
    cgst: 'CGST (₹)',
    sgst: 'SGST (₹)',
    igst: 'IGST (₹)',
    taxableValue: 'Taxable Value',
    totalGst: 'Total GST (₹)',
  };

  // New PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [poVendorBillNo, setPoVendorBillNo] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poTaxMode, setPoTaxMode] = useState<'AUTO' | 'INTRA' | 'INTER' | 'EXEMPT'>('AUTO');
  const [poDiscountType, setPoDiscountType] = useState<'FLAT' | 'PERCENT'>('FLAT');
  const [poDiscountValue, setPoDiscountValue] = useState<number>(0);
  const [poFreightAmount, setPoFreightAmount] = useState<number>(0);
  const [poAutoRoundOff, setPoAutoRoundOff] = useState<boolean>(true);
  const [poItemCategoryFilter, setPoItemCategoryFilter] = useState<string>('ALL');

  // Vendor Fast Context (Frequent Items & Last PO)
  const [vendorFrequentItems, setVendorFrequentItems] = useState<any[]>([]);
  const [loadingFrequentItems, setLoadingFrequentItems] = useState<boolean>(false);
  const [vendorLastPo, setVendorLastPo] = useState<any | null>(null);
  const [showFrequentTray, setShowFrequentTray] = useState<boolean>(true);

  const [poLines, setPoLines] = useState<Array<{
    itemId: number;
    itemName: string;
    itemCode: string;
    orderedQty: number;
    unitPrice: number;
    salePrice: number;
    mrp: number;
    taxRate: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    expiryDate?: string;
  }>>([]);
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState<number>(10);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newSalePrice, setNewSalePrice] = useState<number>(0);
  const [newMrp, setNewMrp] = useState<number>(0);
  const [newGstSlab, setNewGstSlab] = useState<number>(0);
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');

  // PO Combobox Search states
  const [poVendorSearch, setPoVendorSearch] = useState('');
  const [isPoVendorSearchOpen, setIsPoVendorSearchOpen] = useState(false);
  const [poItemSearch, setPoItemSearch] = useState('');
  const [isPoItemSearchOpen, setIsPoItemSearchOpen] = useState(false);

  const poItemInputRef = useRef<HTMLInputElement>(null);
  const poQtyInputRef = useRef<HTMLInputElement>(null);
  const poPriceInputRef = useRef<HTMLInputElement>(null);

  // PO Details Modal
  const [isViewPoModalOpen, setIsViewPoModalOpen] = useState(false);
  const [selectedPoDetails, setSelectedPoDetails] = useState<any | null>(null);

  // GRN Modal
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [activePoForGrn, setActivePoForGrn] = useState<any | null>(null);
  const [directGrnVendorId, setDirectGrnVendorId] = useState('');
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
    expiryDate?: string;
    rejectionReason: string;
  }>>([]);
  const [grnAddItemId, setGrnAddItemId] = useState('');
  const [grnAddQty, setGrnAddQty] = useState<number>(10);
  const [grnAddCost, setGrnAddCost] = useState<number>(0);
  const [grnAddExpiry, setGrnAddExpiry] = useState<string>('');

  // Direct GRN Combobox Search states
  const [grnVendorSearch, setGrnVendorSearch] = useState('');
  const [isGrnVendorSearchOpen, setIsGrnVendorSearchOpen] = useState(false);
  const [grnItemSearch, setGrnItemSearch] = useState('');
  const [isGrnItemSearchOpen, setIsGrnItemSearchOpen] = useState(false);

  // View GRN Slip Modal
  const [isViewGrnModalOpen, setIsViewGrnModalOpen] = useState(false);
  const [selectedGrnDetails, setSelectedGrnDetails] = useState<any | null>(null);

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

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, vendorFilter, search]);

  const ensureItemsLoaded = async () => {
    if (items.length === 0) {
      try {
        const res = await api.get('/items?limit=500');
        if (res.data.success) setItems(res.data.data);
      } catch (err) {
        console.error('Failed to load items:', err);
      }
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch primary datasets in parallel (fast and light)
      const [vRes, oRes] = await Promise.all([
        api.get('/vendors'),
        api.get('/purchasing/orders'),
      ]);
      if (vRes.data.success) setVendors(vRes.data.data);
      if (oRes.data.success) setOrders(oRes.data.data);

      // Receipts & Invoices loaded asynchronously without blocking main table render
      api.get('/purchasing/receipts').then((r) => r.data.success && setReceipts(r.data.data)).catch(console.error);
      api.get('/purchasing/invoices').then((r) => r.data.success && setInvoices(r.data.data)).catch(console.error);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get('/purchasing/orders');
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

  // Auto-load vendor past items & latest PO when vendor is selected
  useEffect(() => {
    if (!selectedVendorId) {
      setVendorFrequentItems([]);
      setVendorLastPo(null);
      return;
    }

    const loadVendorContext = async () => {
      try {
        setLoadingFrequentItems(true);
        const res = await api.get(`/vendors/${selectedVendorId}/profile`);
        if (res.data.success && res.data.data) {
          setVendorFrequentItems(res.data.data.suppliedItems || []);
          const pastOrders = res.data.data.purchaseOrders || [];
          if (pastOrders.length > 0) {
            setVendorLastPo(pastOrders[0]);
          } else {
            setVendorLastPo(null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingFrequentItems(false);
      }
    };

    loadVendorContext();
  }, [selectedVendorId]);

  // Fast 1-click clone / repeat from previous PO
  const handleCopyLastPo = async () => {
    if (!vendorLastPo) return;
    try {
      setLoading(true);
      const res = await api.get(`/purchasing/orders/${vendorLastPo.id}`);
      if (res.data.success && res.data.data) {
        const order = res.data.data;
        const copiedLines = (order.items || []).map((itm: any) => {
          const matchedItem = items.find((i) => i.id === (itm.item_id || itm.itemId));
          const taxR = parseFloat(itm.tax_rate || itm.taxRate || matchedItem?.tax_rate?.toString() || '0');
          return {
            itemId: itm.item_id || itm.itemId,
            itemName: itm.item_name || itm.itemName || matchedItem?.name || 'Item',
            itemCode: itm.item_code || itm.itemCode || matchedItem?.item_code || '',
            orderedQty: parseFloat(itm.ordered_qty || itm.orderedQty || '1'),
            unitPrice: parseFloat(itm.unit_price || itm.unitPrice || matchedItem?.purchase_price?.toString() || '0'),
            salePrice: parseFloat(itm.selling_price || itm.salePrice || matchedItem?.selling_price?.toString() || '0'),
            mrp: parseFloat(itm.mrp || matchedItem?.selling_price?.toString() || itm.unit_price || '0'),
            taxRate: taxR,
            cgstRate: taxR / 2,
            sgstRate: taxR / 2,
            igstRate: taxR,
            expiryDate: itm.expiry_date ? String(itm.expiry_date).split('T')[0] : undefined,
          };
        });
        setPoLines(copiedLines);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Quick Add single frequent item
  const handleQuickAddFrequentItem = (fItem: any) => {
    const existingIdx = poLines.findIndex((p) => p.itemId === fItem.item_id);
    if (existingIdx >= 0) {
      const updated = [...poLines];
      updated[existingIdx].orderedQty += 10;
      setPoLines(updated);
      return;
    }

    const itm = items.find((i) => i.id === fItem.item_id);
    const purPrice = parseFloat(fItem.avg_unit_cost || fItem.purchase_price || itm?.purchase_price?.toString() || '0');
    const saleP = parseFloat(itm?.selling_price?.toString() || (itm as any)?.batch1_rate?.toString() || '0');
    const mrpP = parseFloat((itm as any)?.mrp?.toString() || saleP.toString()) || saleP;
    const taxRate = parseFloat(itm?.tax_rate?.toString() || '0');

    setPoLines([
      ...poLines,
      {
        itemId: fItem.item_id,
        itemName: fItem.item_name || itm?.name || 'Item',
        itemCode: fItem.item_code || itm?.item_code || '',
        orderedQty: Math.max(1, Math.round(parseFloat(fItem.total_ordered_qty?.toString() || '10') / (fItem.po_count || 1))) || 10,
        unitPrice: purPrice,
        salePrice: saleP,
        mrp: mrpP,
        taxRate: taxRate,
        cgstRate: taxRate / 2,
        sgstRate: taxRate / 2,
        igstRate: taxRate,
        expiryDate: undefined,
      },
    ]);
  };

  // 1-Click Quick Add all frequent items from this vendor
  const handleAddAllFrequentItems = () => {
    const newItemsToAdd = vendorFrequentItems
      .filter((fItem) => !poLines.some((p) => p.itemId === fItem.item_id))
      .map((fItem) => {
        const itm = items.find((i) => i.id === fItem.item_id);
        const purPrice = parseFloat(fItem.avg_unit_cost || fItem.purchase_price || itm?.purchase_price?.toString() || '0');
        const saleP = parseFloat(itm?.selling_price?.toString() || (itm as any)?.batch1_rate?.toString() || '0');
        const mrpP = parseFloat((itm as any)?.mrp?.toString() || saleP.toString()) || saleP;
        const taxRate = parseFloat(itm?.tax_rate?.toString() || '0');
        return {
          itemId: fItem.item_id,
          itemName: fItem.item_name || itm?.name || 'Item',
          itemCode: fItem.item_code || itm?.item_code || '',
          orderedQty: Math.max(1, Math.round(parseFloat(fItem.total_ordered_qty?.toString() || '10') / (fItem.po_count || 1))) || 10,
          unitPrice: purPrice,
          salePrice: saleP,
          mrp: mrpP,
          taxRate: taxRate,
          cgstRate: taxRate / 2,
          sgstRate: taxRate / 2,
          igstRate: taxRate,
          expiryDate: undefined,
        };
      });
    setPoLines([...poLines, ...newItemsToAdd]);
  };

  // Inline table line field updater for ultra-fast on-the-fly corrections
  const handleUpdatePoLine = (index: number, field: string, value: any) => {
    setPoLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };
      if (field === 'taxRate') {
        const rate = parseFloat(value) || 0;
        line.taxRate = rate;
        line.cgstRate = rate / 2;
        line.sgstRate = rate / 2;
        line.igstRate = rate;
      }
      updated[index] = line;
      return updated;
    });
  };

  // Duplicate an existing line
  const handleDuplicatePoLine = (index: number) => {
    const line = poLines[index];
    setPoLines([...poLines, { ...line }]);
  };

  // Clear all items with confirmation
  const handleClearAllPoLines = () => {
    if (poLines.length === 0) return;
    if (confirm('Clear all line items in this purchase order?')) {
      setPoLines([]);
    }
  };

  // Add item line to new PO
  const handleAddLineToPo = () => {
    if (!newItemId) return;
    const itm = items.find((i) => i.id === parseInt(newItemId, 10));
    if (!itm) return;

    const purPrice = newPrice > 0 ? newPrice : parseFloat(itm.purchase_price?.toString() || '0');
    const saleP = newSalePrice > 0 ? newSalePrice : parseFloat(itm.selling_price?.toString() || (itm as any).batch1_rate?.toString() || '0');
    const mrpP = newMrp > 0 ? newMrp : (saleP > 0 ? saleP : purPrice);
    const taxRate = newGstSlab >= 0 ? newGstSlab : parseFloat(itm.tax_rate?.toString() || '0');

    const existingIndex = poLines.findIndex((p) => p.itemId === itm.id);
    if (existingIndex >= 0) {
      // Increase quantity instead of throwing an annoying alert
      const updated = [...poLines];
      updated[existingIndex].orderedQty += (newQty || 1);
      if (newPrice > 0) updated[existingIndex].unitPrice = newPrice;
      if (newSalePrice > 0) updated[existingIndex].salePrice = newSalePrice;
      if (newMrp > 0) updated[existingIndex].mrp = newMrp;
      setPoLines(updated);
    } else {
      setPoLines([
        ...poLines,
        {
          itemId: itm.id,
          itemName: itm.name,
          itemCode: itm.item_code,
          orderedQty: newQty || 1,
          unitPrice: purPrice,
          salePrice: saleP,
          mrp: mrpP,
          taxRate: taxRate,
          cgstRate: taxRate / 2,
          sgstRate: taxRate / 2,
          igstRate: taxRate,
          expiryDate: newExpiryDate || undefined,
        },
      ]);
    }

    setNewItemId('');
    setPoItemSearch('');
    setIsPoItemSearchOpen(false);
    setNewQty(10);
    setNewPrice(0);
    setNewSalePrice(0);
    setNewMrp(0);
    setNewGstSlab(0);
    setNewExpiryDate('');

    // Re-focus search input automatically for rapid entry
    setTimeout(() => {
      poItemInputRef.current?.focus();
    }, 50);
  };

  const handleSelectItemForPo = (itemIdStr: string) => {
    setNewItemId(itemIdStr);
    const itm = items.find((i) => i.id === parseInt(itemIdStr, 10));
    if (itm) {
      const purPrice = parseFloat(itm.purchase_price?.toString() || '0');
      const saleP = parseFloat(itm.selling_price?.toString() || (itm as any).batch1_rate?.toString() || '0');
      const mrpP = parseFloat((itm as any).mrp?.toString() || saleP.toString()) || saleP;
      const totalTax = parseFloat(itm.tax_rate?.toString() || '0');

      setNewPrice(purPrice);
      setNewSalePrice(saleP);
      setNewMrp(mrpP);
      setNewGstSlab(totalTax);
      setNewExpiryDate((itm as any).batch1_expiry ? String((itm as any).batch1_expiry).split('T')[0] : '');

      // Focus quantity field immediately so user can press Enter or change quantity
      setTimeout(() => {
        poQtyInputRef.current?.focus();
        poQtyInputRef.current?.select();
      }, 50);
    }
  };

  const handleRemovePoLine = (index: number) => {
    setPoLines(poLines.filter((_, idx) => idx !== index));
  };

  const poTotals = useMemo(() => {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let taxAmount = 0;

    const vendor = vendors.find((v) => v.id.toString() === selectedVendorId);
    const vendorState = (vendor?.state || 'Andhra Pradesh').toLowerCase();
    const isOutsideAp = vendorState && !vendorState.includes('andhra') && !vendorState.includes('ap');
    const isInter = poTaxMode === 'INTER' 
      ? true 
      : poTaxMode === 'INTRA' 
      ? false 
      : (isOutsideAp || (/^[0-9]{2}/.test(vendor?.gstin || '') && !vendor?.gstin?.startsWith('37')));

    poLines.forEach((l) => {
      const lineSub = l.orderedQty * l.unitPrice;
      const cgstVal = poTaxMode === 'EXEMPT' ? 0 : (l.cgstRate ?? 0);
      const sgstVal = poTaxMode === 'EXEMPT' ? 0 : (l.sgstRate ?? 0);
      const igstVal = poTaxMode === 'EXEMPT' ? 0 : (l.igstRate ?? 0);
      const rate = poTaxMode === 'EXEMPT' ? 0 : (l.taxRate || 0);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (cgstVal > 0 || sgstVal > 0 || igstVal > 0) {
        cgst = lineSub * (cgstVal / 100);
        sgst = lineSub * (sgstVal / 100);
        igst = lineSub * (igstVal / 100);
      } else if (rate > 0) {
        if (isInter) {
          igst = lineSub * (rate / 100);
        } else {
          cgst = lineSub * ((rate / 2) / 100);
          sgst = lineSub * ((rate / 2) / 100);
        }
      }

      subtotal += lineSub;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      taxAmount += (cgst + sgst + igst);
    });

    const discountVal = poDiscountType === 'PERCENT' ? (subtotal * (poDiscountValue / 100)) : poDiscountValue;
    const finalSubtotal = Math.max(0, subtotal - discountVal);
    const freightVal = poFreightAmount || 0;
    const preRoundTotal = finalSubtotal + taxAmount + freightVal;
    const roundOffVal = Math.round(preRoundTotal) - preRoundTotal;
    const totalAmount = preRoundTotal + (poAutoRoundOff ? roundOffVal : 0);

    return {
      subtotal,
      discountVal,
      freightVal,
      roundOffVal: poAutoRoundOff ? roundOffVal : 0,
      cgstTotal,
      sgstTotal,
      igstTotal,
      taxAmount,
      totalAmount,
      isInter,
    };
  }, [poLines, selectedVendorId, vendors, poTaxMode, poDiscountType, poDiscountValue, poFreightAmount, poAutoRoundOff]);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poLines.length === 0) {
      setError('Please add at least one line item to the order.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const notesArray: string[] = [];
      if (poVendorBillNo) notesArray.push(`Invoice/Ref: ${poVendorBillNo}`);
      if (poDiscountValue > 0) {
        notesArray.push(`Discount: ${poDiscountType === 'PERCENT' ? `${poDiscountValue}%` : `₹${poDiscountValue}`}`);
      }
      if (poFreightAmount > 0) notesArray.push(`Freight: ₹${poFreightAmount}`);
      if (poNotes) notesArray.push(poNotes);

      const notesPayload = notesArray.join(' | ') || 'Commodity replenishment';

      const res = await api.post('/purchasing/orders', {
        vendorId: parseInt(selectedVendorId, 10),
        orderDate,
        expectedDeliveryDate: expectedDate || null,
        vendorInvoiceNumber: poVendorBillNo || null,
        notes: notesPayload,
        items: poLines.map((l) => ({
          itemId: l.itemId,
          orderedQty: l.orderedQty,
          unitPrice: l.unitPrice,
          salePrice: l.salePrice,
          mrp: l.mrp,
          cgstRate: poTaxMode === 'EXEMPT' ? 0 : (l.cgstRate || 0),
          sgstRate: poTaxMode === 'EXEMPT' ? 0 : (l.sgstRate || 0),
          igstRate: poTaxMode === 'EXEMPT' ? 0 : (l.igstRate || 0),
          taxRate: poTaxMode === 'EXEMPT' ? 0 : ((l.cgstRate || 0) + (l.sgstRate || 0) + (l.igstRate || 0) || (l.taxRate || 0)),
          expiryDate: l.expiryDate || null,
        })),
      });

      if (res.data.success) {
        setIsPoModalOpen(false);
        setPoLines([]);
        setSelectedVendorId('');
        setPoVendorBillNo('');
        setPoNotes('');
        setPoDiscountValue(0);
        setPoFreightAmount(0);
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
    ensureItemsLoaded();
    try {
      const res = await api.get(`/purchasing/orders/${po.id}`);
      if (res.data.success) {
        const poDetails = res.data.data;
        setActivePoForGrn(poDetails);
        setDirectGrnVendorId(poDetails.vendor_id.toString());
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

  const receiptMap = useMemo(() => {
    const map = new Map<number, GoodsReceipt>();
    receipts.forEach((r) => {
      if (r.po_id) map.set(r.po_id, r);
    });
    return map;
  }, [receipts]);

  const receiptByPoNumMap = useMemo(() => {
    const map = new Map<string, GoodsReceipt>();
    receipts.forEach((r) => {
      if (r.po_number) map.set(r.po_number, r);
    });
    return map;
  }, [receipts]);

  const handleOpenDirectGrn = async () => {
    await ensureItemsLoaded();
    setActivePoForGrn(null);
    setDirectGrnVendorId(vendors[0]?.id?.toString() || '');
    setGrnVendorSearch('');
    setIsGrnVendorSearchOpen(false);
    setGrnChallan('');
    setGrnVehicle('');
    setGrnDate(new Date().toISOString().split('T')[0]);
    setGrnLines([]);
    setGrnAddItemId(items[0]?.id?.toString() || '');
    setGrnItemSearch('');
    setIsGrnItemSearchOpen(false);
    setGrnAddExpiry('');
    if (items.length > 0) {
      setGrnAddQty(10);
      setGrnAddCost(parseFloat(items[0].purchase_price?.toString() || '0'));
    }
    setIsGrnModalOpen(true);
  };

  const handleAddDirectGrnLine = () => {
    if (!grnAddItemId) return;
    const itm = items.find((i) => i.id === parseInt(grnAddItemId, 10));
    if (!itm) return;

    if (grnLines.some((l) => l.itemId === itm.id)) {
      alert('This item is already added to the received lines.');
      return;
    }

    setGrnLines([
      ...grnLines,
      {
        itemId: itm.id,
        itemName: itm.name,
        itemCode: itm.item_code,
        orderedQty: 0,
        receivedQty: grnAddQty,
        acceptedQty: grnAddQty,
        rejectedQty: 0,
        unitCost: grnAddCost > 0 ? grnAddCost : parseFloat(itm.purchase_price.toString()),
        expiryDate: grnAddExpiry || undefined,
        rejectionReason: '',
      },
    ]);
    setGrnAddExpiry('');
  };

  const handleRemoveGrnLine = (index: number) => {
    setGrnLines(grnLines.filter((_, idx) => idx !== index));
  };

  const handleViewGrn = async (grnId: number) => {
    try {
      const res = await api.get(`/purchasing/receipts/${grnId}`);
      if (res.data.success) {
        setSelectedGrnDetails(res.data.data);
        setIsViewGrnModalOpen(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load GRN details');
    }
  };

  const handleSendWhatsAppPo = async (poId: number) => {
    try {
      const res = await api.post('/whatsapp/send-vendor-po', { poId });
      alert(res.data.message || 'WhatsApp Purchase Order dispatched to vendor!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch WhatsApp PO');
    }
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendorId = activePoForGrn ? activePoForGrn.vendor_id : parseInt(directGrnVendorId, 10);
    if (!vendorId) {
      alert('Please select a vendor.');
      return;
    }

    if (grnLines.length === 0) {
      alert('Please add at least one received item line.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/purchasing/receipts', {
        poId: activePoForGrn ? activePoForGrn.id : null,
        vendorId,
        receiptDate: grnDate,
        deliveryChallanNumber: grnChallan || `DC-${Date.now().toString().slice(-6)}`,
        vehicleNumber: grnVehicle || 'AP 31 TT 9999',
        notes: activePoForGrn ? `Received against ${activePoForGrn.po_number}` : 'Direct Stock Inward',
        items: grnLines.map((l) => ({
          itemId: l.itemId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          unitCost: l.unitCost,
          expiryDate: l.expiryDate || null,
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

  // GST Tax Breakdown Helper for Andhra Pradesh (State code: 37)
  const getGstBreakdown = (po: PurchaseOrder) => {
    const taxable = parseFloat(po.subtotal?.toString() || '0');
    const totalTax = parseFloat(po.tax_amount?.toString() || '0');
    const totalAmt = parseFloat(po.total_amount?.toString() || '0');

    const gstin = po.vendor_gstin?.trim() || '';
    const state = (po.vendor_state || 'Andhra Pradesh').trim().toLowerCase();

    // Check if supply has recorded line item taxes
    const recCgst = parseFloat((po as any).cgst_amount?.toString() || '0');
    const recSgst = parseFloat((po as any).sgst_amount?.toString() || '0');
    const recIgst = parseFloat((po as any).igst_amount?.toString() || '0');

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let isInterState = false;

    if (recCgst > 0 || recSgst > 0 || recIgst > 0) {
      cgst = recCgst;
      sgst = recSgst;
      igst = recIgst;
      isInterState = recIgst > 0 && (recCgst === 0 && recSgst === 0);
    } else if (totalTax > 0) {
      // Check if supply is Inter-State (outside AP) or Intra-State (within AP 37)
      const isOutsideAp = state && !state.includes('andhra') && !state.includes('ap');
      isInterState = isOutsideAp || (/^[0-9]{2}/.test(gstin) && !gstin.startsWith('37'));

      if (isInterState) {
        igst = totalTax;
      } else {
        // Intra-State AP: 50% CGST + 50% SGST
        cgst = Math.round((totalTax / 2) * 100) / 100;
        sgst = Math.round((totalTax - cgst) * 100) / 100;
      }
    }

    return { taxable, totalTax, cgst, sgst, igst, totalAmt, isInterState, gstin };
  };

  const handleExportTaxRegister = () => {
    if (orders.length === 0) {
      alert('No purchase records to export.');
      return;
    }

    const headers = [
      'PO Number',
      'Vendor Bill Number',
      'GRN Number',
      'Bill Date',
      'GRN Date',
      'Vendor Code',
      'Vendor Name',
      'Vendor GSTIN',
      'Tax Jurisdiction',
      'Items Count',
      'Taxable Value (INR)',
      'CGST (INR)',
      'SGST (INR)',
      'IGST (INR)',
      'Total GST (INR)',
      'Net Total (INR)',
      'Status'
    ];

    const rows = filteredOrders.map((po) => {
      const receipt = receiptMap.get(po.id) || (po.po_number ? receiptByPoNumMap.get(po.po_number) : undefined);
      const grnNum = (po as any).grn_number || receipt?.grn_number || '';
      const grnDt = (po as any).grn_date || receipt?.receipt_date || '';
      const b = getGstBreakdown(po);
      return [
        `"${po.po_number}"`,
        `"${po.vendor_invoice_number || ''}"`,
        `"${grnNum}"`,
        `"${formatDate(po.order_date)}"`,
        `"${formatDate(grnDt)}"`,
        `"${po.vendor_code}"`,
        `"${(po.vendor_name || '').replace(/"/g, '""')}"`,
        `"${po.vendor_gstin || ''}"`,
        `"${b.isInterState ? 'Inter-State (IGST)' : 'Intra-State AP (CGST+SGST)'}"`,
        po.item_count || 1,
        b.taxable.toFixed(2),
        b.cgst.toFixed(2),
        b.sgst.toFixed(2),
        b.igst.toFixed(2),
        b.totalTax.toFixed(2),
        b.totalAmt.toFixed(2),
        `"${po.status}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CFECC_Purchase_Tax_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Instant In-Memory Filtered Orders & Pagination (0ms delay)
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'ALL') {
      result = result.filter((po) => po.status === statusFilter);
    }
    if (vendorFilter !== 'ALL') {
      result = result.filter((po) => po.vendor_id?.toString() === vendorFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (po) =>
          po.po_number?.toLowerCase().includes(q) ||
          ((po as any).grn_number && (po as any).grn_number.toLowerCase().includes(q)) ||
          po.vendor_name?.toLowerCase().includes(q) ||
          po.vendor_code?.toLowerCase().includes(q) ||
          (po.vendor_gstin && po.vendor_gstin.toLowerCase().includes(q)) ||
          ((po as any).vendor_invoice_number && (po as any).vendor_invoice_number.toLowerCase().includes(q)) ||
          (po.notes && po.notes.toLowerCase().includes(q))
      );
    }
    return result;
  }, [orders, statusFilter, vendorFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Metrics & GST Summary based on filtered results
  const taxSummary = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let tax = 0;
    let grand = 0;

    filteredOrders.forEach((po) => {
      const b = getGstBreakdown(po);
      taxable += b.taxable;
      cgst += b.cgst;
      sgst += b.sgst;
      igst += b.igst;
      tax += b.totalTax;
      grand += b.totalAmt;
    });

    return { taxable, cgst, sgst, igst, tax, grand };
  }, [filteredOrders]);

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
          <h2 className="text-xl font-bold text-navy-800">Purchasing & Stock Inward Register</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Direct vendor purchases, stock receipts (GRN), delivery challans, GST tax breakdown and inventory inwards
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportTaxRegister}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
            title="Download full GST inward tax register for GSTR-2B compliance"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Tax CSV</span>
          </button>

          <button
            onClick={() => setIsReturnModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors shadow-subtle"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>Purchase Return</span>
          </button>

          <button
            onClick={handleOpenDirectGrn}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-subtle"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Receive Vendor Stock (GRN)</span>
          </button>

          <button
            onClick={() => navigate('/purchasing/orders/new')}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner from New Order Page */}
      {successBanner && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Total Inward Value</span>
            <FileSpreadsheet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2 tabular-nums">
            ₹{taxSummary.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">{orders.length} Inward Purchases &bull; Net Amount</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Total Tax (GST Paid)</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2 tabular-nums">
            ₹{taxSummary.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-textSecondary mt-1 flex flex-wrap gap-x-2">
            <span>CGST: <strong>₹{taxSummary.cgst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
            <span>SGST: <strong>₹{taxSummary.sgst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
            <span>IGST: <strong>₹{taxSummary.igst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Goods Receipts (GRN)</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-navy-800 mt-2 tabular-nums">{receipts.length}</div>
          <div className="text-[11px] text-textSecondary mt-1">Completed shipments verified</div>
        </div>

        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-textSecondary uppercase">Vendor Payables</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 mt-2 tabular-nums">
            ₹{unpaidInvoicesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-textSecondary mt-1">Outstanding vendor bills</div>
        </div>
      </div>

      {/* Unified Register Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden space-y-3 p-4">
        {/* Filters and search bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO #, vendor name, code, GSTIN, challan #..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-textSecondary font-semibold">Vendor:</span>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none max-w-[180px] truncate"
              >
                <option value="ALL">All Vendors ({vendors.length})</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendor_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-textSecondary font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Column Visibility Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Columns</span>
              </button>

              {showColumnDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-card border border-borderLine p-3 z-30 space-y-2">
                  <div className="font-bold text-navy-800 text-xs pb-1.5 border-b border-borderLine flex items-center justify-between">
                    <span>Toggle Columns</span>
                    <button
                      onClick={() =>
                        setVisibleColumns({
                          grnNumber: true,
                          billDate: true,
                          vendorGstin: true,
                          cgst: true,
                          sgst: true,
                          igst: true,
                          taxableValue: true,
                          totalGst: true,
                        })
                      }
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Show All
                    </button>
                  </div>
                  {Object.entries(columnLabels).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center space-x-2 text-xs text-navy-800 cursor-pointer hover:bg-slate-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[key as keyof typeof visibleColumns]}
                        onChange={(e) =>
                          setVisibleColumns({
                            ...visibleColumns,
                            [key]: e.target.checked,
                          })
                        }
                        className="rounded border-borderLine text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {(search || vendorFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setVendorFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-2.5 py-1.5 text-xs text-textSecondary hover:text-navy-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
                title="Reset Filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* GST Notice Banner */}
        <div className="flex items-center justify-between text-[11px] text-textSecondary bg-slate-50/80 px-3.5 py-2 rounded-lg border border-borderLine">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              GST Tax Inward Register with <strong>CGST + SGST (AP - 37)</strong> & <strong>IGST</strong> compliance
            </span>
          </div>
          <div className="text-slate-500 hidden sm:flex items-center space-x-1 text-[11px]">
            <span>Click <strong>View</strong> on any order to inspect full line items & slip details</span>
          </div>
        </div>

        {/* Unified Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[380px] border border-borderLine rounded-lg scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-borderLine shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3.5 min-w-[130px]">PO / Bill #</th>
                {visibleColumns.grnNumber && <th className="py-3 px-3 min-w-[110px]">GRN #</th>}
                {visibleColumns.billDate && <th className="py-3 px-3 min-w-[100px]">Bill Date</th>}
                <th className="py-3 px-3 min-w-[105px]">Date</th>
                <th className="py-3 px-3 min-w-[200px]">Vendor</th>
                {visibleColumns.vendorGstin && <th className="py-3 px-3 min-w-[150px]">Vendor GSTIN</th>}
                <th className="py-3 px-3 text-center min-w-[85px]">Items</th>
                {visibleColumns.taxableValue && <th className="py-3 px-3 text-right min-w-[110px]">Taxable Value</th>}
                {visibleColumns.cgst && <th className="py-3 px-3 text-right min-w-[95px] text-blue-700 bg-blue-50/50">CGST (₹)</th>}
                {visibleColumns.sgst && <th className="py-3 px-3 text-right min-w-[95px] text-indigo-700 bg-indigo-50/50">SGST (₹)</th>}
                {visibleColumns.igst && <th className="py-3 px-3 text-right min-w-[95px] text-purple-700 bg-purple-50/50">IGST (₹)</th>}
                {visibleColumns.totalGst && <th className="py-3 px-3 text-right min-w-[100px] text-navy-800 bg-slate-200/50">Total GST</th>}
                <th className="py-3 px-3 text-right min-w-[115px]">Net Total</th>
                <th className="py-3 px-3 text-center min-w-[95px]">Status</th>
                <th className="py-3 px-3 text-center min-w-[80px]">View</th>
                <th className="py-3 px-3.5 text-center min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={7 + Object.values(visibleColumns).filter(Boolean).length} className="py-12 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading purchases & goods receipts...</div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7 + Object.values(visibleColumns).filter(Boolean).length} className="py-12 text-center text-textSecondary">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No purchase records found matching filter criteria.</div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((po) => {
                  const receipt = receiptMap.get(po.id) || (po.po_number ? receiptByPoNumMap.get(po.po_number) : undefined);
                  const grnNum = (po as any).grn_number || receipt?.grn_number;
                  const grnDt = (po as any).grn_date || receipt?.receipt_date;
                  const { taxable, totalTax, cgst, sgst, igst, totalAmt, isInterState, gstin } = getGstBreakdown(po);

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* PO / Bill # */}
                      <td className="py-3 px-3.5 font-mono">
                        <div className="font-bold text-navy-800">{po.po_number}</div>
                        {po.vendor_invoice_number ? (
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5 truncate max-w-[120px]" title={`Vendor Bill #${po.vendor_invoice_number}`}>
                            Bill #{po.vendor_invoice_number}
                          </div>
                        ) : null}
                      </td>

                      {/* Optional GRN # */}
                      {visibleColumns.grnNumber && (
                        <td className="py-3 px-3 font-mono">
                          {grnNum ? (
                            <span className="font-bold text-emerald-700">{grnNum}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Optional Bill Date */}
                      {visibleColumns.billDate && (
                        <td className="py-3 px-3 whitespace-nowrap text-textSecondary font-medium">
                          {formatDate(po.order_date)}
                        </td>
                      )}

                      {/* Inward Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {grnDt ? (
                          <span className="font-semibold text-emerald-700">{formatDate(grnDt)}</span>
                        ) : (
                          <span className="text-slate-600 font-medium">{formatDate(po.order_date)}</span>
                        )}
                      </td>

                      {/* Vendor Name & Code */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-navy-800 truncate max-w-[220px]" title={po.vendor_name}>
                          {po.vendor_name}
                        </div>
                        <div className="text-[10px] text-textSecondary font-mono mt-0.5">
                          {po.vendor_code}
                        </div>
                      </td>

                      {/* Optional Vendor GSTIN */}
                      {visibleColumns.vendorGstin && (
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-800 font-medium">
                          {gstin || (po.vendor_code ? `37AAAC${po.vendor_code.replace(/[^0-9]/g, '').padStart(4, '0')}Z1` : '-')}
                        </td>
                      )}

                      {/* Items */}
                      <td className="py-3 px-3 text-center font-medium">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px]">
                          {parseInt(String(po.item_count || receipt?.item_count || 0), 10)} lines
                        </span>
                      </td>

                      {/* Optional Taxable Value */}
                      {visibleColumns.taxableValue && (
                        <td className="py-3 px-3 text-right font-medium text-textSecondary tabular-nums">
                          ₹{taxable.toFixed(2)}
                        </td>
                      )}

                      {/* Optional CGST */}
                      {visibleColumns.cgst && (
                        <td className="py-3 px-3 text-right font-medium text-blue-700 bg-blue-50/20 tabular-nums">
                          {cgst > 0 ? `₹${cgst.toFixed(2)}` : '-'}
                        </td>
                      )}

                      {/* Optional SGST */}
                      {visibleColumns.sgst && (
                        <td className="py-3 px-3 text-right font-medium text-indigo-700 bg-indigo-50/20 tabular-nums">
                          {sgst > 0 ? `₹${sgst.toFixed(2)}` : '-'}
                        </td>
                      )}

                      {/* Optional IGST */}
                      {visibleColumns.igst && (
                        <td className="py-3 px-3 text-right font-medium text-purple-700 bg-purple-50/20 tabular-nums">
                          {igst > 0 ? `₹${igst.toFixed(2)}` : '-'}
                        </td>
                      )}

                      {/* Total Tax */}
                      {visibleColumns.totalGst && (
                        <td className="py-3 px-3 text-right font-bold text-navy-800 bg-slate-50/50 tabular-nums">
                          ₹{totalTax.toFixed(2)}
                        </td>
                      )}

                      {/* Net Total */}
                      <td className="py-3 px-3 text-right font-black text-navy-900 tabular-nums">
                        ₹{totalAmt.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={po.status} />
                      </td>

                      {/* Dedicated View Column */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => receipt ? handleViewGrn(receipt.id) : handleViewPo(po.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 text-xs font-semibold transition-colors shadow-2xs group"
                          title="View complete purchase order and GRN slip details"
                        >
                          <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          <span>View</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            title="Dispatch PO via WhatsApp"
                            onClick={() => handleSendWhatsAppPo(po.id)}
                            className="p-1 hover:bg-emerald-50 rounded text-emerald-600 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && !receipt && (
                            <button
                              onClick={() => handleOpenGrn(po)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 text-primary border border-blue-200 hover:bg-primary hover:text-white text-[10px] font-semibold transition-colors"
                            >
                              <Truck className="w-3 h-3" />
                              <span>GRN</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 pb-1 text-xs text-textSecondary px-1">
          <div className="flex items-center space-x-2">
            <span>Showing</span>
            <span className="font-bold text-navy-800 font-mono">
              {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            <span>to</span>
            <span className="font-bold text-navy-800 font-mono">
              {Math.min(currentPage * pageSize, filteredOrders.length)}
            </span>
            <span>of</span>
            <span className="font-bold text-navy-800 font-mono">{filteredOrders.length}</span>
            <span>purchases</span>
            {filteredOrders.length !== orders.length && (
              <span className="text-[11px] text-primary font-mono">(filtered from {orders.length} total)</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white border border-borderLine rounded text-xs focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px]"
                title="First Page"
              >
                &laquo;
              </button>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px] flex items-center space-x-1"
                title="Previous Page"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>
              <span className="px-2 font-mono font-bold text-navy-800 text-[11px]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px] flex items-center space-x-1"
                title="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 rounded border border-borderLine bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-[11px]"
                title="Last Page"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>

        {/* Floating Summary Footer with Tax Breakdown */}
        <div className="sticky bottom-0 z-10 bg-slate-50/95 backdrop-blur-xs border-t border-borderLine px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between text-xs text-textSecondary select-none gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              Showing <span className="font-bold text-navy-800 font-mono">{filteredOrders.length}</span> purchase inwards
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div>
              Taxable: <strong className="text-navy-800 font-mono">₹{taxSummary.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-blue-700">
              CGST: <strong className="font-mono">₹{taxSummary.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-indigo-700">
              SGST: <strong className="font-mono">₹{taxSummary.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="hidden lg:block text-slate-300">|</div>
            <div className="text-purple-700">
              IGST: <strong className="font-mono">₹{taxSummary.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs self-end md:self-auto">
            <span className="text-navy-800 font-medium">
              Total GST: <strong className="font-mono font-bold">₹{taxSummary.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-navy-900 font-bold">
              Grand Total:{' '}
              <strong className="text-navy-900 font-mono text-sm font-black">
                ₹{taxSummary.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        title="Create Purchase Order"
        subtitle="Order commodities from registered suppliers with automated tax calculations"
        maxWidth="6xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-borderLine">
            {/* Searchable Vendor Combobox */}
            <div className="relative">
              <label className="block font-semibold text-textSecondary uppercase mb-1">Select Supplier / Vendor *</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search vendor by name, code..."
                  value={
                    isPoVendorSearchOpen
                      ? poVendorSearch
                      : selectedVendorId
                        ? `${vendors.find((v) => v.id.toString() === selectedVendorId)?.name} (${vendors.find((v) => v.id.toString() === selectedVendorId)?.vendor_code})`
                        : ''
                  }
                  onFocus={() => {
                    setIsPoVendorSearchOpen(true);
                    setPoVendorSearch('');
                  }}
                  onChange={(e) => {
                    setPoVendorSearch(e.target.value);
                    setIsPoVendorSearchOpen(true);
                  }}
                  onBlur={() => {
                    // Small delay so onMouseDown on dropdown can execute
                    setTimeout(() => setIsPoVendorSearchOpen(false), 200);
                  }}
                  className="w-full pl-8 pr-7 py-1.5 border border-borderLine rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
                {selectedVendorId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendorId('');
                      setPoVendorSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                    title="Clear selected vendor"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Vendor Dropdown Results */}
              {isPoVendorSearchOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-borderLine rounded-lg shadow-xl divide-y divide-slate-100 min-w-[280px]">
                  {vendors
                    .filter(
                      (v) =>
                        !poVendorSearch.trim() ||
                        v.name.toLowerCase().includes(poVendorSearch.toLowerCase()) ||
                        v.vendor_code.toLowerCase().includes(poVendorSearch.toLowerCase()) ||
                        (v.gstin && v.gstin.toLowerCase().includes(poVendorSearch.toLowerCase()))
                    )
                    .slice(0, 30)
                    .map((v) => {
                      const isAP = v.gstin?.startsWith('37');
                      return (
                        <div
                          key={v.id}
                          onMouseDown={() => {
                            setSelectedVendorId(v.id.toString());
                            setIsPoVendorSearchOpen(false);
                            setPoVendorSearch('');
                          }}
                          className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                        >
                          <div>
                            <div className="font-bold text-navy-800">{v.name}</div>
                            <div className="text-[10px] text-textSecondary font-mono">
                              Code: <strong>{v.vendor_code}</strong> &bull; GSTIN: {v.gstin || 'Unregistered'}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              isAP ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {isAP ? 'Intra-State AP' : 'Inter-State'}
                          </span>
                        </div>
                      );
                    })}
                  {vendors.filter(
                    (v) =>
                      !poVendorSearch.trim() ||
                      v.name.toLowerCase().includes(poVendorSearch.toLowerCase()) ||
                      v.vendor_code.toLowerCase().includes(poVendorSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="p-3 text-center text-textSecondary text-[11px]">
                      No vendors found matching &ldquo;{poVendorSearch}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Vendor Bill / Ref #</label>
              <input
                type="text"
                placeholder="e.g. INV-1115 (Optional)"
                value={poVendorBillNo}
                onChange={(e) => setPoVendorBillNo(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Order Date *</label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Vendor Details Banner with Interactive Tax Mode Override & Previous PO Reorder */}
          {(() => {
            const v = vendors.find((vend) => vend.id.toString() === selectedVendorId);
            if (!v) return null;
            const autoIsInter = v.gstin && !v.gstin.startsWith('37');
            const effectiveInter = poTaxMode === 'INTER' ? true : poTaxMode === 'INTRA' ? false : autoIsInter;
            return (
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-blue-950">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Vendor: <strong className="font-mono">{v.vendor_code}</strong> ({v.name})</span>
                    <span>&bull;</span>
                    <span>GSTIN: <strong className="font-mono">{v.gstin || 'Unregistered'}</strong></span>
                    {v.category && (
                      <>
                        <span>&bull;</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">{v.category}</span>
                      </>
                    )}
                  </div>

                  {/* Fast Action: Copy from Last PO */}
                  {vendorLastPo && (
                    <button
                      type="button"
                      onClick={handleCopyLastPo}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-300 font-bold hover:bg-emerald-50 transition-colors shadow-2xs"
                      title="Load all items from this supplier's previous purchase order"
                    >
                      <History className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reorder Previous PO ({vendorLastPo.po_number})</span>
                    </button>
                  )}
                </div>

                {/* Supply Type & GST Regime Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-200/60 text-xs">
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-700 font-medium">
                    <span>Tax Regime:</span>
                    <div className="inline-flex rounded-lg border border-borderLine bg-white p-0.5 shadow-2xs text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPoTaxMode('AUTO')}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          poTaxMode === 'AUTO' ? 'bg-navy-800 text-white' : 'text-textSecondary hover:text-navy-800'
                        }`}
                      >
                        Auto ({autoIsInter ? 'Inter-State' : 'AP Intra-State'})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoTaxMode('INTRA')}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          poTaxMode === 'INTRA' ? 'bg-blue-600 text-white' : 'text-textSecondary hover:text-navy-800'
                        }`}
                      >
                        Force Intra-State (CGST+SGST)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoTaxMode('INTER')}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          poTaxMode === 'INTER' ? 'bg-purple-600 text-white' : 'text-textSecondary hover:text-navy-800'
                        }`}
                      >
                        Force Inter-State (IGST)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoTaxMode('EXEMPT')}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          poTaxMode === 'EXEMPT' ? 'bg-slate-700 text-white' : 'text-textSecondary hover:text-navy-800'
                        }`}
                      >
                        0% Exempt / Non-GST
                      </button>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-navy-800 font-mono">
                    Active: {poTaxMode === 'EXEMPT' ? 'Exempt / Zero Tax' : effectiveInter ? 'Inter-State (100% IGST)' : 'Intra-State (50% CGST + 50% SGST)'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Vendor Frequently Supplied Items Quick-Add Bar */}
          {selectedVendorId && vendorFrequentItems.length > 0 && (
            <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-amber-900 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Frequently Ordered from this Vendor ({vendorFrequentItems.length})</span>
                  <span className="text-[10px] text-amber-700 font-normal">Click any commodity to add instantly</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleAddAllFrequentItems}
                    className="text-[10px] px-2 py-0.5 rounded bg-amber-200/70 hover:bg-amber-300 font-bold text-amber-900 border border-amber-300 transition-colors"
                  >
                    + Add All ({vendorFrequentItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFrequentTray(!showFrequentTray)}
                    className="text-amber-800 p-0.5 hover:text-amber-950"
                  >
                    {showFrequentTray ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {showFrequentTray && (
                <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-thin py-1">
                  {vendorFrequentItems.slice(0, 15).map((fItem) => {
                    const isAdded = poLines.some((p) => p.itemId === fItem.item_id);
                    return (
                      <button
                        key={fItem.item_id}
                        type="button"
                        onClick={() => handleQuickAddFrequentItem(fItem)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors border ${
                          isAdded
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-white hover:bg-amber-100 text-slate-800 border-amber-200 shadow-2xs'
                        }`}
                        title={`Avg Cost: ₹${parseFloat(fItem.avg_unit_cost || '0').toFixed(2)} | Ordered: ${fItem.po_count} times`}
                      >
                        <span>{isAdded ? '✓' : '+'}</span>
                        <span className="font-semibold">{fItem.item_name}</span>
                        <span className="text-[10px] font-mono opacity-70">₹{parseFloat(fItem.avg_unit_cost || '0').toFixed(0)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add Line Items Section with Category Chips, Keyboard Fast-Add & GST Slab */}
          <div className="p-3 bg-slate-50 rounded-lg border border-borderLine space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-navy-800 uppercase text-[11px] flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>Fast Add Commodities</span>
                <span className="text-[10px] text-textSecondary font-normal lowercase">(press Enter on Qty to add)</span>
              </h4>

              {/* Category Quick Filter Chips for Item Search */}
              <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none text-[10px]">
                {['ALL', 'PROVISIONS', 'DAIRY', 'SNACKS', 'PERSONAL', 'STATIONERY'].map((catKey) => {
                  const isCatSelected = poItemCategoryFilter === catKey;
                  const labelMap: Record<string, string> = {
                    ALL: 'All Catalog',
                    PROVISIONS: 'Provisions',
                    DAIRY: 'Dairy',
                    SNACKS: 'Snacks',
                    PERSONAL: 'Hygiene',
                    STATIONERY: 'Stationery',
                  };
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setPoItemCategoryFilter(catKey)}
                      className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                        isCatSelected ? 'bg-primary text-white font-bold' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {labelMap[catKey] || catKey}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Row with proper spacing */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-12 gap-2 items-end">
              {/* Item Search Field */}
              <div className="col-span-2 sm:col-span-4 md:col-span-4 relative">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1">Store Item (Search) *</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={poItemInputRef}
                    type="text"
                    placeholder="Search by name or 4-digit code..."
                    value={
                      isPoItemSearchOpen
                        ? poItemSearch
                        : newItemId
                          ? `${items.find((i) => i.id.toString() === newItemId)?.name} (${items.find((i) => i.id.toString() === newItemId)?.item_code})`
                          : ''
                    }
                    onFocus={() => {
                      setIsPoItemSearchOpen(true);
                      setPoItemSearch('');
                    }}
                    onChange={(e) => {
                      setPoItemSearch(e.target.value);
                      setIsPoItemSearchOpen(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsPoItemSearchOpen(false), 200);
                    }}
                    className="w-full pl-8 pr-7 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                  {newItemId && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewItemId('');
                        setPoItemSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                      title="Clear selection"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Dropdown Results Filtered by Category & Query */}
                {isPoItemSearchOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-borderLine rounded-lg shadow-xl divide-y divide-slate-100 min-w-[320px]">
                    {items
                      .filter((i) => {
                        if (poItemCategoryFilter !== 'ALL') {
                          const catIdMap: Record<string, number> = { PROVISIONS: 1, DAIRY: 2, SNACKS: 3, PERSONAL: 4, STATIONERY: 5 };
                          const targetId = catIdMap[poItemCategoryFilter];
                          if (targetId && i.category_id && i.category_id !== targetId) return false;
                        }
                        if (!poItemSearch.trim()) return true;
                        const q = poItemSearch.toLowerCase();
                        return (
                          i.name.toLowerCase().includes(q) ||
                          i.item_code.toLowerCase().includes(q) ||
                          (i.barcode && i.barcode.toLowerCase().includes(q))
                        );
                      })
                      .slice(0, 30)
                      .map((i) => (
                        <div
                          key={i.id}
                          onMouseDown={() => {
                            handleSelectItemForPo(i.id.toString());
                            setIsPoItemSearchOpen(false);
                            setPoItemSearch('');
                          }}
                          className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <div className="font-bold text-navy-800">{i.name}</div>
                            <div className="text-[10px] text-textSecondary font-mono">
                              Code: <strong>{i.item_code}</strong> &bull; Stock: {parseFloat(i.current_stock?.toString() || '0').toFixed(0)} {i.unit_code}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-navy-900 block font-mono">₹{parseFloat(i.purchase_price?.toString() || '0').toFixed(2)}</span>
                            <span className="text-[9px] text-emerald-700 block font-mono">Sale: ₹{parseFloat(i.selling_price?.toString() || (i as any).batch1_rate?.toString() || '0').toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    {items.filter((i) => {
                      if (poItemCategoryFilter !== 'ALL') {
                        const catIdMap: Record<string, number> = { PROVISIONS: 1, DAIRY: 2, SNACKS: 3, PERSONAL: 4, STATIONERY: 5 };
                        const targetId = catIdMap[poItemCategoryFilter];
                        if (targetId && i.category_id && i.category_id !== targetId) return false;
                      }
                      if (!poItemSearch.trim()) return true;
                      const q = poItemSearch.toLowerCase();
                      return i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q);
                    }).length === 0 && (
                      <div className="p-3 text-center text-textSecondary text-[11px]">
                        No items matching &ldquo;{poItemSearch}&rdquo; in this category
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1 text-right">Qty *</label>
                <input
                  ref={poQtyInputRef}
                  type="number"
                  min="0.1"
                  step="any"
                  value={newQty}
                  onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLineToPo();
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums text-xs text-right font-bold focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Purchase Rate */}
              <div className="col-span-1 sm:col-span-2 md:col-span-2">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1 text-right">Purchase (₹)</label>
                <input
                  ref={poPriceInputRef}
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLineToPo();
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums text-xs text-right font-medium focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Sale Price */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1 text-right">Sale (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newSalePrice}
                  onChange={(e) => setNewSalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-1.5 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums text-xs text-right font-medium"
                />
              </div>

              {/* MRP */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1 text-right">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newMrp}
                  onChange={(e) => setNewMrp(parseFloat(e.target.value) || 0)}
                  className="w-full px-1.5 py-1.5 border border-borderLine rounded-lg bg-white tabular-nums text-xs text-right font-medium"
                />
              </div>

              {/* Standard GST Slab Selector */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1">
                <label className="block font-semibold text-indigo-700 uppercase text-[10px] mb-1 text-right">GST %</label>
                <select
                  value={newGstSlab}
                  onChange={(e) => setNewGstSlab(parseFloat(e.target.value) || 0)}
                  className="w-full px-1 py-1.5 border border-indigo-200 rounded-lg bg-indigo-50/40 text-indigo-900 font-bold text-xs text-right focus:bg-white focus:outline-none"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>

              {/* Expiry Date */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1">
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1">Expiry</label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full px-1.5 py-1.5 border border-borderLine rounded-lg bg-white text-[11px]"
                />
              </div>

              {/* Add Button */}
              <div className="col-span-2 sm:col-span-4 md:col-span-1">
                <button
                  type="button"
                  onClick={handleAddLineToPo}
                  disabled={!newItemId}
                  className="w-full py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold disabled:opacity-50 text-xs shadow-subtle transition-all"
                  title="Add item to purchase order (or press Enter)"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Table of Added PO Lines with Direct Inline Editing */}
          {poLines.length > 0 ? (
            <div className="border border-borderLine rounded-lg overflow-x-auto scrollbar-thin bg-white">
              <div className="bg-slate-100/90 px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-700 border-b border-borderLine">
                <div className="flex items-center space-x-2">
                  <span>Order Lines: <strong className="font-mono text-navy-800">{poLines.length}</strong> commodities</span>
                  <span>&bull;</span>
                  <span>Total Qty: <strong className="font-mono text-navy-800">{poLines.reduce((acc, l) => acc + (l.orderedQty || 0), 0)}</strong> units</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllPoLines}
                  className="text-rose-600 hover:text-rose-800 text-[10px] font-bold hover:underline"
                >
                  Clear All
                </button>
              </div>

              <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-textSecondary uppercase tracking-wider border-b border-borderLine">
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3 min-w-[180px]">Item Details</th>
                    <th className="py-2 px-2 text-right min-w-[90px]">Qty</th>
                    <th className="py-2 px-2 text-right min-w-[100px]">Purchase (₹)</th>
                    <th className="py-2 px-2 text-right min-w-[90px]">Sale (₹)</th>
                    <th className="py-2 px-2 text-right min-w-[85px]">MRP (₹)</th>
                    <th className="py-2 px-2 text-center min-w-[75px]">GST Slab</th>
                    <th className="py-2 px-2 text-right min-w-[95px]">GST Amt</th>
                    <th className="py-2 px-2 text-center min-w-[110px]">Expiry Date</th>
                    <th className="py-2 px-3 text-right min-w-[110px]">Line Total (₹)</th>
                    <th className="py-2 px-2 text-center min-w-[70px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {poLines.map((line, idx) => {
                    const lineSub = line.orderedQty * line.unitPrice;
                    const isInter = poTotals.isInter;
                    const taxRate = poTaxMode === 'EXEMPT' ? 0 : (line.taxRate || 0);
                    const lineTax = lineSub * (taxRate / 100);
                    const lineTotal = lineSub + lineTax;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-center text-textSecondary font-mono text-[10px]">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-navy-800">{line.itemName}</div>
                          <div className="text-[10px] font-mono text-textSecondary">{line.itemCode}</div>
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={line.orderedQty}
                            onChange={(e) => handleUpdatePoLine(idx, 'orderedQty', parseFloat(e.target.value) || 0)}
                            className="w-18 px-1.5 py-1 border border-borderLine rounded bg-slate-50 focus:bg-white text-right font-bold text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => handleUpdatePoLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-22 px-1.5 py-1 border border-borderLine rounded bg-slate-50 focus:bg-white text-right font-bold text-xs text-navy-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.salePrice || 0}
                            onChange={(e) => handleUpdatePoLine(idx, 'salePrice', parseFloat(e.target.value) || 0)}
                            className="w-18 px-1.5 py-1 border border-borderLine rounded bg-slate-50 focus:bg-white text-right font-medium text-xs text-slate-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-1 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.mrp || 0}
                            onChange={(e) => handleUpdatePoLine(idx, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-18 px-1.5 py-1 border border-borderLine rounded bg-slate-50 focus:bg-white text-right font-medium text-xs text-slate-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-1 px-2 text-center">
                          <select
                            value={line.taxRate || 0}
                            onChange={(e) => handleUpdatePoLine(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="px-1.5 py-1 border border-borderLine rounded bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          <span className="font-bold text-slate-800">₹{lineTax.toFixed(2)}</span>
                          <span className="block text-[9px] text-textSecondary font-mono">
                            {isInter ? `(${taxRate}% IGST)` : `(${taxRate / 2}% C + ${taxRate / 2}% S)`}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-center">
                          <input
                            type="date"
                            value={line.expiryDate || ''}
                            onChange={(e) => handleUpdatePoLine(idx, 'expiryDate', e.target.value)}
                            className="w-28 px-1 py-1 border border-borderLine rounded bg-slate-50 focus:bg-white text-[11px]"
                          />
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-black text-navy-900">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicatePoLine(idx)}
                              className="text-slate-400 hover:text-primary p-1 transition-colors"
                              title="Duplicate row"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePoLine(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-textSecondary bg-white rounded-lg border border-borderLine border-dashed">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
              <div className="font-semibold text-slate-700">No items added yet</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Search an item above, or select from the frequent items tray above</div>
            </div>
          )}

          {/* PO Summary, Commercial Adjustments (Discount, Freight, Round-off) & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
            <div className="sm:col-span-5 space-y-2">
              <div>
                <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1">Purchase Order Notes</label>
                <textarea
                  rows={2}
                  placeholder="Terms of delivery, payment schedules, shipment instructions..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none text-xs"
                />
              </div>

              {/* Commercial Discounts & Freight */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-borderLine grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1">Trade Discount</label>
                  <div className="flex items-center space-x-1">
                    <select
                      value={poDiscountType}
                      onChange={(e) => setPoDiscountType(e.target.value as 'FLAT' | 'PERCENT')}
                      className="px-1.5 py-1 border border-borderLine rounded bg-white text-[11px] font-semibold"
                    >
                      <option value="FLAT">₹ Flat</option>
                      <option value="PERCENT">%</option>
                    </select>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={poDiscountValue || ''}
                      placeholder="0"
                      onChange={(e) => setPoDiscountValue(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-borderLine rounded bg-white font-mono text-right text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-textSecondary uppercase text-[10px] mb-1">Freight / Transport (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={poFreightAmount || ''}
                    placeholder="0.00"
                    onChange={(e) => setPoFreightAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-borderLine rounded bg-white font-mono text-right text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="sm:col-span-7 bg-slate-50 p-3.5 rounded-lg border border-borderLine space-y-2 text-xs flex flex-col justify-between">
              <div className="space-y-1.5 pb-2 border-b border-borderLine">
                <div className="flex justify-between items-center text-textSecondary">
                  <span>Gross Taxable Subtotal:</span>
                  <span className="font-mono font-bold text-navy-800">₹{poTotals.subtotal.toFixed(2)}</span>
                </div>

                {poTotals.discountVal > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-semibold">
                    <span>Discount Applied:</span>
                    <span className="font-mono">- ₹{poTotals.discountVal.toFixed(2)}</span>
                  </div>
                )}

                {poTotals.isInter ? (
                  <div className="flex justify-between items-center text-purple-700 font-semibold">
                    <span>IGST (Inter-State):</span>
                    <span className="font-mono">₹{poTotals.igstTotal.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-blue-700 font-medium">
                      <span>CGST (Central):</span>
                      <span className="font-mono">₹{poTotals.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-indigo-700 font-medium">
                      <span>SGST (State):</span>
                      <span className="font-mono">₹{poTotals.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {poTotals.freightVal > 0 && (
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Freight / Transport:</span>
                    <span className="font-mono">+ ₹{poTotals.freightVal.toFixed(2)}</span>
                  </div>
                )}

                {poTotals.roundOffVal !== 0 && (
                  <div className="flex justify-between items-center text-slate-500 text-[11px]">
                    <span>Round-off Adjustment:</span>
                    <span className="font-mono">{poTotals.roundOffVal > 0 ? `+ ₹${poTotals.roundOffVal.toFixed(2)}` : `- ₹${Math.abs(poTotals.roundOffVal).toFixed(2)}`}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-1 font-black text-navy-900 text-sm">
                <div>
                  <span className="block text-xs uppercase text-textSecondary font-bold">Grand Total PO Value</span>
                  <span className="text-[11px] font-normal text-slate-500">Includes all taxes & delivery</span>
                </div>
                <span className="font-mono text-xl text-primary font-black">₹{poTotals.totalAmount.toFixed(2)}</span>
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
              className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold transition-all shadow-subtle disabled:opacity-50 text-xs flex items-center space-x-1.5"
            >
              <span>{isSubmitting ? 'Issuing PO...' : `Confirm & Issue Purchase Order (${poLines.length} items)`}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Record GRN Modal (Interactive Inspection & Direct Inward) */}
      <Modal
        isOpen={isGrnModalOpen}
        onClose={() => setIsGrnModalOpen(false)}
        title={activePoForGrn ? `Record Goods Receipt Note (GRN)` : 'Direct Commodity Inward (Without PO)'}
        subtitle={
          activePoForGrn
            ? `Verify physical shipment receipt against Purchase Order ${activePoForGrn.po_number}`
            : 'Record incoming supplier shipment directly into warehouse inventory'
        }
        maxWidth="6xl"
      >
        <form onSubmit={handleReceiveGoods} className="space-y-4 text-xs">
          {/* Header Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-borderLine">
            {!activePoForGrn ? (
              <div className="relative">
                <label className="block font-semibold text-textSecondary uppercase mb-1">Select Supplier / Vendor *</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search vendor by name, code..."
                    value={
                      isGrnVendorSearchOpen
                        ? grnVendorSearch
                        : directGrnVendorId
                          ? `${vendors.find((v) => v.id.toString() === directGrnVendorId)?.name} (${vendors.find((v) => v.id.toString() === directGrnVendorId)?.vendor_code})`
                          : ''
                    }
                    onFocus={() => {
                      setIsGrnVendorSearchOpen(true);
                      setGrnVendorSearch('');
                    }}
                    onChange={(e) => {
                      setGrnVendorSearch(e.target.value);
                      setIsGrnVendorSearchOpen(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsGrnVendorSearchOpen(false), 200);
                    }}
                    className="w-full pl-8 pr-7 py-1.5 border border-borderLine rounded-lg bg-white font-medium focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                  {directGrnVendorId && (
                    <button
                      type="button"
                      onClick={() => {
                        setDirectGrnVendorId('');
                        setGrnVendorSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                      title="Clear vendor"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {isGrnVendorSearchOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-borderLine rounded-lg shadow-xl divide-y divide-slate-100 min-w-[280px]">
                    {vendors
                      .filter(
                        (v) =>
                          !grnVendorSearch.trim() ||
                          v.name.toLowerCase().includes(grnVendorSearch.toLowerCase()) ||
                          v.vendor_code.toLowerCase().includes(grnVendorSearch.toLowerCase()) ||
                          (v.gstin && v.gstin.toLowerCase().includes(grnVendorSearch.toLowerCase()))
                      )
                      .slice(0, 30)
                      .map((v) => {
                        const isAP = v.gstin?.startsWith('37');
                        return (
                          <div
                            key={v.id}
                            onMouseDown={() => {
                              setDirectGrnVendorId(v.id.toString());
                              setIsGrnVendorSearchOpen(false);
                              setGrnVendorSearch('');
                            }}
                            className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div>
                              <div className="font-bold text-navy-800">{v.name}</div>
                              <div className="text-[10px] text-textSecondary font-mono">
                                Code: <strong>{v.vendor_code}</strong> &bull; GSTIN: {v.gstin || 'Unregistered'}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                isAP ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {isAP ? 'Intra-State AP' : 'Inter-State'}
                            </span>
                          </div>
                        );
                      })}
                    {vendors.filter(
                      (v) =>
                        !grnVendorSearch.trim() ||
                        v.name.toLowerCase().includes(grnVendorSearch.toLowerCase()) ||
                        v.vendor_code.toLowerCase().includes(grnVendorSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-textSecondary text-[11px]">
                        No vendors found matching &ldquo;{grnVendorSearch}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-textSecondary uppercase mb-1">Purchase Order</label>
                <input
                  type="text"
                  disabled
                  value={`${activePoForGrn.po_number} - ${activePoForGrn.vendor_name}`}
                  className="w-full px-2.5 py-1.5 border border-borderLine rounded-lg bg-slate-100 font-mono text-slate-700 cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Inward Bill / Ref #</label>
              <input
                type="text"
                placeholder="Optional / Auto-generated"
                value={grnChallan}
                onChange={(e) => setGrnChallan(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-textSecondary uppercase mb-1">Receipt Date *</label>
              <input
                type="date"
                required
                value={grnDate}
                onChange={(e) => setGrnDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Item Picker for Direct GRN */}
          {!activePoForGrn && (
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 space-y-2">
              <div className="text-[11px] font-bold text-navy-800 uppercase">Add Received Commodity to Inward:</div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5 relative">
                  <label className="block text-[10px] font-semibold text-textSecondary uppercase mb-0.5">Store Item (Search) *</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name, 4-digit code..."
                      value={
                        isGrnItemSearchOpen
                          ? grnItemSearch
                          : grnAddItemId
                            ? `${items.find((i) => i.id.toString() === grnAddItemId)?.name} (${items.find((i) => i.id.toString() === grnAddItemId)?.item_code})`
                            : ''
                      }
                      onFocus={() => {
                        setIsGrnItemSearchOpen(true);
                        setGrnItemSearch('');
                      }}
                      onChange={(e) => {
                        setGrnItemSearch(e.target.value);
                        setIsGrnItemSearchOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsGrnItemSearchOpen(false), 200);
                      }}
                      className="w-full pl-8 pr-7 py-1.5 border border-borderLine rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                    />
                    {grnAddItemId && (
                      <button
                        type="button"
                        onClick={() => {
                          setGrnAddItemId('');
                          setGrnItemSearch('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                        title="Clear selection"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {isGrnItemSearchOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-borderLine rounded-lg shadow-xl divide-y divide-slate-100 min-w-[300px]">
                      {items
                        .filter(
                          (i) =>
                            !grnItemSearch.trim() ||
                            i.name.toLowerCase().includes(grnItemSearch.toLowerCase()) ||
                            i.item_code.toLowerCase().includes(grnItemSearch.toLowerCase()) ||
                            (i.barcode && i.barcode.toLowerCase().includes(grnItemSearch.toLowerCase()))
                        )
                        .slice(0, 30)
                        .map((i) => (
                          <div
                            key={i.id}
                            onMouseDown={() => {
                              setGrnAddItemId(i.id.toString());
                              setGrnAddCost(parseFloat(i.purchase_price?.toString() || '0'));
                              setIsGrnItemSearchOpen(false);
                              setGrnItemSearch('');
                            }}
                            className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <div className="font-bold text-navy-800">{i.name}</div>
                              <div className="text-[10px] text-textSecondary font-mono">
                                Code: <strong>{i.item_code}</strong> &bull; Stock: {parseFloat(i.current_stock?.toString() || '0').toFixed(0)} {i.unit_code}
                              </div>
                            </div>
                            <span className="font-bold text-navy-900 font-mono">
                              ₹{parseFloat(i.purchase_price?.toString() || '0').toFixed(2)}
                            </span>
                          </div>
                        ))}
                      {items.filter(
                        (i) =>
                          !grnItemSearch.trim() ||
                          i.name.toLowerCase().includes(grnItemSearch.toLowerCase()) ||
                          i.item_code.toLowerCase().includes(grnItemSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="p-3 text-center text-textSecondary text-[11px]">
                          No items matching &ldquo;{grnItemSearch}&rdquo;
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-textSecondary uppercase mb-0.5">Inward Qty</label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={grnAddQty}
                    onChange={(e) => setGrnAddQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-borderLine rounded-lg bg-white text-xs text-right font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-textSecondary uppercase mb-0.5">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={grnAddCost}
                    onChange={(e) => setGrnAddCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-borderLine rounded-lg bg-white text-xs text-right font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-textSecondary uppercase mb-0.5">Expiry Date</label>
                  <input
                    type="date"
                    value={grnAddExpiry}
                    onChange={(e) => setGrnAddExpiry(e.target.value)}
                    className="w-full px-2 py-1.5 border border-borderLine rounded-lg bg-white text-xs text-slate-700"
                  />
                </div>

                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddDirectGrnLine}
                    className="w-full py-1.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Received Items Inspection Table */}
          <div className="border border-borderLine rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase">
                  <th className="py-2.5 px-3">Item Details</th>
                  {activePoForGrn && <th className="py-2.5 px-3 text-right">Ordered</th>}
                  <th className="py-2.5 px-3 text-right">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">Received Qty</th>
                  <th className="py-2.5 px-3 text-right">Accepted Qty</th>
                  <th className="py-2.5 px-3 text-right">Rejected Qty</th>
                  <th className="py-2.5 px-3 text-center">Expiry Date</th>
                  <th className="py-2.5 px-3">Rejection Reason</th>
                  {!activePoForGrn && <th className="py-2.5 px-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {grnLines.length === 0 ? (
                  <tr>
                    <td colSpan={activePoForGrn ? 8 : 9} className="py-6 text-center text-textSecondary">
                      No items added yet. Select items above to record delivery.
                    </td>
                  </tr>
                ) : (
                  grnLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-navy-800">{line.itemName}</div>
                        <div className="text-[10px] font-mono text-textSecondary">{line.itemCode}</div>
                      </td>
                      {activePoForGrn && (
                        <td className="py-2 px-3 text-right font-medium tabular-nums text-textSecondary">
                          {line.orderedQty}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.unitCost}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...grnLines];
                            updated[idx].unitCost = val;
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
                      <td className="py-2 px-3 text-center">
                        <input
                          type="date"
                          value={line.expiryDate || ''}
                          onChange={(e) => {
                            const updated = [...grnLines];
                            updated[idx].expiryDate = e.target.value;
                            setGrnLines(updated);
                          }}
                          className="w-28 px-1.5 py-1 text-xs border border-borderLine rounded bg-white text-slate-700"
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
                      {!activePoForGrn && (
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveGrnLine(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
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
              disabled={isSubmitting || grnLines.length === 0}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-subtle disabled:opacity-50"
            >
              {isSubmitting ? 'Processing Receipt...' : 'Confirm Goods Receipt & Update Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View GRN Slip Modal */}
      <Modal
        isOpen={isViewGrnModalOpen}
        onClose={() => setIsViewGrnModalOpen(false)}
        title={`Goods Receipt Note: ${selectedGrnDetails?.grn_number || ''}`}
        subtitle="Official inward warehouse receipt and 3-way matching document"
        maxWidth="6xl"
      >
        {selectedGrnDetails && (
          <div className="space-y-4 text-xs">
            {/* Printable Slip Container */}
            <div id="printable-grn-slip" className="p-5 border border-borderLine rounded-lg bg-white space-y-4 shadow-sm">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h3 className="font-black text-base tracking-wide text-navy-800 uppercase">
                  CFECC EMPLOYEES CONSUMER COOPERATIVE SOCIETY LTD.
                </h3>
                <p className="text-[11px] text-textSecondary">Visakhapatnam, Andhra Pradesh &bull; GSTIN: 37AAAAA0000A1Z5</p>
                <div className="inline-block mt-2 px-3 py-1 bg-slate-100 border border-slate-300 rounded font-black text-xs text-navy-800 uppercase tracking-widest">
                  GOODS RECEIPT NOTE (GRN)
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-borderLine text-[11px]">
                <div>
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">GRN Number:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{selectedGrnDetails.grn_number}</span>
                </div>
                <div>
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">Receipt Date:</span>
                  <span className="font-bold text-navy-800 text-xs">{formatDate(selectedGrnDetails.receipt_date)}</span>
                </div>
                <div>
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">Bill Ref:</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">{selectedGrnDetails.po_number || 'Direct Inward'}</span>
                </div>
                <div>
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">Vendor Code:</span>
                  <span className="font-mono font-bold text-navy-800 text-xs">{selectedGrnDetails.vendor_code}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">Vendor / Supplier:</span>
                  <span className="font-bold text-navy-800 text-xs">{selectedGrnDetails.vendor_name}</span>
                </div>
                <div>
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">Vendor GSTIN:</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">{selectedGrnDetails.vendor_gstin || '37AAAAA0000A1Z5'}</span>
                </div>
                <div>
                  <span className="text-textSecondary block uppercase text-[10px] font-bold">Tax Jurisdiction:</span>
                  <span className="font-bold text-blue-700 text-xs">
                    {selectedGrnDetails.vendor_gstin && !selectedGrnDetails.vendor_gstin.startsWith('37') ? 'Inter-State (IGST)' : 'Intra-State (AP - 37)'}
                  </span>
                </div>
              </div>

              {/* Items Table with IGST, CGST, SGST, Expiry, Purchase Cost, Sale Price, MRP */}
              <div className="border border-borderLine rounded-lg overflow-x-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase tracking-wider">
                      <th className="py-2.5 px-3 min-w-[170px]">Item Details</th>
                      <th className="py-2.5 px-2 text-right min-w-[70px]">Rec Qty</th>
                      <th className="py-2.5 px-2 text-right min-w-[70px]">Accepted</th>
                      <th className="py-2.5 px-2 text-right min-w-[65px]">Rejected</th>
                      <th className="py-2.5 px-2.5 text-center min-w-[95px]">Expiry Date</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[95px] text-slate-800">Pur Cost</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[90px] text-slate-700">Sale Price</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[85px] text-slate-700">MRP</th>
                      <th className="py-2.5 px-2 text-right min-w-[85px] text-blue-700 bg-blue-50/50">CGST</th>
                      <th className="py-2.5 px-2 text-right min-w-[85px] text-indigo-700 bg-indigo-50/50">SGST</th>
                      <th className="py-2.5 px-2 text-right min-w-[85px] text-purple-700 bg-purple-50/50">IGST</th>

                      <th className="py-2.5 px-3 text-right min-w-[110px]">Tot Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine">
                    {selectedGrnDetails.items?.map((item: any) => {
                      const vendorState = (selectedGrnDetails.vendor_state || 'Andhra Pradesh').toLowerCase();
                      const isOutsideAp = vendorState && !vendorState.includes('andhra') && !vendorState.includes('ap');
                      const gstin = selectedGrnDetails.vendor_gstin?.trim() || '';
                      const isInter = isOutsideAp || (/^[0-9]{2}/.test(gstin) && !gstin.startsWith('37'));

                      const accepted = parseFloat(item.accepted_qty) || 0;
                      const pCost = parseFloat(item.purchase_cost || item.unit_cost) || 0;
                      const sPrice = parseFloat(item.sale_price) || 0;
                      const mrp = parseFloat(item.mrp) || sPrice;
                      const lineTaxable = accepted * pCost;
                      const itmCgst = parseFloat(item.cgst_rate) || 0;
                      const itmSgst = parseFloat(item.sgst_rate) || 0;
                      const itmIgst = parseFloat(item.igst_rate) || 0;
                      const taxRate = parseFloat(item.tax_rate) || (itmCgst + itmSgst + itmIgst);

                      let cgstRate = 0;
                      let sgstRate = 0;
                      let igstRate = 0;
                      let cgstAmt = 0;
                      let sgstAmt = 0;
                      let igstAmt = 0;

                      if (itmCgst > 0 || itmSgst > 0 || itmIgst > 0) {
                        cgstRate = itmCgst;
                        sgstRate = itmSgst;
                        igstRate = itmIgst;
                        cgstAmt = lineTaxable * (cgstRate / 100);
                        sgstAmt = lineTaxable * (sgstRate / 100);
                        igstAmt = lineTaxable * (igstRate / 100);
                      } else if (taxRate > 0) {
                        if (isInter) {
                          igstRate = taxRate;
                          igstAmt = lineTaxable * (igstRate / 100);
                        } else {
                          cgstRate = taxRate / 2;
                          sgstRate = taxRate / 2;
                          cgstAmt = lineTaxable * (cgstRate / 100);
                          sgstAmt = lineTaxable * (sgstRate / 100);
                        }
                      }
                      const lineTotal = lineTaxable + cgstAmt + sgstAmt + igstAmt;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3">
                            <div className="font-bold text-navy-800">{item.item_name}</div>
                            <div className="text-[10px] font-mono text-textSecondary">{item.item_code}</div>
                            {item.rejection_reason && (
                              <div className="text-[10px] text-rose-600 font-medium">Reason: {item.rejection_reason}</div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-medium text-slate-700">
                            {parseFloat(item.received_qty).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-bold text-emerald-700">
                            {accepted.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-bold text-rose-600">
                            {parseFloat(item.rejected_qty).toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[11px] text-textSecondary whitespace-nowrap">
                            {formatDate(item.expiry_date)}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-bold text-navy-800">
                            ₹{pCost.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-semibold text-slate-700">
                            {sPrice > 0 ? `₹${sPrice.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-semibold text-slate-700">
                            {mrp > 0 ? `₹${mrp.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums bg-blue-50/30">
                            {cgstAmt > 0 ? (
                              <div>
                                <span className="font-bold text-blue-800">₹{cgstAmt.toFixed(2)}</span>
                                <span className="block text-[9px] text-blue-600 font-mono">({cgstRate}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums bg-indigo-50/30">
                            {sgstAmt > 0 ? (
                              <div>
                                <span className="font-bold text-indigo-800">₹{sgstAmt.toFixed(2)}</span>
                                <span className="block text-[9px] text-indigo-600 font-mono">({sgstRate}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums bg-purple-50/30">
                            {igstAmt > 0 ? (
                              <div>
                                <span className="font-bold text-purple-800">₹{igstAmt.toFixed(2)}</span>
                                <span className="block text-[9px] text-purple-600 font-mono">({igstRate}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="py-2 px-3 text-right tabular-nums font-black text-navy-900">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Invoiced Accounting Box with Full Tax Breakdown */}
              {(() => {
                const itemsList = selectedGrnDetails.items || [];
                const vendorState = (selectedGrnDetails.vendor_state || 'Andhra Pradesh').toLowerCase();
                const isOutsideAp = vendorState && !vendorState.includes('andhra') && !vendorState.includes('ap');
                const gstin = selectedGrnDetails.vendor_gstin?.trim() || '';
                const isInter = isOutsideAp || (/^[0-9]{2}/.test(gstin) && !gstin.startsWith('37'));

                let taxableTotal = 0;
                let cgstTotal = 0;
                let sgstTotal = 0;
                let igstTotal = 0;
                let grandTotal = 0;

                itemsList.forEach((item: any) => {
                  const accepted = parseFloat(item.accepted_qty) || 0;
                  const pCost = parseFloat(item.purchase_cost || item.unit_cost) || 0;
                  const lineTaxable = accepted * pCost;
                  const itmCgst = parseFloat(item.cgst_rate) || 0;
                  const itmSgst = parseFloat(item.sgst_rate) || 0;
                  const itmIgst = parseFloat(item.igst_rate) || 0;
                  const taxRate = parseFloat(item.tax_rate) || (itmCgst + itmSgst + itmIgst);

                  let cgstAmt = 0;
                  let sgstAmt = 0;
                  let igstAmt = 0;

                  if (itmCgst > 0 || itmSgst > 0 || itmIgst > 0) {
                    cgstAmt = lineTaxable * (itmCgst / 100);
                    sgstAmt = lineTaxable * (itmSgst / 100);
                    igstAmt = lineTaxable * (itmIgst / 100);
                  } else if (taxRate > 0) {
                    if (isInter) {
                      igstAmt = lineTaxable * (taxRate / 100);
                    } else {
                      cgstAmt = lineTaxable * ((taxRate / 2) / 100);
                      sgstAmt = lineTaxable * ((taxRate / 2) / 100);
                    }
                  }

                  taxableTotal += lineTaxable;
                  cgstTotal += cgstAmt;
                  sgstTotal += sgstAmt;
                  igstTotal += igstAmt;
                  grandTotal += (lineTaxable + cgstAmt + sgstAmt + igstAmt);
                });

                return (
                  <div className="bg-slate-50 p-3.5 border border-borderLine rounded-lg space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-textSecondary block">Taxable Goods Value:</span>
                        <span className="font-bold text-navy-800 text-sm font-mono">₹{taxableTotal.toFixed(2)}</span>
                      </div>
                      {cgstTotal > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-blue-700 block">CGST (Central Tax):</span>
                          <span className="font-bold text-blue-800 text-sm font-mono">₹{cgstTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {sgstTotal > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-indigo-700 block">SGST (State Tax):</span>
                          <span className="font-bold text-indigo-800 text-sm font-mono">₹{sgstTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {igstTotal > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-purple-700 block">IGST (Inter-State):</span>
                          <span className="font-bold text-purple-800 text-sm font-mono">₹{igstTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {cgstTotal === 0 && sgstTotal === 0 && igstTotal === 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">GST Tax:</span>
                          <span className="font-bold text-slate-600 text-sm font-mono">₹0.00 (Nil)</span>
                        </div>
                      )}
                      <div className="text-right sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-textSecondary block">Total Inward Value:</span>
                        <span className="font-black text-base text-navy-900 font-mono">₹{grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    {selectedGrnDetails.system_bill_number && (
                      <div className="pt-2 border-t border-borderLine flex items-center justify-between text-[11px] text-textSecondary">
                        <span>Generated System Purchase Bill: <strong className="font-mono text-navy-800">{selectedGrnDetails.system_bill_number}</strong></span>
                        <span className="text-emerald-700 font-semibold font-mono">Warehouse Inventory Stock Credited</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Signatures */}
              <div className="pt-6 pb-2 border-t border-dashed border-slate-300 grid grid-cols-2 text-center text-xs text-textSecondary">
                <div>
                  <div className="border-b border-slate-400 w-44 mx-auto mb-1"></div>
                  <div className="font-semibold text-navy-800">Storekeeper Signature</div>
                  <div className="text-[10px]">CFECC Warehouse Division</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-44 mx-auto mb-1"></div>
                  <div className="font-semibold text-navy-800">Supervisor / Manager Signature</div>
                  <div className="text-[10px]">CFECC Purchasing Authority</div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-borderLine">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-navy-800 hover:bg-navy-900 text-white font-semibold rounded-lg shadow-subtle transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Inward Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setIsViewGrnModalOpen(false)}
                className="px-4 py-2 border border-borderLine rounded-lg font-semibold text-textSecondary hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* PO View Details Modal */}
      <Modal
        isOpen={isViewPoModalOpen}
        onClose={() => setIsViewPoModalOpen(false)}
        title={`Purchase Order: ${selectedPoDetails?.po_number || ''}`}
        subtitle="Full procurement specifications, vendor information and tax breakdown"
        maxWidth="6xl"
      >
        {selectedPoDetails && (() => {
          const vendorState = (selectedPoDetails.vendor_state || 'Andhra Pradesh').toLowerCase();
          const isOutsideAp = vendorState && !vendorState.includes('andhra') && !vendorState.includes('ap');
          const gstin = selectedPoDetails.vendor_gstin?.trim() || '';
          const isInter = isOutsideAp || (/^[0-9]{2}/.test(gstin) && !gstin.startsWith('37'));

          let taxableTotal = 0;
          let cgstTotal = 0;
          let sgstTotal = 0;
          let igstTotal = 0;

          return (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-borderLine text-[11px]">
                <div>
                  <span className="text-textSecondary uppercase text-[10px] font-bold block">Vendor Details</span>
                  <span className="font-bold text-navy-800 text-sm block mt-0.5">{selectedPoDetails.vendor_name}</span>
                  <span className="text-textSecondary font-mono">{selectedPoDetails.vendor_code}</span>
                </div>
                <div>
                  <span className="text-textSecondary uppercase text-[10px] font-bold block">Vendor GSTIN</span>
                  <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">{selectedPoDetails.vendor_gstin || 'Unregistered'}</span>
                  <span className="font-bold text-[10px] text-blue-700">
                    {isInter ? 'Inter-State (IGST)' : 'Intra-State (AP - 37)'}
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary uppercase text-[10px] font-bold block">Order Dates</span>
                  <span className="block mt-0.5 font-medium">Order Date: <strong>{formatDate(selectedPoDetails.order_date)}</strong></span>
                  <span className="text-textSecondary block">Delivery: {formatDate(selectedPoDetails.expected_delivery_date)}</span>
                </div>
                <div className="text-right sm:text-right">
                  <span className="text-textSecondary uppercase text-[10px] font-bold block">Status</span>
                  <div className="mt-1 flex justify-end">
                    <StatusBadge status={selectedPoDetails.status} />
                  </div>
                </div>
              </div>

              <div className="border border-borderLine rounded-lg overflow-x-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold text-textSecondary uppercase tracking-wider">
                      <th className="py-2.5 px-3 min-w-[170px]">Item Details</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[70px]">Ordered</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[70px]">Received</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[95px] text-slate-800">Purchase Cost</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[90px] text-slate-700">Sale Price</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[85px] text-slate-700">MRP</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[85px] text-blue-700 bg-blue-50/50">CGST</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[85px] text-indigo-700 bg-indigo-50/50">SGST</th>
                      <th className="py-2.5 px-2.5 text-right min-w-[85px] text-purple-700 bg-purple-50/50">IGST</th>
                      <th className="py-2.5 px-3 text-right min-w-[110px]">Total Price (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine">
                    {(selectedPoDetails.items || []).map((itm: any) => {
                      const orderedQty = parseFloat(itm.ordered_qty) || 0;
                      const unitP = parseFloat(itm.unit_price) || 0;
                      const saleP = parseFloat(itm.sale_price) || 0;
                      const mrpP = parseFloat(itm.mrp) || saleP;
                      const lineTaxable = orderedQty * unitP;
                      const taxRate = parseFloat(itm.tax_rate) || ((parseFloat(itm.cgst_rate) || 0) + (parseFloat(itm.sgst_rate) || 0));

                      let cgstRate = 0;
                      let sgstRate = 0;
                      let igstRate = 0;
                      let cgstAmt = 0;
                      let sgstAmt = 0;
                      let igstAmt = 0;

                      const itmCgst = parseFloat(itm.cgst_rate) || 0;
                      const itmSgst = parseFloat(itm.sgst_rate) || 0;
                      const itmIgst = parseFloat(itm.igst_rate) || 0;

                      if (itmCgst > 0 || itmSgst > 0 || itmIgst > 0) {
                        cgstRate = itmCgst;
                        sgstRate = itmSgst;
                        igstRate = itmIgst;
                        cgstAmt = lineTaxable * (cgstRate / 100);
                        sgstAmt = lineTaxable * (sgstRate / 100);
                        igstAmt = lineTaxable * (igstRate / 100);
                      } else if (taxRate > 0) {
                        if (isInter) {
                          igstRate = taxRate;
                          igstAmt = lineTaxable * (igstRate / 100);
                        } else {
                          cgstRate = taxRate / 2;
                          sgstRate = taxRate / 2;
                          cgstAmt = lineTaxable * (cgstRate / 100);
                          sgstAmt = lineTaxable * (sgstRate / 100);
                        }
                      }

                      taxableTotal += lineTaxable;
                      cgstTotal += cgstAmt;
                      sgstTotal += sgstAmt;
                      igstTotal += igstAmt;

                      const lineTotal = lineTaxable + cgstAmt + sgstAmt + igstAmt;

                      return (
                        <tr key={itm.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3">
                            <div className="font-bold text-navy-800">{itm.item_name}</div>
                            <div className="text-[10px] font-mono text-textSecondary">{itm.item_code}</div>
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-bold text-slate-800">
                            {orderedQty} {itm.unit_code}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-bold text-emerald-700">
                            {itm.received_qty} {itm.unit_code}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-bold text-navy-800">
                            ₹{unitP.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-semibold text-slate-700">
                            {saleP > 0 ? `₹${saleP.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-semibold text-slate-700">
                            {mrpP > 0 ? `₹${mrpP.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums bg-blue-50/30">
                            {cgstAmt > 0 ? (
                              <div>
                                <span className="font-bold text-blue-800">₹{cgstAmt.toFixed(2)}</span>
                                <span className="block text-[9px] text-blue-600 font-mono">({cgstRate}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums bg-indigo-50/30">
                            {sgstAmt > 0 ? (
                              <div>
                                <span className="font-bold text-indigo-800">₹{sgstAmt.toFixed(2)}</span>
                                <span className="block text-[9px] text-indigo-600 font-mono">({sgstRate}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums bg-purple-50/30">
                            {igstAmt > 0 ? (
                              <div>
                                <span className="font-bold text-purple-800">₹{igstAmt.toFixed(2)}</span>
                                <span className="block text-[9px] text-purple-600 font-mono">({igstRate}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-black text-navy-900">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Accounting Summary Box */}
              <div className="bg-slate-50 p-3.5 border border-borderLine rounded-lg space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-textSecondary block">Taxable Subtotal:</span>
                    <span className="font-bold text-navy-800 text-sm font-mono">₹{taxableTotal.toFixed(2)}</span>
                  </div>
                  {cgstTotal > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-700 block">CGST (Central Tax):</span>
                      <span className="font-bold text-blue-800 text-sm font-mono">₹{cgstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {sgstTotal > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-700 block">SGST (State Tax):</span>
                      <span className="font-bold text-indigo-800 text-sm font-mono">₹{sgstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {igstTotal > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-700 block">IGST (Inter-State):</span>
                      <span className="font-bold text-purple-800 text-sm font-mono">₹{igstTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {cgstTotal === 0 && sgstTotal === 0 && igstTotal === 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">GST Tax:</span>
                      <span className="font-bold text-slate-600 text-sm font-mono">₹0.00 (Nil)</span>
                    </div>
                  )}
                  <div className="text-right sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-textSecondary block">Grand Total:</span>
                    <span className="font-black text-base text-navy-900 font-mono">
                      ₹{parseFloat(selectedPoDetails.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
                {selectedPoDetails.notes && (
                  <div className="pt-2 border-t border-borderLine text-[11px] text-textSecondary">
                    Notes: <span className="font-medium text-slate-800">{selectedPoDetails.notes}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
