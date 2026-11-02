import bcrypt from 'bcryptjs';
import { initDatabase, executeRawSql } from './index.js';

export async function seedDatabase() {
  console.log('[Seed] Starting CFECC enterprise database seed...');
  await initDatabase();

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', salt);
  const managerPasswordHash = await bcrypt.hash('Manager@123', salt);
  const cashierPasswordHash = await bcrypt.hash('Cashier@123', salt);

  // 1. Roles
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

  // 2. Permissions
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
      (6, 'SEC', 'Security & Safety', TRUE)
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
      (8, 6, 'Security Supervisor', TRUE)
    ON CONFLICT DO NOTHING;
  `);

  // 5. Sample Employees
  await executeRawSql(`
    INSERT INTO employees (
      id, employee_code, first_name, last_name, date_of_birth, gender,
      mobile, alternate_mobile, email, current_address, permanent_address,
      department_id, designation_id, joining_date, employment_type,
      employment_status, credit_enabled, credit_limit, current_outstanding, available_credit
    ) VALUES
      (
        1, 'CFE-1001', 'Rajesh', 'Varma', '1985-06-15', 'MALE',
        '9848022334', '9848022335', 'rajesh.varma@cfecc.org', 'MVP Colony, Sector 3, Visakhapatnam', 'MVP Colony, Sector 3, Visakhapatnam',
        1, 1, '2018-04-01', 'PERMANENT',
        'ACTIVE', TRUE, 25000.00, 3250.00, 21750.00
      ),
      (
        2, 'CFE-1002', 'Srinivasa', 'Rao', '1990-08-20', 'MALE',
        '9848033445', '9848033446', 'srinivasa.rao@cfecc.org', 'Seethammadhara, Visakhapatnam', 'Gajuwaka, Visakhapatnam',
        2, 2, '2019-07-15', 'PERMANENT',
        'ACTIVE', TRUE, 20000.00, 1840.00, 18160.00
      ),
      (
        3, 'CFE-1003', 'Lakshmi', 'Prasanna', '1994-11-05', 'FEMALE',
        '9848044556', '9848044557', 'lakshmi.p@cfecc.org', 'Muralinagar, Visakhapatnam', 'Muralinagar, Visakhapatnam',
        3, 5, '2021-02-10', 'PERMANENT',
        'ACTIVE', TRUE, 15000.00, 890.00, 14110.00
      ),
      (
        4, 'CFE-1004', 'Venkat', 'Ramana', '1992-03-25', 'MALE',
        '9848055667', NULL, 'venkat.ramana@cfecc.org', 'Akkayyapalem, Visakhapatnam', 'Anakapalle, AP',
        5, 7, '2020-09-01', 'PERMANENT',
        'ACTIVE', TRUE, 15000.00, 4120.00, 10880.00
      ),
      (
        5, 'CFE-1005', 'Kavitha', 'Reddy', '1996-09-12', 'FEMALE',
        '9848066778', NULL, 'kavitha.reddy@cfecc.org', 'Madhurawada, Visakhapatnam', 'Kakinada, AP',
        4, 6, '2022-05-18', 'PERMANENT',
        'ACTIVE', TRUE, 12000.00, 0.00, 12000.00
      )
    ON CONFLICT (employee_code) DO NOTHING;
  `);

  // 6. Users
  await executeRawSql(`
    INSERT INTO users (id, employee_id, username, email, password_hash, full_name, role_id, is_active)
    VALUES
      (1, 1, 'admin', 'admin@cfecc.org', '${adminPasswordHash}', 'Rajesh Varma (Admin)', 1, TRUE),
      (2, 2, 'manager', 'manager@cfecc.org', '${managerPasswordHash}', 'Srinivasa Rao (Manager)', 2, TRUE),
      (3, 3, 'cashier', 'cashier@cfecc.org', '${cashierPasswordHash}', 'Lakshmi Prasanna (Cashier)', 3, TRUE)
    ON CONFLICT (username) DO NOTHING;
  `);

  // 7. Categories & Units
  await executeRawSql(`
    INSERT INTO item_categories (id, code, name, description)
    VALUES
      (1, 'PROVISIONS', 'Provisions & Groceries', 'Rice, Dal, Atta, Edible Oils, Sugar, Spices'),
      (2, 'DAIRY', 'Dairy & Refrigerated', 'Milk, Curd, Butter, Paneer, Cheese'),
      (3, 'SNACKS', 'Beverages & Snacks', 'Tea, Coffee, Biscuits, Health Drinks, Juices'),
      (4, 'PERSONAL', 'Personal Care & Hygiene', 'Soaps, Shampoos, Oral Care, Detergents'),
      (5, 'STATIONERY', 'Stationery & Household', 'Notebooks, Pens, Files, Cleaning materials')
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

  // 8. Items with Regular & Subsidized Employee Price
  await executeRawSql(`
    INSERT INTO items (
      id, item_code, name, category_id, brand, unit_id, barcode,
      purchase_price, selling_price, employee_price, current_stock, min_stock, reorder_level, tax_rate
    ) VALUES
      (1, 'ITM-001', 'Sona Masoori Rice (25kg Bag)', 1, 'BPT Heritage', 1, '89010001', 1250.00, 1450.00, 1350.00, 48.000, 10.000, 20.000, 0.00),
      (2, 'ITM-002', 'Freedom Refined Sunflower Oil (1 Ltr)', 1, 'Freedom', 4, '89010002', 115.00, 135.00, 122.00, 120.000, 25.000, 40.000, 5.00),
      (3, 'ITM-003', 'Aashirvaad Shudh Chakki Atta (10kg)', 1, 'ITC Aashirvaad', 1, '89010003', 420.00, 485.00, 445.00, 35.000, 10.000, 15.000, 0.00),
      (4, 'ITM-004', 'Toor Dal Premium (1kg)', 1, 'Tata Sampann', 2, '89010004', 145.00, 175.00, 155.00, 85.000, 15.000, 30.000, 0.00),
      (5, 'ITM-005', 'Visakha Dairy Standardized Milk (500ml)', 2, 'Visakha Dairy', 3, '89010005', 28.00, 32.00, 30.00, 60.000, 10.000, 20.000, 0.00),
      (6, 'ITM-006', 'Visakha Dairy Pure Ghee (500ml)', 2, 'Visakha Dairy', 4, '89010006', 320.00, 370.00, 340.00, 28.000, 5.000, 10.000, 12.00),
      (7, 'ITM-007', 'Red Label Tea (500g)', 3, 'Brooke Bond', 3, '89010007', 230.00, 270.00, 245.00, 52.000, 10.000, 15.000, 5.00),
      (8, 'ITM-008', 'Bru Instant Coffee (100g Jar)', 3, 'Bru', 1, '89010008', 190.00, 225.00, 205.00, 40.000, 8.000, 15.000, 18.00),
      (9, 'ITM-009', 'Mysore Sandal Soap (Pack of 3)', 4, 'Mysore Sandal', 3, '89010009', 150.00, 180.00, 160.00, 45.000, 10.000, 20.000, 18.00),
      (10, 'ITM-010', 'Surf Excel Quick Wash Detergent (1kg)', 4, 'HUL', 3, '89010010', 135.00, 160.00, 142.00, 50.000, 12.000, 25.000, 18.00)
    ON CONFLICT (item_code) DO NOTHING;
  `);

  // 9. Vendors
  await executeRawSql(`
    INSERT INTO vendors (
      id, vendor_code, name, contact_person, phone, email, address, city, state, gstin, payment_terms_days, opening_balance, current_outstanding
    ) VALUES
      (1, 'VND-001', 'Visakha Dairy Cooperative Ltd', 'M. Ramanathan', '08912517890', 'sales@visakhadairy.com', 'Akkireddypalem, Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '37AAAAA1234A1Z1', 15, 0.00, 14500.00),
      (2, 'VND-002', 'Vizag Wholesale Provisions Agency', 'P. K. Gupta', '08912567843', 'gupta.traders@gmail.com', 'Main Road, Jagadamba Junction, Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '37BBBBB5678B1Z2', 30, 0.00, 38200.00),
      (3, 'VND-003', 'Hindustan Unilever Authorized C&F', 'Anand K.', '08912789123', 'vizag_cf@hul.com', 'Industrial Estate, Auto Nagar, Gajuwaka', 'Visakhapatnam', 'Andhra Pradesh', '37CCCCC9012C1Z3', 30, 0.00, 22100.00)
    ON CONFLICT (vendor_code) DO NOTHING;
  `);

  // 10. Initial Employee Ledger History for active balances
  await executeRawSql(`
    INSERT INTO employee_ledger (
      employee_id, transaction_date, transaction_type, reference_type, reference_id, debit_amount, credit_amount, running_balance, remarks
    ) VALUES
      (1, NOW() - INTERVAL '5 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00001', 3250.00, 0.00, 3250.00, 'Store Credit Purchase at POS Terminal 1'),
      (2, NOW() - INTERVAL '4 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00002', 1840.00, 0.00, 1840.00, 'Store Credit Purchase at POS Terminal 1'),
      (3, NOW() - INTERVAL '3 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00003', 890.00, 0.00, 890.00, 'Store Credit Purchase at POS Terminal 1'),
      (4, NOW() - INTERVAL '2 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00004', 4120.00, 0.00, 4120.00, 'Store Credit Purchase at POS Terminal 1')
    ON CONFLICT DO NOTHING;
  `);

  // 11. Initial Billing Period
  await executeRawSql(`
    INSERT INTO billing_periods (
      id, period_code, period_name, start_date, end_date, billing_date, status, total_employees_billed, total_billed_amount, total_recovered_amount
    ) VALUES
      (1, 'BILL-2026-03', 'March 2026 Store Billing', '2026-02-26', '2026-03-25', '2026-03-26', 'OPEN', 4, 10100.00, 0.00)
    ON CONFLICT (period_code) DO NOTHING;
  `);

  // 12. Sample Purchase Orders
  await executeRawSql(`
    INSERT INTO purchase_orders (
      id, po_number, vendor_id, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, status, notes
    ) VALUES
      (1, 'PO-2026-0001', 1, '2026-03-01', '2026-03-05', 25000.00, 1250.00, 26250.00, 'COMPLETED', 'Regular weekly dairy & ghee replenishment'),
      (2, 'PO-2026-0002', 2, '2026-03-05', '2026-03-10', 45000.00, 2250.00, 47250.00, 'COMPLETED', 'Monthly rice & grocery bulk procurement'),
      (3, 'PO-2026-0003', 3, '2026-03-10', '2026-03-15', 30000.00, 5400.00, 35400.00, 'APPROVED', 'Soaps & detergents FMCG stock order')
    ON CONFLICT (po_number) DO NOTHING;
  `);

  // 13. Sample Purchase Order Items
  await executeRawSql(`
    INSERT INTO purchase_order_items (
      id, po_id, item_id, ordered_qty, received_qty, unit_price, tax_rate, tax_amount, total_price
    ) VALUES
      (1, 1, 5, 200.000, 200.000, 28.00, 0.00, 0.00, 5600.00),
      (2, 1, 6, 60.000, 60.000, 320.00, 12.00, 2304.00, 21504.00),
      (3, 2, 1, 30.000, 30.000, 1250.00, 0.00, 0.00, 37500.00),
      (4, 2, 4, 50.000, 50.000, 145.00, 0.00, 0.00, 7250.00),
      (5, 3, 9, 100.000, 0.000, 150.00, 18.00, 2700.00, 17700.00),
      (6, 3, 10, 100.000, 0.000, 135.00, 18.00, 2430.00, 15930.00)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 14. Sample Goods Receipts (GRN)
  await executeRawSql(`
    INSERT INTO goods_receipts (
      id, grn_number, po_id, vendor_id, receipt_date, delivery_challan_number, vehicle_number, status, notes
    ) VALUES
      (1, 'GRN-2026-0001', 1, 1, '2026-03-04', 'DC-VD-8812', 'AP 31 TT 4421', 'VERIFIED', 'Received all dairy cartons in refrigerated condition'),
      (2, 'GRN-2026-0002', 2, 2, '2026-03-09', 'DC-ZW-4019', 'AP 31 TY 1109', 'VERIFIED', 'Received rice bags and toor dal in good condition')
    ON CONFLICT (grn_number) DO NOTHING;
  `);

  // 15. Sample Goods Receipt Items
  await executeRawSql(`
    INSERT INTO goods_receipt_items (
      id, grn_id, item_id, received_qty, accepted_qty, rejected_qty, unit_cost
    ) VALUES
      (1, 1, 5, 200.000, 200.000, 0.000, 28.00),
      (2, 1, 6, 60.000, 60.000, 0.000, 320.00),
      (3, 2, 1, 30.000, 30.000, 0.000, 1250.00),
      (4, 2, 4, 50.000, 50.000, 0.000, 145.00)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 16. Sample Purchase Invoices
  await executeRawSql(`
    INSERT INTO purchase_invoices (
      id, invoice_number, system_bill_number, vendor_id, grn_id, invoice_date, due_date,
      subtotal, tax_amount, total_amount, paid_amount, status, notes
    ) VALUES
      (1, 'INV-VD-2026-091', 'PINV-2026-0001', 1, 1, '2026-03-04', '2026-03-19', 24800.00, 2304.00, 27104.00, 15000.00, 'PARTIALLY_PAID', 'Partially cleared via RTGS, balance payable'),
      (2, 'INV-VWP-5510', 'PINV-2026-0002', 2, 2, '2026-03-09', '2026-04-08', 44750.00, 0.00, 44750.00, 44750.00, 'PAID', 'Full payment settled via NEFT')
    ON CONFLICT (system_bill_number) DO NOTHING;
  `);

  // 17. Sample Vendor Payments
  await executeRawSql(`
    INSERT INTO vendor_payments (
      id, payment_number, vendor_id, payment_date, payment_mode, amount, reference_number, purchase_invoice_id, notes
    ) VALUES
      (1, 'VPAY-2026-0001', 1, '2026-03-06', 'NEFT_RTGS', 15000.00, 'UTR-SBI-9912048', 1, 'Advance part payment against milk delivery'),
      (2, 'VPAY-2026-0002', 2, '2026-03-12', 'NEFT_RTGS', 44750.00, 'UTR-SBI-4481023', 2, 'Full settlement for rice and dal procurement')
    ON CONFLICT (payment_number) DO NOTHING;
  `);

  console.log('[Seed] Database seeding completed successfully.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase().catch((err) => {
    console.error('[Seed Error]:', err);
    process.exit(1);
  });
}
