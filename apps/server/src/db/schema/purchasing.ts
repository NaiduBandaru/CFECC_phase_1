import { pgTable, text, serial, timestamp, integer, numeric, date } from 'drizzle-orm/pg-core';
import { vendors } from './vendors.js';
import { items } from './inventory.js';

export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: text('po_number').notNull().unique(), // 'PO-2026-0001'
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  orderDate: date('order_date').notNull(),
  expectedDeliveryDate: date('expected_delivery_date'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('PENDING').notNull(), // 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').notNull().references(() => items.id),
  orderedQty: numeric('ordered_qty', { precision: 12, scale: 3 }).notNull(),
  receivedQty: numeric('received_qty', { precision: 12, scale: 3 }).default('0.000').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
});

export const goodsReceipts = pgTable('goods_receipts', {
  id: serial('id').primaryKey(),
  grnNumber: text('grn_number').notNull().unique(), // 'GRN-2026-0001'
  poId: integer('po_id').references(() => purchaseOrders.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  receiptDate: date('receipt_date').notNull(),
  deliveryChallanNumber: text('delivery_challan_number'),
  vehicleNumber: text('vehicle_number'),
  status: text('status').default('RECEIVED').notNull(), // 'RECEIVED', 'VERIFIED', 'REJECTED'
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const goodsReceiptItems = pgTable('goods_receipt_items', {
  id: serial('id').primaryKey(),
  grnId: integer('grn_id').notNull().references(() => goodsReceipts.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').notNull().references(() => items.id),
  receivedQty: numeric('received_qty', { precision: 12, scale: 3 }).notNull(),
  acceptedQty: numeric('accepted_qty', { precision: 12, scale: 3 }).notNull(),
  rejectedQty: numeric('rejected_qty', { precision: 12, scale: 3 }).default('0.000').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  expiryDate: date('expiry_date'),
  rejectionReason: text('rejection_reason'),
});

export const purchaseInvoices = pgTable('purchase_invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull(), // Vendor's invoice number
  systemBillNumber: text('system_bill_number').notNull().unique(), // 'PINV-2026-0001'
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  grnId: integer('grn_id').references(() => goodsReceipts.id),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('UNPAID').notNull(), // 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'
  attachmentUrl: text('attachment_url'),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

