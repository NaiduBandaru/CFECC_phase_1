import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // SUPER_ADMIN, STORE_MANAGER, CASHIER, ACCOUNTS_OFFICER, HR_PAYROLL
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  module: text('module').notNull(), // pos, sales, inventory, purchasing, employees, billing, payroll, reports, admin
  action: text('action').notNull(), // view, create, edit, delete, approve, export
  code: text('code').notNull().unique(), // e.g., 'pos:checkout', 'employees:edit'
  description: text('description'),
});

export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id'),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  roleId: integer('role_id').notNull().references(() => roles.id),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, APPROVE, REVERSE, LOGIN
  entity: text('entity').notNull(), // EMPLOYEE, SALE, BILLING_PERIOD, PURCHASE, etc.
  entityId: text('entity_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
