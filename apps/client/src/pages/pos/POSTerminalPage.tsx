import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
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

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialCatalog();
  }, []);

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
        setIsReceiptModalOpen(true);
        // Reset Cart
        setCart([]);
        setSelectedEmployee(null);
        fetchInitialCatalog();
      }
    } catch (err: any) {
      setCheckoutError(err.response?.data?.message || 'Transaction could not be completed.');
    } finally {
      setIsCheckingOut(false);
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
          <div className="space-y-4 text-xs font-mono">
            <div className="text-center pb-3 border-b border-dashed border-borderLine font-sans">
              <h4 className="font-bold text-sm text-navy-800">CFECC STORES MANAGEMENT</h4>
              <p className="text-[11px] text-textSecondary">Visakhapatnam, Andhra Pradesh</p>
              <p className="text-[10px] text-textSecondary">GSTIN: 37AAAAA0000A1Z5</p>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Invoice No:</span>
                <span className="font-bold">{completedSale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{new Date(completedSale.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Billed To:</span>
                <span className="font-bold">{completedSale.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Tender:</span>
                <span className="font-bold">{completedSale.paymentMode}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-borderLine py-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-textSecondary">
                <span>ITEM</span>
                <span>QTY x RATE</span>
                <span>TOTAL</span>
              </div>
              {completedSale.items?.map((item: any) => (
                <div key={item.itemId} className="flex justify-between text-[11px]">
                  <span className="truncate max-w-[140px]">{item.name}</span>
                  <span>{item.quantity} x {item.unitPrice.toFixed(2)}</span>
                  <span>₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 font-sans text-xs">
              <div className="flex justify-between text-textSecondary">
                <span>Subtotal:</span>
                <span>₹{parseFloat(completedSale.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-textSecondary">
                <span>Total Tax (GST):</span>
                <span>₹{parseFloat(completedSale.taxAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-navy-800 pt-1 border-t border-borderLine">
                <span>Invoice Total:</span>
                <span>₹{parseFloat(completedSale.totalAmount).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center pt-2 text-[10px] text-textSecondary font-sans">
              Thank you for shopping at CFECC Stores!
            </div>

            <div className="flex space-x-2 pt-3 border-t border-borderLine font-sans">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-navy-800 text-white font-semibold text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-borderLine font-semibold text-xs text-textSecondary hover:bg-slate-50"
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
