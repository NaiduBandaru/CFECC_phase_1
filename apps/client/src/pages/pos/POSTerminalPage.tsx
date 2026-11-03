import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.js';
import { BarcodeSvg } from '../../components/ui/BarcodeSvg.js';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  CreditCard,
  User,
  IndianRupee,
  QrCode,
  CheckCircle,
  AlertCircle,
  Printer,
  X,
  Package,
  MessageSquare,
  Send,
  Lock,
  Unlock,
  FileText,
  Receipt,
} from 'lucide-react';

interface CartItem {
  itemId: number;
  itemCode: string;
  name: string;
  unitCode: string;
  unitPrice: number;
  employeePrice: number;
  quantity: number;
  taxRate: number;
  currentStock: number;
}

export const POSTerminalPage: React.FC = () => {
  // Products catalog
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Selected Employee & Credit info
  const [employeeQuery, setEmployeeQuery] = useState<string>('');
  const [employeeSuggestions, setEmployeeSuggestions] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Cart & Checkout
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'EMPLOYEE_CREDIT' | 'CASH' | 'UPI'>('EMPLOYEE_CREDIT');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [waSending, setWaSending] = useState<boolean>(false);
  const [waSentStatus, setWaSentStatus] = useState<string | null>(null);
  const [waPhoneInput, setWaPhoneInput] = useState<string>('');
  const [thermalSize, setThermalSize] = useState<'80mm' | '58mm'>('80mm');

  // Shift Management & Register Closure States
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [isShiftLoading, setIsShiftLoading] = useState<boolean>(true);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState<boolean>(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState<boolean>(false);
  const [zReportData, setZReportData] = useState<any | null>(null);
  const [newOpeningFloat, setNewOpeningFloat] = useState<string>('2000');
  const [closingCashCountedInput, setClosingCashCountedInput] = useState<string>('');
  const [closingNotesInput, setClosingNotesInput] = useState<string>('');
  const [shiftOperating, setShiftOperating] = useState<boolean>(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialCatalog();
    fetchActiveShift();
  }, []);

  const fetchActiveShift = async () => {
    try {
      setIsShiftLoading(true);
      const res = await api.get('/pos/shift/current');
      if (res.data.success) {
        setActiveShift(res.data.activeShift);
      }
    } catch (err) {
      console.error('Failed to load active shift', err);
    } finally {
      setIsShiftLoading(false);
    }
  };

  const handleOpenShift = async () => {
    try {
      setShiftOperating(true);
      setShiftError(null);
      const floatVal = parseFloat(newOpeningFloat) || 0;
      const res = await api.post('/pos/shift/open', {
        openingFloat: floatVal,
        terminalId: 'POS-01',
      });
      if (res.data.success) {
        setIsOpenShiftModalOpen(false);
        fetchActiveShift();
      }
    } catch (err: any) {
      setShiftError(err.response?.data?.message || 'Failed to open register.');
    } finally {
      setShiftOperating(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      setShiftOperating(true);
      setShiftError(null);
      const counted = parseFloat(closingCashCountedInput) || 0;
      const res = await api.post('/pos/shift/close', {
        shiftId: activeShift.id,
        closingCashCounted: counted,
        closingNotes: closingNotesInput,
      });
      if (res.data.success) {
        const zRes = await api.get(`/pos/shift/z-report/${activeShift.id}`);
        if (zRes.data.success) {
          setZReportData(zRes.data.report);
          setIsCloseShiftModalOpen(false);
          setIsZReportModalOpen(true);
          fetchActiveShift();
        }
      }
    } catch (err: any) {
      setShiftError(err.response?.data?.message || 'Failed to close shift.');
    } finally {
      setShiftOperating(false);
    }
  };

  const fetchInitialCatalog = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/pos/lookup-item'),
        api.get('/items/categories'),
      ]);
      if (itemsRes.data.success) setItems(itemsRes.data.items);
      if (catsRes.data.success) setCategories(catsRes.data.categories);
    } catch (err) {
      console.error('Failed to load POS catalog', err);
    }
  };

  // Live employee lookup
  const handleEmployeeSearch = async (val: string) => {
    setEmployeeQuery(val);
    if (!val.trim()) {
      setEmployeeSuggestions([]);
      return;
    }
    try {
      const res = await api.get(`/pos/lookup-employee?query=${encodeURIComponent(val)}`);
      if (res.data.success) {
        setEmployeeSuggestions(res.data.employees);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    setEmployeeSuggestions([]);
    setEmployeeQuery('');
    setPaymentMode('EMPLOYEE_CREDIT');
  };

  // Add Item to Cart
  const handleAddToCart = (product: any) => {
    setCheckoutError(null);
    const existing = cart.find(c => c.itemId === product.id);

    // If employee is selected, automatically apply the subsidized employeePrice!
    const effectivePrice = selectedEmployee
      ? parseFloat(product.employee_price)
      : parseFloat(product.selling_price);

    if (existing) {
      setCart(cart.map(c => 
        c.itemId === product.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([
        ...cart,
        {
          itemId: product.id,
          itemCode: product.item_code,
          name: product.name,
          unitCode: product.unit_code || 'PCS',
          unitPrice: effectivePrice,
          employeePrice: parseFloat(product.employee_price),
          quantity: 1,
          taxRate: parseFloat(product.tax_rate || '0'),
          currentStock: parseFloat(product.current_stock || '0'),
        },
      ]);
    }
  };

  // Barcode Instant Scan
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const res = await api.get(`/pos/lookup-item?barcode=${encodeURIComponent(barcodeInput.trim())}`);
      if (res.data.success && res.data.items.length > 0) {
        handleAddToCart(res.data.items[0]);
        setBarcodeInput('');
      } else {
        setCheckoutError(`Item with barcode '${barcodeInput}' not found.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(cart.map(c => {
      if (c.itemId === itemId) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : null;
      }
      return c;
    }).filter(Boolean) as CartItem[]);
  };

  const removeItem = (itemId: number) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalTax = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity * (item.taxRate / 100)), 0);
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

  // Checkout execution
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const payload = {
        employeeId: selectedEmployee?.id || null,
        customerName: selectedEmployee ? `${selectedEmployee.name}` : 'Walk-in Customer',
        customerMobile: selectedEmployee?.mobile || null,
        paymentMode,
        items: cart.map(c => ({
          itemId: c.itemId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          taxRate: c.taxRate,
          discountAmount: 0,
        })),
      };

      const res = await api.post('/pos/checkout', payload);
      if (res.data.success) {
        setCompletedSale({
          ...res.data.sale,
          items: [...cart],
          grandTotal,
          employee: selectedEmployee,
        });
        setWaPhoneInput(selectedEmployee?.mobile || '');
        setWaSentStatus(null);
        setIsReceiptModalOpen(true);
        // Reset Cart
        setCart([]);
        setSelectedEmployee(null);
        fetchInitialCatalog();
        fetchActiveShift();
      }
    } catch (err: any) {
      setCheckoutError(err.response?.data?.message || 'Transaction could not be completed.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleSendWhatsAppReceipt = async () => {
    if (!completedSale?.id) return;
    try {
      setWaSending(true);
      setWaSentStatus(null);
      const res = await api.post('/whatsapp/send-receipt', {
        saleId: completedSale.id,
        customPhone: waPhoneInput || undefined,
      });
      if (res.data.success) {
        setWaSentStatus(`Dispatched (${res.data.result?.mode || 'SENT'})`);
      } else {
        setWaSentStatus(`Failed: ${res.data.message}`);
      }
    } catch (err: any) {
      setWaSentStatus(`Error: ${err.response?.data?.message || 'Dispatch failed'}`);
    } finally {
      setWaSending(false);
    }
  };

  // Filter products by category & search
  const filteredProducts = items.filter(itm => {
    const matchesCat = selectedCategory === 'ALL' || itm.category_name === selectedCategory;
    const matchesSearch = !itemSearch || 
      itm.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
      itm.item_code.toLowerCase().includes(itemSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Top Shift & Register Management Bar */}
      <div className="lg:col-span-12 bg-surface rounded-cfecc border border-borderLine shadow-subtle p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {activeShift ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Shift #{activeShift.shiftNumber}</span>
              </span>
              <span className="text-xs text-textSecondary font-medium">
                Terminal: <strong className="text-navy-800">{activeShift.terminalId}</strong>
              </span>
              <span className="text-xs text-textSecondary font-medium">
                Cashier: <strong className="text-navy-800">{activeShift.cashierName}</strong>
              </span>
              <span className="text-xs text-textSecondary font-medium">
                Float: <strong className="text-navy-800">₹{activeShift.openingFloat.toFixed(2)}</strong>
              </span>
              <span className="text-xs text-textSecondary font-medium">
                Cash in Drawer: <strong className="text-emerald-700 font-bold">₹{(activeShift.liveMetrics?.expectedCash || activeShift.openingFloat).toFixed(2)}</strong>
              </span>
              <span className="text-xs text-textSecondary font-medium">
                Turnover: <strong className="text-primary font-bold">₹{(activeShift.liveMetrics?.totalSales || 0).toFixed(2)}</strong> ({activeShift.liveMetrics?.totalTransactions || 0} bills)
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Register Closed (No Active Shift)</span>
              </span>
              <span className="text-xs text-textSecondary hidden md:inline">
                Start shift to track cash drawer float, payments reconciliation and EOD Z-Reports.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {activeShift ? (
            <button
              onClick={() => {
                setClosingCashCountedInput((activeShift.liveMetrics?.expectedCash || activeShift.openingFloat).toFixed(2));
                setClosingNotesInput('');
                setShiftError(null);
                setIsCloseShiftModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Close Shift & Z-Report</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setShiftError(null);
                setNewOpeningFloat('2000');
                setIsOpenShiftModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Open Cash Register</span>
            </button>
          )}
        </div>
      </div>

      {/* LEFT SECTION (Col 7): Product Catalog & Barcode Scanner */}
      <div className="lg:col-span-7 space-y-4">
        {/* Barcode & Search Controls */}
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Barcode Quick Scan */}
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <Barcode className="w-4 h-4 text-primary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode (Press Enter)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-blue-50/40 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white font-mono"
              />
            </form>

            {/* Product Name Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by title..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex space-x-2 overflow-x-auto pt-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'ALL' ? 'bg-navy-800 text-white' : 'bg-slate-100 text-textSecondary hover:text-textPrimary'
              }`}
            >
              All Items
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === c.name ? 'bg-navy-800 text-white' : 'bg-slate-100 text-textSecondary hover:text-textPrimary'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
          {filteredProducts.map((p) => {
            const hasStock = parseFloat(p.current_stock) > 0;
            return (
              <button
                key={p.id}
                disabled={!hasStock}
                onClick={() => handleAddToCart(p)}
                className={`text-left p-3.5 bg-surface rounded-cfecc border border-borderLine shadow-subtle hover:border-primary hover:shadow-elevated transition-all flex flex-col justify-between ${
                  !hasStock ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div>
                  <div className="text-[10px] text-textSecondary font-mono uppercase">{p.item_code}</div>
                  <div className="text-xs font-bold text-navy-800 line-clamp-2 mt-0.5 leading-snug">{p.name}</div>
                  <div className="text-[10px] text-textSecondary mt-1">
                    Stock: <span className="font-semibold text-textPrimary">{parseFloat(p.current_stock)} {p.unit_code}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-borderLine flex items-center justify-between w-full">
                  <div>
                    {selectedEmployee ? (
                      <div>
                        <div className="text-[10px] text-primary font-semibold">Staff Rate</div>
                        <div className="text-xs font-bold text-primary tabular-nums">
                          ₹{parseFloat(p.employee_price).toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] text-textSecondary">Price</div>
                        <div className="text-xs font-bold text-navy-800 tabular-nums">
                          ₹{parseFloat(p.selling_price).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="p-1 rounded bg-slate-100 hover:bg-primary hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT SECTION (Col 5): Employee Selection & Cart Checkout */}
      <div className="lg:col-span-5 bg-surface rounded-cfecc border border-borderLine shadow-subtle p-5 space-y-4">
        {/* Employee Selection */}
        <div>
          <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-1.5">
            1. Select Employee / Credit Account
          </label>
          {selectedEmployee ? (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-1.5 font-bold text-navy-800 text-xs">
                  <span>{selectedEmployee.name}</span>
                  <span className="text-[11px] text-textSecondary">({selectedEmployee.employeeCode})</span>
                </div>
                <div className="text-[11px] text-textSecondary mt-0.5 flex items-center space-x-3">
                  <span>Limit: ₹{selectedEmployee.creditLimit}</span>
                  <span>&bull;</span>
                  <span className="text-emerald-700 font-semibold">Available: ₹{selectedEmployee.availableCredit}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1 text-slate-400 hover:text-status-danger transition-colors"
                title="Change Employee"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <User className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee by code, name, mobile..."
                value={employeeQuery}
                onChange={(e) => handleEmployeeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
              />
              {/* Autocomplete Dropdown */}
              {employeeSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface border border-borderLine rounded-lg shadow-elevated divide-y divide-borderLine max-h-48 overflow-y-auto">
                  {employeeSuggestions.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-navy-800">{emp.name} ({emp.employeeCode})</div>
                        <div className="text-[11px] text-textSecondary">{emp.department} &bull; {emp.mobile}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-emerald-700 font-semibold">Available Credit</div>
                        <div className="font-bold text-emerald-700 tabular-nums">₹{emp.availableCredit}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shopping Cart List */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-borderLine">
            <span className="text-[11px] font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-primary" />
              <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
            </span>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] text-status-danger font-semibold hover:underline"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div className="divide-y divide-borderLine max-h-60 overflow-y-auto mt-2 pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-textSecondary">
                <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <div>Scan a barcode or click items to add to cart.</div>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.itemId} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="max-w-[170px]">
                    <div className="font-bold text-navy-800 truncate">{item.name}</div>
                    <div className="text-[11px] text-textSecondary tabular-nums">
                      ₹{item.unitPrice.toFixed(2)} / {item.unitCode}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.itemId, -1)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-textPrimary"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold tabular-nums w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.itemId, 1)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-textPrimary"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-navy-800 tabular-nums">
                      ₹{(item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeItem(item.itemId)}
                      className="text-[10px] text-slate-400 hover:text-status-danger transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calculation Totals */}
        <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs">
          <div className="flex justify-between text-textSecondary">
            <span>Subtotal</span>
            <span className="font-medium text-navy-800 tabular-nums">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-textSecondary">
            <span>Applicable Taxes (GST)</span>
            <span className="font-medium text-navy-800 tabular-nums">₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-navy-800 pt-1.5 border-t border-borderLine">
            <span>Net Payable Total</span>
            <span className="text-base text-primary tabular-nums">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Tender Selection */}
        <div>
          <label className="block text-[11px] font-bold text-navy-800 uppercase tracking-wider mb-2">
            Payment Mode
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPaymentMode('EMPLOYEE_CREDIT')}
              className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center space-y-1 transition-all ${
                paymentMode === 'EMPLOYEE_CREDIT'
                  ? 'bg-blue-50 border-primary text-primary shadow-sm'
                  : 'border-borderLine text-textSecondary hover:bg-slate-50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-[11px]">Monthly Credit</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('UPI')}
              className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center space-y-1 transition-all ${
                paymentMode === 'UPI'
                  ? 'bg-blue-50 border-primary text-primary shadow-sm'
                  : 'border-borderLine text-textSecondary hover:bg-slate-50'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span className="text-[11px]">UPI Payment</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('CASH')}
              className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center space-y-1 transition-all ${
                paymentMode === 'CASH'
                  ? 'bg-blue-50 border-primary text-primary shadow-sm'
                  : 'border-borderLine text-textSecondary hover:bg-slate-50'
              }`}
            >
              <IndianRupee className="w-4 h-4" />
              <span className="text-[11px]">Cash Tender</span>
            </button>
          </div>
        </div>

        {checkoutError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-lg flex items-start space-x-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{checkoutError}</span>
          </div>
        )}

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || isCheckingOut}
          className="w-full py-3 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-subtle hover:shadow-elevated transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isCheckingOut ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Complete Sale &bull; ₹{grandTotal.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>

      {/* Invoice Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="CFECC Stores &bull; Sales Invoice Receipt"
        subtitle="Official tax invoice and customer credit receipt"
        maxWidth="md"
      >
        {completedSale && (
          <div className="space-y-4 text-xs">
            {/* Paper Size selector (no-print) */}
            <div className="no-print flex items-center justify-between pb-2 border-b border-borderLine">
              <span className="text-textSecondary text-[11px] font-semibold">Thermal Paper Roll Width:</span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setThermalSize('80mm')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    thermalSize === '80mm' ? 'bg-navy-800 text-white shadow-sm' : 'bg-slate-100 text-textSecondary hover:bg-slate-200'
                  }`}
                >
                  80mm Standard
                </button>
                <button
                  type="button"
                  onClick={() => setThermalSize('58mm')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    thermalSize === '58mm' ? 'bg-navy-800 text-white shadow-sm' : 'bg-slate-100 text-textSecondary hover:bg-slate-200'
                  }`}
                >
                  58mm Compact
                </button>
              </div>
            </div>

            {/* Printable Thermal Receipt Container */}
            <div
              id="printable-receipt"
              className={`space-y-3 font-mono border border-dashed border-slate-300 p-4 rounded-lg bg-white mx-auto shadow-sm ${
                thermalSize === '58mm' ? 'thermal-58mm max-w-[280px] text-[10px]' : 'max-w-[340px] text-[11px]'
              }`}
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <h4 className="font-bold text-sm tracking-wide text-black uppercase">CFECC STORES</h4>
                <p className="text-[10px] text-black">Employee Consumer Cooperative Society</p>
                <p className="text-[10px] text-black">Visakhapatnam, Andhra Pradesh</p>
                <p className="text-[10px] font-bold text-black mt-0.5">GSTIN: 37AAAAA0000A1Z5</p>
              </div>

              <div className="space-y-1 text-black text-[10px] sm:text-[11px]">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold">{completedSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date & Time:</span>
                  <span>{new Date(completedSale.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold truncate max-w-[170px]">{completedSale.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-bold uppercase">{completedSale.paymentMode}</span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
                <div className="flex justify-between font-bold text-[10px] text-black border-b border-dotted pb-0.5">
                  <span className="w-1/2">ITEM</span>
                  <span className="w-1/4 text-center">QTY</span>
                  <span className="w-1/4 text-right">AMT</span>
                </div>
                {completedSale.items?.map((item: any) => (
                  <div key={item.itemId} className="flex justify-between text-black text-[10px] sm:text-[11px]">
                    <span className="w-1/2 truncate font-medium">{item.name}</span>
                    <span className="w-1/4 text-center">{item.quantity}</span>
                    <span className="w-1/4 text-right">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-black text-[10px] sm:text-[11px]">
                <div className="flex justify-between">
                  <span>Items Count:</span>
                  <span>{completedSale.items?.length || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(completedSale.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST / SGST (Tax):</span>
                  <span>₹{parseFloat(completedSale.taxAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-black pt-1 border-t border-dashed border-slate-400">
                  <span>NET TOTAL:</span>
                  <span>₹{parseFloat(completedSale.totalAmount).toFixed(2)}</span>
                </div>
              </div>

              {completedSale.employee && completedSale.paymentMode === 'EMPLOYEE_CREDIT' && (
                <div className="border-t border-dotted border-slate-400 pt-1 text-[10px] text-black space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span>Store Credit Outstanding:</span>
                    <span>₹{parseFloat((completedSale.employee.current_outstanding || 0).toString()).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-black">
                    <span>Available Credit Limit:</span>
                    <span>₹{parseFloat((completedSale.employee.available_credit || 0).toString()).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="text-center pt-2 flex flex-col items-center">
                <BarcodeSvg value={completedSale.invoiceNumber} height={32} barWidth={1.2} showText={true} />
                <p className="text-[9px] text-black mt-1 font-sans font-medium">
                  *** Thank You &bull; Visit Again ***
                </p>
                <p className="text-[8px] text-slate-600 font-sans">Goods returnable within 7 days with bill</p>
              </div>
            </div>

            {/* WhatsApp Receipt Dispatch via Meta Cloud API (no-print) */}
            <div className="no-print bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 space-y-1.5 font-sans">
              <div className="flex items-center justify-between text-emerald-950">
                <span className="font-bold flex items-center space-x-1.5 text-[11px]">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Send WhatsApp e-Receipt (Meta Cloud API)</span>
                </span>
                {waSentStatus && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                    {waSentStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="e.g. 9848022338 or +919848022338"
                  value={waPhoneInput}
                  onChange={(e) => setWaPhoneInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-emerald-300 rounded-md bg-white font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendWhatsAppReceipt}
                  disabled={waSending || !waPhoneInput.trim()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center space-x-1 disabled:opacity-50 transition-colors shadow-subtle"
                >
                  <Send className="w-3 h-3" />
                  <span>{waSending ? 'Sending...' : 'Send WhatsApp'}</span>
                </button>
              </div>
            </div>

            {/* Modal Controls (no-print) */}
            <div className="no-print flex space-x-2 pt-2 border-t border-borderLine font-sans">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs shadow-subtle transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal Receipt ({thermalSize})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-borderLine font-semibold text-xs text-textSecondary hover:bg-slate-50 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 1. Open Shift / Start Register Modal */}
      <Modal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        title="Open Cash Register / Start Shift"
        subtitle="Initialize opening cash drawer float to begin sales tracking"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs font-sans">
          {shiftError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {shiftError}
            </div>
          )}

          <div>
            <label className="block font-bold text-navy-800 uppercase text-[11px] mb-1">
              Opening Cash Float (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newOpeningFloat}
                onChange={(e) => setNewOpeningFloat(e.target.value)}
                placeholder="2000.00"
                className="w-full pl-8 pr-3 py-2 border border-borderLine rounded-lg bg-slate-50 font-bold text-sm focus:bg-white focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-textSecondary mt-1">
              Physical cash amount placed in the cash drawer at the start of the day.
            </p>
          </div>

          <div>
            <label className="block font-bold text-navy-800 uppercase text-[11px] mb-1">
              Terminal Workstation
            </label>
            <input
              type="text"
              disabled
              value="POS-01 (Main Billing Counter)"
              className="w-full p-2 border border-borderLine rounded-lg bg-slate-100 font-medium text-slate-700 cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(false)}
              className="px-4 py-2 border border-borderLine rounded-lg text-textSecondary font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={shiftOperating}
              onClick={handleOpenShift}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-subtle disabled:opacity-50 transition-colors"
            >
              {shiftOperating ? 'Opening...' : 'Start Shift & Open Register'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Close Shift / EOD Register Closure Modal */}
      <Modal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        title={`Close Register & End Shift: #${activeShift?.shiftNumber || ''}`}
        subtitle="Count physical drawer cash and reconcile shift turnover against payment modes"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs font-sans">
          {shiftError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {shiftError}
            </div>
          )}

          {activeShift && (() => {
            const expCash = (activeShift.liveMetrics?.expectedCash || activeShift.openingFloat);
            const counted = parseFloat(closingCashCountedInput) || 0;
            const variance = counted - expCash;
            const isBalanced = Math.abs(variance) < 0.01;

            return (
              <>
                {/* 3 Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-borderLine rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-textSecondary">Cash in Drawer</div>
                    <div className="mt-1 text-base font-black text-navy-800">
                      ₹{expCash.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-textSecondary mt-0.5">
                      Float: ₹{activeShift.openingFloat.toFixed(2)} + Sales: ₹{(activeShift.liveMetrics?.cashSales || 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-borderLine rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-textSecondary">Non-Cash Sales</div>
                    <div className="mt-1 text-base font-black text-slate-800">
                      ₹{((activeShift.liveMetrics?.upiSales || 0) + (activeShift.liveMetrics?.creditSales || 0)).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-textSecondary mt-0.5">
                      UPI: ₹{(activeShift.liveMetrics?.upiSales || 0).toFixed(2)} | Credit: ₹{(activeShift.liveMetrics?.creditSales || 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
                    <div className="text-[10px] uppercase font-bold text-primary">Shift Turnover</div>
                    <div className="mt-1 text-base font-black text-primary">
                      ₹{(activeShift.liveMetrics?.totalSales || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-blue-700 mt-0.5">
                      {activeShift.liveMetrics?.totalTransactions || 0} bills completed
                    </div>
                  </div>
                </div>

                {/* Cash Counting & Variance Calculation */}
                <div className="p-3.5 bg-slate-50 border border-borderLine rounded-lg space-y-3">
                  <div>
                    <label className="block font-bold text-navy-800 uppercase text-[11px] mb-1">
                      Physically Counted Drawer Cash (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={closingCashCountedInput}
                        onChange={(e) => setClosingCashCountedInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 border border-borderLine rounded-lg bg-white font-bold text-base text-navy-800 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Real-time Variance Badge */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-semibold ${
                      isBalanced
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : variance > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <span>
                      {isBalanced
                        ? 'Cash drawer is balanced.'
                        : variance > 0
                        ? 'Cash surplus detected.'
                        : 'Cash shortage detected.'}
                    </span>
                    <span className="font-bold">
                      Variance: {variance >= 0 ? `+₹${variance.toFixed(2)}` : `-₹${Math.abs(variance).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {/* Closing Notes */}
                <div>
                  <label className="block font-bold text-navy-800 uppercase text-[11px] mb-1">
                    Supervisor / Cashier Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={closingNotesInput}
                    onChange={(e) => setClosingNotesInput(e.target.value)}
                    placeholder="Enter any variance explanation, shift handover notes..."
                    className="w-full p-2 border border-borderLine rounded-lg bg-slate-50 text-xs focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-borderLine">
                  <button
                    type="button"
                    onClick={() => setIsCloseShiftModalOpen(false)}
                    className="px-4 py-2 border border-borderLine rounded-lg text-textSecondary font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={shiftOperating || !closingCashCountedInput}
                    onClick={handleCloseShift}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-subtle disabled:opacity-50 transition-colors"
                  >
                    {shiftOperating ? 'Closing...' : 'Close Shift & Generate Z-Report'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* 3. Z-Report Thermal Slip Modal */}
      <Modal
        isOpen={isZReportModalOpen}
        onClose={() => setIsZReportModalOpen(false)}
        title="End-of-Day (EOD) Z-Report"
        subtitle="Final register closure summary with audit breakdown"
        maxWidth="md"
      >
        {zReportData && (
          <div className="space-y-4">
            {/* Format toggle (no-print) */}
            <div className="no-print flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-borderLine">
              <span className="text-xs font-semibold text-textSecondary">Paper Width:</span>
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => setThermalSize('80mm')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    thermalSize === '80mm' ? 'bg-primary text-white shadow-sm' : 'bg-white text-textSecondary hover:bg-slate-100'
                  }`}
                >
                  80mm Standard
                </button>
                <button
                  type="button"
                  onClick={() => setThermalSize('58mm')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    thermalSize === '58mm' ? 'bg-primary text-white shadow-sm' : 'bg-white text-textSecondary hover:bg-slate-100'
                  }`}
                >
                  58mm Compact
                </button>
              </div>
            </div>

            {/* Printable Thermal Z-Report */}
            <div
              id="printable-receipt"
              className={`space-y-3 font-mono border border-dashed border-slate-300 p-4 rounded-lg bg-white mx-auto shadow-sm ${
                thermalSize === '58mm' ? 'thermal-58mm max-w-[280px] text-[10px]' : 'max-w-[340px] text-[11px]'
              }`}
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <h4 className="font-bold text-sm tracking-wide text-black uppercase">CFECC STORES</h4>
                <p className="text-[10px] text-black">Employee Consumer Cooperative Society</p>
                <p className="text-[10px] text-black">Visakhapatnam, Andhra Pradesh</p>
                <p className="text-[11px] font-black text-black mt-1 uppercase tracking-wider">
                  *** EOD REGISTER Z-REPORT ***
                </p>
              </div>

              {/* Shift details */}
              <div className="space-y-1 text-black text-[10px] sm:text-[11px]">
                <div className="flex justify-between">
                  <span>Shift Number:</span>
                  <span className="font-bold">{zReportData.shift.shiftNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal:</span>
                  <span className="font-bold">{zReportData.shift.terminalId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span className="font-bold">{zReportData.shift.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Opened:</span>
                  <span>{new Date(zReportData.shift.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Closed:</span>
                  <span>{new Date(zReportData.shift.endTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              </div>

              {/* Cash Drawer Reconciliation */}
              <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1 text-black text-[10px] sm:text-[11px]">
                <div className="font-bold text-[10px] uppercase text-black pb-0.5 border-b border-dotted">
                  DRAWER CASH RECONCILIATION
                </div>
                <div className="flex justify-between">
                  <span>Opening Cash Float:</span>
                  <span>₹{zReportData.shift.openingFloat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Cash Sales:</span>
                  <span>₹{zReportData.shift.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-0.5 border-t border-dotted">
                  <span>= Expected Cash:</span>
                  <span>₹{zReportData.shift.expectedCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Actual Counted Cash:</span>
                  <span>₹{zReportData.shift.closingCashCounted.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black pt-1 border-t border-dashed border-slate-400 text-sm">
                  <span>VARIANCE:</span>
                  <span>
                    {zReportData.shift.cashVariance >= 0
                      ? `+₹${zReportData.shift.cashVariance.toFixed(2)}`
                      : `-₹${Math.abs(zReportData.shift.cashVariance).toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-1 text-black text-[10px] sm:text-[11px]">
                <div className="font-bold text-[10px] uppercase text-black pb-0.5 border-b border-dotted">
                  COLLECTION BY PAYMENT MODE
                </div>
                <div className="flex justify-between">
                  <span>Cash Inflow:</span>
                  <span>₹{zReportData.shift.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>UPI / QR Inflow:</span>
                  <span>₹{zReportData.shift.upiSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Member Store Credit:</span>
                  <span>₹{zReportData.shift.creditSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-black pt-1 border-t border-dashed border-slate-400">
                  <span>GROSS TURNOVER:</span>
                  <span>₹{zReportData.shift.totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Total Invoices Generated:</span>
                  <span className="font-bold">{zReportData.shift.totalTransactions}</span>
                </div>
              </div>

              {/* Category Breakdown */}
              {zReportData.categoryBreakdown?.length > 0 && (
                <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-1 text-black text-[10px] sm:text-[11px]">
                  <div className="font-bold text-[10px] uppercase text-black pb-0.5 border-b border-dotted">
                    SALES BY COMMODITY CATEGORY
                  </div>
                  {zReportData.categoryBreakdown.map((c: any) => (
                    <div key={c.category} className="flex justify-between">
                      <span className="truncate max-w-[170px]">{c.category} ({c.itemCount})</span>
                      <span>₹{c.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-4 pb-2 border-t border-dashed border-slate-400 space-y-4 text-[9px] text-black">
                <div className="flex justify-between pt-3">
                  <div>Cashier Signature</div>
                  <div>Supervisor Signature</div>
                </div>
                <p className="text-center text-[8px] text-slate-500 font-sans">
                  Printed on {new Date().toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Modal Controls (no-print) */}
            <div className="no-print flex space-x-2 pt-2 border-t border-borderLine font-sans">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-white font-semibold text-xs shadow-subtle transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Z-Report Slip ({thermalSize})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZReportModalOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-borderLine font-semibold text-xs text-textSecondary hover:bg-slate-50 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

