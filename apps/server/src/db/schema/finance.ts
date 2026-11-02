import { pgTable, text, serial, timestamp, integer, numeric, date } from 'drizzle-orm/pg-core';
import { employees } from './employees.js';

export const employeeLedger = pgTable('employee_ledger', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  transactionDate: timestamp('transaction_date').defaultNow().notNull(),
  transactionType: text('transaction_type').notNull(), // 'CREDIT_SALE', 'PAYMENT_RECEIVED', 'PAYROLL_RECOVERY', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT', 'OPENING_BALANCE'
  referenceType: text('reference_type'), // 'SALE', 'PAYMENT', 'BILLING_STATEMENT', 'PAYROLL_ENTRY'
  referenceId: text('reference_id'),
  debitAmount: numeric('debit_amount', { precision: 12, scale: 2 }).default('0.00').notNull(), // Increases employee liability/outstanding
  creditAmount: numeric('credit_amount', { precision: 12, scale: 2 }).default('0.00').notNull(), // Decreases employee liability (payments, recoveries)
  runningBalance: numeric('running_balance', { precision: 12, scale: 2 }).notNull(),
  remarks: text('remarks'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billingPeriods = pgTable('billing_periods', {
  id: serial('id').primaryKey(),
  periodCode: text('period_code').notNull().unique(), // e.g., 'BILL-2026-03'
  periodName: text('period_name').notNull(), // e.g., 'March 2026 Billing'
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  billingDate: date('billing_date').notNull(),
  status: text('status').default('DRAFT').notNull(), // 'DRAFT', 'FINALIZED', 'CLOSED'
  totalEmployeesBilled: integer('total_employees_billed').default(0).notNull(),
  totalBilledAmount: numeric('total_billed_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  totalRecoveredAmount: numeric('total_recovered_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  finalizedAt: timestamp('finalized_at'),
  finalizedBy: integer('finalized_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeInvoices = pgTable('employee_invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(), // 'STMT-2026-03-001'
  billingPeriodId: integer('billing_period_id').notNull().references(() => billingPeriods.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),

  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0.00').notNull(),
  currentPurchases: numeric('current_purchases', { precision: 12, scale: 2 }).default('0.00').notNull(),
  adjustments: numeric('adjustments', { precision: 12, scale: 2 }).default('0.00').notNull(),
  paymentsReceived: numeric('payments_received', { precision: 12, scale: 2 }).default('0.00').notNull(),
  recoveriesDeducted: numeric('recoveries_deducted', { precision: 12, scale: 2 }).default('0.00').notNull(),
  closingOutstanding: numeric('closing_outstanding', { precision: 12, scale: 2 }).default('0.00').notNull(),

  status: text('status').default('GENERATED').notNull(), // 'GENERATED', 'APPROVED', 'RECOVERED', 'PARTIALLY_RECOVERED', 'CANCELLED'
  pdfUrl: text('pdf_url'),
  whatsappSentAt: timestamp('whatsapp_sent_at'),
  whatsappStatus: text('whatsapp_status').default('PENDING').notNull(), // 'PENDING', 'SENT', 'DELIVERED', 'FAILED'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  paymentNumber: text('payment_number').notNull().unique(), // 'PAY-2026-0001'
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  paymentDate: timestamp('payment_date').defaultNow().notNull(),
  paymentMode: text('payment_mode').notNull(), // 'CASH', 'UPI', 'BANK_TRANSFER'
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  transactionReference: text('transaction_reference'),
  remarks: text('remarks'),
  receivedBy: integer('received_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recoveryRecords = pgTable('recovery_records', {
  id: serial('id').primaryKey(),
  recoveryNumber: text('recovery_number').notNull().unique(), // 'REC-2026-0001'
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  billingPeriodId: integer('billing_period_id').notNull().references(() => billingPeriods.id),
  employeeInvoiceId: integer('employee_invoice_id').references(() => employeeInvoices.id),
  recoverySource: text('recovery_source').default('PAYROLL_DEDUCTION').notNull(), // 'PAYROLL_DEDUCTION', 'DIRECT_PAYMENT', 'SPECIAL_RECOVERY'
  amountDeducted: numeric('amount_deducted', { precision: 12, scale: 2 }).notNull(),
  payrollPeriodId: integer('payroll_period_id'),
  status: text('status').default('COMPLETED').notNull(), // 'PENDING', 'COMPLETED', 'REVERSED'
  recoveredAt: timestamp('recovered_at').defaultNow().notNull(),
  remarks: text('remarks'),
});

