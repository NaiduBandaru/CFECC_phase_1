import { pgTable, text, serial, timestamp, integer, numeric } from 'drizzle-orm/pg-core';
import { employees } from './employees.js';
import { items } from './inventory.js';
import { users } from './auth.js';

export const posShifts = pgTable('pos_shifts', {
  id: serial('id').primaryKey(),
  shiftNumber: text('shift_number').notNull().unique(), // 'SHF-2026-00001'
  cashierId: integer('cashier_id').references(() => users.id),
  terminalId: text('terminal_id').default('POS-01').notNull(),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  openingFloat: numeric('opening_float', { precision: 12, scale: 2 }).default('0.00').notNull(),
  closingCashCounted: numeric('closing_cash_counted', { precision: 12, scale: 2 }),
  expectedCash: numeric('expected_cash', { precision: 12, scale: 2 }).default('0.00').notNull(),
  cashVariance: numeric('cash_variance', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalCashSales: numeric('total_cash_sales', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalUpiSales: numeric('total_upi_sales', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalCreditSales: numeric('total_credit_sales', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalSales: numeric('total_sales', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalTransactions: integer('total_transactions').default(0).notNull(),
  status: text('status').default('OPEN').notNull(), // 'OPEN', 'CLOSED'
  closingNotes: text('closing_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => posShifts.id),
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
  itemCode: text('item_code'),
  batchNumber: integer('batch_number').default(1).notNull(),
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

