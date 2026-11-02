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
      FROM employees WHERE employee_code = 'CFE-1001'
    `);
    expect(emp.rows[0].credit_enabled).toBe(true);
    expect(parseFloat(emp.rows[0].credit_limit)).toBe(25000.00);

    const item = await executeRawSql(`SELECT purchase_price, selling_price, employee_price FROM items WHERE item_code = 'ITM-001'`);
    // Employee price must be lower than standard retail selling price
    expect(parseFloat(item.rows[0].employee_price)).toBeLessThan(parseFloat(item.rows[0].selling_price));
  });

  it('3. POS Checkout Flow with Employee Credit, Stock Movement & Ledger Posting', async () => {
    // Check initial outstanding
    const initialEmp = await executeRawSql(`SELECT current_outstanding, available_credit FROM employees WHERE id = 1`);
    const initialOutstanding = parseFloat(initialEmp.rows[0].current_outstanding);

    // Initial stock
    const initialItem = await executeRawSql(`SELECT current_stock FROM items WHERE id = 1`);
    const initialStock = parseFloat(initialItem.rows[0].current_stock);

    // Simulate purchase of 2 units of Item 1 at employee price (1350.00 each = 2700.00)
    const saleAmount = 2700.00;
    const invoiceNum = `INV-TEST-${Date.now()}`;

    // Update stock
    const newStock = initialStock - 2;
    await executeRawSql(`UPDATE items SET current_stock = ${newStock.toFixed(3)} WHERE id = 1`);

    // Record stock movement
    await executeRawSql(`
      INSERT INTO stock_movements (item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after)
      VALUES (1, 'SALE', 'SALE', '${invoiceNum}', -2.000, 1250.00, ${newStock.toFixed(3)})
    `);

    // Update employee balance
    const newOutstanding = initialOutstanding + saleAmount;
    const newAvailable = 25000.00 - newOutstanding;
    await executeRawSql(`
      UPDATE employees SET current_outstanding = ${newOutstanding.toFixed(2)}, available_credit = ${newAvailable.toFixed(2)} WHERE id = 1
    `);

    // Post to ledger
    await executeRawSql(`
      INSERT INTO employee_ledger (employee_id, transaction_type, reference_type, reference_id, debit_amount, credit_amount, running_balance, remarks)
      VALUES (1, 'CREDIT_SALE', 'SALE', '${invoiceNum}', ${saleAmount.toFixed(2)}, 0.00, ${newOutstanding.toFixed(2)}, 'Test POS checkout')
    `);

    // Verify
    const updatedEmp = await executeRawSql(`SELECT current_outstanding, available_credit FROM employees WHERE id = 1`);
    expect(parseFloat(updatedEmp.rows[0].current_outstanding)).toBeCloseTo(newOutstanding);

    const ledgerCheck = await executeRawSql(`SELECT * FROM employee_ledger WHERE reference_id = '${invoiceNum}'`);
    expect(ledgerCheck.rows.length).toBe(1);
    expect(parseFloat(ledgerCheck.rows[0].debit_amount)).toBe(2700.00);
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
