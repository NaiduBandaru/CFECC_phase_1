import { pgTable, text, serial, timestamp, integer, numeric } from 'drizzle-orm/pg-core';
import { employees } from './employees.js';
import { items } from './inventory.js';

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(), // 'INV-2026-00001'
  saleType: text('sale_type').default('EMPLOYEE_CREDIT').notNull(), // 'EMPLOYEE_CREDIT', 'CASH', 'UPI', 'SPLIT'
  employeeId: integer('employee_id').references(() => employees.id),
  customerName: text('customer_name'),
  customerMobile: text('customer_mobile'),

  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),

  paymentMode: text('payment_mode').default('EMPLOYEE_CREDIT').notNull(), // 'EMPLOYEE_CREDIT', 'CASH', 'UPI', 'SPLIT'
  paymentStatus: text('payment_status').default('COMPLETED').notNull(), // 'PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED'

  billedBy: integer('billed_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleId: integer('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').notNull().references(() => items.id),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
});

export const saleReturns = pgTable('sale_returns', {
  id: serial('id').primaryKey(),
  returnNumber: text('return_number').notNull().unique(), // 'RET-2026-0001'
  saleId: integer('sale_id').notNull().references(() => sales.id),
  returnDate: timestamp('return_date').defaultNow().notNull(),
  refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }).notNull(),
  refundMethod: text('refund_method').default('CREDIT_ADJUSTMENT').notNull(), // 'CREDIT_ADJUSTMENT', 'CASH', 'UPI'
  reason: text('reason').notNull(),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
