import bcrypt from 'bcryptjs';
import { initDatabase, executeRawSql, syncDatabaseSequences } from './index.js';

export async function initCleanProduction() {
  console.log('====================================================');
  console.log('[CFECC Production Initializer]');
  console.log('Setting up clean enterprise schema with NO dummy data...');
  console.log('====================================================');

  await initDatabase();

  const salt = await bcrypt.genSalt(10);
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123';
  const adminPasswordHash = await bcrypt.hash(initialAdminPassword, salt);

  // 1. Roles (Core System Roles)
  console.log('[1/6] Seeding system roles...');
  await executeRawSql(`
    INSERT INTO roles (id, code, name, description, is_system)
    VALUES 
      (1, 'SUPER_ADMIN', 'Super Administrator', 'Full system access, configurations, and overrides', TRUE),
      (2, 'STORE_MANAGER', 'Store Manager', 'Manage inventory, purchasing, pricing, and operational reports', TRUE),
      (3, 'CASHIER', 'Cashier / POS Operator', 'Counter sales, barcode checkout, and receipt issuance', TRUE),
      (4, 'ACCOUNTS_OFFICER', 'Accounts Officer', 'Billing periods, ledger accounting, and credit reconciliation', TRUE),
      (5, 'HR_PAYROLL', 'HR & Payroll Officer', 'Employee KYC master, store recovery statements, and payroll advice', TRUE)
    ON CONFLICT (code) DO NOTHING;
  `);

  // 2. System Permissions
  console.log('[2/6] Seeding module permissions...');
  const permissionsList = [
    { mod: 'pos', act: 'checkout', code: 'pos:checkout', desc: 'Process point of sale orders' },
    { mod: 'pos', act: 'discount', code: 'pos:discount', desc: 'Apply discounts at checkout' },
    { mod: 'sales', act: 'view', code: 'sales:view', desc: 'View sales invoices' },
    { mod: 'sales', act: 'return', code: 'sales:return', desc: 'Process sales returns' },
    { mod: 'inventory', act: 'view', code: 'inventory:view', desc: 'View inventory & stock balances' },
    { mod: 'inventory', act: 'adjust', code: 'inventory:adjust', desc: 'Perform manual stock adjustments' },
    { mod: 'items', act: 'manage', code: 'items:manage', desc: 'Create and edit items & pricing' },
    { mod: 'purchasing', act: 'create', code: 'purchasing:create', desc: 'Create PO and GRN' },
    { mod: 'purchasing', act: 'approve', code: 'purchasing:approve', desc: 'Approve purchase invoices' },
    { mod: 'vendors', act: 'manage', code: 'vendors:manage', desc: 'Manage vendor master & payments' },
    { mod: 'employees', act: 'view', code: 'employees:view', desc: 'View employee directory' },
    { mod: 'employees', act: 'manage', code: 'employees:manage', desc: 'Create and update employee records' },
    { mod: 'billing', act: 'generate', code: 'billing:generate', desc: 'Run monthly billing engine' },
    { mod: 'billing', act: 'finalize', code: 'billing:finalize', desc: 'Finalize monthly statements' },
    { mod: 'payroll', act: 'process', code: 'payroll:process', desc: 'Process payroll and store recovery' },
    { mod: 'reports', act: 'view', code: 'reports:view', desc: 'Access financial & operational reports' },
    { mod: 'admin', act: 'full', code: 'admin:full', desc: 'Full system administration' }
  ];

  for (const p of permissionsList) {
    await executeRawSql(`
      INSERT INTO permissions (module, action, code, description)
      VALUES ('${p.mod}', '${p.act}', '${p.code}', '${p.desc}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // 3. Departments
  console.log('[3/6] Seeding standard departments...');
  await executeRawSql(`
    INSERT INTO departments (id, code, name, is_active)
    VALUES
      (1, 'ADMIN', 'Administration & Management', TRUE),
      (2, 'OPS', 'Store Operations & Logistics', TRUE),
      (3, 'FIN', 'Finance & Accounts', TRUE),
      (4, 'HR', 'Human Resources', TRUE),
      (5, 'ENGG', 'Engineering & Maintenance', TRUE),
      (6, 'SEC', 'Security & Port Safety', TRUE),
      (7, 'MARINE', 'Marine & Vessel Support', TRUE)
    ON CONFLICT (code) DO NOTHING;
  `);

  // 4. Designations
  await executeRawSql(`
    INSERT INTO designations (id, department_id, title, is_active)
    VALUES
      (1, 1, 'General Manager / Secretary', TRUE),
      (2, 2, 'Store Superintendent', TRUE),
      (3, 3, 'Senior Accounts Officer', TRUE),
      (4, 2, 'Counter Cashier / Operator', TRUE),
      (5, 4, 'HR & Payroll Executive', TRUE)
    ON CONFLICT DO NOTHING;
  `);

  // 5. Units & Categories Master
  console.log('[4/6] Seeding standard units and categories...');
  await executeRawSql(`
    INSERT INTO units (id, code, name, precision)
    VALUES
      (1, 'PCS', 'Pieces', 0),
      (2, 'KG', 'Kilogram', 3),
      (3, 'PKT', 'Packet', 0),
      (4, 'LTR', 'Liter', 2),
      (5, 'BOX', 'Box', 0)
    ON CONFLICT (code) DO NOTHING;
  `);

  await executeRawSql(`
    INSERT INTO item_categories (id, code, name, description)
    VALUES
      (1, 'PROVISIONS', 'Provisions & Groceries', 'Rice, Dal, Atta, Edible Oils, Sugar, Salt, Spices'),
      (2, 'DAIRY', 'Dairy & Refrigerated', 'Milk, Curd, Butter, Paneer, Ghee, Cheese'),
      (3, 'SNACKS', 'Beverages & Snacks', 'Tea, Coffee, Biscuits, Health Drinks, Juices, Dry Fruits'),
      (4, 'PERSONAL', 'Personal Care & Hygiene', 'Soaps, Shampoos, Oral Care, Detergents, Cleaners'),
      (5, 'STATIONERY', 'Stationery & Household', 'Notebooks, Pens, Registers, Office Utility')
    ON CONFLICT (code) DO NOTHING;
  `);

  // 6. Primary Administrator User
  console.log('[5/6] Creating primary Administrator account...');
  await executeRawSql(`
    INSERT INTO users (id, employee_id, username, email, password_hash, full_name, role_id, is_active)
    VALUES
      (1, NULL, 'admin', 'admin@cfecc.org', '${adminPasswordHash}', 'System Administrator', 1, TRUE)
    ON CONFLICT (username) DO UPDATE SET
      password_hash = '${adminPasswordHash}',
      is_active = TRUE;
  `);

  // Synchronize sequences
  console.log('[6/6] Synchronizing database sequences...');
  await syncDatabaseSequences();

  console.log('====================================================');
  console.log('✅ Clean production database initialization COMPLETE!');
  console.log('Initial Super Admin: username="admin"');
  console.log('====================================================');
}

if (process.argv[1]?.endsWith('clean-production-init.ts')) {
  initCleanProduction().catch((err) => {
    console.error('[Clean Production Init Error]:', err);
    process.exit(1);
  });
}

