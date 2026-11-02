import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Sale } from '../../types/index.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { Modal } from '../../components/ui/Modal.js';
import { Receipt, Search, Filter, Eye, Printer, CreditCard, Download } from 'lucide-react';

export const SalesRegisterPage: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('ALL');

  // View Invoice Modal
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchSales();
  }, [search, paymentMode]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ search, paymentMode });
      const res = await api.get(`/sales?${params.toString()}`);
      if (res.data.success) {
        setSales(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (id: number) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.data.success) {
        setSelectedSale(res.data.sale);
        setSaleItems(res.data.items);
        setIsInvoiceModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Sales Register & Transactions</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Audit trail of all retail POS invoices, payment methods and customer receipts
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice # or employee name..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-borderLine rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="EMPLOYEE_CREDIT">Employee Credit</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
          </select>
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Billed To</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Tax (GST)</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading sales history...</div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-textSecondary">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>No sales transactions logged.</div>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-navy-800">{sale.invoice_number}</td>
                    <td className="py-3 px-4 text-textSecondary">
                      {new Date(sale.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-navy-800">
                        {sale.first_name ? `${sale.first_name} ${sale.last_name}` : sale.customer_name || 'Walk-in'}
                      </div>
                      {sale.employee_code && (
                        <div className="text-[11px] text-textSecondary font-mono">{sale.employee_code}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-textPrimary">
                        {sale.payment_mode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                      ₹{parseFloat(sale.subtotal.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-textSecondary tabular-nums">
                      ₹{parseFloat(sale.tax_amount.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-navy-800 tabular-nums">
                      ₹{parseFloat(sale.total_amount.toString()).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={sale.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleViewInvoice(sale.id)}
                        className="p-1 rounded text-textSecondary hover:text-primary hover:bg-blue-50 transition-colors"
                        title="View Detailed Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={selectedSale?.invoice_number || 'Invoice Details'}
        subtitle="Official Store Sales Receipt"
        maxWidth="lg"
      >
        {selectedSale && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-borderLine">
              <div>
                <span className="text-textSecondary block">Customer / Employee</span>
                <span className="font-bold text-navy-800 text-sm">
                  {selectedSale.first_name ? `${selectedSale.first_name} ${selectedSale.last_name}` : selectedSale.customer_name}
                </span>
                {selectedSale.employee_code && (
                  <span className="text-[11px] text-textSecondary block font-mono">
                    ID: {selectedSale.employee_code} &bull; {selectedSale.department_name}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-textSecondary block">Date & Time</span>
                <span className="font-semibold text-navy-800">
                  {new Date(selectedSale.created_at).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-textSecondary block">Payment: {selectedSale.payment_mode}</span>
              </div>
            </div>

            {/* Line items table */}
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase">
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Rate</th>
                  <th className="py-2 px-3 text-right">Tax</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {saleItems.map((itm) => (
                  <tr key={itm.id}>
                    <td className="py-2 px-3 font-semibold text-navy-800">{itm.item_name}</td>
                    <td className="py-2 px-3 text-center font-mono">{parseFloat(itm.quantity)} {itm.unit_code}</td>
                    <td className="py-2 px-3 text-right font-mono">₹{parseFloat(itm.unit_price).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono">₹{parseFloat(itm.tax_amount).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold font-mono">₹{parseFloat(itm.total_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-3 border-t border-borderLine space-y-1 text-right text-xs">
              <div className="text-textSecondary">Subtotal: ₹{parseFloat(selectedSale.subtotal).toFixed(2)}</div>
              <div className="text-textSecondary">Taxes (GST): ₹{parseFloat(selectedSale.tax_amount).toFixed(2)}</div>
              <div className="text-sm font-bold text-navy-800">Grand Total: ₹{parseFloat(selectedSale.total_amount).toFixed(2)}</div>
            </div>

            <div className="flex justify-end pt-3 border-t border-borderLine">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-navy-800 text-white font-semibold text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
