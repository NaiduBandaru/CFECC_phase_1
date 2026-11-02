import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import * as schema from './schema/index.js';
import { config } from '../config/index.js';

let dbInstance: any = null;
let pgliteInstance: PGlite | null = null;
let pgPoolInstance: pg.Pool | null = null;

export async function initDatabase() {
  if (dbInstance) return dbInstance;

  const isExplicitPglite = process.env.USE_PGLITE === 'true' || process.env.NODE_ENV === 'test';
  let connectedRemote = false;

  if (!isExplicitPglite && config.databaseUrl && config.databaseUrl.trim() !== '') {
    const isSupabase = config.databaseUrl.includes('supabase.co') ||
      config.databaseUrl.includes('pooler.supabase.com') ||
      config.databaseUrl.includes('sslmode=require');

    try {
      console.log(`[Database] Connecting to PostgreSQL instance (${isSupabase ? 'Supabase with SSL' : 'Standard'})...`);
      const pool = new pg.Pool({
        connectionString: config.databaseUrl,
        ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 3000,
      });
      // Test connectivity
      const client = await pool.connect();
      client.release();
      pgPoolInstance = pool;
      dbInstance = drizzlePg(pgPoolInstance, { schema });
      connectedRemote = true;
      console.log('[Database] Successfully connected to remote PostgreSQL instance.');
    } catch (err: any) {
      console.warn(`[Database] Remote PostgreSQL connection failed (${err.message}). Falling back to local embedded PGlite storage.`);
      pgPoolInstance = null;
      dbInstance = null;
    }
  }

  if (!connectedRemote) {
    // Zero-config embedded PostgreSQL via PGlite
    const dataDir = path.resolve(process.cwd(), '.data', 'pglite');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    console.log(`[Database] Initializing embedded PostgreSQL storage at ${dataDir}...`);
    pgliteInstance = new PGlite(dataDir);
    dbInstance = drizzlePglite(pgliteInstance, { schema });
  }

  // Ensure tables exist on boot
  await ensureTablesCreated();

  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export async function executeRawSql(sql: string) {
  if (pgPoolInstance) {
    return await pgPoolInstance.query(sql);
  } else if (pgliteInstance) {
    // If multiple statements, use exec, otherwise query
    if (sql.includes(';') && (sql.includes('CREATE TABLE') || sql.includes('INSERT INTO') && sql.split(';').filter(s => s.trim()).length > 1)) {
      await pgliteInstance.exec(sql);
      return { rows: [] };
    }
    return await pgliteInstance.query(sql);
  }
  throw new Error('No active database client to execute SQL');
}

export async function executeScript(sql: string) {
  if (pgPoolInstance) {
    return await pgPoolInstance.query(sql);
  } else if (pgliteInstance) {
    return await pgliteInstance.exec(sql);
  }
  throw new Error('No active database client to execute SQL');
}

async function ensureTablesCreated() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS designations (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      title TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      employee_code TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE,
      gender TEXT,
      profile_image_url TEXT,
      marital_status TEXT,
      mobile TEXT NOT NULL,
      alternate_mobile TEXT,
      email TEXT,
      current_address TEXT,
      permanent_address TEXT,
      department_id INTEGER REFERENCES departments(id),
      designation_id INTEGER REFERENCES designations(id),
      joining_date DATE NOT NULL,
      employment_type TEXT NOT NULL DEFAULT 'PERMANENT',
      reporting_manager_id INTEGER,
      employment_status TEXT NOT NULL DEFAULT 'ACTIVE',
      exit_date DATE,
      credit_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 10000.00,
      current_outstanding NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      available_credit NUMERIC(12, 2) NOT NULL DEFAULT 10000.00,
      billing_cycle_day INTEGER NOT NULL DEFAULT 25,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      old_values JSONB,
      new_values JSONB,
      ip_address TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_salaries (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      da NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      hra NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      statutory_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      net_base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      effective_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_bank_details (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      account_holder_name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      branch TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_documents (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      document_name TEXT NOT NULL,
      document_url TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS item_categories (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      parent_id INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      precision INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      item_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES item_categories(id),
      subcategory TEXT,
      brand TEXT,
      description TEXT,
      unit_id INTEGER REFERENCES units(id),
      sku TEXT,
      barcode TEXT UNIQUE,
      hsn_code TEXT,
      purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      employee_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
      min_stock NUMERIC(12, 3) NOT NULL DEFAULT 5.000,
      reorder_level NUMERIC(12, 3) NOT NULL DEFAULT 10.000,
      tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS item_price_history (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      old_purchase_price NUMERIC(12, 2) NOT NULL,
      new_purchase_price NUMERIC(12, 2) NOT NULL,
      old_selling_price NUMERIC(12, 2) NOT NULL,
      new_selling_price NUMERIC(12, 2) NOT NULL,
      old_employee_price NUMERIC(12, 2) NOT NULL,
      new_employee_price NUMERIC(12, 2) NOT NULL,
      reason TEXT,
      changed_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id),
      movement_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      quantity NUMERIC(12, 3) NOT NULL,
      unit_cost NUMERIC(12, 2) NOT NULL,
      balance_after NUMERIC(12, 3) NOT NULL,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      vendor_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      city TEXT DEFAULT 'Visakhapatnam',
      state TEXT DEFAULT 'Andhra Pradesh',
      gstin TEXT,
      payment_terms_days INTEGER NOT NULL DEFAULT 30,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      current_outstanding NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vendor_payments (
      id SERIAL PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
      payment_mode TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      reference_number TEXT,
      purchase_invoice_id INTEGER,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      order_date DATE NOT NULL,
      expected_delivery_date DATE,
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      ordered_qty NUMERIC(12, 3) NOT NULL,
      received_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
      unit_price NUMERIC(12, 2) NOT NULL,
      tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      total_price NUMERIC(12, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goods_receipts (
      id SERIAL PRIMARY KEY,
      grn_number TEXT NOT NULL UNIQUE,
      po_id INTEGER REFERENCES purchase_orders(id),
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      receipt_date DATE NOT NULL,
      delivery_challan_number TEXT,
      vehicle_number TEXT,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS goods_receipt_items (
      id SERIAL PRIMARY KEY,
      grn_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      received_qty NUMERIC(12, 3) NOT NULL,
      accepted_qty NUMERIC(12, 3) NOT NULL,
      rejected_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
      unit_cost NUMERIC(12, 2) NOT NULL,
      rejection_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      system_bill_number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      grn_id INTEGER REFERENCES goods_receipts(id),
      invoice_date DATE NOT NULL,
      due_date DATE,
      subtotal NUMERIC(12, 2) NOT NULL,
      tax_amount NUMERIC(12, 2) NOT NULL,
      total_amount NUMERIC(12, 2) NOT NULL,
      paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      attachment_url TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      sale_type TEXT NOT NULL DEFAULT 'EMPLOYEE_CREDIT',
      employee_id INTEGER REFERENCES employees(id),
      customer_name TEXT,
      customer_mobile TEXT,
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      payment_mode TEXT NOT NULL DEFAULT 'EMPLOYEE_CREDIT',
      payment_status TEXT NOT NULL DEFAULT 'COMPLETED',
      billed_by INTEGER,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      quantity NUMERIC(12, 3) NOT NULL,
      unit_price NUMERIC(12, 2) NOT NULL,
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
      tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      total_price NUMERIC(12, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_returns (
      id SERIAL PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      return_date TIMESTAMP NOT NULL DEFAULT NOW(),
      refund_amount NUMERIC(12, 2) NOT NULL,
      refund_method TEXT NOT NULL DEFAULT 'CREDIT_ADJUSTMENT',
      reason TEXT NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_ledger (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      transaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
      transaction_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      debit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      credit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      running_balance NUMERIC(12, 2) NOT NULL,
      remarks TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS billing_periods (
      id SERIAL PRIMARY KEY,
      period_code TEXT NOT NULL UNIQUE,
      period_name TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      billing_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_employees_billed INTEGER NOT NULL DEFAULT 0,
      total_billed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      total_recovered_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      finalized_at TIMESTAMP,
      finalized_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employee_invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      current_purchases NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      adjustments NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      payments_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      recoveries_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      closing_outstanding NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'GENERATED',
      pdf_url TEXT,
      whatsapp_sent_at TIMESTAMP,
      whatsapp_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
      payment_mode TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      transaction_reference TEXT,
      remarks TEXT,
      received_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recovery_records (
      id SERIAL PRIMARY KEY,
      recovery_number TEXT NOT NULL UNIQUE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id),
      employee_invoice_id INTEGER REFERENCES employee_invoices(id),
      recovery_source TEXT NOT NULL DEFAULT 'PAYROLL_DEDUCTION',
      amount_deducted NUMERIC(12, 2) NOT NULL,
      payroll_period_id INTEGER,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      recovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
      remarks TEXT
    );

    CREATE TABLE IF NOT EXISTS payroll_periods (
      id SERIAL PRIMARY KEY,
      period_code TEXT NOT NULL UNIQUE,
      month_year TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      payout_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_gross_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      total_store_recovery NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      total_net_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      processed_at TIMESTAMP,
      approved_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payroll_entries (
      id SERIAL PRIMARY KEY,
      payroll_period_id INTEGER NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      basic_salary NUMERIC(12, 2) NOT NULL,
      da NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      hra NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      gross_salary NUMERIC(12, 2) NOT NULL,
      store_recovery_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      statutory_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      total_deductions NUMERIC(12, 2) NOT NULL,
      net_salary NUMERIC(12, 2) NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id SERIAL PRIMARY KEY,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      message_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      template_name TEXT NOT NULL,
      payload JSONB,
      status TEXT NOT NULL DEFAULT 'PENDING',
      provider_message_id TEXT,
      error_message TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await executeScript(ddl);
}
