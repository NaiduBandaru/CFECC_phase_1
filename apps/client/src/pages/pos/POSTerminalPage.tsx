import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Search,
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
  Calendar,
  LayoutGrid,
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
  imageUrl?: string;
}

export const POSTerminalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Products catalog
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [itemSearch, setItemSearch] = useState<string>('');
  const itemSearchRef = useRef<HTMLInputElement>(null);

  // Selected Employee & Credit info
  const [employeeQuery, setEmployeeQuery] = useState<string>('');
  const [employeeSuggestions, setEmployeeSuggestions] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Cart & Checkout
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'EMPLOYEE_CREDIT' | 'CASH' | 'UPI'>('EMPLOYEE_CREDIT');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [couponAmount, setCouponAmount] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [justScannedCode, setJustScannedCode] = useState<string | null>(null);

  // Live Terminal Clock & Fullscreen State
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [waSending, setWaSending] = useState<boolean>(false);
  const [waSentStatus, setWaSentStatus] = useState<string | null>(null);
  const [waPhoneInput, setWaPhoneInput] = useState<string>('');
  const [thermalSize, setThermalSize] = useState<'80mm' | '58mm' | 'continuous'>('80mm');
  const [quickCodeInput, setQuickCodeInput] = useState<string>('');
  const quickCodeRef = useRef<HTMLInputElement>(null);

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
    // Auto focus rapid code input on boot
    setTimeout(() => {
      quickCodeRef.current?.focus();
    }, 400);
  }, []);

  // Keyboard Shortcuts Listener (F1: 4-Digit Code, F2: Search Products, F4: Payment Mode, Ctrl+Enter: Checkout, Esc: Exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        quickCodeRef.current?.focus();
        quickCodeRef.current?.select();
      } else if (e.key === 'F2') {
        e.preventDefault();
        itemSearchRef.current?.focus();
        itemSearchRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setPaymentMode((prev) => {
          if (prev === 'EMPLOYEE_CREDIT') return 'UPI';
          if (prev === 'UPI') return 'CASH';
          return 'EMPLOYEE_CREDIT';
        });
      } else if (isReceiptModalOpen && e.key === 'Enter') {
        e.preventDefault();
        setIsReceiptModalOpen(false);
        quickCodeRef.current?.focus();
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
    const isCashier = user?.roleCode === 'CASHIER';
    if (cart.length > 0) {
      const confirmExit = window.confirm(
        `Cart has ${cart.reduce((s, i) => s + i.quantity, 0)} item(s) worth ₹${grandTotal.toFixed(
          2
        )}.\n\nAre you sure you want to ${isCashier ? 'sign out of the cashier terminal' : 'exit the POS cashier terminal'}?`
      );
      if (!confirmExit) return;
    }
    if (isCashier) {
      logout();
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
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

  // Live Server Item Search Debounce
  useEffect(() => {
    const trimmed = itemSearch.trim();
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/pos/lookup-item?query=${encodeURIComponent(trimmed)}`);
        if (res.data.success && Array.isArray(res.data.items) && res.data.items.length > 0) {
          setItems((prev) => {
            const existingMap = new Map(prev.map((i) => [i.id, i]));
            for (const itm of res.data.items) {
              existingMap.set(itm.id, itm);
            }
            return Array.from(existingMap.values());
          });
        }
      } catch (err) {
        console.error('Failed to lookup item by search query', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [itemSearch]);

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

  const handleClearEmployee = () => {
    setSelectedEmployee(null);
    setCouponAmount('');
    if (paymentMode === 'EMPLOYEE_CREDIT') {
      setPaymentMode('CASH');
    }
  };

  const handleClearAll = () => {
    setCart([]);
    setCouponAmount('');
    setCashTendered('');
    setCheckoutError(null);
  };

  // Auto-clear coupon if cart becomes empty
  useEffect(() => {
    if (cart.length === 0 && couponAmount !== '') {
      setCouponAmount('');
    }
  }, [cart.length, couponAmount]);

  // Add Item to Cart
  const handleAddToCart = (product: any) => {
    setCheckoutError(null);
    const existing = cart.find((c) => c.itemId === product.id);

    const b1Qty = parseFloat(String((product as any).batch1_qty || 0));
    const b2Qty = parseFloat(String((product as any).batch2_qty || 0));
    const b1Rate = parseFloat(String((product as any).batch1_rate || 0));
    const b2Rate = parseFloat(String((product as any).batch2_rate || 0));
    const baseSelling = parseFloat(String(product.selling_price || 0));
    const activeSellingPrice = b1Qty > 0
      ? (b1Rate > 0 ? b1Rate : baseSelling)
      : b2Qty > 0
        ? (b2Rate > 0 ? b2Rate : baseSelling)
        : baseSelling;

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
          unitPrice: activeSellingPrice,
          employeePrice: activeSellingPrice,
          sellingPrice: activeSellingPrice,
          quantity: 1,
          taxRate: parseFloat(product.tax_rate || '0'),
          currentStock: parseFloat(String((product as any).batch1_qty || 0)) + parseFloat(String((product as any).batch2_qty || 0)),
          imageUrl: product.image_url,
        },
      ]);
    }
  };

  // 4-Digit Quick Code Direct Input (FoxPro Numpad Rapid Cashier Entry)
  const handleQuickCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCodeInput.trim()) return;

    try {
      const code = quickCodeInput.trim();
      const res = await api.get(`/pos/quick-lookup-code?code=${encodeURIComponent(code)}`);
      if (res.data.success && res.data.item) {
        handleAddToCart(res.data.item);
        setJustScannedCode(res.data.item.item_code);
        setTimeout(() => setJustScannedCode(null), 1500);
        setQuickCodeInput('');
      } else {
        setCheckoutError(res.data.message || `Item code '${code}' not found.`);
      }
    } catch (err: any) {
      setCheckoutError(err.response?.data?.message || `Failed to find item code '${quickCodeInput}'`);
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

  // Meal Coupon Deduction (COUPAMT)
  const couponNumeric = Math.min(grandTotal, Math.max(0, parseFloat(couponAmount) || 0));
  const netPayable = Math.max(0, Math.round((grandTotal - couponNumeric) * 100) / 100);

  // Cash Change Return calculation
  const tenderedNumeric = parseFloat(cashTendered) || 0;
  const changeToReturn = Math.max(0, tenderedNumeric - netPayable);

  // Credit validation: check if order exceeds available credit
  const availableCreditNum = selectedEmployee ? parseFloat(selectedEmployee.availableCredit || 0) : 0;
  const isCreditExceeded = paymentMode === 'EMPLOYEE_CREDIT' && selectedEmployee && netPayable > availableCreditNum;

  // Checkout execution
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (isCreditExceeded) {
      setCheckoutError(
        `Order payable amount (₹${netPayable.toFixed(2)}) exceeds available credit limit (₹${availableCreditNum.toFixed(2)}).`
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
        couponAmount: couponNumeric,
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
        const saleRecord = {
          ...res.data.sale,
          items: [...cart],
          grandTotal,
          netPayable,
          couponAmount: couponNumeric,
          employee: selectedEmployee,
        };
        setCompletedSale(saleRecord);
        setLastCompletedSale(saleRecord);
        setWaPhoneInput(selectedEmployee?.mobile || '');
        setWaSentStatus(null);
        setIsReceiptModalOpen(true);
        // Reset Cart, Tender & Coupon
        setCart([]);
        setSelectedEmployee(null);
        setCashTendered('');
        setCouponAmount('');
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

  // Filter products by category & search, prioritizing exact code matches & available items
  const q = itemSearch.trim().toLowerCase();
  const isDigits = /^\d+$/.test(q);
  const paddedQ = isDigits && q.length < 4 ? q.padStart(4, '0') : q;

  const filteredProducts = items
    .filter((itm) => {
      const itmCode = (itm.item_code || '').toLowerCase();
      const itmName = (itm.name || '').toLowerCase();

      // Support raw code, zero-padded code (e.g. '1' -> '0001'), or substring
      const matchesSearch =
        !q ||
        itmCode === q ||
        itmCode === paddedQ ||
        itmCode.includes(q) ||
        itmName.includes(q);

      // When searching specifically for an item, do not let an active category filter hide it
      const matchesCat = !q
        ? selectedCategory === 'ALL' || itm.category_name === selectedCategory
        : selectedCategory === 'ALL' || itm.category_name === selectedCategory || itmCode === q || itmCode === paddedQ;

      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      const itmCodeA = (a.item_code || '').toLowerCase();
      const itmCodeB = (b.item_code || '').toLowerCase();

      // 1. Exact item code match comes FIRST
      if (q) {
        const exactA = itmCodeA === q || itmCodeA === paddedQ;
        const exactB = itmCodeB === q || itmCodeB === paddedQ;
        if (exactA && !exactB) return -1;
        if (!exactA && exactB) return 1;
      }

      // 2. Available items first, out-of-stock items at the end
      const stockA =
        parseFloat(String((a as any).batch1_qty || 0)) + parseFloat(String((a as any).batch2_qty || 0)) ||
        parseFloat(String(a.current_stock || 0));
      const stockB =
        parseFloat(String((b as any).batch1_qty || 0)) + parseFloat(String((b as any).batch2_qty || 0)) ||
        parseFloat(String(b.current_stock || 0));
      const hasStockA = stockA > 0;
      const hasStockB = stockB > 0;

      if (hasStockA && !hasStockB) return -1;
      if (!hasStockA && hasStockB) return 1;

      // If both in stock, sort descending by stock level (or item code)
      if (hasStockA && hasStockB && stockB !== stockA) {
        return stockB - stockA;
      }

      return (a.item_code || '').localeCompare(b.item_code || '', undefined, { numeric: true });
    });

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-100 flex flex-col z-50 overflow-hidden font-sans select-none">
      {/* 1. TOP DEDICATED POS TERMINAL COMMAND BAR */}
      <header className="h-14 bg-navy-900 border-b border-navy-800 text-white px-4 flex items-center justify-between shrink-0 shadow-md">
        {/* Left: Branding, Station & Subtitle */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-400">
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
                Community &bull; Cooperate &bull; Security &bull; Life
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Date & Clock Badges */}
        <div className="hidden md:flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-medium bg-navy-800/80 px-2.5 py-1 rounded-md border border-navy-700/60">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-mono bg-navy-800/80 px-2.5 py-1 rounded-md border border-navy-700/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>
        </div>

        {/* Right: Actions, User Icon, Fullscreen & Exit POS Button */}
        <div className="flex items-center space-x-2">
          {lastCompletedSale && (
            <button
              type="button"
              onClick={() => {
                setCompletedSale(lastCompletedSale);
                setIsReceiptModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 hover:text-white border border-navy-700 text-xs font-semibold transition-colors"
              title="Reprint last completed receipt"
            >
              <Printer className="w-3.5 h-3.5 text-primary-light" />
              <span className="hidden sm:inline">Reprint Bill ({lastCompletedSale.invoiceNumber})</span>
            </button>
          )}

          {/* User Profile Badge */}
          <div
            className="w-8 h-8 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center text-slate-300"
            title={user?.fullName || 'Cashier'}
          >
            <User className="w-4 h-4" />
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white border border-navy-700 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Prominent EXIT POS / LOGOUT Button */}
          <button
            type="button"
            onClick={handleExitPos}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            title={user?.roleCode === 'CASHIER' ? 'Sign out of Cashier Terminal [Esc]' : 'Exit POS Terminal and return to Back-Office Dashboard [Esc]'}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{user?.roleCode === 'CASHIER' ? 'Sign Out' : 'Exit POS'}</span>
            <span className="text-[10px] text-white/70 font-mono hidden sm:inline">[Esc]</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN POS WORKSPACE: FULL-HEIGHT DUAL PANE */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* LEFT PANE: PRODUCT DISCOVERY, BARCODE SCANNER & CATALOG GRID (7 COLS / 8 COLS ON XL) */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden min-h-0">
          {/* Product Search & Rapid Code Controls */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              {/* 1. Quick 4-Digit Commodity Code Entry (FoxPro Numpad Rapid Billing) */}
              <form onSubmit={handleQuickCodeSubmit} className="md:col-span-4 relative">
                <Calculator
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                    justScannedCode ? 'text-emerald-500 animate-bounce' : 'text-amber-500'
                  }`}
                />
                <input
                  ref={quickCodeRef}
                  type="text"
                  maxLength={6}
                  placeholder="[F1] 4-Digit Code (e.g. 0001) + ↵"
                  value={quickCodeInput}
                  onChange={(e) => setQuickCodeInput(e.target.value)}
                  className={`w-full pl-9 pr-7 py-2 text-xs rounded-lg font-mono font-bold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    justScannedCode
                      ? 'bg-emerald-50 border-2 border-emerald-400 text-emerald-900'
                      : 'bg-amber-50/50 border border-amber-300/80 text-navy-900 placeholder:text-amber-700/60'
                  }`}
                />
                {quickCodeInput && (
                  <button
                    type="button"
                    onClick={() => setQuickCodeInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* 2. Product Name / Code Search (Expands across available width) */}
              <div className="md:col-span-8 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={itemSearchRef}
                  type="text"
                  placeholder="Search by product name, code, brand... [F2]"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredProducts.length > 0) {
                        handleAddToCart(filteredProducts[0]);
                      }
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-navy-800 placeholder:text-slate-400 font-medium"
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
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-navy-800 border border-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>All Commodities</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    selectedCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {items.length}
                </span>
              </button>
              {categories.map((c) => {
                const count = items.filter((i) => i.category_id === c.id || i.category_name === c.name).length;
                const isSelected = selectedCategory === c.name;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-navy-800 border border-slate-200'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Cards Grid with Fast-Scroll & Full Commodity Name Readability */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((p) => {
                const stock =
                  parseFloat(String((p as any).batch1_qty || 0)) + parseFloat(String((p as any).batch2_qty || 0)) ||
                  parseFloat(String(p.current_stock || 0));
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
                    className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between group relative bg-white hover:border-primary/80 hover:shadow-md ${
                      cartItem ? 'border-primary ring-2 ring-primary/40 bg-blue-50/20' : 'border-slate-200'
                    } ${!hasStock ? 'opacity-55 cursor-not-allowed bg-slate-50/70' : 'cursor-pointer active:scale-[0.99]'}`}
                  >
                    {/* Top Row: 4-Digit Code Pill + Stock Status */}
                    <div className="flex items-center justify-between gap-1 w-full mb-1.5">
                      <span className="text-[10px] font-mono font-extrabold text-primary bg-primary/10 border border-primary/25 px-1.5 py-0.5 rounded shrink-0">
                        {p.item_code}
                      </span>
                      {!hasStock ? (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                          OUT OF STOCK
                        </span>
                      ) : isLow ? (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                          LOW ({stock})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium shrink-0 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          <span>Stock: <strong className="text-slate-700 font-semibold">{stock}</strong></span>
                        </span>
                      )}
                    </div>

                    {/* Middle: Product Name (Full 2 Lines) + Optional Packshot Thumbnail */}
                    <div className="flex items-start space-x-2 flex-1 min-w-0 my-0.5">
                      {p.image_url ? (
                        <div className="w-12 h-12 shrink-0 rounded-lg bg-white flex items-center justify-center p-0.5 border border-slate-100 overflow-hidden">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            loading="lazy"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div
                          title={p.name}
                          className="text-xs font-bold text-navy-900 uppercase tracking-tight line-clamp-2 leading-snug group-hover:text-primary transition-colors min-h-[2rem]"
                        >
                          {p.name}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Price + Cart Qty + Add Button */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 w-full">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="font-mono font-black text-sm text-navy-900">
                          ₹{parseFloat(p.selling_price || 0).toFixed(2)}
                        </span>
                        {cartItem && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded-full">
                            x{cartItem.quantity}
                          </span>
                        )}
                      </div>
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-primary group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
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
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden min-h-0">
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

          {/* Middle: Order Items Header (Fixed Bar) */}
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200 shrink-0 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-navy-800 uppercase tracking-wider flex items-center space-x-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                <span>Order Items</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary font-mono">
                {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {(cart.length > 0 || couponAmount !== '') && (
              <button
                type="button"
                onClick={() => {
                  if (cart.length > 1) {
                    if (window.confirm(`Clear all ${totalItemsCount} items and coupon from the order?`)) {
                      handleClearAll();
                    }
                  } else {
                    handleClearAll();
                  }
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:bg-rose-50 px-2 py-1 rounded transition-colors flex items-center space-x-1"
                title="Clear all items and coupon in cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Cart Items List - Full Dynamic Height with Smooth Scrolling */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-700 text-xs">Cart is currently empty</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Enter 4-digit code [F1], search products [F2], or click any item to add</div>
                </div>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.itemId}
                  className="py-2.5 flex items-center justify-between gap-2.5 text-xs group hover:bg-slate-50/70 -mx-1.5 px-1.5 rounded-lg transition-colors"
                >
                  {/* Cart Item Thumbnail */}
                  <div className="w-9 h-9 rounded-md bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 text-slate-300" />
                    )}
                  </div>

                  {/* Item Details: Full Unclipped Name & Unit Price */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold text-navy-900 leading-snug line-clamp-2 text-xs flex items-baseline space-x-1"
                      title={item.name}
                    >
                      <span className="font-mono text-[10px] text-primary shrink-0 font-extrabold">[{item.itemCode}]</span>
                      <span>{item.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center flex-wrap gap-1.5 mt-0.5">
                      <span>₹{item.unitPrice.toFixed(2)} / {item.unitCode}</span>
                    </div>
                  </div>

                  {/* Ergonomic Stepper */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.itemId, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition-colors active:scale-95"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold font-mono tabular-nums w-6 text-center text-navy-900 text-xs">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.itemId, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition-colors active:scale-95"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove Button */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <div className="text-right min-w-[68px]">
                      <div className="font-bold font-mono text-navy-900 text-xs">
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-[9px] text-slate-400 font-mono">
                          {item.quantity} &times; ₹{item.unitPrice.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.itemId)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove item from order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
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
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Gross Order Value</span>
                <span className="font-mono font-bold text-slate-800">₹{grandTotal.toFixed(2)}</span>
              </div>

              {/* Meal / Food Coupon Deduction (COUPAMT) */}
              <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center space-x-1">
                  <span>Meal Coupon (COUPAMT):</span>
                </span>
                <div className="flex items-center space-x-1 w-32">
                  <span className="text-slate-400 text-xs">₹</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      step="any"
                      placeholder="0.00"
                      value={couponAmount}
                      onChange={(e) => setCouponAmount(e.target.value)}
                      className="w-full pl-2 pr-6 py-0.5 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded focus:border-primary focus:outline-none"
                    />
                    {couponAmount !== '' && (
                      <button
                        type="button"
                        onClick={() => setCouponAmount('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 transition-colors"
                        title="Clear Meal Coupon"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {couponNumeric > 0 && (
                <div className="flex justify-between text-[11px] text-emerald-700 font-medium">
                  <span>Coupon Deduction:</span>
                  <span className="font-mono font-bold">- ₹{couponNumeric.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-bold text-navy-800 pt-1 border-t border-slate-200">
                <span className="uppercase text-xs tracking-wider">Net Amount Due</span>
                <span className="text-xl font-black font-mono text-primary">₹{netPayable.toFixed(2)}</span>
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
                    {[netPayable, 100, 200, 500, 1000, 2000].map((preset) => (
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
                  Order payable amount (₹{netPayable.toFixed(2)}) exceeds available credit of ₹{availableCreditNum.toFixed(2)}. Switch tender to Cash or UPI.
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
                  <span>COMPLETE SALE &bull; ₹{netPayable.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            {/* Keyboard Shortcuts Helper Bar */}
            <div className="pt-1 flex items-center justify-center space-x-3 text-[10px] text-slate-400 font-mono">
              <span>[F1] 4-Digit Code</span>
              <span>&bull;</span>
              <span>[F2] Search</span>
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

      {/* High-Speed Payment Success & WhatsApp Dialog */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Sale Completed"
        subtitle="Payment recorded & receipt generated"
        maxWidth="sm"
      >
        {completedSale && (
          <div className="space-y-3.5 text-xs font-sans">
            {/* 1. Direct Success Header */}
            <div className="flex flex-col items-center text-center pt-1 pb-1">
              <div className="w-13 h-13 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-xs">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-800">Payment Successful!</h3>
              <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">
                Bill <span className="text-navy-900 bg-slate-100 px-2 py-0.5 rounded font-mono font-black">{completedSale.invoiceNumber}</span>
              </p>
            </div>

            {/* 2. Compact Key Details Card */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Total Paid</span>
                <span className="font-mono font-black text-xl text-emerald-600">
                  ₹{parseFloat(completedSale.totalAmount || completedSale.netPayable || 0).toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Customer</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {completedSale.employeeName || completedSale.customerName || 'Walk-in Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tender Mode</span>
                  <span className="font-bold text-slate-800 uppercase block">
                    {completedSale.paymentMode === 'EMPLOYEE_CREDIT' ? 'Monthly Credit' : completedSale.paymentMode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Items</span>
                  <span className="font-semibold text-slate-700">
                    {completedSale.items?.length || 1} items
                  </span>
                </div>
                {completedSale.employee && completedSale.paymentMode === 'EMPLOYEE_CREDIT' && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Available Credit</span>
                    <span className="font-mono font-bold text-blue-700">
                      ₹{parseFloat((completedSale.employee.available_credit || 0).toString()).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Direct WhatsApp e-Receipt Dispatch */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5 text-xs text-emerald-950">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                  <span>WhatsApp e-Receipt</span>
                </span>
                {waSentStatus && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    waSentStatus.startsWith('Error') || waSentStatus.startsWith('Failed')
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-200/80 text-emerald-900'
                  }`}>
                    {waSentStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Mobile:</span>
                  <span className="font-mono font-bold text-emerald-950">
                    {waPhoneInput ? waPhoneInput : 'No Mobile Registered'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSendWhatsAppReceipt}
                  disabled={waSending || !waPhoneInput.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 disabled:opacity-40 transition-all shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>{waSending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>

            {/* 4. Modal Fast Actions */}
            <div className="no-print flex space-x-2 pt-1 border-t border-slate-200 font-sans">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 active:scale-98"
              >
                <span>Next Customer</span>
                <span className="text-[10px] text-white/70 font-mono">[Enter]</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                title="Print physical paper slip if customer requests"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>

            {/* Hidden Printable Receipt for browser print dialog */}
            <div id="printable-receipt" className="hidden print:block font-mono text-[11px] leading-tight text-black p-4">
              <div className="text-center pb-2 border-b border-dashed border-black">
                <h4 className="font-bold text-sm uppercase">CFECC STORES</h4>
                <p className="text-[10px]">Employee Consumer Cooperative Society</p>
                <p className="text-[10px]">Visakhapatnam, Andhra Pradesh</p>
                <p className="text-[10px] font-bold">GSTIN: 37AAAAA0000A1Z5</p>
              </div>
              <div className="py-2 text-[10px] space-y-0.5">
                <div>Bill No: {completedSale.invoiceNumber}</div>
                <div>Date: {new Date(completedSale.createdAt).toLocaleString('en-IN')}</div>
                <div>Customer: {completedSale.employeeName || completedSale.customerName}</div>
                <div>Mode: {completedSale.paymentMode}</div>
              </div>
              <div className="border-t border-b border-dashed border-black py-1">
                {(completedSale.items || []).map((it: any) => (
                  <div key={it.itemId} className="flex justify-between text-[10px]">
                    <span className="truncate w-1/2">{it.name}</span>
                    <span className="w-1/4 text-center">{it.quantity}</span>
                    <span className="w-1/4 text-right">₹{(it.quantity * it.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-1.5 text-right font-bold text-xs">
                NET TOTAL: ₹{parseFloat(completedSale.totalAmount || completedSale.netPayable || 0).toFixed(2)}
              </div>
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
