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
    INSERT INTO roles (code, name, description, is_system)
    VALUES 
      ('SUPER_ADMIN', 'Super Administrator', 'Full system access and configurations', TRUE),
      ('STORE_MANAGER', 'Store Manager', 'Manage inventory, purchases, and store operations', TRUE),
      ('CASHIER', 'Cashier / POS Operator', 'Handle daily sales, checkout, and receipt issuance', TRUE),
      ('ACCOUNTS_OFFICER', 'Accounts Officer', 'Manage billing, payments, credit reconciliations', TRUE),
      ('HR_PAYROLL', 'HR & Payroll Officer', 'Manage employee master and payroll recoveries', TRUE)
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
    INSERT INTO departments (code, name, is_active)
    VALUES
      ('ADMIN', 'Administration & Management', TRUE),
      ('OPS', 'Store Operations & Logistics', TRUE),
      ('FIN', 'Finance & Accounts', TRUE),
      ('HR', 'Human Resources', TRUE),
      ('ENGG', 'Engineering & Maintenance', TRUE),
      ('SEC', 'Security & Port Safety', TRUE),
      ('MARINE', 'Marine & Vessel Support', TRUE)
    ON CONFLICT (code) DO NOTHING;
  `);

  // 4. Designations
  await executeRawSql(`
    INSERT INTO designations (department_id, title, is_active)
    SELECT d.id, val.title, TRUE
    FROM (VALUES
      ('ADMIN', 'General Manager'),
      ('OPS', 'Senior Store Manager'),
      ('OPS', 'Inventory Supervisor'),
      ('OPS', 'Store Cashier'),
      ('FIN', 'Accounts Officer'),
      ('HR', 'HR Specialist'),
      ('ENGG', 'Maintenance Lead'),
      ('SEC', 'Security Supervisor'),
      ('MARINE', 'Marine Technical Officer'),
      ('OPS', 'Senior Logistics Coordinator')
    ) AS val(dept_code, title)
    JOIN departments d ON d.code = val.dept_code
    WHERE NOT EXISTS (SELECT 1 FROM designations des WHERE des.department_id = d.id AND des.title = val.title);
  `);

  // 5. System Users (Unlinked to mock employees; authentic administrative accounts)
  await executeRawSql(`
    INSERT INTO users (employee_id, username, email, password_hash, full_name, role_id, is_active)
    VALUES
      (NULL, 'admin', 'admin@cfecc.org', '${adminPasswordHash}', 'CFECC Administrator', (SELECT id FROM roles WHERE code = 'SUPER_ADMIN' LIMIT 1), TRUE),
      (NULL, 'manager', 'manager@cfecc.org', '${managerPasswordHash}', 'Store Manager', (SELECT id FROM roles WHERE code = 'STORE_MANAGER' LIMIT 1), TRUE),
      (NULL, 'cashier', 'cashier@cfecc.org', '${cashierPasswordHash}', 'Store Cashier', (SELECT id FROM roles WHERE code = 'CASHIER' LIMIT 1), TRUE)
    ON CONFLICT (username) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      password_hash = EXCLUDED.password_hash,
      employee_id = NULL,
      email = EXCLUDED.email,
      role_id = EXCLUDED.role_id,
      is_active = TRUE;
  `);

  // 6. Categories & Units
  await executeRawSql(`
    INSERT INTO item_categories (code, name, description)
    VALUES
      ('PROVISIONS', 'Provisions & Groceries', 'Rice, Dal, Atta, Edible Oils, Sugar, Salt, Spices'),
      ('DAIRY', 'Dairy & Refrigerated', 'Milk, Curd, Butter, Paneer, Ghee, Cheese'),
      ('SNACKS', 'Beverages & Snacks', 'Tea, Coffee, Biscuits, Health Drinks, Juices, Dry Fruits'),
      ('PERSONAL', 'Personal Care & Hygiene', 'Soaps, Shampoos, Oral Care, Detergents, Cleaners'),
      ('STATIONERY', 'Stationery & Household', 'Notebooks, Pens, Registers, Office Utility')
    ON CONFLICT (code) DO NOTHING;
  `);

  await executeRawSql(`
    INSERT INTO units (code, name, precision)
    VALUES
      ('PCS', 'Pieces', 0),
      ('KG', 'Kilogram', 3),
      ('PKT', 'Packet', 0),
      ('LTR', 'Liter', 2),
      ('BOX', 'Box', 0)
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
