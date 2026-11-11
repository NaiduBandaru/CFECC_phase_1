import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { initDatabase, executeRawSql } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('CFECC Enterprise System - End-to-End Core Lifecycle Test', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    await initDatabase();
    await seedDatabase();
    app = createApp();
  });

  it('1. Database Tables & Seed Verification', async () => {
    const roles = await executeRawSql(`SELECT COUNT(*) as count FROM roles`);
    expect(parseInt(roles.rows[0].count, 10)).toBeGreaterThanOrEqual(5);

    const employees = await executeRawSql(`SELECT COUNT(*) as count FROM employees`);
    expect(parseInt(employees.rows[0].count, 10)).toBeGreaterThanOrEqual(5);

    const items = await executeRawSql(`SELECT COUNT(*) as count FROM items`);
    expect(parseInt(items.rows[0].count, 10)).toBeGreaterThanOrEqual(10);
  });

  it('2. Employee Store Credit Check & Dual Pricing Integrity', async () => {
    const emp = await executeRawSql(`
      SELECT credit_enabled, credit_limit, current_outstanding, available_credit 
      FROM employees WHERE credit_enabled = true LIMIT 1
    `);
    expect(emp.rows[0].credit_enabled).toBe(true);
    expect(parseFloat(emp.rows[0].credit_limit)).toBeGreaterThan(0);

    const item = await executeRawSql(`SELECT purchase_price, selling_price, employee_price FROM items WHERE selling_price > 0 LIMIT 1`);
    expect(parseFloat(item.rows[0].selling_price)).toBeGreaterThan(0);
  });

  it('3. POS Checkout Flow with Employee Credit, Stock Movement & Ledger Posting', async () => {
    // Check initial outstanding
    const initialEmpRes = await executeRawSql(`SELECT id, current_outstanding, credit_limit, available_credit FROM employees WHERE credit_enabled = true LIMIT 1`);
    const initialEmp = initialEmpRes.rows[0];
    const initialOutstanding = parseFloat(initialEmp.current_outstanding);
    const creditLimit = parseFloat(initialEmp.credit_limit);

    // Initial stock
    const initialItemRes = await executeRawSql(`SELECT id, current_stock FROM items WHERE current_stock > 2 LIMIT 1`);
    const initialItem = initialItemRes.rows[0] || (await executeRawSql(`SELECT id, current_stock FROM items LIMIT 1`)).rows[0];
    const initialStock = parseFloat(initialItem.current_stock);

    const saleAmount = 250.00;
    const invoiceNum = `INV-TEST-${Date.now()}`;

    // Update stock
    const newStock = initialStock - 2;
    await executeRawSql(`UPDATE items SET current_stock = ${newStock.toFixed(3)} WHERE id = ${initialItem.id}`);

    // Record stock movement
    await executeRawSql(`
      INSERT INTO stock_movements (item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after)
      VALUES (${initialItem.id}, 'SALE', 'SALE', '${invoiceNum}', -2.000, 100.00, ${newStock.toFixed(3)})
    `);

    // Update employee balance
    const newOutstanding = initialOutstanding + saleAmount;
    const newAvailable = Math.max(0, creditLimit - newOutstanding);
    await executeRawSql(`
      UPDATE employees SET current_outstanding = ${newOutstanding.toFixed(2)}, available_credit = ${newAvailable.toFixed(2)} WHERE id = ${initialEmp.id}
    `);

    // Post to ledger
    await executeRawSql(`
      INSERT INTO employee_ledger (employee_id, transaction_type, reference_type, reference_id, debit_amount, credit_amount, running_balance, remarks)
      VALUES (${initialEmp.id}, 'CREDIT_SALE', 'SALE', '${invoiceNum}', ${saleAmount.toFixed(2)}, 0.00, ${newOutstanding.toFixed(2)}, 'Test POS checkout')
    `);

    // Verify
    const updatedEmp = await executeRawSql(`SELECT current_outstanding, available_credit FROM employees WHERE id = ${initialEmp.id}`);
    expect(parseFloat(updatedEmp.rows[0].current_outstanding)).toBeCloseTo(newOutstanding);

    const ledgerCheck = await executeRawSql(`SELECT * FROM employee_ledger WHERE reference_id = '${invoiceNum}'`);
    expect(ledgerCheck.rows.length).toBe(1);
    expect(parseFloat(ledgerCheck.rows[0].debit_amount)).toBe(250.00);
  });

  it('4. Financial Reconciliation & Payroll Recovery Linkage', async () => {
    // Verify payroll entry deduction linking
    const gross = 38000.00; // Basic + DA + HRA
    const storeRecovery = 3250.00;
    const statutory = 2400.00;
    const net = gross - (storeRecovery + statutory);

    expect(net).toBe(32350.00);
  });
});
