import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const purchasingRouter = Router();

// 1. List Purchase Orders
purchasingRouter.get('/orders', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const orders = await executeRawSql(`
      SELECT po.*, v.name as vendor_name, v.vendor_code
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      ORDER BY po.order_date DESC, po.id DESC;
    `);
    return res.json({ success: true, data: orders.rows });
  } catch (err) {
    next(err);
  }
});

// 2. Create Purchase Order
purchasingRouter.post('/orders', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { vendorId, orderDate, expectedDeliveryDate, items, notes } = req.body;

    const countResult = await executeRawSql(`SELECT COUNT(*) as count FROM purchase_orders`);
    const nextNum = parseInt(countResult.rows[0]?.count || '0', 10) + 1;
    const poNumber = `PO-2026-${String(nextNum).padStart(4, '0')}`;

    let subtotal = 0;
    let taxAmount = 0;

    for (const itm of items) {
      const lineSubtotal = itm.orderedQty * itm.unitPrice;
      const lineTax = lineSubtotal * (itm.taxRate / 100);
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }

    const totalAmount = subtotal + taxAmount;

    const poResult = await executeRawSql(`
      INSERT INTO purchase_orders (
        po_number, vendor_id, order_date, expected_delivery_date,
        subtotal, tax_amount, total_amount, status, notes, created_by
      ) VALUES (
        '${poNumber}', ${vendorId}, '${orderDate}', 
        ${expectedDeliveryDate ? `'${expectedDeliveryDate}'` : 'NULL'},
        ${subtotal.toFixed(2)}, ${taxAmount.toFixed(2)}, ${totalAmount.toFixed(2)},
        'APPROVED', ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      ) RETURNING id;
    `);

    const poId = poResult.rows[0].id;

    for (const itm of items) {
      const lineSubtotal = itm.orderedQty * itm.unitPrice;
      const lineTax = lineSubtotal * (itm.taxRate / 100);
      const lineTotal = lineSubtotal + lineTax;

      await executeRawSql(`
        INSERT INTO purchase_order_items (
          po_id, item_id, ordered_qty, unit_price, tax_rate, tax_amount, total_price
        ) VALUES (
          ${poId}, ${itm.itemId}, ${parseFloat(itm.orderedQty).toFixed(3)},
          ${parseFloat(itm.unitPrice).toFixed(2)}, ${parseFloat(itm.taxRate).toFixed(2)},
          ${lineTax.toFixed(2)}, ${lineTotal.toFixed(2)}
        );
      `);
    }

    return res.status(201).json({
      success: true,
      message: 'Purchase Order created successfully',
      poNumber,
      poId,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Create Goods Receipt Note (GRN) & update stock
purchasingRouter.post('/receipts', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { poId, vendorId, receiptDate, deliveryChallanNumber, vehicleNumber, items, notes } = req.body;

    const countResult = await executeRawSql(`SELECT COUNT(*) as count FROM goods_receipts`);
    const nextNum = parseInt(countResult.rows[0]?.count || '0', 10) + 1;
    const grnNumber = `GRN-2026-${String(nextNum).padStart(4, '0')}`;

    const grnResult = await executeRawSql(`
      INSERT INTO goods_receipts (
        grn_number, po_id, vendor_id, receipt_date, delivery_challan_number, vehicle_number, notes, created_by
      ) VALUES (
        '${grnNumber}', ${poId || 'NULL'}, ${vendorId}, '${receiptDate}',
        ${deliveryChallanNumber ? `'${deliveryChallanNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${vehicleNumber ? `'${vehicleNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      ) RETURNING id;
    `);

    const grnId = grnResult.rows[0].id;

    // Process items, update inventory & stock movements
    for (const itm of items) {
      const acceptedQty = parseFloat(itm.acceptedQty);
      const unitCost = parseFloat(itm.unitCost);

      await executeRawSql(`
        INSERT INTO goods_receipt_items (
          grn_id, item_id, received_qty, accepted_qty, rejected_qty, unit_cost
        ) VALUES (
          ${grnId}, ${itm.itemId}, ${parseFloat(itm.receivedQty).toFixed(3)},
          ${acceptedQty.toFixed(3)}, ${parseFloat(itm.rejectedQty || '0').toFixed(3)},
          ${unitCost.toFixed(2)}
        );
      `);

      // Update current stock
      const stockRes = await executeRawSql(`SELECT current_stock FROM items WHERE id = ${itm.itemId}`);
      const prevStock = parseFloat(stockRes.rows[0]?.current_stock || '0');
      const newStock = prevStock + acceptedQty;

      await executeRawSql(`
        UPDATE items SET
          current_stock = ${newStock.toFixed(3)},
          purchase_price = ${unitCost.toFixed(2)},
          updated_at = NOW()
        WHERE id = ${itm.itemId};
      `);

      // Record Stock Movement audit record
      await executeRawSql(`
        INSERT INTO stock_movements (
          item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes, created_by
        ) VALUES (
          ${itm.itemId}, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', '${grnNumber}',
          ${acceptedQty.toFixed(3)}, ${unitCost.toFixed(2)}, ${newStock.toFixed(3)},
          'Received via GRN ${grnNumber}', ${req.user?.id || 'NULL'}
        );
      `);
    }

    return res.status(201).json({
      success: true,
      message: 'Goods Receipt recorded and inventory updated',
      grnNumber,
      grnId,
    });
  } catch (err) {
    next(err);
  }
});
