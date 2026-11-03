import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Trash2,
  Sparkles,
  Calculator,
  ArrowRight,
  LogOut,
  Maximize2,
  Minimize2,
  Store,
  Clock,
  Check,
} from 'lucide-react';

interface CartItem {
  itemId: number;
  itemCode: string;
  name: string;
  unitCode: string;
  unitPrice: number;
  employeePrice: number;
  sellingPrice: number;
  quantity: number;
  taxRate: number;
  currentStock: number;
}

export const POSTerminalPage: React.FC = () => {
  const navigate = useNavigate();

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
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [justScannedCode, setJustScannedCode] = useState<string | null>(null);

  // Live Terminal Clock & Fullscreen State
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [waSending, setWaSending] = useState<boolean>(false);
  const [waSentStatus, setWaSentStatus] = useState<string | null>(null);
  const [waPhoneInput, setWaPhoneInput] = useState<string>('');
  const [thermalSize, setThermalSize] = useState<'80mm' | '58mm'>('80mm');

  // Shift Management & Register Closure States
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [_isShiftLoading, setIsShiftLoading] = useState<boolean>(true);
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

  // Live Clock Interval
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
          ' \u2022 ' +
          now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchInitialCatalog();
    fetchActiveShift();
    // Auto focus barcode input on boot
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 400);
  }, []);

  // Keyboard Shortcuts Listener (F2: Barcode, F4: Payment Mode, Ctrl+Enter: Checkout, Esc: Exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setPaymentMode((prev) => {
          if (prev === 'EMPLOYEE_CREDIT') return 'UPI';
          if (prev === 'UPI') return 'CASH';
          return 'EMPLOYEE_CREDIT';
        });
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0 && !isCheckingOut) {
          handleCheckout();
        }
      } else if (e.key === 'Escape') {
        if (!isReceiptModalOpen && !isOpenShiftModalOpen && !isCloseShiftModalOpen && !isZReportModalOpen) {
          if (employeeSuggestions.length > 0) {
            setEmployeeSuggestions([]);
          } else if (cart.length === 0) {
            handleExitPos();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckingOut, paymentMode, selectedEmployee, employeeSuggestions, isReceiptModalOpen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleExitPos = () => {
    if (cart.length > 0) {
      const confirmExit = window.confirm(
        `Cart has ${cart.reduce((s, i) => s + i.quantity, 0)} item(s) worth ₹${grandTotal.toFixed(
          2
        )}.\n\nAre you sure you want to exit the POS cashier terminal?`
      );
      if (!confirmExit) return;
    }
    navigate('/dashboard');
  };

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

    // Recalculate cart item prices to staff subsidized rates
    setCart((prev) =>
      prev.map((c) => ({
        ...c,
        unitPrice: c.employeePrice,
      }))
    );
  };

  const handleClearEmployee = () => {
    setSelectedEmployee(null);
    if (paymentMode === 'EMPLOYEE_CREDIT') {
      setPaymentMode('CASH');
    }
    // Revert cart item prices to standard selling prices
    setCart((prev) =>
      prev.map((c) => ({
        ...c,
        unitPrice: c.sellingPrice,
      }))
    );
  };

  // Add Item to Cart
  const handleAddToCart = (product: any) => {
    setCheckoutError(null);
    const existing = cart.find((c) => c.itemId === product.id);

    const effectivePrice = selectedEmployee
      ? parseFloat(product.employee_price)
      : parseFloat(product.selling_price);

    if (existing) {
      setCart(
        cart.map((c) =>
          c.itemId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
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
          sellingPrice: parseFloat(product.selling_price),
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
      const code = barcodeInput.trim();
      const res = await api.get(`/pos/lookup-item?barcode=${encodeURIComponent(code)}`);
      if (res.data.success && res.data.items.length > 0) {
        handleAddToCart(res.data.items[0]);
        setJustScannedCode(code);
        setTimeout(() => setJustScannedCode(null), 1500);
        setBarcodeInput('');
      } else {
        setCheckoutError(`Item with barcode '${code}' not found.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(
      cart
        .map((c) => {
          if (c.itemId === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (itemId: number) => {
    setCart(cart.filter((c) => c.itemId !== itemId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalTax = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity * (item.taxRate / 100), 0);
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
  const totalItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Cash Change Return calculation
  const tenderedNumeric = parseFloat(cashTendered) || 0;
  const changeToReturn = Math.max(0, tenderedNumeric - grandTotal);

  // Credit validation: check if order exceeds available credit
  const availableCreditNum = selectedEmployee ? parseFloat(selectedEmployee.availableCredit || 0) : 0;
  const isCreditExceeded = paymentMode === 'EMPLOYEE_CREDIT' && selectedEmployee && grandTotal > availableCreditNum;

  // Checkout execution
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (isCreditExceeded) {
      setCheckoutError(
        `Order total (₹${grandTotal.toFixed(2)}) exceeds available credit limit (₹${availableCreditNum.toFixed(2)}).`
      );
      return;
    }

    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const payload = {
        employeeId: selectedEmployee?.id || null,
        customerName: selectedEmployee ? `${selectedEmployee.name}` : 'Walk-in Customer',
        customerMobile: selectedEmployee?.mobile || null,
        paymentMode,
        items: cart.map((c) => ({
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
        // Reset Cart & Tender
        setCart([]);
        setSelectedEmployee(null);
        setCashTendered('');
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
  const filteredProducts = items.filter((itm) => {
    const matchesCat = selectedCategory === 'ALL' || itm.category_name === selectedCategory;
    const matchesSearch =
      !itemSearch ||
      itm.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      itm.item_code.toLowerCase().includes(itemSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-100 flex flex-col z-50 overflow-hidden font-sans select-none">
      {/* 1. TOP DEDICATED POS TERMINAL COMMAND BAR */}
      <header className="h-14 bg-navy-900 border-b border-navy-800 text-white px-4 flex items-center justify-between shrink-0 shadow-md">
        {/* Left: Branding, Station & Live Clock */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-400">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wider uppercase flex items-center space-x-1.5">
                <span>CFECC STORES</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-primary text-white">
                  TERMINAL {activeShift?.terminalId || 'POS-01'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Consumer Cooperative Society Ltd
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-300 font-mono bg-navy-800/80 px-2.5 py-1 rounded-md border border-navy-700/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>
        </div>

        {/* Center: Shift & Live Drawer Cash */}
        <div className="hidden lg:flex items-center space-x-3 text-xs">
          {activeShift ? (
            <div className="flex items-center space-x-2.5 bg-navy-800/90 px-3 py-1.5 rounded-lg border border-navy-700">
              <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>SHIFT #{activeShift.shiftNumber}</span>
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-200">
                Cashier: <strong className="text-white">{activeShift.cashierName || 'Rajesh Varma'}</strong>
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-200">
                Drawer: <strong className="text-emerald-300 font-mono">₹{(activeShift.liveMetrics?.expectedCash || activeShift.openingFloat).toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-200">
                Sales: <strong className="text-amber-300 font-mono">₹{(activeShift.liveMetrics?.totalSales || 0).toFixed(2)}</strong> ({activeShift.liveMetrics?.totalTransactions || 0} bills)
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-lg text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Register Drawer Closed</span>
            </div>
          )}
        </div>

        {/* Right: Actions, Fullscreen & Exit POS Button */}
        <div className="flex items-center space-x-2">
          {activeShift ? (
            <button
              type="button"
              onClick={() => {
                setClosingCashCountedInput(
                  (activeShift.liveMetrics?.expectedCash || activeShift.openingFloat).toFixed(2)
                );
                setClosingNotesInput('');
                setShiftError(null);
                setIsCloseShiftModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 hover:text-white border border-navy-700 text-xs font-semibold transition-colors"
              title="Close shift and print EOD Z-Report"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Close Shift</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShiftError(null);
                setNewOpeningFloat('2000');
                setIsOpenShiftModalOpen(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Open Register</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white border border-navy-700 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Prominent EXIT POS Button */}
          <button
            type="button"
            onClick={handleExitPos}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            title="Exit POS Terminal and return to Back-Office Dashboard [Esc]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit POS</span>
            <span className="text-[10px] text-white/70 font-mono hidden sm:inline">[Esc]</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN POS WORKSPACE: FULL-HEIGHT DUAL PANE */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* LEFT PANE: PRODUCT DISCOVERY, BARCODE SCANNER & CATALOG GRID (7 COLS / 8 COLS ON XL) */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden">
          {/* Barcode & Search Controls */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Barcode Quick Scan */}
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <Barcode
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                    justScannedCode ? 'text-emerald-500 animate-bounce' : 'text-primary'
                  }`}
                />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan Barcode [F2] &bull; Press Enter..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className={`w-full pl-9 pr-8 py-2 text-xs rounded-lg font-mono transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                    justScannedCode
                      ? 'bg-emerald-50 border-2 border-emerald-400 text-emerald-900 font-bold'
                      : 'bg-white border border-slate-300 focus:bg-white text-navy-800'
                  }`}
                />
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={() => setBarcodeInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Product Name Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter items by name, category or code..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-navy-800"
                />
                {itemSearch && (
                  <button
                    type="button"
                    onClick={() => setItemSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  selectedCategory === 'ALL'
                    ? 'bg-navy-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-navy-800 border border-slate-200'
                }`}
              >
                <span>All Commodities</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 font-mono">
                  {items.length}
                </span>
              </button>
              {categories.map((c) => {
                const count = items.filter((i) => i.category_id === c.id || i.category_name === c.name).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                      selectedCategory === c.name
                        ? 'bg-navy-800 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-navy-800 border border-slate-200'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Cards Grid with Fast-Scroll */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((p) => {
                const stock = parseFloat(p.current_stock || '0');
                const minStock = parseFloat(p.min_stock || '0');
                const hasStock = stock > 0;
                const isLow = hasStock && stock <= minStock;
                const cartItem = cart.find((c) => c.itemId === p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!hasStock}
                    onClick={() => handleAddToCart(p)}
                    className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between group relative ${
                      cartItem
                        ? 'border-primary ring-2 ring-primary/40 bg-blue-50/30 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-primary/80 hover:shadow-md'
                    } ${!hasStock ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    {/* In-cart count badge */}
                    {cartItem && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white flex items-center space-x-1 shadow-xs">
                        <Check className="w-3 h-3" />
                        <span>{cartItem.quantity} in cart</span>
                      </span>
                    )}

                    <div>
                      <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400 uppercase">
                        <span>{p.item_code}</span>
                      </div>

                      <div className="text-xs font-bold text-navy-800 line-clamp-2 mt-0.5 leading-snug group-hover:text-primary transition-colors">
                        {p.name}
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1 flex items-center space-x-1">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            !hasStock ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        <span>
                          Stock: <strong className={isLow ? 'text-amber-700' : 'text-slate-700'}>{stock} {p.unit_code}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                      <div>
                        {selectedEmployee ? (
                          <div>
                            <span className="text-[9px] font-bold text-emerald-800 uppercase flex items-center space-x-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Staff Subsidy</span>
                            </span>
                            <div className="text-sm font-black text-emerald-700 font-mono">
                              ₹{parseFloat(p.employee_price).toFixed(2)}
                            </div>
                            <span className="text-[9px] text-slate-400 line-through font-mono">
                              ₹{parseFloat(p.selling_price).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-medium">Price</span>
                            <div className="text-sm font-black text-navy-800 font-mono">
                              ₹{parseFloat(p.selling_price).toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-1 rounded-lg bg-slate-100 group-hover:bg-primary group-hover:text-white text-navy-800 transition-colors shadow-2xs">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: ORDER CART & CASHIER CHECKOUT DESK (5 COLS / 4 COLS ON XL) */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden">
          {/* Top: Customer Account Selector */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Customer Account</span>
              </label>
              {selectedEmployee ? (
                <button
                  type="button"
                  onClick={handleClearEmployee}
                  className="text-[10px] text-rose-600 font-semibold hover:underline"
                >
                  Switch to Walk-in
                </button>
              ) : (
                <span className="text-[10px] text-slate-500 font-medium">
                  Walk-in Retail Customer
                </span>
              )}
            </div>

            {selectedEmployee ? (
              <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-navy-800 text-xs">
                      {selectedEmployee.name}{' '}
                      <span className="font-mono text-primary font-bold">({selectedEmployee.employeeCode})</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {selectedEmployee.department || 'Operations'} &bull; {selectedEmployee.mobile}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearEmployee}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Available Store Credit Meter */}
                <div className="text-[11px] space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-600">Available Credit:</span>
                    <span className="font-mono text-emerald-800 font-bold">
                      ₹{parseFloat(selectedEmployee.availableCredit || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200/70 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          ((parseFloat(selectedEmployee.currentOutstanding || 0) + grandTotal) /
                            (parseFloat(selectedEmployee.creditLimit || 1) || 1)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Lookup Employee (Name, Code, Phone)..."
                  value={employeeQuery}
                  onChange={(e) => handleEmployeeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-navy-800"
                />
                {employeeSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {employeeSuggestions.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleSelectEmployee(emp)}
                        className="w-full text-left p-2 hover:bg-blue-50/70 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-navy-800">
                            {emp.name} <span className="font-mono text-primary font-normal">({emp.employeeCode})</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {emp.department} &bull; {emp.mobile}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-emerald-700 font-bold uppercase">Credit Avail.</div>
                          <div className="font-bold text-emerald-700 font-mono">
                            ₹{parseFloat(emp.availableCredit || 0).toFixed(2)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Middle: Cart Items List (Scrollable Area) */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="text-[11px] font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                  <span>Order Items ({totalItemsCount})</span>
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-600 font-semibold hover:underline flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1 mt-1">
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 space-y-1">
                    <Package className="w-9 h-9 mx-auto text-slate-300" />
                    <div className="font-bold text-slate-700 text-xs">Cart is currently empty</div>
                    <div className="text-[11px]">Scan barcode or tap any product to add</div>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.itemId} className="py-2 flex items-center justify-between text-xs group">
                      <div className="max-w-[150px]">
                        <div className="font-bold text-navy-800 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                          <span>₹{item.unitPrice.toFixed(2)} / {item.unitCode}</span>
                          {selectedEmployee && (
                            <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                              Staff
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.itemId, -1)}
                          className="p-1 rounded bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold font-mono tabular-nums w-6 text-center text-navy-800 text-xs">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.itemId, 1)}
                          className="p-1 rounded bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Total & Remove */}
                      <div className="text-right">
                        <div className="font-bold font-mono text-navy-800">
                          ₹{(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.itemId)}
                          className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom: Tender Selection, Change Calculator & Checkout Action */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2.5">
            {/* Calculation Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Subtotal</span>
                <span className="font-mono text-slate-800 font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Taxes (GST)</span>
                <span className="font-mono text-slate-800 font-medium">₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-navy-800 pt-1 border-t border-slate-200">
                <span className="uppercase text-xs tracking-wider">Net Amount Due</span>
                <span className="text-xl font-black font-mono text-primary">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode Selector [F4] */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Tender Mode [F4]
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMode('EMPLOYEE_CREDIT')}
                  className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center space-y-0.5 transition-all ${
                    paymentMode === 'EMPLOYEE_CREDIT'
                      ? 'bg-blue-50 border-primary text-primary shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Monthly Credit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center space-y-0.5 transition-all ${
                    paymentMode === 'UPI'
                      ? 'bg-blue-50 border-primary text-primary shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="text-[10px]">UPI / QR Pay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`p-2 rounded-lg border font-semibold flex flex-col items-center justify-center space-y-0.5 transition-all ${
                    paymentMode === 'CASH'
                      ? 'bg-blue-50 border-primary text-primary shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Cash Tender</span>
                </button>
              </div>
            </div>

            {/* Cash Drawer Calculator (shown when CASH is selected) */}
            {paymentMode === 'CASH' && (
              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-amber-900 font-bold text-[11px]">
                  <span className="flex items-center space-x-1">
                    <Calculator className="w-3.5 h-3.5 text-amber-700" />
                    <span>Change Calculator</span>
                  </span>
                  <div className="flex space-x-1">
                    {[grandTotal, 100, 200, 500, 1000, 2000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashTendered(preset.toString())}
                        className="px-1.5 py-0.5 rounded bg-white border border-amber-300 font-mono font-bold text-[10px] text-amber-900 hover:bg-amber-100"
                      >
                        ₹{preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-amber-900">Cash Received</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full px-2 py-1 border border-amber-300 rounded font-mono font-bold text-xs bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-emerald-900">Return Change</label>
                    <div className="px-2 py-1 border border-emerald-300 rounded font-mono font-bold text-xs bg-emerald-100/70 text-emerald-900">
                      ₹{changeToReturn.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Exceeded Warning */}
            {isCreditExceeded && (
              <div className="p-2 bg-rose-50 border border-rose-300 text-rose-800 text-[11px] rounded-lg flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>
                  Order (₹{grandTotal.toFixed(2)}) exceeds available credit of ₹{availableCreditNum.toFixed(2)}. Switch tender to Cash or UPI.
                </span>
              </div>
            )}

            {checkoutError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-lg flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Complete Checkout Button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCheckingOut || isCreditExceeded}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 active:scale-[0.99]"
            >
              {isCheckingOut ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>COMPLETE SALE &bull; ₹{grandTotal.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            {/* Keyboard Shortcuts Helper Bar */}
            <div className="pt-1 flex items-center justify-center space-x-3 text-[10px] text-slate-400 font-mono">
              <span>[F2] Barcode</span>
              <span>&bull;</span>
              <span>[F4] Mode</span>
              <span>&bull;</span>
              <span>[Ctrl+Enter] Bill</span>
              <span>&bull;</span>
              <span>[Esc] Exit</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODALS: THERMAL RECEIPT, OPEN SHIFT, CLOSE SHIFT, Z-REPORT */}

      {/* Invoice Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="CFECC Stores &bull; Sales Invoice Receipt"
        subtitle="Official tax invoice and customer credit receipt"
        maxWidth="md"
      >
        {completedSale && (
          <div className="space-y-4 text-xs font-sans">
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
                  <span>
                    {new Date(completedSale.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
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

      {/* Open Shift Modal */}
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

      {/* Close Shift Modal */}
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
            const expCash = activeShift.liveMetrics?.expectedCash || activeShift.openingFloat;
            const counted = parseFloat(closingCashCountedInput) || 0;
            const variance = counted - expCash;
            const isBalanced = Math.abs(variance) < 0.01;

            return (
              <>
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

      {/* Z-Report Thermal Slip Modal */}
      <Modal
        isOpen={isZReportModalOpen}
        onClose={() => setIsZReportModalOpen(false)}
        title="End-of-Day (EOD) Z-Report"
        subtitle="Final register closure summary with audit breakdown"
        maxWidth="md"
      >
        {zReportData && (
          <div className="space-y-4">
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
