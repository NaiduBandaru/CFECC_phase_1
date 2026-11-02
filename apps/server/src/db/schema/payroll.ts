import { pgTable, text, serial, timestamp, integer, numeric, date } from 'drizzle-orm/pg-core';
import { employees } from './employees.js';

export const payrollPeriods = pgTable('payroll_periods', {
  id: serial('id').primaryKey(),
  periodCode: text('period_code').notNull().unique(), // e.g., 'PAY-2026-03'
  monthYear: text('month_year').notNull(), // '2026-03'
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  payoutDate: date('payout_date').notNull(),
  status: text('status').default('DRAFT').notNull(), // 'DRAFT', 'CALCULATED', 'APPROVED', 'DISBURSED'
  totalGrossSalary: numeric('total_gross_salary', { precision: 14, scale: 2 }).default('0.00').notNull(),
  totalStoreRecovery: numeric('total_store_recovery', { precision: 14, scale: 2 }).default('0.00').notNull(),
  totalNetSalary: numeric('total_net_salary', { precision: 14, scale: 2 }).default('0.00').notNull(),
  processedAt: timestamp('processed_at'),
  approvedBy: integer('approved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrollEntries = pgTable('payroll_entries', {
  id: serial('id').primaryKey(),
  payrollPeriodId: integer('payroll_period_id').notNull().references(() => payrollPeriods.id, { onDelete: 'cascade' }),
  employeeId: integer('employee_id').notNull().references(() => employees.id),

  basicSalary: numeric('basic_salary', { precision: 12, scale: 2 }).notNull(),
  da: numeric('da', { precision: 12, scale: 2 }).default('0.00').notNull(),
  hra: numeric('hra', { precision: 12, scale: 2 }).default('0.00').notNull(),
  otherAllowances: numeric('other_allowances', { precision: 12, scale: 2 }).default('0.00').notNull(),
  grossSalary: numeric('gross_salary', { precision: 12, scale: 2 }).notNull(),

  // Key CFECC Integration Field:
  storeRecoveryAmount: numeric('store_recovery_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  statutoryDeductions: numeric('statutory_deductions', { precision: 12, scale: 2 }).default('0.00').notNull(),
  otherDeductions: numeric('other_deductions', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalDeductions: numeric('total_deductions', { precision: 12, scale: 2 }).notNull(),
  netSalary: numeric('net_salary', { precision: 12, scale: 2 }).notNull(),

  paymentStatus: text('payment_status').default('PENDING').notNull(), // 'PENDING', 'PAID', 'HOLD'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

