import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Vendor, Item } from '../../types/index.js';
import {
  ArrowLeft,
  Building2,
  Search,
  Plus,
  Trash2,
  Copy,
  Zap,
  Sparkles,
  History,
  Tag,
  ChevronDown,
  ChevronUp,
  Percent,
  Truck,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  BadgePercent,
  X,
  CreditCard,
  MapPin,
  Phone,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface PoLineItem {
  itemId: number;
  itemName: string;
  itemCode: string;
  category?: string;
  orderedQty: number;
  unitPrice: number;
  salePrice: number;
  mrp: number;
  taxRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  expiryDate?: string;
}

export const CreatePurchaseOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialVendorParam = searchParams.get('vendorId') || '';

  // Core Data States
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Vendor Selection State (Starts EMPTY by default - user requirement: "dont select the vendor in pre")
  const [selectedVendorId, setSelectedVendorId] = useState<string>(initialVendorParam);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const vendorDropdownRef = useRef<HTMLDivElement>(null);

  // Vendor Context History & Fast Reorder
  const [vendorFrequentItems, setVendorFrequentItems] = useState<any[]>([]);
  const [loadingFrequentItems, setLoadingFrequentItems] = useState(false);
  const [vendorLastPo, setVendorLastPo] = useState<{ id: number; po_number: string; items: any[]; order_date: string } | null>(null);
  const [showFrequentTray, setShowFrequentTray] = useState(true);

  // Order Details
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [poVendorBillNo, setPoVendorBillNo] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [creditTerms, setCreditTerms] = useState('30 Days');

  // Tax & Commercial Adjustments
  const [poTaxMode, setPoTaxMode] = useState<'AUTO' | 'INTRA' | 'INTER' | 'EXEMPT'>('AUTO');
  const [poDiscountType, setPoDiscountType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [poDiscountValue, setPoDiscountValue] = useState<number>(0);
  const [poFreightAmount, setPoFreightAmount] = useState<number>(0);
  const [poAutoRoundOff, setPoAutoRoundOff] = useState<boolean>(true);

  // Item Addition Form States
  const [poItemSearch, setPoItemSearch] = useState('');
  const [isPoItemSearchOpen, setIsPoItemSearchOpen] = useState(false);
  const [poItemCategoryFilter, setPoItemCategoryFilter] = useState<string>('ALL');
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [newItemId, setNewItemId] = useState('');
  const [newQty, setNewQty] = useState<number>(10);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newSalePrice, setNewSalePrice] = useState<number>(0);
  const [newMrp, setNewMrp] = useState<number>(0);
  const [newCgstRate, setNewCgstRate] = useState<number>(0);
  const [newSgstRate, setNewSgstRate] = useState<number>(0);
  const [newIgstRate, setNewIgstRate] = useState<number>(0);
  const [newExpiryDate, setNewExpiryDate] = useState('');

  // Selected item object reference for live feedback
  const selectedItemObj = useMemo(() => {
    if (!newItemId) return null;
    return items.find((i) => i.id.toString() === newItemId) || null;
  }, [items, newItemId]);

  // Line Items
  const [poLines, setPoLines] = useState<PoLineItem[]>([]);

  // Input Focus Refs for Lightning Fast Keyboard Navigation
  const poItemInputRef = useRef<HTMLInputElement>(null);
  const poQtyInputRef = useRef<HTMLInputElement>(null);
  const poPriceInputRef = useRef<HTMLInputElement>(null);
  const poCgstInputRef = useRef<HTMLInputElement>(null);
  const poSgstInputRef = useRef<HTMLInputElement>(null);
  const poIgstInputRef = useRef<HTMLInputElement>(null);
  const poItemSearchContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Data Fetching (Vendors & Items & Categories)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [vRes, iRes, cRes] = await Promise.all([
          api.get('/vendors'),
          api.get('/items?limit=3000'),
          api.get('/items/categories'),
        ]);

        if (vRes.data.success) {
          setVendors(vRes.data.data);
        }
        if (iRes.data.success) {
          setItems(iRes.data.data);
        }
        if (cRes.data.success && cRes.data.categories) {
          setAllCategories(cRes.data.categories.map((c: any) => c.name));
        }
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
        setError('Failed to fetch vendors and items catalog.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // 2. Click outside listeners for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(e.target as Node)) {
        setIsVendorDropdownOpen(false);
      }
      if (poItemSearchContainerRef.current && !poItemSearchContainerRef.current.contains(e.target as Node)) {
        setIsPoItemSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Current Selected Vendor Object
  const currentVendor = useMemo(() => {
    return vendors.find((v) => v.id.toString() === selectedVendorId) || null;
  }, [vendors, selectedVendorId]);

  // Set default credit terms when vendor is chosen
  useEffect(() => {
    if (currentVendor?.payment_terms_days) {
      setCreditTerms(`${currentVendor.payment_terms_days} Days`);
    }
  }, [currentVendor]);

  // 4. Fetch Vendor Profile (Frequent Items + Past PO) when vendor changes
  useEffect(() => {
    if (!selectedVendorId) {
      setVendorFrequentItems([]);
      setVendorLastPo(null);
      return;
    }

    const loadVendorContext = async () => {
      setLoadingFrequentItems(true);
      try {
        const res = await api.get(`/vendors/${selectedVendorId}/profile`);
        if (res.data.success) {
          const profile = res.data.data;
          if (profile.suppliedItems && Array.isArray(profile.suppliedItems)) {
            setVendorFrequentItems(profile.suppliedItems);
          }
          if (profile.purchaseOrders && profile.purchaseOrders.length > 0) {
            const sortedPos = [...profile.purchaseOrders].sort(
              (a: any, b: any) => new Date(b.created_at || b.order_date).getTime() - new Date(a.created_at || a.order_date).getTime()
            );
            const latestPo = sortedPos[0];
            try {
              const poDetailRes = await api.get(`/purchasing/orders/${latestPo.id}`);
              if (poDetailRes.data.success && poDetailRes.data.data?.items?.length > 0) {
                setVendorLastPo({
                  id: latestPo.id,
                  po_number: latestPo.po_number,
                  order_date: latestPo.order_date,
                  items: poDetailRes.data.data.items,
                });
              } else {
                setVendorLastPo(null);
              }
            } catch {
              setVendorLastPo(null);
            }
          } else {
            setVendorLastPo(null);
          }
        }
      } catch (err) {
        console.error('Failed to load vendor profile context:', err);
      } finally {
        setLoadingFrequentItems(false);
      }
    };

    loadVendorContext();
  }, [selectedVendorId]);

  // 5. Vendor Filtering for Autocomplete Search
  const filteredVendors = useMemo(() => {
    const q = vendorSearchQuery.toLowerCase().trim();
    if (!q) return vendors.slice(0, 40); // show top 40 when query empty
    return vendors.filter((v) => {
      const matchName = v.name?.toLowerCase().includes(q);
      const matchCode = v.vendor_code?.toLowerCase().includes(q);
      const matchGstin = v.gstin?.toLowerCase().includes(q);
      const matchCat = (v.category || '')?.toLowerCase().includes(q);
      const matchPhone = v.phone?.toLowerCase().includes(q);
      const matchCity = v.city?.toLowerCase().includes(q);
      return matchName || matchCode || matchGstin || matchCat || matchPhone || matchCity;
    });
  }, [vendors, vendorSearchQuery]);

  // Top Active Vendors for Instant 1-Click Pick
  const topSuppliers = useMemo(() => {
    return vendors
      .filter((v) => v.is_active)
      .slice(0, 5);
  }, [vendors]);

  // Unique item categories for quick filtering in item search
  const itemCategories = useMemo(() => {
    if (allCategories.length > 0) return allCategories;
    const cats = new Set<string>();
    items.forEach((itm) => {
      if (itm.category_name) cats.add(itm.category_name);
    });
    return Array.from(cats).sort();
  }, [allCategories, items]);

  // Item Search Filtering
  const filteredItems = useMemo(() => {
    let list = items;
    if (poItemCategoryFilter !== 'ALL') {
      list = list.filter((i) => i.category_name === poItemCategoryFilter);
    }
    const q = poItemSearch.toLowerCase().trim();
    if (!q) return list.slice(0, 25);
    return list.filter((i) => {
      const matchName = i.name.toLowerCase().includes(q);
      const matchCode = i.item_code.toLowerCase().includes(q);
      const matchBarcode = (i as any).barcode?.toLowerCase().includes(q);
      return matchName || matchCode || matchBarcode;
    }).slice(0, 30);
  }, [items, poItemSearch, poItemCategoryFilter]);

  // 6. 1-Click Actions: Copy Past PO & Add Frequent Items
  const handleCopyLastPo = () => {
    if (!vendorLastPo || !vendorLastPo.items?.length) return;
    const copiedLines: PoLineItem[] = vendorLastPo.items.map((pi: any) => {
      const matchedItm = items.find((i) => i.id === pi.item_id);
      const taxR = parseFloat(pi.tax_rate?.toString() || '0');
      const unitP = parseFloat(pi.unit_price?.toString() || '0');
      const saleP = parseFloat(matchedItm?.selling_price?.toString() || '0');
      const mrpP = parseFloat((matchedItm as any)?.mrp?.toString() || saleP.toString()) || saleP;

      const cgstR = parseFloat(pi.cgst_rate?.toString() || (taxR > 0 ? (taxR / 2).toString() : '0'));
      const sgstR = parseFloat(pi.sgst_rate?.toString() || (taxR > 0 ? (taxR / 2).toString() : '0'));
      const igstR = parseFloat(pi.igst_rate?.toString() || '0');
      const effTax = (cgstR + sgstR + igstR) > 0 ? (cgstR + sgstR + igstR) : taxR;

      return {
        itemId: pi.item_id,
        itemName: pi.item_name || matchedItm?.name || `Item #${pi.item_id}`,
        itemCode: matchedItm?.item_code || '',
        category: matchedItm?.category_name || '',
        orderedQty: parseFloat(pi.ordered_qty?.toString() || '1'),
        unitPrice: unitP,
        salePrice: saleP,
        mrp: mrpP,
        taxRate: effTax,
        cgstRate: cgstR,
        sgstRate: sgstR,
        igstRate: igstR,
        expiryDate: undefined,
      };
    });

    setPoLines((prev) => {
      const existingIds = new Set(prev.map((l) => l.itemId));
      const newAdditions = copiedLines.filter((l) => !existingIds.has(l.itemId));
      return [...prev, ...newAdditions];
    });
    setSuccessMessage(`Successfully loaded ${copiedLines.length} items from previous PO #${vendorLastPo.po_number}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleQuickAddFrequentItem = (fItem: any) => {
    const itm = items.find((i) => i.id === fItem.item_id);
    const purPrice = parseFloat(fItem.last_rate?.toString() || itm?.purchase_price?.toString() || '0');
    const saleP = parseFloat(itm?.selling_price?.toString() || '0');
    const mrpP = parseFloat((itm as any)?.mrp?.toString() || saleP.toString()) || saleP;
    const totalTax = parseFloat(itm?.tax_rate?.toString() || '0');
    const cgstR = parseFloat((itm as any)?.cgst_rate?.toString() || (totalTax / 2).toString()) || 0;
    const sgstR = parseFloat((itm as any)?.sgst_rate?.toString() || (totalTax / 2).toString()) || 0;
    const igstR = parseFloat((itm as any)?.igst_rate?.toString() || '0');
    const effTax = (cgstR + sgstR + igstR) > 0 ? (cgstR + sgstR + igstR) : totalTax;
    const defQty = Math.max(1, Math.round(parseFloat(fItem.units_supplied?.toString() || '10') / 5));

    setPoLines((prev) => {
      const exIndex = prev.findIndex((p) => p.itemId === fItem.item_id);
      if (exIndex >= 0) {
        const copy = [...prev];
        copy[exIndex].orderedQty += defQty;
        return copy;
      }
      return [
        ...prev,
        {
          itemId: fItem.item_id,
          itemName: fItem.name || itm?.name || `Item #${fItem.item_id}`,
          itemCode: itm?.item_code || '',
          category: itm?.category_name || '',
          orderedQty: defQty,
          unitPrice: purPrice,
          salePrice: saleP,
          mrp: mrpP,
          taxRate: effTax,
          cgstRate: cgstR,
          sgstRate: sgstR,
          igstRate: igstR,
        },
      ];
    });
  };

  const handleAddAllFrequentItems = () => {
    if (!vendorFrequentItems.length) return;
    vendorFrequentItems.forEach((f) => handleQuickAddFrequentItem(f));
    setSuccessMessage(`Added ${vendorFrequentItems.length} frequent commodities to the order!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // 7. Select Item from Autocomplete
  const handleSelectItemForPo = (itemIdStr: string) => {
    setNewItemId(itemIdStr);
    const itm = items.find((i) => i.id === parseInt(itemIdStr, 10));
    if (itm) {
      const purPrice = parseFloat(itm.purchase_price?.toString() || '0');
      const saleP = parseFloat(itm.selling_price?.toString() || (itm as any).batch1_rate?.toString() || '0');
      const mrpP = parseFloat((itm as any).mrp?.toString() || saleP.toString()) || saleP;
      const totalTax = parseFloat(itm.tax_rate?.toString() || '0');
      const itmCgst = parseFloat((itm as any).cgst_rate?.toString() || '0');
      const itmSgst = parseFloat((itm as any).sgst_rate?.toString() || '0');
      const itmIgst = parseFloat((itm as any).igst_rate?.toString() || '0');

      const vendorState = (currentVendor?.state || 'Andhra Pradesh').toLowerCase();
      const isOutsideAp = vendorState && !vendorState.includes('andhra') && !vendorState.includes('ap');
      const isInter = poTaxMode === 'INTER' 
        ? true 
        : poTaxMode === 'INTRA' 
        ? false 
        : (isOutsideAp || (/^[0-9]{2}/.test(currentVendor?.gstin || '') && !currentVendor?.gstin?.startsWith('37')));

      let initCgst = 0;
      let initSgst = 0;
      let initIgst = 0;

      if (poTaxMode === 'EXEMPT') {
        initCgst = 0;
        initSgst = 0;
        initIgst = 0;
      } else if (itmCgst > 0 || itmSgst > 0) {
        // Honor explicit CGST/SGST on the commodity
        initCgst = itmCgst;
        initSgst = itmSgst;
        initIgst = itmIgst;
      } else if (isInter) {
        initIgst = itmIgst > 0 ? itmIgst : totalTax;
        initCgst = 0;
        initSgst = 0;
      } else {
        initCgst = itmCgst > 0 ? itmCgst : (totalTax / 2);
        initSgst = itmSgst > 0 ? itmSgst : (totalTax / 2);
        initIgst = 0;
      }

      setNewPrice(purPrice);
      setNewSalePrice(saleP);
      setNewMrp(mrpP);
      setNewCgstRate(initCgst);
      setNewSgstRate(initSgst);
      setNewIgstRate(initIgst);
      setNewExpiryDate((itm as any).batch1_expiry ? String((itm as any).batch1_expiry).split('T')[0] : '');

      setIsPoItemSearchOpen(false);

      // Auto focus quantity input so user can hit enter or adjust qty
      setTimeout(() => {
        poQtyInputRef.current?.focus();
        poQtyInputRef.current?.select();
      }, 50);
    }
  };

  // 8. Add Line Item to Order
  const handleAddLineToPo = () => {
    if (!newItemId) return;
    const itm = items.find((i) => i.id === parseInt(newItemId, 10));
    if (!itm) return;

    const purPrice = newPrice > 0 ? newPrice : parseFloat(itm.purchase_price?.toString() || '0');
    const saleP = newSalePrice > 0 ? newSalePrice : parseFloat(itm.selling_price?.toString() || (itm as any).batch1_rate?.toString() || '0');
    const mrpP = newMrp > 0 ? newMrp : (saleP > 0 ? saleP : purPrice);
    const cgstVal = newCgstRate || 0;
    const sgstVal = newSgstRate || 0;
    const igstVal = newIgstRate || 0;
    const totalTaxVal = cgstVal + sgstVal + igstVal;

    const existingIndex = poLines.findIndex((p) => p.itemId === itm.id);
    if (existingIndex >= 0) {
      const updated = [...poLines];
      updated[existingIndex].orderedQty += (newQty || 1);
      if (newPrice > 0) updated[existingIndex].unitPrice = newPrice;
      if (newSalePrice > 0) updated[existingIndex].salePrice = newSalePrice;
      if (newMrp > 0) updated[existingIndex].mrp = newMrp;
      updated[existingIndex].cgstRate = cgstVal;
      updated[existingIndex].sgstRate = sgstVal;
      updated[existingIndex].igstRate = igstVal;
      updated[existingIndex].taxRate = totalTaxVal;
      setPoLines(updated);
    } else {
      setPoLines([
        ...poLines,
        {
          itemId: itm.id,
          itemName: itm.name,
          itemCode: itm.item_code,
          category: itm.category_name || undefined,
          orderedQty: newQty || 1,
          unitPrice: purPrice,
          salePrice: saleP,
          mrp: mrpP,
          taxRate: totalTaxVal,
          cgstRate: cgstVal,
          sgstRate: sgstVal,
          igstRate: igstVal,
          expiryDate: newExpiryDate || undefined,
        },
      ]);
    }

    // Reset input fields
    setNewItemId('');
    setPoItemSearch('');
    setIsPoItemSearchOpen(false);
    setNewQty(10);
    setNewPrice(0);
    setNewSalePrice(0);
    setNewMrp(0);
    setNewCgstRate(0);
    setNewSgstRate(0);
    setNewIgstRate(0);
    setNewExpiryDate('');

    // Re-focus search input automatically for non-stop rapid typing
    setTimeout(() => {
      poItemInputRef.current?.focus();
    }, 50);
  };

  // 9. Inline Line Item Editing
  const handleUpdatePoLine = (index: number, field: keyof PoLineItem, value: any) => {
    setPoLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'cgstRate') {
        const val = parseFloat(value) || 0;
        target.cgstRate = val;
        target.taxRate = val + (target.sgstRate || 0) + (target.igstRate || 0);
      } else if (field === 'sgstRate') {
        const val = parseFloat(value) || 0;
        target.sgstRate = val;
        target.taxRate = (target.cgstRate || 0) + val + (target.igstRate || 0);
      } else if (field === 'igstRate') {
        const val = parseFloat(value) || 0;
        target.igstRate = val;
        target.taxRate = (target.cgstRate || 0) + (target.sgstRate || 0) + val;
      } else if (field === 'taxRate') {
        const val = parseFloat(value) || 0;
        target.taxRate = val;
        target.cgstRate = val / 2;
        target.sgstRate = val / 2;
        target.igstRate = 0;
      }
      updated[index] = target;
      return updated;
    });
  };

  const handleDuplicatePoLine = (index: number) => {
    const line = poLines[index];
    setPoLines([...poLines, { ...line }]);
  };

  const handleRemovePoLine = (index: number) => {
    setPoLines(poLines.filter((_, idx) => idx !== index));
  };

  const handleClearAllPoLines = () => {
    if (poLines.length === 0) return;
    if (window.confirm('Are you sure you want to clear all commodities from this purchase order?')) {
      setPoLines([]);
    }
  };

  // 10. Financial Totals Computation
  const poTotals = useMemo(() => {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let taxAmount = 0;

    const isInter = poTaxMode === 'INTER'
      ? true
      : poTaxMode === 'INTRA'
      ? false
      : (currentVendor?.gstin && !currentVendor.gstin.startsWith('37'));

    poLines.forEach((l) => {
      const lineSub = l.orderedQty * l.unitPrice;
      const cgst = poTaxMode === 'EXEMPT' ? 0 : lineSub * ((l.cgstRate || 0) / 100);
      const sgst = poTaxMode === 'EXEMPT' ? 0 : lineSub * ((l.sgstRate || 0) / 100);
      const igst = poTaxMode === 'EXEMPT' ? 0 : lineSub * ((l.igstRate || 0) / 100);

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

    const totalQty = poLines.reduce((acc, curr) => acc + curr.orderedQty, 0);

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
      totalQty,
    };
  }, [poLines, currentVendor, poTaxMode, poDiscountType, poDiscountValue, poFreightAmount, poAutoRoundOff]);

  // 11. Submit Purchase Order
  const handleConfirmAndIssuePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) {
      setError('Please select a supplier/vendor before issuing the purchase order.');
      return;
    }
    if (poLines.length === 0) {
      setError('Please add at least one commodity line item to the order.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const notesArray: string[] = [];
      if (poVendorBillNo) notesArray.push(`Invoice/Ref: ${poVendorBillNo}`);
      if (creditTerms) notesArray.push(`Credit Terms: ${creditTerms}`);
      if (poDiscountValue > 0) {
        notesArray.push(`Discount: ${poDiscountType === 'PERCENT' ? `${poDiscountValue}%` : `₹${poDiscountValue}`}`);
      }
      if (poFreightAmount > 0) notesArray.push(`Freight: ₹${poFreightAmount}`);
      if (poNotes) notesArray.push(poNotes);

      const notesPayload = notesArray.join(' | ') || 'Replenishment stock procurement';

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
          taxRate: poTaxMode === 'EXEMPT' ? 0 : ((l.cgstRate || 0) + (l.sgstRate || 0) + (l.igstRate || 0)),
          expiryDate: l.expiryDate || null,
        })),
      });

      if (res.data.success) {
        // Navigate back to purchasing with immediate success feedback
        navigate('/purchasing', {
          state: {
            successMessage: `Purchase Order created successfully with ${poLines.length} items!`,
          },
        });
      }
    } catch (err: any) {
      console.error('PO Creation error:', err);
      setError(err.response?.data?.message || 'Failed to issue purchase order. Please check line items and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. TOP BREADCRUMB & PAGE HEADER */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-textSecondary mb-1.5">
              <Link to="/purchasing" className="hover:text-primary transition-colors flex items-center space-x-1">
                <ArrowLeft className="w-3 h-3" />
                <span>Purchasing & GRN</span>
              </Link>
              <span>/</span>
              <span className="font-medium text-textPrimary">New Purchase Order</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-navy-800 tracking-tight">Create Purchase Order</h1>
                <p className="text-xs text-textSecondary">
                  Issue commercial stock orders to registered suppliers with instant tax calculation & rapid line entry
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => {
                if (poLines.length > 0 && !window.confirm('Discard current purchase order draft and exit?')) {
                  return;
                }
                navigate('/purchasing');
              }}
              className="px-4 py-2 rounded-lg border border-borderLine text-textSecondary text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmAndIssuePo}
              disabled={isSubmitting || !selectedVendorId || poLines.length === 0}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Issuing PO...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Issue Purchase Order</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-700">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successMessage && (
          <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-700">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. SUPPLIER & ORDER DETAILS (CLEAN SIDE-BY-SIDE LAYOUT) */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-borderLine pb-3 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
              1. Supplier & Order Information
            </h2>
          </div>

          {/* GST Tax Mode Selector in Header */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Tax Mode:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setPoTaxMode('AUTO')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  poTaxMode === 'AUTO' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Auto detect AP Intra-State (37) vs Inter-State (IGST)"
              >
                Auto AP/IGST
              </button>
              <button
                type="button"
                onClick={() => setPoTaxMode('INTRA')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  poTaxMode === 'INTRA' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Force Intra-State (CGST + SGST)"
              >
                Intra-State
              </button>
              <button
                type="button"
                onClick={() => setPoTaxMode('INTER')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  poTaxMode === 'INTER' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Force Inter-State (100% IGST)"
              >
                Inter-State (IGST)
              </button>
              <button
                type="button"
                onClick={() => setPoTaxMode('EXEMPT')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  poTaxMode === 'EXEMPT' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Zero-rated or Exempt supplies"
              >
                0% Exempt
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Left = Supplier, Right = 4 Order Metadata Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Supplier Selection / Active Card (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-2">
            <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider">
              Supplier / Vendor <span className="text-rose-500">*</span>
            </label>

            {!currentVendor ? (
              /* Empty Supplier Search & Popular Chips */
              <div className="space-y-2">
                <div className="relative" ref={vendorDropdownRef}>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={vendorSearchQuery}
                      onChange={(e) => {
                        setVendorSearchQuery(e.target.value);
                        setIsVendorDropdownOpen(true);
                      }}
                      onFocus={() => setIsVendorDropdownOpen(true)}
                      placeholder="Search supplier name, code (e.g. A009), GSTIN..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-borderLine bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                    />
                  </div>

                  {/* Vendor Dropdown List */}
                  {isVendorDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl bg-white border border-borderLine shadow-xl divide-y divide-slate-100">
                      {filteredVendors.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-500">
                          No registered suppliers found for "{vendorSearchQuery}".
                        </div>
                      ) : (
                        filteredVendors.map((v) => (
                          <div
                            key={v.id}
                            onClick={() => {
                              setSelectedVendorId(v.id.toString());
                              setIsVendorDropdownOpen(false);
                              setVendorSearchQuery('');
                            }}
                            className="p-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs text-navy-800">{v.name}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                  {v.vendor_code}
                                </span>
                                {v.category && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                                    {v.category}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                                <span>GSTIN: {v.gstin || 'Unregistered'}</span>
                                <span>•</span>
                                <span>{v.city || 'Visakhapatnam'}</span>
                              </div>
                            </div>
                            <span className="text-xs text-primary font-bold">Select</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Popular Suppliers Quick Select Chips */}
                <div className="flex items-center flex-wrap gap-1.5 text-xs pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick Pick:</span>
                  {topSuppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedVendorId(s.id.toString());
                        setVendorSearchQuery('');
                      }}
                      className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-primary text-[11px] font-medium text-slate-700 transition-colors"
                    >
                      {s.name} ({s.vendor_code})
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Sleek, Clean Active Supplier Card */
              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-navy-800">{currentVendor.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                        {currentVendor.vendor_code}
                      </span>
                      {currentVendor.category && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {currentVendor.category}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span>GSTIN: <strong className="font-mono text-slate-700">{currentVendor.gstin || 'Unregistered'}</strong></span>
                      <span>•</span>
                      <span>{currentVendor.city || 'Visakhapatnam'}</span>
                      {currentVendor.phone && (
                        <>
                          <span>•</span>
                          <span>{currentVendor.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendorId('');
                      setVendorSearchQuery('');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1 shrink-0 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>
                </div>

                {/* Quick Helper Actions: Reorder Past PO & Frequent Commodities Tray */}
                {(vendorLastPo || vendorFrequentItems.length > 0) && (
                  <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-slate-200">
                    {vendorLastPo && (
                      <button
                        type="button"
                        onClick={handleCopyLastPo}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Reorder Past PO #{vendorLastPo.po_number} ({vendorLastPo.items.length} items)</span>
                      </button>
                    )}
                    {vendorFrequentItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowFrequentTray(!showFrequentTray)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Frequent Items ({vendorFrequentItems.length})</span>
                        {showFrequentTray ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                      </button>
                    )}
                  </div>
                )}

                {/* Expanded Frequent Items Tray when opened */}
                {currentVendor && showFrequentTray && vendorFrequentItems.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Click to add:</span>
                      <button
                        type="button"
                        onClick={handleAddAllFrequentItems}
                        className="text-primary font-bold hover:underline"
                      >
                        + Add All ({vendorFrequentItems.length})
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {vendorFrequentItems.slice(0, 10).map((f) => (
                        <button
                          key={f.item_id}
                          type="button"
                          onClick={() => handleQuickAddFrequentItem(f)}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-primary hover:text-primary text-[11px] font-medium text-slate-700 transition-colors flex items-center space-x-1"
                        >
                          <span>{f.name}</span>
                          <span className="text-slate-400 text-[10px]">(₹{f.last_rate || 0})</span>
                          <Plus className="w-2.5 h-2.5 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: 4 Order Metadata Inputs (lg:col-span-7) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
                Order Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-borderLine text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
                Expected Delivery Date
              </label>
              <div className="relative">
                <Truck className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-borderLine text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
                Vendor Quotation / Bill Ref #
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. INV-1115 / Quotation # (Optional)"
                  value={poVendorBillNo}
                  onChange={(e) => setPoVendorBillNo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-borderLine text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
                Payment / Credit Terms
              </label>
              <div className="relative">
                <CreditCard className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={creditTerms}
                  onChange={(e) => setCreditTerms(e.target.value)}
                  placeholder="e.g. 30 Days Credit"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-borderLine text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RAPID LINE ITEM ENTRY BAR */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-borderLine pb-3 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
              2. Add Commodities to Purchase Order
            </h2>
          </div>
          <span className="text-[11px] text-textSecondary flex items-center space-x-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] text-slate-700">Enter ↵</kbd>
            <span>Jump between fields & instant add to order list</span>
          </span>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2.5 mb-3.5 no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center space-x-1">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span>Category:</span>
          </span>
          <button
            type="button"
            onClick={() => setPoItemCategoryFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
              poItemCategoryFilter === 'ALL'
                ? 'bg-navy-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Commodities
          </button>
          {itemCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPoItemCategoryFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                poItemCategoryFilter === c
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Selected Item Notification Banner if an item is active */}
        {selectedItemObj && (
          <div className="mb-3.5 p-2.5 px-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-2xs">
            <div className="flex items-center space-x-2.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold text-navy-800 truncate">{selectedItemObj.name}</span>
              <span className="font-mono text-[11px] font-bold bg-white border border-blue-200 px-1.5 py-0.5 rounded text-blue-800">
                {selectedItemObj.item_code}
              </span>
              {selectedItemObj.category_name && (
                <span className="text-[11px] text-slate-500 hidden sm:inline">• {selectedItemObj.category_name}</span>
              )}
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200 hidden md:inline">
                In Stock: {Number(selectedItemObj.current_stock || 0).toFixed(0)} {selectedItemObj.unit_name || selectedItemObj.unit_code || 'Units'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewItemId('');
                setPoItemSearch('');
                poItemInputRef.current?.focus();
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1 shrink-0 ml-2"
            >
              <X className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>
        )}

        {/* Row 1: Item Search, Qty, Prices, Expiry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end mb-3.5">
          {/* Item Search Bar */}
          <div className="md:col-span-4 relative" ref={poItemSearchContainerRef}>
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Store Item Search (Code / Name / Barcode) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={poItemInputRef}
                type="text"
                placeholder="Search item name or 4-digit code..."
                value={poItemSearch}
                onChange={(e) => {
                  setPoItemSearch(e.target.value);
                  setIsPoItemSearchOpen(true);
                }}
                onFocus={() => setIsPoItemSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredItems.length > 0) {
                      handleSelectItemForPo(filteredItems[0].id.toString());
                    }
                  }
                }}
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-borderLine text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
              {poItemSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setPoItemSearch('');
                    setNewItemId('');
                    setIsPoItemSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown Options */}
            {isPoItemSearchOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl bg-white border border-borderLine shadow-xl divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <div className="p-3 text-xs text-textSecondary text-center">
                    No matching store commodities found
                  </div>
                ) : (
                  filteredItems.map((itm) => (
                    <div
                      key={itm.id}
                      onClick={() => handleSelectItemForPo(itm.id.toString())}
                      className="p-2.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-xs text-navy-800">{itm.name}</div>
                        <div className="text-[10px] text-textSecondary flex items-center space-x-2">
                          <span className="font-mono bg-slate-100 px-1 rounded font-bold text-slate-700">{itm.item_code}</span>
                          {itm.category_name && <span>• {itm.category_name}</span>}
                          <span>• Pur: ₹{itm.purchase_price || 0}</span>
                          <span>• MRP: ₹{(itm as any).mrp || itm.selling_price || 0}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold block">
                          GST: {itm.tax_rate || 0}%
                        </span>
                        {(itm as any).cgst_rate > 0 && (
                          <span className="text-[9px] text-slate-400">
                            C:{(itm as any).cgst_rate}% S:{(itm as any).sgst_rate}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Ordered Qty */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Ordered Qty <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={poQtyInputRef}
                type="number"
                min="1"
                step="any"
                value={newQty}
                onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    poPriceInputRef.current?.focus();
                    poPriceInputRef.current?.select();
                  }
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-borderLine text-xs font-bold text-navy-800 text-center bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
              {selectedItemObj && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">
                  {selectedItemObj.unit_code || 'Units'}
                </span>
              )}
            </div>
          </div>

          {/* Purchase Rate (₹) */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Purchase Rate (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">₹</span>
              <input
                ref={poPriceInputRef}
                type="number"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    poCgstInputRef.current?.focus();
                    poCgstInputRef.current?.select();
                  }
                }}
                className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-borderLine text-xs font-bold text-navy-800 text-right bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
            </div>
          </div>

          {/* Sale Price (₹) */}
          <div className="md:col-span-1 sm:col-span-1">
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1 truncate" title="Sale Price (₹)">
              Sale (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newSalePrice}
              onChange={(e) => setNewSalePrice(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-2.5 rounded-lg border border-borderLine text-xs font-medium text-right bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            />
          </div>

          {/* MRP (₹) */}
          <div className="md:col-span-1 sm:col-span-1">
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1 truncate" title="MRP (₹)">
              MRP (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newMrp}
              onChange={(e) => setNewMrp(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-2.5 rounded-lg border border-borderLine text-xs font-medium text-right bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            />
          </div>

          {/* Expiry Date */}
          <div className="md:col-span-2 sm:col-span-2">
            <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1">
              Expiry Date
            </label>
            <input
              type="date"
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              className="w-full px-2 py-2.5 rounded-lg border border-borderLine text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            />
          </div>
        </div>

        {/* Row 2: SEPARATE GST TAX RATES & ADD TO ORDER ACTION */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: GST Manual Inputs and Presets */}
            <div className="space-y-2.5 flex-1 min-w-0">
              {/* Manual Input Fields & Computed Total */}
              <div className="flex items-center flex-wrap gap-3">
                <div className="flex items-center space-x-1.5 shrink-0">
                  <Percent className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                    Separate GST Rates:
                  </span>
                </div>

                {/* CGST Input Box */}
                <div className="flex items-center bg-white rounded-lg border border-blue-300 shadow-2xs overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
                  <span className="px-2 py-1 bg-blue-50 text-[10px] font-bold text-blue-800 border-r border-blue-200 uppercase">
                    CGST
                  </span>
                  <input
                    ref={poCgstInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCgstRate}
                    onChange={(e) => setNewCgstRate(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        poSgstInputRef.current?.focus();
                        poSgstInputRef.current?.select();
                      }
                    }}
                    className="w-12 px-1 py-1 text-center text-xs font-bold text-blue-800 focus:outline-none"
                  />
                  <span className="pr-2 text-[10px] text-slate-400 font-semibold">%</span>
                </div>

                {/* SGST Input Box */}
                <div className="flex items-center bg-white rounded-lg border border-blue-300 shadow-2xs overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
                  <span className="px-2 py-1 bg-blue-50 text-[10px] font-bold text-blue-800 border-r border-blue-200 uppercase">
                    SGST
                  </span>
                  <input
                    ref={poSgstInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSgstRate}
                    onChange={(e) => setNewSgstRate(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        poIgstInputRef.current?.focus();
                        poIgstInputRef.current?.select();
                      }
                    }}
                    className="w-12 px-1 py-1 text-center text-xs font-bold text-blue-800 focus:outline-none"
                  />
                  <span className="pr-2 text-[10px] text-slate-400 font-semibold">%</span>
                </div>

                {/* IGST Input Box */}
                <div className="flex items-center bg-white rounded-lg border border-indigo-300 shadow-2xs overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
                  <span className="px-2 py-1 bg-indigo-50 text-[10px] font-bold text-indigo-800 border-r border-indigo-200 uppercase">
                    IGST
                  </span>
                  <input
                    ref={poIgstInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={newIgstRate}
                    onChange={(e) => setNewIgstRate(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLineToPo();
                      }
                    }}
                    className="w-12 px-1 py-1 text-center text-xs font-bold text-indigo-800 focus:outline-none"
                  />
                  <span className="pr-2 text-[10px] text-slate-400 font-semibold">%</span>
                </div>

                {/* Total GST Badge & Computed Tax Amount */}
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-200/90 text-xs font-semibold text-slate-700">
                  <span className="text-[10px] uppercase text-slate-500 font-bold">Total:</span>
                  <span className="font-mono font-bold text-navy-800">
                    {(newCgstRate + newSgstRate + newIgstRate).toFixed(1)}%
                  </span>
                  {newQty > 0 && newPrice > 0 && (newCgstRate + newSgstRate + newIgstRate) > 0 && (
                    <span className="text-[10px] font-mono text-emerald-700 font-bold ml-1">
                      (₹{((newQty * newPrice * (newCgstRate + newSgstRate + newIgstRate)) / 100).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Preset Buttons (Grouped & Never Overlapping) */}
              <div className="flex items-center flex-wrap gap-1.5 text-[11px] pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>

                {/* Intra-State GST Presets */}
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(0); setNewSgstRate(0); setNewIgstRate(0); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newCgstRate === 0 && newSgstRate === 0 && newIgstRate === 0
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    0% Nil
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(2.5); setNewSgstRate(2.5); setNewIgstRate(0); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newCgstRate === 2.5 && newSgstRate === 2.5 && newIgstRate === 0
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    5% (2.5+2.5)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(6); setNewSgstRate(6); setNewIgstRate(0); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newCgstRate === 6 && newSgstRate === 6 && newIgstRate === 0
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    12% (6+6)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(9); setNewSgstRate(9); setNewIgstRate(0); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newCgstRate === 9 && newSgstRate === 9 && newIgstRate === 0
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    18% (9+9)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(14); setNewSgstRate(14); setNewIgstRate(0); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newCgstRate === 14 && newSgstRate === 14 && newIgstRate === 0
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    28% (14+14)
                  </button>
                </div>

                {/* Inter-State IGST Presets */}
                <div className="inline-flex items-center rounded-lg border border-indigo-200 bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(0); setNewSgstRate(0); setNewIgstRate(5); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newIgstRate === 5 && newCgstRate === 0 && newSgstRate === 0
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    IGST 5%
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(0); setNewSgstRate(0); setNewIgstRate(12); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newIgstRate === 12 && newCgstRate === 0 && newSgstRate === 0
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    IGST 12%
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(0); setNewSgstRate(0); setNewIgstRate(18); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newIgstRate === 18 && newCgstRate === 0 && newSgstRate === 0
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    IGST 18%
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCgstRate(0); setNewSgstRate(0); setNewIgstRate(28); }}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      newIgstRate === 28 && newCgstRate === 0 && newSgstRate === 0
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    IGST 28%
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Add Line Button */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleAddLineToPo}
                disabled={!newItemId || newQty <= 0}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 flex items-center justify-center space-x-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item to Order</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">↵ Enter</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. LINE ITEMS GRID (FULL WIDTH SPACIOUS TABLE) */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-borderLine flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
              3. Ordered Items & Line Specifications ({poLines.length})
            </h2>
          </div>

          {poLines.length > 0 && (
            <div className="flex items-center space-x-3">
              <span className="text-xs text-textSecondary">
                Total Units: <strong className="text-navy-800">{poTotals.totalQty}</strong>
              </span>
              <button
                type="button"
                onClick={handleClearAllPoLines}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>

        {poLines.length === 0 ? (
          <div className="py-16 text-center text-textSecondary space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm text-navy-800">No commodities added yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Use the search bar above to look up store items, or click any frequent item pill to populate this purchase order.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-borderLine bg-slate-100/70 text-[11px] font-bold text-navy-800 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 min-w-[190px]">Commodity / Code</th>
                  <th className="py-3 px-2 text-center w-24">Ordered Qty</th>
                  <th className="py-3 px-2 text-right w-24">Purchase Rate (₹)</th>
                  <th className="py-3 px-2 text-right w-20">Sale (₹)</th>
                  <th className="py-3 px-2 text-right w-20">MRP (₹)</th>
                  <th className="py-3 px-1.5 text-center w-20 text-blue-700 bg-blue-50/60 font-bold">CGST %</th>
                  <th className="py-3 px-1.5 text-center w-20 text-blue-700 bg-blue-50/60 font-bold">SGST %</th>
                  <th className="py-3 px-1.5 text-center w-20 text-indigo-700 bg-indigo-50/60 font-bold">IGST %</th>
                  <th className="py-3 px-2 text-center w-28">Expiry Date</th>
                  <th className="py-3 px-3 text-right w-24">Net Subtotal (₹)</th>
                  <th className="py-3 px-3 text-right w-24">Tax (₹)</th>
                  <th className="py-3 px-3 text-right w-28">Line Total (₹)</th>
                  <th className="py-3 px-3 text-center w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {poLines.map((line, idx) => {
                  const lineNet = line.orderedQty * line.unitPrice;
                  const cgstR = poTaxMode === 'EXEMPT' ? 0 : (line.cgstRate || 0);
                  const sgstR = poTaxMode === 'EXEMPT' ? 0 : (line.sgstRate || 0);
                  const igstR = poTaxMode === 'EXEMPT' ? 0 : (line.igstRate || 0);
                  const lineCgst = lineNet * (cgstR / 100);
                  const lineSgst = lineNet * (sgstR / 100);
                  const lineIgst = lineNet * (igstR / 100);
                  const lineTax = lineCgst + lineSgst + lineIgst;
                  const lineGross = lineNet + lineTax;

                  return (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-bold text-navy-800">{line.itemName}</div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono bg-slate-100 px-1 py-0.2 rounded font-semibold text-slate-700">
                            {line.itemCode}
                          </span>
                          {line.category && (
                            <span className="text-slate-400">• {line.category}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleUpdatePoLine(idx, 'orderedQty', Math.max(1, line.orderedQty - 1))}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={line.orderedQty}
                            onChange={(e) => handleUpdatePoLine(idx, 'orderedQty', parseFloat(e.target.value) || 0)}
                            className="w-14 px-1 py-1 rounded border border-borderLine text-center font-bold text-navy-800 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdatePoLine(idx, 'orderedQty', line.orderedQty + 1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => handleUpdatePoLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 px-1.5 py-1 rounded border border-borderLine text-right font-bold text-navy-800 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.salePrice}
                          onChange={(e) => handleUpdatePoLine(idx, 'salePrice', parseFloat(e.target.value) || 0)}
                          className="w-20 px-1 py-1 rounded border border-borderLine text-right text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.mrp}
                          onChange={(e) => handleUpdatePoLine(idx, 'mrp', parseFloat(e.target.value) || 0)}
                          className="w-20 px-1 py-1 rounded border border-borderLine text-right text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      {/* CGST % Manual Input */}
                      <td className="py-2.5 px-1 text-center bg-blue-50/20">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.cgstRate ?? 0}
                          onChange={(e) => handleUpdatePoLine(idx, 'cgstRate', parseFloat(e.target.value) || 0)}
                          className="w-14 px-1 py-1 rounded border border-blue-200 text-center font-bold text-blue-700 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </td>

                      {/* SGST % Manual Input */}
                      <td className="py-2.5 px-1 text-center bg-blue-50/20">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.sgstRate ?? 0}
                          onChange={(e) => handleUpdatePoLine(idx, 'sgstRate', parseFloat(e.target.value) || 0)}
                          className="w-14 px-1 py-1 rounded border border-blue-200 text-center font-bold text-blue-700 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </td>

                      {/* IGST % Manual Input */}
                      <td className="py-2.5 px-1 text-center bg-indigo-50/20">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.igstRate ?? 0}
                          onChange={(e) => handleUpdatePoLine(idx, 'igstRate', parseFloat(e.target.value) || 0)}
                          className="w-14 px-1 py-1 rounded border border-indigo-200 text-center font-bold text-indigo-700 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="date"
                          value={line.expiryDate || ''}
                          onChange={(e) => handleUpdatePoLine(idx, 'expiryDate', e.target.value)}
                          className="w-28 px-1 py-1 rounded border border-borderLine text-[11px] bg-white"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                        ₹{lineNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        <div>₹{lineTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {(lineCgst > 0 || lineSgst > 0 || lineIgst > 0) && (
                          <div className="text-[9px] text-slate-400 flex items-center justify-end space-x-1 mt-0.5">
                            {lineCgst > 0 && <span className="text-blue-600">C:{lineCgst.toFixed(1)}</span>}
                            {lineSgst > 0 && <span className="text-blue-600">S:{lineSgst.toFixed(1)}</span>}
                            {lineIgst > 0 && <span className="text-indigo-600">I:{lineIgst.toFixed(1)}</span>}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-navy-800">
                        ₹{lineGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicatePoLine(idx)}
                            title="Duplicate line"
                            className="p-1 text-slate-400 hover:text-primary transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePoLine(idx)}
                            title="Delete line"
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
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
        )}
      </div>

      {/* 5. COMMERCIAL ADJUSTMENTS & FINANCIAL TOTALS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Notes & Special Delivery Guidelines */}
        <div className="lg:col-span-7 bg-surface rounded-cfecc border border-borderLine shadow-subtle p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-borderLine pb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
              Purchase Order Terms & Instructions
            </h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1.5">
              Receiving Notes / Shipment Instructions
            </label>
            <textarea
              rows={4}
              placeholder="e.g. Deliver between 9 AM - 2 PM at Store Gate #2. Check batch expiry date. Fragile glass packaging."
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              className="w-full p-3 rounded-lg border border-borderLine text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-navy-800 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <span>Commercial Procurement Policy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Upon approval, this Purchase Order authorizes the vendor to dispatch goods. Physical verification, batch number recording, and quality inspection will take place during Goods Receipt Note (GRN) generation.
            </p>
          </div>
        </div>

        {/* Right: Commercial Calculations & Grand Total */}
        <div className="lg:col-span-5 bg-surface rounded-cfecc border border-borderLine shadow-subtle p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-borderLine pb-3">
            <BadgePercent className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-navy-800 uppercase tracking-wider">
              Commercial Summary & Taxes
            </h2>
          </div>

          {/* Trade Discount Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Trade Discount</span>
              <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPoDiscountType('PERCENT')}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    poDiscountType === 'PERCENT' ? 'bg-primary text-white' : 'text-slate-600'
                  }`}
                >
                  % Percent
                </button>
                <button
                  type="button"
                  onClick={() => setPoDiscountType('FLAT')}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    poDiscountType === 'FLAT' ? 'bg-primary text-white' : 'text-slate-600'
                  }`}
                >
                  ₹ Flat
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={poDiscountValue}
                onChange={(e) => setPoDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-1.5 rounded-lg border border-borderLine text-xs font-semibold text-right bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>
          </div>

          {/* Freight / Shipping Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Freight & Transportation (₹)</span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={poFreightAmount}
              onChange={(e) => setPoFreightAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full px-3 py-1.5 rounded-lg border border-borderLine text-xs font-semibold text-right bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>

          {/* Breakdown List */}
          <div className="divide-y divide-slate-100 pt-2 text-xs">
            <div className="py-1.5 flex justify-between text-textSecondary">
              <span>Gross Taxable Subtotal:</span>
              <span className="font-mono font-semibold text-slate-800">
                ₹{poTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {poTotals.discountVal > 0 && (
              <div className="py-1.5 flex justify-between text-emerald-600">
                <span>Trade Discount:</span>
                <span className="font-mono font-semibold">
                  - ₹{poTotals.discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {poTotals.freightVal > 0 && (
              <div className="py-1.5 flex justify-between text-textSecondary">
                <span>Freight / Delivery Charges:</span>
                <span className="font-mono font-semibold text-slate-800">
                  + ₹{poTotals.freightVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Separate GST Breakdown */}
            {poTaxMode === 'EXEMPT' ? (
              <div className="py-1.5 flex justify-between text-slate-500 italic">
                <span>GST Tax Mode:</span>
                <span>0% Exempt Supply</span>
              </div>
            ) : (
              <>
                {poTotals.cgstTotal > 0 && (
                  <div className="py-1.5 flex justify-between text-blue-700 font-medium">
                    <span>Central GST (CGST):</span>
                    <span className="font-mono font-semibold">
                      ₹{poTotals.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {poTotals.sgstTotal > 0 && (
                  <div className="py-1.5 flex justify-between text-blue-700 font-medium">
                    <span>State GST (SGST):</span>
                    <span className="font-mono font-semibold">
                      ₹{poTotals.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {poTotals.igstTotal > 0 && (
                  <div className="py-1.5 flex justify-between text-indigo-700 font-medium">
                    <span>Integrated GST (IGST):</span>
                    <span className="font-mono font-semibold">
                      ₹{poTotals.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="py-1.5 flex justify-between text-slate-700 font-bold border-t border-dashed border-slate-200 mt-1 pt-1">
                  <span>Total Tax Amount (GST):</span>
                  <span className="font-mono">
                    ₹{poTotals.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}

            {/* Auto Round Off Checkbox */}
            <div className="py-2 flex items-center justify-between text-slate-600">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={poAutoRoundOff}
                  onChange={(e) => setPoAutoRoundOff(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                />
                <span className="text-[11px] font-semibold">Auto Round-off</span>
              </label>
              <span className="font-mono text-slate-500">
                {poTotals.roundOffVal >= 0 ? `+₹${poTotals.roundOffVal.toFixed(2)}` : `-₹${Math.abs(poTotals.roundOffVal).toFixed(2)}`}
              </span>
            </div>

            {/* Grand Total Value */}
            <div className="pt-3 pb-1 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-extrabold text-navy-800 uppercase tracking-wider block">
                  Total Purchase Order Value
                </span>
                <span className="text-[10px] text-textSecondary">
                  {poLines.length} items • {poTotals.totalQty} units
                </span>
              </div>
              <div className="text-2xl font-black text-navy-800 font-mono tracking-tight text-right">
                ₹{poTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Action Submit */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleConfirmAndIssuePo}
              disabled={isSubmitting || !selectedVendorId || poLines.length === 0}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-primary to-indigo-600 text-white text-sm font-extrabold hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Issuing Purchase Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Issue Purchase Order (₹{poTotals.totalAmount.toFixed(0)})</span>
                </>
              )}
            </button>
            {!selectedVendorId && (
              <p className="text-[11px] text-rose-500 text-center font-medium mt-1.5">
                * Please select a registered supplier above to enable order issuance.
              </p>
            )}
            {selectedVendorId && poLines.length === 0 && (
              <p className="text-[11px] text-amber-600 text-center font-medium mt-1.5">
                * Please add at least 1 commodity item to issue this order.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
