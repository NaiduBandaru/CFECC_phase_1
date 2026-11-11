import bcrypt from 'bcryptjs';
import { initDatabase, executeRawSql, syncDatabaseSequences } from './index.js';

export async function seedDatabase() {
  console.log('[Seed] Initializing core CFECC system roles, permissions, categories, units, and administrative accounts...');
  await initDatabase();

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', salt);
  const managerPasswordHash = await bcrypt.hash('Manager@123', salt);
  const cashierPasswordHash = await bcrypt.hash('Cashier@123', salt);

  // 1. System Roles
  await executeRawSql(`
    INSERT INTO roles (id, code, name, description, is_system)
    VALUES 
      (1, 'SUPER_ADMIN', 'Super Administrator', 'Full system access and configurations', TRUE),
      (2, 'STORE_MANAGER', 'Store Manager', 'Manage inventory, purchases, and store operations', TRUE),
      (3, 'CASHIER', 'Cashier / POS Operator', 'Handle daily sales, checkout, and receipt issuance', TRUE),
      (4, 'ACCOUNTS_OFFICER', 'Accounts Officer', 'Manage billing, payments, credit reconciliations', TRUE),
      (5, 'HR_PAYROLL', 'HR & Payroll Officer', 'Manage employee master and payroll recoveries', TRUE)
    ON CONFLICT (code) DO NOTHING;
  `);

  // 2. System Permissions
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
      (1, 1, 'General Manager', TRUE),
      (2, 2, 'Senior Store Manager', TRUE),
      (3, 2, 'Inventory Supervisor', TRUE),
      (4, 2, 'Store Cashier', TRUE),
      (5, 3, 'Accounts Officer', TRUE),
      (6, 4, 'HR Specialist', TRUE),
      (7, 5, 'Maintenance Lead', TRUE),
      (8, 6, 'Security Supervisor', TRUE),
      (9, 7, 'Marine Technical Officer', TRUE),
      (10, 2, 'Senior Logistics Coordinator', TRUE)
    ON CONFLICT DO NOTHING;
  `);

  // 5. System Users (Unlinked to mock employees; authentic administrative accounts)
  await executeRawSql(`
    INSERT INTO users (id, employee_id, username, email, password_hash, full_name, role_id, is_active)
    VALUES
      (1, NULL, 'admin', 'admin@cfecc.org', '${adminPasswordHash}', 'CFECC Administrator', 1, TRUE),
      (2, NULL, 'manager', 'manager@cfecc.org', '${managerPasswordHash}', 'Store Manager', 2, TRUE),
      (3, NULL, 'cashier', 'cashier@cfecc.org', '${cashierPasswordHash}', 'Store Cashier', 3, TRUE)
    ON CONFLICT (username) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      employee_id = NULL,
      email = EXCLUDED.email,
      role_id = EXCLUDED.role_id,
      is_active = TRUE;
  `);

  // 6. Categories & Units
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

  // Ensure all sequences are updated past the seeded IDs
  await syncDatabaseSequences();

  console.log('[Seed] Core CFECC system tables initialized successfully (No mock data inserted).');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase().catch((err) => {
    console.error('[Seed Error]:', err);
    process.exit(1);
  });
}
