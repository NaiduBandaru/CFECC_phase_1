import { pgTable, text, serial, timestamp, boolean, integer, numeric } from 'drizzle-orm/pg-core';

export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  vendorCode: text('vendor_code').notNull().unique(), // e.g. 'VND-001'
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  city: text('city').default('Visakhapatnam'),
  state: text('state').default('Andhra Pradesh'),
  gstin: text('gstin'),
  paymentTermsDays: integer('payment_terms_days').default(30).notNull(),

  // Bank Info
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  ifscCode: text('ifsc_code'),

  // Financial Balances
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0.00').notNull(),
  currentOutstanding: numeric('current_outstanding', { precision: 12, scale: 2 }).default('0.00').notNull(),

  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vendorPayments = pgTable('vendor_payments', {
  id: serial('id').primaryKey(),
  paymentNumber: text('payment_number').notNull().unique(), // 'VPAY-2026-0001'
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  paymentDate: timestamp('payment_date').defaultNow().notNull(),
  paymentMode: text('payment_mode').notNull(), // 'NEFT_RTGS', 'CHEQUE', 'UPI', 'CASH'
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  referenceNumber: text('reference_number'),
  purchaseInvoiceId: integer('purchase_invoice_id'),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
