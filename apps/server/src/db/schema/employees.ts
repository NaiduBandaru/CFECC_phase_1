import { pgTable, text, serial, timestamp, boolean, integer, numeric, date } from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // e.g., 'ADMIN', 'OPS', 'FIN', 'MAINT', 'HR'
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const designations = pgTable('designations', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id').notNull().references(() => departments.id),
  title: text('title').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeCode: text('employee_code').notNull().unique(), // e.g., 'CFE-1001'
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: date('date_of_birth'),
  gender: text('gender'), // 'MALE', 'FEMALE', 'OTHER'
  profileImageUrl: text('profile_image_url'),
  maritalStatus: text('marital_status'), // 'SINGLE', 'MARRIED', etc.

  // Contact
  mobile: text('mobile').notNull(),
  alternateMobile: text('alternate_mobile'),
  email: text('email'),
  currentAddress: text('current_address'),
  permanentAddress: text('permanent_address'),

  // Employment
  departmentId: integer('department_id').references(() => departments.id),
  designationId: integer('designation_id').references(() => designations.id),
  joiningDate: date('joining_date').notNull(),
  employmentType: text('employment_type').default('PERMANENT').notNull(), // 'PERMANENT', 'CONTRACT', 'PROBATION'
  reportingManagerId: integer('reporting_manager_id'),
  employmentStatus: text('employment_status').default('ACTIVE').notNull(), // 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'RETIRED'
  exitDate: date('exit_date'),

  // Store Credit Controls
  creditEnabled: boolean('credit_enabled').default(true).notNull(),
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).default('10000.00').notNull(),
  currentOutstanding: numeric('current_outstanding', { precision: 12, scale: 2 }).default('0.00').notNull(),
  availableCredit: numeric('available_credit', { precision: 12, scale: 2 }).default('10000.00').notNull(),
  billingCycleDay: integer('billing_cycle_day').default(25).notNull(), // Day of month when billing cuts off

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const employeeSalaries = pgTable('employee_salaries', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  basicSalary: numeric('basic_salary', { precision: 12, scale: 2 }).default('0.00').notNull(),
  da: numeric('da', { precision: 12, scale: 2 }).default('0.00').notNull(), // Dearness Allowance
  hra: numeric('hra', { precision: 12, scale: 2 }).default('0.00').notNull(), // House Rent Allowance
  otherAllowances: numeric('other_allowances', { precision: 12, scale: 2 }).default('0.00').notNull(),
  statutoryDeductions: numeric('statutory_deductions', { precision: 12, scale: 2 }).default('0.00').notNull(), // PF, ESI, PT
  netBaseSalary: numeric('net_base_salary', { precision: 12, scale: 2 }).default('0.00').notNull(),
  effectiveDate: date('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeBankDetails = pgTable('employee_bank_details', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  accountHolderName: text('account_holder_name').notNull(),
  bankName: text('bank_name').notNull(),
  accountNumber: text('account_number').notNull(),
  ifscCode: text('ifsc_code').notNull(),
  branch: text('branch'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeDocuments = pgTable('employee_documents', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(), // 'AADHAAR', 'PAN', 'APPOINTMENT_LETTER', 'PHOTO', 'OTHER'
  documentName: text('document_name').notNull(),
  documentUrl: text('document_url').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});
