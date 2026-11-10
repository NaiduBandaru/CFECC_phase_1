import bcrypt from 'bcryptjs';
import { initDatabase, executeRawSql, syncDatabaseSequences } from './index.js';

export async function seedDatabase() {
  console.log('[Seed] Starting comprehensive CFECC enterprise database seed for all modules...');
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

  // 5. Extended Employee Master (12 Employees across all departments)
  await executeRawSql(`
    INSERT INTO employees (
      id, employee_code, first_name, last_name, date_of_birth, gender,
      mobile, alternate_mobile, email, current_address, permanent_address,
      department_id, designation_id, joining_date, employment_type,
      employment_status, credit_enabled, credit_limit, current_outstanding, available_credit
    ) VALUES
      (
        1, 'CFE-1001', 'Rajesh', 'Varma', '1985-06-15', 'MALE',
        '9985172319', '9848022335', 'rajesh.varma@cfecc.org', 'MVP Colony, Sector 3, Visakhapatnam', 'MVP Colony, Sector 3, Visakhapatnam',
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
        'ACTIVE', TRUE, 18000.00, 890.00, 17110.00
      ),
      (
        4, 'CFE-1004', 'Venkat', 'Ramana', '1992-03-25', 'MALE',
        '9848055667', NULL, 'venkat.ramana@cfecc.org', 'Akkayyapalem, Visakhapatnam', 'Anakapalle, AP',
        5, 7, '2020-09-01', 'PERMANENT',
        'ACTIVE', TRUE, 20000.00, 4120.00, 15880.00
      ),
      (
        5, 'CFE-1005', 'Kavitha', 'Reddy', '1996-09-12', 'FEMALE',
        '9848066778', NULL, 'kavitha.reddy@cfecc.org', 'Madhurawada, Visakhapatnam', 'Kakinada, AP',
        4, 6, '2022-05-18', 'PERMANENT',
        'ACTIVE', TRUE, 15000.00, 0.00, 15000.00
      ),
      (
        6, 'CFE-1006', 'Chandra', 'Sekhar', '1988-01-14', 'MALE',
        '9848077889', NULL, 'chandra.sekhar@cfecc.org', 'Kurmannapalem, Visakhapatnam', 'Vizianagaram, AP',
        6, 8, '2019-01-10', 'PERMANENT',
        'ACTIVE', TRUE, 18000.00, 2150.00, 15850.00
      ),
      (
        7, 'CFE-1007', 'Nagarjuna', 'Babu', '1991-04-30', 'MALE',
        '9848088990', NULL, 'nagarjuna.b@cfecc.org', 'Pendurthi, Visakhapatnam', 'Pendurthi, Visakhapatnam',
        7, 9, '2020-11-15', 'PERMANENT',
        'ACTIVE', TRUE, 25000.00, 3600.00, 21400.00
      ),
      (
        8, 'CFE-1008', 'Anuradha', 'Devi', '1995-12-08', 'FEMALE',
        '9848099001', NULL, 'anuradha.d@cfecc.org', 'Dwaraka Nagar, Visakhapatnam', 'Visakhapatnam',
        2, 4, '2022-08-01', 'PERMANENT',
        'ACTIVE', TRUE, 15000.00, 1200.00, 13800.00
      ),
      (
        9, 'CFE-1009', 'Suresh', 'Kumar', '1987-07-22', 'MALE',
        '9848100112', NULL, 'suresh.k@cfecc.org', 'Gajuwaka, Visakhapatnam', 'Srikakulam, AP',
        5, 7, '2017-03-20', 'PERMANENT',
        'ACTIVE', TRUE, 22000.00, 2850.00, 19150.00
      ),
      (
        10, 'CFE-1010', 'Bhavani', 'Shankar', '1993-10-18', 'MALE',
        '9848111223', NULL, 'bhavani.s@cfecc.org', 'Siripuram, Visakhapatnam', 'Visakhapatnam',
        2, 10, '2021-06-15', 'PERMANENT',
        'ACTIVE', TRUE, 20000.00, 0.00, 20000.00
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

  // 8. Rich Store Items Master (28 Items with dual pricing and stock thresholds)
  await executeRawSql(`
    INSERT INTO items (
      id, item_code, name, category_id, brand, unit_id, barcode,
      purchase_price, selling_price, employee_price, current_stock, min_stock, reorder_level, tax_rate
    ) VALUES
      -- Provisions (Category 1)
      (1, 'ITM-001', 'Sona Masoori Rice (25kg Bag)', 1, 'BPT Heritage', 1, '89010001', 1250.00, 1450.00, 1350.00, 48.000, 10.000, 20.000, 0.00),
      (2, 'ITM-002', 'Freedom Refined Sunflower Oil (1 Ltr)', 1, 'Freedom', 4, '89010002', 115.00, 135.00, 122.00, 120.000, 25.000, 40.000, 5.00),
      (3, 'ITM-003', 'Aashirvaad Shudh Chakki Atta (10kg)', 1, 'ITC Aashirvaad', 1, '89010003', 420.00, 485.00, 445.00, 35.000, 10.000, 15.000, 0.00),
      (4, 'ITM-004', 'Toor Dal Premium (1kg)', 1, 'Tata Sampann', 2, '89010004', 145.00, 175.00, 155.00, 85.000, 15.000, 30.000, 0.00),
      (15, 'ITM-015', 'Moong Dal Yellow Split (1kg)', 1, 'Tata Sampann', 2, '89010015', 130.00, 155.00, 142.00, 60.000, 12.000, 25.000, 0.00),
      (16, 'ITM-016', 'Sugar Premium Crystal (1kg)', 1, 'Madhur Sugar', 2, '89010016', 42.00, 48.00, 45.00, 150.000, 30.000, 50.000, 5.00),
      (17, 'ITM-017', 'Tata Iodized Salt (1kg)', 1, 'Tata Salt', 3, '89010017', 22.00, 28.00, 25.00, 100.000, 20.000, 40.000, 0.00),
      (18, 'ITM-018', 'Gold Drop Groundnut Oil (1 Ltr)', 1, 'Gold Drop', 4, '89010018', 165.00, 190.00, 175.00, 80.000, 15.000, 30.000, 5.00),

      -- Dairy & Refrigerated (Category 2)
      (5, 'ITM-005', 'Visakha Dairy Standardized Milk (500ml)', 2, 'Visakha Dairy', 3, '89010005', 28.00, 32.00, 30.00, 60.000, 10.000, 20.000, 0.00),
      (6, 'ITM-006', 'Visakha Dairy Pure Ghee (500ml)', 2, 'Visakha Dairy', 4, '89010006', 320.00, 370.00, 340.00, 28.000, 5.000, 10.000, 12.00),
      (11, 'ITM-011', 'Visakha Dairy Fresh Curd (500g Pouch)', 2, 'Visakha Dairy', 3, '89010011', 32.00, 38.00, 35.00, 90.000, 15.000, 25.000, 0.00),
      (12, 'ITM-012', 'Visakha Dairy Butter Unsalted (500g)', 2, 'Visakha Dairy', 1, '89010012', 260.00, 295.00, 280.00, 40.000, 8.000, 15.000, 12.00),
      (13, 'ITM-013', 'Visakha Dairy Malai Paneer (200g)', 2, 'Visakha Dairy', 3, '89010013', 95.00, 115.00, 105.00, 55.000, 10.000, 20.000, 0.00),
      (14, 'ITM-014', 'Visakha Dairy Flavoured Badam Milk (200ml)', 2, 'Visakha Dairy', 1, '89010014', 30.00, 38.00, 34.00, 75.000, 15.000, 30.000, 12.00),

      -- Snacks & Beverages (Category 3)
      (7, 'ITM-007', 'Red Label Tea (500g)', 3, 'Brooke Bond', 3, '89010007', 230.00, 270.00, 245.00, 52.000, 10.000, 15.000, 5.00),
      (8, 'ITM-008', 'Bru Instant Coffee (100g Jar)', 3, 'Bru', 1, '89010008', 190.00, 225.00, 205.00, 40.000, 8.000, 15.000, 18.00),
      (23, 'ITM-023', 'Sunfeast Dark Fantasy Choco Fills (300g)', 3, 'ITC Sunfeast', 1, '89010023', 120.00, 150.00, 135.00, 65.000, 10.000, 20.000, 18.00),
      (24, 'ITM-024', 'Horlicks Classic Malt Refill (500g)', 3, 'HUL Horlicks', 3, '89010024', 240.00, 285.00, 260.00, 40.000, 10.000, 15.000, 18.00),

      -- Personal Care & Hygiene (Category 4)
      (9, 'ITM-009', 'Mysore Sandal Soap (Pack of 3)', 4, 'Mysore Sandal', 3, '89010009', 150.00, 180.00, 160.00, 45.000, 10.000, 20.000, 18.00),
      (10, 'ITM-010', 'Surf Excel Quick Wash Detergent (1kg)', 4, 'HUL', 3, '89010010', 135.00, 160.00, 142.00, 50.000, 12.000, 25.000, 18.00),
      (19, 'ITM-019', 'Lifebuoy Total Germ Protection Soap (125g)', 4, 'HUL', 1, '89010019', 32.00, 38.00, 35.00, 110.000, 20.000, 40.000, 18.00),
      (20, 'ITM-020', 'Clinic Plus Strong & Long Shampoo (175ml)', 4, 'HUL', 1, '89010020', 110.00, 135.00, 122.00, 45.000, 10.000, 20.000, 18.00),
      (21, 'ITM-021', 'Vim Dishwash Gel Lemon (500ml)', 4, 'HUL', 1, '89010021', 90.00, 110.00, 98.00, 65.000, 12.000, 25.000, 18.00),
      (22, 'ITM-022', 'Close Up Everfresh Red Hot Toothpaste (150g)', 4, 'HUL', 1, '89010022', 85.00, 105.00, 94.00, 70.000, 15.000, 30.000, 18.00),
      (25, 'ITM-025', 'Goodknight Gold Flash Mosquito Liquid Refill', 4, 'Godrej', 1, '89010025', 72.00, 89.00, 80.00, 85.000, 15.000, 30.000, 18.00),
      (26, 'ITM-026', 'Cinthol Original Deodorant Bathing Soap (100g)', 4, 'Godrej', 1, '89010026', 38.00, 45.00, 40.00, 90.000, 20.000, 35.000, 18.00),

      -- Stationery & Utility (Category 5)
      (27, 'ITM-027', 'Classmate Long Notebook Ruled (160 Pages)', 5, 'ITC Classmate', 1, '89010027', 48.00, 60.00, 52.00, 120.000, 25.000, 50.000, 12.00),
      (28, 'ITM-028', 'Reynolds 045 Fine Carbide Ball Pen (Box of 20)', 5, 'Reynolds', 5, '89010028', 140.00, 180.00, 160.00, 30.000, 5.000, 10.000, 12.00)
    ON CONFLICT (item_code) DO NOTHING;
  `);

  // 9. Item Price History (for Item Pricing page audit trail)
  await executeRawSql(`
    INSERT INTO item_price_history (
      item_id, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price,
      old_employee_price, new_employee_price, reason, changed_by, created_at
    ) VALUES
      (1, 1200.00, 1250.00, 1400.00, 1450.00, 1300.00, 1350.00, 'Vendor revised procurement cost for Sona Masoori Rice', 1, NOW() - INTERVAL '15 days'),
      (2, 110.00, 115.00, 130.00, 135.00, 118.00, 122.00, 'Global edible oil market price escalation', 1, NOW() - INTERVAL '12 days'),
      (5, 26.00, 28.00, 30.00, 32.00, 28.00, 30.00, 'Visakha Dairy official rate card update for milk', 1, NOW() - INTERVAL '10 days'),
      (6, 300.00, 320.00, 350.00, 370.00, 325.00, 340.00, 'Ghee procurement price increase by dairy federation', 1, NOW() - INTERVAL '8 days'),
      (7, 220.00, 230.00, 260.00, 270.00, 235.00, 245.00, 'Tea auction rate adjustment', 1, NOW() - INTERVAL '5 days')
    ON CONFLICT DO NOTHING;
  `);

  // 10. Vendors (6 Authentic Regional Suppliers in Visakhapatnam)
  await executeRawSql(`
    INSERT INTO vendors (
      id, vendor_code, name, contact_person, phone, email, address, city, state, gstin, payment_terms_days, opening_balance, current_outstanding
    ) VALUES
      (1, 'VND-001', 'Visakha Dairy Cooperative Ltd', 'M. Ramanathan', '08912517890', 'sales@visakhadairy.com', 'Akkireddypalem, Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '37AAAAA1234A1Z1', 15, 0.00, 14500.00),
      (2, 'VND-002', 'Vizag Wholesale Provisions Agency', 'P. K. Gupta', '08912567843', 'gupta.traders@gmail.com', 'Main Road, Jagadamba Junction, Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '37BBBBB5678B1Z2', 30, 0.00, 38200.00),
      (3, 'VND-003', 'Hindustan Unilever Authorized C&F', 'Anand K.', '08912789123', 'vizag_cf@hul.com', 'Industrial Estate, Auto Nagar, Gajuwaka', 'Visakhapatnam', 'Andhra Pradesh', '37CCCCC9012C1Z3', 30, 0.00, 22100.00),
      (4, 'VND-004', 'ITC Foods Regional Hub', 'S. K. Verma', '08912588102', 'itc_vizag@itc.in', 'Port Area Logistics Park, Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '37DDDDD3456D1Z4', 30, 0.00, 18500.00),
      (5, 'VND-005', 'Godrej Consumer Products C&F Vizag', 'N. Mohan Rao', '08912744319', 'godrej.vizag@godrej.com', 'Auto Nagar Phase 2, Gajuwaka', 'Visakhapatnam', 'Andhra Pradesh', '37EEEEE7890E1Z5', 21, 0.00, 12400.00),
      (6, 'VND-006', 'Tata Consumer Products Wholesale Agency', 'Ramesh Patnaik', '08912633091', 'tataproducts.vsp@gmail.com', 'Near Port Stadium, Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '37FFFFF2345F1Z6', 30, 0.00, 25600.00)
    ON CONFLICT (vendor_code) DO NOTHING;
  `);

  // 11. Purchase Orders
  await executeRawSql(`
    INSERT INTO purchase_orders (
      id, po_number, vendor_id, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, status, notes
    ) VALUES
      (1, 'PO-2026-0001', 1, '2026-03-01', '2026-03-05', 25000.00, 1250.00, 26250.00, 'COMPLETED', 'Regular weekly dairy & ghee replenishment'),
      (2, 'PO-2026-0002', 2, '2026-03-05', '2026-03-10', 45000.00, 2250.00, 47250.00, 'COMPLETED', 'Monthly rice & grocery bulk procurement'),
      (3, 'PO-2026-0003', 3, '2026-03-10', '2026-03-15', 30000.00, 5400.00, 35400.00, 'COMPLETED', 'Soaps & detergents FMCG stock order'),
      (4, 'PO-2026-0004', 1, '2026-03-15', '2026-03-18', 21330.00, 1422.00, 22752.00, 'COMPLETED', 'Dairy fresh paneer, curd, butter & badam milk procurement'),
      (5, 'PO-2026-0005', 2, '2026-03-18', '2026-03-22', 32400.00, 1160.00, 33560.00, 'COMPLETED', 'Edible oil, refined sugar, salt & dals consignment'),
      (6, 'PO-2026-0006', 3, '2026-03-20', '2026-03-25', 24800.00, 4464.00, 29264.00, 'COMPLETED', 'HUL personal care: shampoo, toothpastes, bar soaps & dishwash'),
      (7, 'PO-2026-0007', 4, '2026-03-22', '2026-03-26', 18500.00, 2220.00, 20720.00, 'COMPLETED', 'ITC biscuits, Sunfeast dark fantasy & Classmate notebooks'),
      (8, 'PO-2026-0008', 5, '2026-03-24', '2026-03-28', 12400.00, 2232.00, 14632.00, 'APPROVED', 'Godrej Goodknight mosquito refills & Cinthol soaps consignment'),
      (9, 'PO-2026-0009', 1, '2026-10-31', '2026-11-02', 42500.00, 2125.00, 44625.00, 'COMPLETED', 'Visakha Dairy fresh bulk milk & pure ghee supply'),
      (10, 'PO-2026-0010', 2, '2026-11-01', '2026-11-03', 38000.00, 1900.00, 39900.00, 'APPROVED', 'Wholesale Sona Masoori rice & edible oil'),
      (11, 'PO-2026-0011', 3, '2026-11-02', '2026-11-04', 24500.00, 1225.00, 25725.00, 'APPROVED', 'HUL Surf Excel & Bru Coffee FMCG bulk stock')
    ON CONFLICT (po_number) DO NOTHING;
  `);

  // 12. Purchase Order Items
  await executeRawSql(`
    INSERT INTO purchase_order_items (
      id, po_id, item_id, ordered_qty, received_qty, unit_price, tax_rate, tax_amount, total_price
    ) VALUES
      (1, 1, 5, 200.000, 200.000, 28.00, 0.00, 0.00, 5600.00),
      (2, 1, 6, 60.000, 60.000, 320.00, 12.00, 2304.00, 21504.00),
      (3, 2, 1, 30.000, 30.000, 1250.00, 0.00, 0.00, 37500.00),
      (4, 2, 4, 50.000, 50.000, 145.00, 0.00, 0.00, 7250.00),
      (5, 3, 9, 100.000, 100.000, 150.00, 18.00, 2700.00, 17700.00),
      (6, 3, 10, 100.000, 100.000, 135.00, 18.00, 2430.00, 15930.00),
      (7, 4, 11, 100.000, 100.000, 32.00, 0.00, 0.00, 3200.00),
      (8, 4, 12, 40.000, 40.000, 260.00, 12.00, 1248.00, 11648.00),
      (9, 4, 13, 60.000, 60.000, 95.00, 0.00, 0.00, 5700.00),
      (10, 4, 14, 80.000, 80.000, 30.00, 12.00, 288.00, 2688.00),
      (11, 5, 2, 100.000, 100.000, 115.00, 5.00, 575.00, 12075.00),
      (12, 5, 3, 30.000, 30.000, 420.00, 0.00, 0.00, 12600.00),
      (13, 5, 15, 40.000, 40.000, 130.00, 0.00, 0.00, 5200.00),
      (14, 5, 16, 120.000, 120.000, 42.00, 5.00, 252.00, 5292.00),
      (15, 6, 19, 120.000, 120.000, 32.00, 18.00, 691.20, 4531.20),
      (16, 6, 20, 50.000, 50.000, 110.00, 18.00, 990.00, 6490.00),
      (17, 6, 21, 70.000, 70.000, 90.00, 18.00, 1134.00, 7434.00),
      (18, 6, 22, 80.000, 80.000, 85.00, 18.00, 1224.00, 8024.00),
      (19, 7, 23, 80.000, 80.000, 120.00, 18.00, 1728.00, 11328.00),
      (20, 7, 27, 150.000, 150.000, 48.00, 12.00, 864.00, 8064.00),
      -- PO 8: Vendor 5 (Godrej Consumer Products)
      (21, 8, 25, 100.000, 100.000, 72.00, 18.00, 1296.00, 8496.00),
      (22, 8, 26, 100.000, 100.000, 52.00, 18.00, 936.00, 6136.00),
      -- PO 9: Vendor 1 (Visakha Dairy)
      (23, 9, 5, 550.000, 550.000, 28.00, 5.00, 770.00, 16170.00),
      (24, 9, 6, 75.000, 75.000, 320.00, 5.00, 1200.00, 25200.00),
      (25, 9, 14, 100.000, 100.000, 31.00, 5.00, 155.00, 3255.00),
      -- PO 10: Vendor 2 (Vizag Wholesale)
      (26, 10, 1, 20.000, 0.000, 1250.00, 5.00, 1250.00, 26250.00),
      (27, 10, 4, 50.000, 0.000, 145.00, 5.00, 362.50, 7612.50),
      (28, 10, 2, 50.000, 0.000, 115.00, 5.00, 287.50, 6037.50),
      -- PO 11: Vendor 3 (HUL)
      (29, 11, 9, 100.000, 0.000, 150.00, 5.00, 750.00, 15750.00),
      (30, 11, 8, 50.000, 0.000, 190.00, 5.00, 475.00, 9975.00)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 13. Goods Receipts (GRN)
  await executeRawSql(`
    INSERT INTO goods_receipts (
      id, grn_number, po_id, vendor_id, receipt_date, delivery_challan_number, vehicle_number, status, notes
    ) VALUES
      (1, 'GRN-2026-0001', 1, 1, '2026-03-04', 'DC-VD-8812', 'AP 31 TT 4421', 'VERIFIED', 'Received all dairy cartons in refrigerated condition'),
      (2, 'GRN-2026-0002', 2, 2, '2026-03-09', 'DC-ZW-4019', 'AP 31 TY 1109', 'VERIFIED', 'Received rice bags and toor dal in good condition'),
      (3, 'GRN-2026-0003', 3, 3, '2026-03-14', 'DC-HUL-1029', 'AP 31 U 8802', 'VERIFIED', 'FMCG personal care soaps and detergents stock received'),
      (4, 'GRN-2026-0004', 4, 1, '2026-03-17', 'DC-VD-8945', 'AP 31 TT 4421', 'VERIFIED', 'Fresh paneer and curd consignments delivered safely'),
      (5, 'GRN-2026-0005', 5, 2, '2026-03-21', 'DC-ZW-4190', 'AP 31 TY 1109', 'VERIFIED', 'Edible oils and sugar sacks unloaded in store storage'),
      (6, 'GRN-2026-0006', 3, 3, '2026-03-24', 'DC-HUL-1188', 'AP 31 U 8802', 'VERIFIED', 'Shampoos, teas and toothpastes checked and verified'),
      (7, 'GRN-2026-0007', 7, 4, '2026-03-25', 'DC-ITC-9901', 'AP 31 V 4510', 'VERIFIED', 'Biscuits and Classmate long notebooks received in store'),
      (8, 'GRN-2026-0008', 8, 5, '2026-03-26', 'DC-GD-7712', 'AP 31 U 9081', 'VERIFIED', 'Goodknight mosquito repellent packs and Cinthol soaps safely unloaded'),
      (9, 'GRN-2026-0009', 9, 6, '2026-03-27', 'DC-TCP-4412', 'AP 31 V 1102', 'VERIFIED', 'Tata Sampann pulses and iodized salt bags verified and stacked')
    ON CONFLICT (grn_number) DO NOTHING;
  `);

  // 13b. Goods Receipt Items (for 3-Way Matching and itemized receipt details)
  await executeRawSql(`
    INSERT INTO goods_receipt_items (
      id, grn_id, item_id, received_qty, accepted_qty, rejected_qty, unit_cost, rejection_reason
    ) VALUES
      (1, 1, 5, 200.000, 200.000, 0.000, 28.00, null),
      (2, 1, 6, 60.000, 60.000, 0.000, 320.00, null),
      (3, 2, 1, 30.000, 30.000, 0.000, 1250.00, null),
      (4, 2, 4, 50.000, 50.000, 0.000, 145.00, null),
      (5, 3, 9, 100.000, 100.000, 0.000, 150.00, null),
      (6, 3, 10, 100.000, 100.000, 0.000, 135.00, null),
      (7, 4, 11, 100.000, 100.000, 0.000, 32.00, null),
      (8, 4, 12, 40.000, 40.000, 0.000, 260.00, null),
      (9, 4, 13, 60.000, 60.000, 0.000, 95.00, null),
      (10, 4, 14, 80.000, 80.000, 0.000, 30.00, null),
      (11, 5, 2, 100.000, 100.000, 0.000, 115.00, null),
      (12, 5, 3, 30.000, 30.000, 0.000, 420.00, null),
      (13, 5, 15, 40.000, 40.000, 0.000, 130.00, null),
      (14, 5, 16, 120.000, 120.000, 0.000, 42.00, null),
      (15, 6, 19, 120.000, 120.000, 0.000, 32.00, null),
      (16, 6, 20, 50.000, 50.000, 0.000, 110.00, null),
      (17, 6, 21, 70.000, 70.000, 0.000, 90.00, null),
      (18, 6, 22, 80.000, 80.000, 0.000, 85.00, null),
      (19, 7, 23, 80.000, 80.000, 0.000, 120.00, null),
      (20, 7, 27, 150.000, 150.000, 0.000, 48.00, null),
      (21, 8, 25, 100.000, 100.000, 0.000, 72.00, null),
      (22, 8, 26, 100.000, 100.000, 0.000, 52.00, null),
      (23, 9, 4, 100.000, 100.000, 0.000, 145.00, null)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 14. Purchase Invoices
  await executeRawSql(`
    INSERT INTO purchase_invoices (
      id, invoice_number, system_bill_number, vendor_id, grn_id, invoice_date, due_date,
      subtotal, tax_amount, total_amount, paid_amount, status, notes
    ) VALUES
      (1, 'INV-VD-2026-091', 'PINV-2026-0001', 1, 1, '2026-03-04', '2026-03-19', 24796.00, 2304.00, 27100.00, 15000.00, 'PARTIALLY_PAID', 'Partially cleared via RTGS, balance payable'),
      (2, 'INV-VWP-5510', 'PINV-2026-0002', 2, 2, '2026-03-09', '2026-04-08', 44750.00, 0.00, 44750.00, 44750.00, 'PAID', 'Full payment settled via NEFT'),
      (3, 'INV-HUL-8821', 'PINV-2026-0003', 3, 3, '2026-03-14', '2026-04-13', 28500.00, 5130.00, 33630.00, 15000.00, 'PARTIALLY_PAID', 'Advance partial payment made'),
      (4, 'INV-VD-2026-118', 'PINV-2026-0004', 1, 4, '2026-03-17', '2026-04-01', 21330.00, 1422.00, 22752.00, 20352.00, 'PARTIALLY_PAID', 'Paneer and curd delivery invoice'),
      (5, 'INV-VWP-5640', 'PINV-2026-0005', 2, 5, '2026-03-21', '2026-04-20', 36380.95, 1819.05, 38200.00, 0.00, 'UNPAID', 'Sugar and oils consignment pending payment'),
      (6, 'INV-HUL-8994', 'PINV-2026-0006', 3, 6, '2026-10-15', '2026-11-24', 24800.00, 4464.00, 29264.00, 25794.00, 'PARTIALLY_PAID', 'HUL personal care replenishment'),
      (7, 'INV-ITC-4410', 'PINV-2026-0007', 4, 7, '2026-03-25', '2026-04-24', 18500.00, 2220.00, 20720.00, 2220.00, 'PARTIALLY_PAID', 'ITC food products & stationery bill'),
      (8, 'INV-GC-2026-102', 'PINV-2026-0008', 5, 8, '2026-10-25', '2026-11-20', 12400.00, 2232.00, 14632.00, 2232.00, 'PARTIALLY_PAID', 'Godrej consumer goods replenishment invoice'),
      (9, 'INV-TCP-2026-301', 'PINV-2026-0009', 6, 9, '2026-10-28', '2026-11-28', 25600.00, 0.00, 25600.00, 0.00, 'UNPAID', 'Tata Sampann pulses and Tata Salt delivery invoice')
    ON CONFLICT (system_bill_number) DO NOTHING;
  `);

  // 15. Vendor Payments
  await executeRawSql(`
    INSERT INTO vendor_payments (
      id, payment_number, vendor_id, payment_date, payment_mode, amount, reference_number, purchase_invoice_id, notes
    ) VALUES
      (1, 'VPAY-2026-0001', 1, '2026-03-06', 'NEFT_RTGS', 15000.00, 'UTR-SBI-9912048', 1, 'Advance part payment against milk delivery'),
      (2, 'VPAY-2026-0002', 2, '2026-03-12', 'NEFT_RTGS', 44750.00, 'UTR-SBI-4481023', 2, 'Full settlement for rice and dal procurement'),
      (3, 'VPAY-2026-0003', 3, '2026-03-16', 'NEFT_RTGS', 15000.00, 'UTR-HDFC-881920', 3, 'Part payment for FMCG consignment'),
      (4, 'VPAY-2026-0004', 1, '2026-03-20', 'NEFT_RTGS', 20352.00, 'UTR-SBI-7729104', 4, 'Payment for dairy paneer & curd invoice'),
      (5, 'VPAY-2026-0005', 5, '2026-03-27', 'NEFT_RTGS', 2822.00, 'UTR-HDFC-991201', 8, 'GST tax component clearance on invoice INV-GC-2026-102'),
      (6, 'VPAY-2026-0006', 4, '2026-03-26', 'NEFT_RTGS', 2220.00, 'UTR-SBI-778819', 7, 'Tax component clearance on invoice INV-ITC-4410')
    ON CONFLICT (payment_number) DO NOTHING;
  `);

  // 16. POS Sales Invoices & Line Items (Across CASH, UPI, and EMPLOYEE_CREDIT)
  await executeRawSql(`
    INSERT INTO sales (
      id, invoice_number, sale_type, employee_id, customer_name, customer_mobile,
      subtotal, discount_amount, tax_amount, total_amount, payment_mode, payment_status, billed_by, created_at
    ) VALUES
      (1, 'INV-2026-00001', 'EMPLOYEE_CREDIT', 1, 'Rajesh Varma', '9848022334', 3250.00, 0.00, 0.00, 3250.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '5 days'),
      (2, 'INV-2026-00002', 'EMPLOYEE_CREDIT', 2, 'Srinivasa Rao', '9848033445', 1840.00, 0.00, 0.00, 1840.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '4 days'),
      (3, 'INV-2026-00003', 'EMPLOYEE_CREDIT', 3, 'Lakshmi Prasanna', '9848044556', 890.00, 0.00, 0.00, 890.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '3 days'),
      (4, 'INV-2026-00004', 'EMPLOYEE_CREDIT', 4, 'Venkat Ramana', '9848055667', 4120.00, 0.00, 0.00, 4120.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '2 days'),
      (5, 'INV-2026-00005', 'UPI', NULL, 'P. Satish Kumar (Customer)', '9848011223', 1250.00, 0.00, 62.50, 1312.50, 'UPI', 'COMPLETED', 3, NOW() - INTERVAL '2 days'),
      (6, 'INV-2026-00006', 'CASH', NULL, 'K. Rambabu (Walk-in)', '9848077665', 540.00, 20.00, 27.00, 547.00, 'CASH', 'COMPLETED', 3, NOW() - INTERVAL '1 days'),
      (7, 'INV-2026-00007', 'EMPLOYEE_CREDIT', 6, 'Chandra Sekhar', '9848077889', 2150.00, 0.00, 0.00, 2150.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '1 days'),
      (8, 'INV-2026-00008', 'EMPLOYEE_CREDIT', 7, 'Nagarjuna Babu', '9848088990', 3600.00, 0.00, 0.00, 3600.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '1 days'),
      (9, 'INV-2026-00009', 'UPI', NULL, 'M. Haritha', '9848033221', 880.00, 0.00, 44.00, 924.00, 'UPI', 'COMPLETED', 3, NOW() - INTERVAL '12 hours'),
      (10, 'INV-2026-00010', 'EMPLOYEE_CREDIT', 9, 'Suresh Kumar', '9848100112', 2850.00, 0.00, 0.00, 2850.00, 'EMPLOYEE_CREDIT', 'COMPLETED', 3, NOW() - INTERVAL '6 hours')
    ON CONFLICT (invoice_number) DO NOTHING;
  `);

  // 17. Sale Items
  await executeRawSql(`
    INSERT INTO sale_items (
      sale_id, item_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
    ) VALUES
      (1, 1, 2.000, 1350.00, 0.00, 0.00, 0.00, 2700.00),
      (1, 4, 3.000, 155.00, 0.00, 0.00, 0.00, 465.00),
      (1, 17, 2.000, 25.00, 0.00, 0.00, 0.00, 50.00),
      (2, 2, 10.000, 122.00, 0.00, 5.00, 61.00, 1281.00),
      (2, 3, 1.000, 445.00, 0.00, 0.00, 0.00, 445.00),
      (3, 7, 2.000, 245.00, 0.00, 5.00, 24.50, 514.50),
      (3, 8, 1.000, 205.00, 0.00, 18.00, 36.90, 241.90),
      (4, 1, 2.000, 1350.00, 0.00, 0.00, 0.00, 2700.00),
      (4, 6, 3.000, 340.00, 0.00, 12.00, 122.40, 1142.40),
      (5, 2, 8.000, 135.00, 0.00, 5.00, 54.00, 1134.00),
      (6, 11, 4.000, 38.00, 0.00, 0.00, 0.00, 152.00),
      (6, 13, 2.000, 115.00, 0.00, 0.00, 0.00, 230.00),
      (7, 9, 5.000, 160.00, 0.00, 18.00, 144.00, 944.00),
      (7, 10, 5.000, 142.00, 0.00, 18.00, 127.80, 837.80),
      (8, 1, 2.000, 1350.00, 0.00, 0.00, 0.00, 2700.00),
      (8, 12, 3.000, 280.00, 0.00, 12.00, 100.80, 940.80),
      (10, 18, 10.000, 175.00, 0.00, 5.00, 87.50, 1837.50),
      (10, 3, 2.000, 445.00, 0.00, 0.00, 0.00, 890.00)
    ON CONFLICT DO NOTHING;
  `);

  // 18. Stock Movements (Inventory Ledger)
  await executeRawSql(`
    INSERT INTO stock_movements (
      item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes
    ) VALUES
      (1, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', 'GRN-2026-0002', 30.000, 1250.00, 50.000, 'Initial wholesale receipt'),
      (1, 'SALE', 'SALE', 'INV-2026-00001', -2.000, 1250.00, 48.000, 'Sold to employee Rajesh Varma'),
      (2, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', 'GRN-2026-0005', 100.000, 115.00, 130.000, 'Freedom oil delivery'),
      (2, 'SALE', 'SALE', 'INV-2026-00002', -10.000, 115.00, 120.000, 'Sold to employee Srinivasa Rao'),
      (5, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', 'GRN-2026-0001', 200.000, 28.00, 60.000, 'Visakha Dairy fresh milk crates'),
      (6, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', 'GRN-2026-0001', 60.000, 320.00, 28.000, 'Visakha Dairy pure ghee cartons'),
      (11, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', 'GRN-2026-0004', 100.000, 32.00, 90.000, 'Fresh curd consignment'),
      (19, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', 'GRN-2026-0006', 120.000, 32.00, 110.000, 'Lifebuoy soaps received')
    ON CONFLICT DO NOTHING;
  `);

  // 19. Employee Ledger (Double-Entry Balance History)
  await executeRawSql(`
    INSERT INTO employee_ledger (
      employee_id, transaction_date, transaction_type, reference_type, reference_id, debit_amount, credit_amount, running_balance, remarks
    )
    SELECT * FROM (VALUES
      (1, NOW() - INTERVAL '5 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00001', 3250.00, 0.00, 3250.00, 'Store Credit Purchase at POS Terminal 1'),
      (2, NOW() - INTERVAL '4 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00002', 1840.00, 0.00, 1840.00, 'Store Credit Purchase at POS Terminal 1'),
      (3, NOW() - INTERVAL '3 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00003', 890.00, 0.00, 890.00, 'Store Credit Purchase at POS Terminal 1'),
      (4, NOW() - INTERVAL '2 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00004', 4120.00, 0.00, 4120.00, 'Store Credit Purchase at POS Terminal 1'),
      (6, NOW() - INTERVAL '1 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00007', 2150.00, 0.00, 2150.00, 'Store Credit Purchase at POS Terminal 1'),
      (7, NOW() - INTERVAL '1 days', 'CREDIT_SALE', 'SALE', 'INV-2026-00008', 3600.00, 0.00, 3600.00, 'Store Credit Purchase at POS Terminal 1'),
      (9, NOW() - INTERVAL '6 hours', 'CREDIT_SALE', 'SALE', 'INV-2026-00010', 2850.00, 0.00, 2850.00, 'Store Credit Purchase at POS Terminal 1')
    ) AS v(employee_id, transaction_date, transaction_type, reference_type, reference_id, debit_amount, credit_amount, running_balance, remarks)
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_ledger el WHERE el.reference_id = v.reference_id AND el.reference_type = v.reference_type
    );
  `);

  // 20. Billing Periods (Feb 2026 Closed + March 2026 Active)
  await executeRawSql(`
    INSERT INTO billing_periods (
      id, period_code, period_name, start_date, end_date, billing_date, status, total_employees_billed, total_billed_amount, total_recovered_amount
    ) VALUES
      (1, 'BILL-2026-03', 'March 2026 Store Billing', '2026-02-26', '2026-03-25', '2026-03-26', 'OPEN', 6, 15850.00, 0.00),
      (2, 'BILL-2026-02', 'February 2026 Store Billing', '2026-01-26', '2026-02-25', '2026-02-26', 'CLOSED', 5, 14200.00, 14200.00)
    ON CONFLICT (period_code) DO NOTHING;
  `);

  // 21. Employee Invoices (Monthly Store Bills)
  await executeRawSql(`
    INSERT INTO employee_invoices (
      id, invoice_number, billing_period_id, employee_id, opening_balance, current_purchases,
      adjustments, payments_received, recoveries_deducted, closing_outstanding, status, whatsapp_status
    ) VALUES
      (1, 'STMT-2026-03-001', 1, 1, 0.00, 3250.00, 0.00, 0.00, 0.00, 3250.00, 'GENERATED', 'DELIVERED'),
      (2, 'STMT-2026-03-002', 1, 2, 0.00, 1840.00, 0.00, 0.00, 0.00, 1840.00, 'GENERATED', 'DELIVERED'),
      (3, 'STMT-2026-03-003', 1, 3, 0.00, 890.00, 0.00, 0.00, 0.00, 890.00, 'GENERATED', 'SENT'),
      (4, 'STMT-2026-03-004', 1, 4, 0.00, 4120.00, 0.00, 0.00, 0.00, 4120.00, 'GENERATED', 'DELIVERED'),
      (5, 'STMT-2026-03-005', 1, 6, 0.00, 2150.00, 0.00, 0.00, 0.00, 2150.00, 'GENERATED', 'SENT'),
      (6, 'STMT-2026-03-006', 1, 7, 0.00, 3600.00, 0.00, 0.00, 0.00, 3600.00, 'GENERATED', 'DELIVERED'),
      (7, 'STMT-2026-02-001', 2, 1, 0.00, 2800.00, 0.00, 0.00, 2800.00, 0.00, 'RECOVERED', 'DELIVERED'),
      (8, 'STMT-2026-02-002', 2, 2, 0.00, 1600.00, 0.00, 0.00, 1600.00, 0.00, 'RECOVERED', 'DELIVERED')
    ON CONFLICT (invoice_number) DO NOTHING;
  `);

  // 22. Payroll Periods (Feb 2026 Disbursed + March 2026 In-Progress)
  await executeRawSql(`
    INSERT INTO payroll_periods (
      id, period_code, month_year, start_date, end_date, payout_date, status,
      total_gross_salary, total_store_recovery, total_net_salary
    ) VALUES
      (1, 'PAY-2026-03', '2026-03', '2026-03-01', '2026-03-31', '2026-04-01', 'CALCULATED', 205500.00, 15850.00, 170700.00),
      (2, 'PAY-2026-02', '2026-02', '2026-02-01', '2026-02-28', '2026-03-01', 'DISBURSED', 235000.00, 14200.00, 197300.00)
    ON CONFLICT (period_code) DO NOTHING;
  `);

  // 23. Payroll Entries (Detailed breakdown with CFECC Store Deductions)
  await executeRawSql(`
    INSERT INTO payroll_entries (
      payroll_period_id, employee_id, basic_salary, da, hra, other_allowances,
      gross_salary, store_recovery_amount, statutory_deductions, other_deductions,
      total_deductions, net_salary, payment_status
    )
    SELECT * FROM (VALUES
      (1, 1, 28000.00, 5600.00, 4200.00, 3200.00, 41000.00, 3250.00, 3800.00, 0.00, 7050.00, 33950.00, 'PENDING'),
      (1, 2, 24000.00, 4800.00, 3600.00, 2600.00, 35000.00, 1840.00, 3200.00, 0.00, 5040.00, 29960.00, 'PENDING'),
      (1, 3, 20000.00, 4000.00, 3000.00, 2000.00, 29000.00, 890.00, 2700.00, 0.00, 3590.00, 25410.00, 'PENDING'),
      (1, 4, 22000.00, 4400.00, 3300.00, 2300.00, 32000.00, 4120.00, 2950.00, 0.00, 7070.00, 24930.00, 'PENDING'),
      (1, 6, 21000.00, 4200.00, 3150.00, 2150.00, 30500.00, 2150.00, 2800.00, 0.00, 4950.00, 25550.00, 'PENDING'),
      (1, 7, 26000.00, 5200.00, 3900.00, 2900.00, 38000.00, 3600.00, 3500.00, 0.00, 7100.00, 30900.00, 'PENDING')
    ) AS v(payroll_period_id, employee_id, basic_salary, da, hra, other_allowances, gross_salary, store_recovery_amount, statutory_deductions, other_deductions, total_deductions, net_salary, payment_status)
    WHERE NOT EXISTS (
      SELECT 1 FROM payroll_entries pe WHERE pe.payroll_period_id = v.payroll_period_id AND pe.employee_id = v.employee_id
    );
  `);

  // 24. Recovery Records (Audit Trail for store credit deductions)
  await executeRawSql(`
    INSERT INTO recovery_records (
      recovery_number, employee_id, billing_period_id, employee_invoice_id,
      recovery_source, amount_deducted, payroll_period_id, status, recovered_at, remarks
    ) VALUES
      ('REC-2026-0001', 1, 2, 7, 'PAYROLL_DEDUCTION', 2800.00, 2, 'COMPLETED', '2026-03-01 10:00:00', 'February salary recovery for Port Colony store dues'),
      ('REC-2026-0002', 2, 2, 8, 'PAYROLL_DEDUCTION', 1600.00, 2, 'COMPLETED', '2026-03-01 10:00:00', 'February store credit payroll recovery'),
      ('REC-2026-0003', 3, 2, NULL, 'PAYROLL_DEDUCTION', 1150.00, 2, 'COMPLETED', '2026-03-01 10:00:00', 'Settled via monthly salary deduction'),
      ('REC-2026-0004', 4, 2, NULL, 'PAYROLL_DEDUCTION', 3200.00, 2, 'COMPLETED', '2026-03-01 10:00:00', 'Full February credit statement settled')
    ON CONFLICT (recovery_number) DO NOTHING;
  `);

  // 25. POS Shifts (1 Closed Shift + 1 Open Register Shift)
  await executeRawSql(`
    INSERT INTO pos_shifts (
      id, shift_number, cashier_id, terminal_id, start_time, end_time,
      opening_float, closing_cash_counted, expected_cash, cash_variance,
      total_cash_sales, total_upi_sales, total_credit_sales, total_sales,
      total_transactions, status, closing_notes, created_at, updated_at
    ) VALUES 
      (
        1, 'SH-2026-0001', 1, 'POS-01', NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day',
        2000.00, 7840.00, 7840.00, 0.00,
        5840.00, 3420.00, 6800.00, 16060.00,
        14, 'CLOSED', 'Shift closed with zero cash variance. End of day cash verified by accounts.',
        NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day'
      ),
      (
        2, 'SH-2026-0002', 1, 'POS-01', NOW() - INTERVAL '4 hours', NULL,
        2000.00, NULL, 4820.00, 0.00,
        2820.00, 1950.00, 4200.00, 8970.00,
        7, 'OPEN', NULL,
        NOW() - INTERVAL '4 hours', NOW()
      )
    ON CONFLICT (shift_number) DO NOTHING;
  `);

  // 26. Direct Payments (Employee Over-The-Counter Cash & UPI Settlements)
  await executeRawSql(`
    INSERT INTO payments (
      id, payment_number, employee_id, payment_date, payment_mode, amount, transaction_reference, remarks, received_by, created_at
    ) VALUES
      (1, 'PAY-2026-0001', 1, NOW() - INTERVAL '2 days', 'UPI', 1500.00, 'UPI/9848022334/928374', 'Mid-month store bill payment via PhonePe', 1, NOW() - INTERVAL '2 days'),
      (2, 'PAY-2026-0002', 3, NOW() - INTERVAL '1 day', 'CASH', 890.00, 'CASH-REC-1049', 'Direct store counter cash payment', 1, NOW() - INTERVAL '1 day'),
      (3, 'PAY-2026-0003', 4, NOW() - INTERVAL '5 hours', 'UPI', 2000.00, 'UPI/9440188990/817263', 'UPI partial repayment for store purchases', 1, NOW() - INTERVAL '5 hours'),
      (4, 'PAY-2026-0004', 7, NOW() - INTERVAL '2 hours', 'CASH', 1200.00, 'CASH-REC-1050', 'Counter cash deposit against grocery balance', 1, NOW() - INTERVAL '2 hours')
    ON CONFLICT (payment_number) DO NOTHING;
  `);

  // 27. Adjust Low Stock Items for realistic replenishment warnings
  await executeRawSql(`UPDATE items SET current_stock = 4.000 WHERE item_code = 'ITM-003'`);
  await executeRawSql(`UPDATE items SET current_stock = 8.000 WHERE item_code = 'ITM-004'`);
  await executeRawSql(`UPDATE items SET current_stock = 7.000 WHERE item_code = 'ITM-005'`);

  // Ensure all sequences are updated past the seeded IDs
  await syncDatabaseSequences();

  console.log('[Seed] Comprehensive CFECC enterprise database seed completed successfully!');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase().catch((err) => {
    console.error('[Seed Error]:', err);
    process.exit(1);
  });
}
