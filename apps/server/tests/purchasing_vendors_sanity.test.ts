import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { initDatabase, executeRawSql } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('CFECC Enterprise System - Comprehensive Purchasing, Vendors & Multi-GST Sanity Test', () => {
  let testVendorId: number;
  let testItemId: number;
  let createdPoId: number;
  let poNumber: string;

  beforeAll(async () => {
    await initDatabase();
    await seedDatabase();

    // Ensure we have at least one test vendor and item
    const vendorRes = await executeRawSql(`
      INSERT INTO vendors (vendor_code, name, category, gstin, phone, address, city, payment_terms_days, is_active)
      VALUES ('VND-TEST-SANITY', 'Sanity Wholesale Mart', 'Provisions & Groceries', '37AAAAA0000A1Z5', '9876543210', 'Port Road', 'Visakhapatnam', 30, true)
      ON CONFLICT (vendor_code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    testVendorId = vendorRes.rows[0].id;

    const itemRes = await executeRawSql(`
      INSERT INTO items (item_code, name, purchase_price, selling_price, current_stock, cgst_rate, sgst_rate, tax_rate)
      VALUES ('ITM-SANITY-1', 'Premium Sona Masoori Rice 25kg', 1200.00, 1450.00, 50.000, 2.50, 2.50, 5.00)
      ON CONFLICT (item_code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    testItemId = itemRes.rows[0].id;
  });

  it('1. Vendor Master: Category attribution and custom querying', async () => {
    const res = await executeRawSql(`
      SELECT id, name, category, gstin, payment_terms_days, is_active 
      FROM vendors WHERE id = ${testVendorId}
    `);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].name).toBe('Sanity Wholesale Mart');
    expect(res.rows[0].category).toBe('Provisions & Groceries');
    expect(res.rows[0].gstin).toBe('37AAAAA0000A1Z5');
    expect(parseInt(res.rows[0].payment_terms_days, 10)).toBe(30);
  });

  it('2. Purchase Order Creation with Separate CGST, SGST, IGST Manual Entries', async () => {
    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM purchase_orders`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    poNumber = `PO-TEST-${String(nextNum).padStart(4, '0')}`;

    const orderedQty = 10;
    const unitPrice = 1200.00;
    const lineSubtotal = orderedQty * unitPrice; // 12,000.00

    // Separate manual GST rates
    const cgstRate = 2.50;
    const sgstRate = 2.50;
    const igstRate = 0.00;
    const totalTaxRate = cgstRate + sgstRate + igstRate; // 5.00%

    const cgstAmt = lineSubtotal * (cgstRate / 100); // 300.00
    const sgstAmt = lineSubtotal * (sgstRate / 100); // 300.00
    const igstAmt = lineSubtotal * (igstRate / 100); // 0.00
    const totalTaxAmt = cgstAmt + sgstAmt + igstAmt; // 600.00
    const lineTotal = lineSubtotal + totalTaxAmt;   // 12,600.00

    // Insert purchase order
    const poRes = await executeRawSql(`
      INSERT INTO purchase_orders (
        po_number, vendor_id, order_date, expected_delivery_date,
        subtotal, tax_amount, total_amount, status, notes
      ) VALUES (
        '${poNumber}', ${testVendorId}, '2026-11-18', '2026-11-25',
        ${lineSubtotal.toFixed(2)}, ${totalTaxAmt.toFixed(2)}, ${lineTotal.toFixed(2)},
        'APPROVED', 'Invoice/Ref: INV-SANITY-01 | Discount: 0% | Freight: ₹0 | Sanity verification order'
      ) RETURNING id;
    `);
    createdPoId = poRes.rows[0].id;
    expect(createdPoId).toBeGreaterThan(0);

    // Insert line item with separate rates and amounts
    await executeRawSql(`
      INSERT INTO purchase_order_items (
        po_id, item_id, ordered_qty, unit_price, tax_rate, tax_amount, total_price,
        cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount
      ) VALUES (
        ${createdPoId}, ${testItemId}, ${orderedQty.toFixed(3)},
        ${unitPrice.toFixed(2)}, ${totalTaxRate.toFixed(2)},
        ${totalTaxAmt.toFixed(2)}, ${lineTotal.toFixed(2)},
        ${cgstRate.toFixed(2)}, ${sgstRate.toFixed(2)}, ${igstRate.toFixed(2)},
        ${cgstAmt.toFixed(2)}, ${sgstAmt.toFixed(2)}, ${igstAmt.toFixed(2)}
      );
    `);

    // Verify PO was inserted cleanly
    const fetchPo = await executeRawSql(`SELECT * FROM purchase_orders WHERE id = ${createdPoId}`);
    expect(fetchPo.rows.length).toBe(1);
    expect(parseFloat(fetchPo.rows[0].subtotal)).toBeCloseTo(12000.00);
    expect(parseFloat(fetchPo.rows[0].tax_amount)).toBeCloseTo(600.00);
    expect(parseFloat(fetchPo.rows[0].total_amount)).toBeCloseTo(12600.00);
  });

  it('3. Purchase Order Item Multi-Tax Inspection', async () => {
    const itemsRes = await executeRawSql(`
      SELECT * FROM purchase_order_items WHERE po_id = ${createdPoId}
    `);
    expect(itemsRes.rows.length).toBe(1);
    const itm = itemsRes.rows[0];

    expect(parseFloat(itm.ordered_qty)).toBeCloseTo(10.000);
    expect(parseFloat(itm.unit_price)).toBeCloseTo(1200.00);
    expect(parseFloat(itm.cgst_rate)).toBeCloseTo(2.50);
    expect(parseFloat(itm.sgst_rate)).toBeCloseTo(2.50);
    expect(parseFloat(itm.igst_rate)).toBeCloseTo(0.00);
    expect(parseFloat(itm.cgst_amount)).toBeCloseTo(300.00);
    expect(parseFloat(itm.sgst_amount)).toBeCloseTo(300.00);
    expect(parseFloat(itm.igst_amount)).toBeCloseTo(0.00);
    expect(parseFloat(itm.tax_amount)).toBeCloseTo(600.00);
    expect(parseFloat(itm.total_price)).toBeCloseTo(12600.00);
  });

  it('4. Goods Receipt Note (GRN) Verification & Stock Updation', async () => {
    const initialItem = await executeRawSql(`SELECT current_stock FROM items WHERE id = ${testItemId}`);
    const preStock = parseFloat(initialItem.rows[0].current_stock);

    const receivedQty = 10;
    const acceptedQty = 10;
    const grnNumber = `GRN-TEST-${Date.now()}`;

    // Create GRN
    const grnRes = await executeRawSql(`
      INSERT INTO goods_receipts (grn_number, po_id, vendor_id, receipt_date, delivery_challan_number, status)
      VALUES ('${grnNumber}', ${createdPoId}, ${testVendorId}, '2026-11-18', 'DC-999', 'RECEIVED')
      RETURNING id;
    `);
    const grnId = grnRes.rows[0].id;

    // Record GRN Item
    await executeRawSql(`
      INSERT INTO goods_receipt_items (grn_id, item_id, received_qty, accepted_qty, rejected_qty, unit_cost)
      VALUES (${grnId}, ${testItemId}, ${receivedQty.toFixed(3)}, ${acceptedQty.toFixed(3)}, 0.000, 1200.00);
    `);

    // Update PO Item received quantity
    await executeRawSql(`
      UPDATE purchase_order_items 
      SET received_qty = received_qty + ${acceptedQty.toFixed(3)} 
      WHERE po_id = ${createdPoId} AND item_id = ${testItemId};
    `);

    // Update Item stock
    const newStock = preStock + acceptedQty;
    await executeRawSql(`
      UPDATE items SET current_stock = ${newStock.toFixed(3)} WHERE id = ${testItemId};
    `);

    // Update PO Status to COMPLETED
    await executeRawSql(`
      UPDATE purchase_orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = ${createdPoId};
    `);

    // Verify
    const updatedPo = await executeRawSql(`SELECT status FROM purchase_orders WHERE id = ${createdPoId}`);
    expect(updatedPo.rows[0].status).toBe('COMPLETED');

    const updatedItem = await executeRawSql(`SELECT current_stock FROM items WHERE id = ${testItemId}`);
    expect(parseFloat(updatedItem.rows[0].current_stock)).toBeCloseTo(newStock);
  });

  it('5. Dual-Batch Stock and Pricing Consistency', async () => {
    // Update batch1 and batch2 rates
    await executeRawSql(`
      UPDATE items 
      SET batch1_qty = 15.000, batch1_rate = 1450.00,
          batch2_qty = 45.000, batch2_rate = 1480.00
      WHERE id = ${testItemId};
    `);

    const batchRes = await executeRawSql(`
      SELECT batch1_qty, batch1_rate, batch2_qty, batch2_rate 
      FROM items WHERE id = ${testItemId}
    `);
    expect(parseFloat(batchRes.rows[0].batch1_qty)).toBeCloseTo(15.000);
    expect(parseFloat(batchRes.rows[0].batch1_rate)).toBeCloseTo(1450.00);
    expect(parseFloat(batchRes.rows[0].batch2_qty)).toBeCloseTo(45.000);
    expect(parseFloat(batchRes.rows[0].batch2_rate)).toBeCloseTo(1480.00);
  });
});
