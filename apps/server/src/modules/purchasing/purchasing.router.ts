import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const purchasingRouter = Router();

const createPoSchema = z.object({
  vendorId: z.number().int(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    itemId: z.number().int(),
    orderedQty: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxRate: z.number().nonnegative().default(0),
  })).min(1, 'At least one item is required in the purchase order'),
});

const receiveGrnSchema = z.object({
  poId: z.number().int().optional().nullable(),
  vendorId: z.number().int(),
  receiptDate: z.string(),
  deliveryChallanNumber: z.string().optional().nullable(),
  vehicleNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    itemId: z.number().int(),
    receivedQty: z.number().nonnegative(),
    acceptedQty: z.number().nonnegative(),
    rejectedQty: z.number().nonnegative().default(0),
    unitCost: z.number().nonnegative(),
    rejectionReason: z.string().optional().nullable(),
  })).min(1, 'At least one item must be received'),
});

const vendorPaymentSchema = z.object({
  vendorId: z.number().int(),
  paymentDate: z.string().optional(),
  paymentMode: z.enum(['NEFT_RTGS', 'CHEQUE', 'UPI', 'CASH']),
  amount: z.number().positive(),
  referenceNumber: z.string().optional().nullable(),
  purchaseInvoiceId: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// 1. List Purchase Orders with Filtering
purchasingRouter.get('/orders', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { status, vendorId, search } = req.query;
    let whereClauses: string[] = ['1=1'];

    if (status && status !== 'ALL') {
      whereClauses.push(`po.status = '${(status as string).replace(/'/g, "''")}'`);
    }

    if (vendorId && vendorId !== 'ALL') {
      whereClauses.push(`po.vendor_id = ${parseInt(vendorId as string, 10)}`);
    }

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(po.po_number) LIKE '%${q}%' OR 
        LOWER(v.name) LIKE '%${q}%' OR 
        LOWER(v.vendor_code) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    const orders = await executeRawSql(`
      SELECT 
        po.*, 
        v.name as vendor_name, 
        v.vendor_code,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) as item_count
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE ${whereSql}
      ORDER BY po.order_date DESC, po.id DESC;
    `);

    return res.json({ success: true, data: orders.rows });
  } catch (err) {
    next(err);
  }
});

// 2. Get Single Purchase Order Details with Line Items
purchasingRouter.get('/orders/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const poId = parseInt(req.params.id as string, 10);
    const orderRes = await executeRawSql(`
      SELECT po.*, v.name as vendor_name, v.vendor_code, v.phone as vendor_phone, v.gstin as vendor_gstin
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.id = ${poId};
    `);

    if (!orderRes.rows || orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }

    const itemsRes = await executeRawSql(`
      SELECT 
        poi.*,
        i.name as item_name,
        i.item_code,
        u.code as unit_code
      FROM purchase_order_items poi
      JOIN items i ON poi.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE poi.po_id = ${poId};
    `);

    return res.json({
      success: true,
      data: {
        ...orderRes.rows[0],
        items: itemsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Create Purchase Order
purchasingRouter.post('/orders', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = createPoSchema.parse(req.body);

    const countResult = await executeRawSql(`SELECT COUNT(*) as count FROM purchase_orders`);
    const nextNum = parseInt(countResult.rows[0]?.count || '0', 10) + 1;
    const poNumber = `PO-2026-${String(nextNum).padStart(4, '0')}`;

    let subtotal = 0;
    let taxAmount = 0;

    for (const itm of body.items) {
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
        '${poNumber}', ${body.vendorId}, '${body.orderDate}', 
        ${body.expectedDeliveryDate ? `'${body.expectedDeliveryDate}'` : 'NULL'},
        ${subtotal.toFixed(2)}, ${taxAmount.toFixed(2)}, ${totalAmount.toFixed(2)},
        'APPROVED', ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      ) RETURNING id;
    `);

    const poId = poResult.rows[0].id;

    for (const itm of body.items) {
      const lineSubtotal = itm.orderedQty * itm.unitPrice;
      const lineTax = lineSubtotal * (itm.taxRate / 100);
      const lineTotal = lineSubtotal + lineTax;

      await executeRawSql(`
        INSERT INTO purchase_order_items (
          po_id, item_id, ordered_qty, unit_price, tax_rate, tax_amount, total_price
        ) VALUES (
          ${poId}, ${itm.itemId}, ${itm.orderedQty.toFixed(3)},
          ${itm.unitPrice.toFixed(2)}, ${itm.taxRate.toFixed(2)},
          ${lineTax.toFixed(2)}, ${lineTotal.toFixed(2)}
        );
      `);
    }

    await logAudit({
      userId: req.user?.id,
      action: 'CREATE',
      entity: 'PURCHASE_ORDER',
      entityId: poId,
      newValues: { poNumber, vendorId: body.vendorId, totalAmount },
      ipAddress: req.ip,
    });

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

// 4. Update PO Status (Approve / Cancel)
purchasingRouter.put('/orders/:id/status', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const poId = parseInt(req.params.id as string, 10);
    const { status } = req.body;

    if (!['PENDING', 'APPROVED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await executeRawSql(`UPDATE purchase_orders SET status = '${status}', updated_at = NOW() WHERE id = ${poId}`);
    return res.json({ success: true, message: `PO status updated to ${status}` });
  } catch (err) {
    next(err);
  }
});

// 5. List Goods Receipts (GRN)
purchasingRouter.get('/receipts', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const receipts = await executeRawSql(`
      SELECT 
        gr.*,
        v.name as vendor_name,
        v.vendor_code,
        po.po_number,
        (SELECT COUNT(*) FROM goods_receipt_items gri WHERE gri.grn_id = gr.id) as item_count
      FROM goods_receipts gr
      JOIN vendors v ON gr.vendor_id = v.id
      LEFT JOIN purchase_orders po ON gr.po_id = po.id
      ORDER BY gr.receipt_date DESC, gr.id DESC;
    `);

    return res.json({ success: true, data: receipts.rows });
  } catch (err) {
    next(err);
  }
});

// 5b. Get Single Goods Receipt (GRN) Details with Line Items
purchasingRouter.get('/receipts/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const grnId = parseInt(req.params.id as string, 10);
    const grnRes = await executeRawSql(`
      SELECT 
        gr.*,
        v.name as vendor_name,
        v.vendor_code,
        v.phone as vendor_phone,
        v.gstin as vendor_gstin,
        po.po_number,
        po.order_date as po_date,
        u.full_name as receiver_name,
        pi.system_bill_number,
        pi.total_amount as invoice_amount
      FROM goods_receipts gr
      JOIN vendors v ON gr.vendor_id = v.id
      LEFT JOIN purchase_orders po ON gr.po_id = po.id
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN purchase_invoices pi ON pi.grn_id = gr.id
      WHERE gr.id = ${grnId};
    `);

    if (!grnRes.rows || grnRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Goods Receipt Note not found' });
    }

    const itemsRes = await executeRawSql(`
      SELECT 
        gri.*,
        i.name as item_name,
        i.item_code,
        u.code as unit_code,
        (gri.accepted_qty * gri.unit_cost) as total_accepted_cost
      FROM goods_receipt_items gri
      JOIN items i ON gri.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE gri.grn_id = ${grnId};
    `);

    return res.json({
      success: true,
      data: {
        ...grnRes.rows[0],
        items: itemsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 6. Record Goods Receipt Note (GRN) & update inventory & calculate matching
purchasingRouter.post('/receipts', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = receiveGrnSchema.parse(req.body);

    const countResult = await executeRawSql(`SELECT COUNT(*) as count FROM goods_receipts`);
    const nextNum = parseInt(countResult.rows[0]?.count || '0', 10) + 1;
    const grnNumber = `GRN-2026-${String(nextNum).padStart(4, '0')}`;

    const grnResult = await executeRawSql(`
      INSERT INTO goods_receipts (
        grn_number, po_id, vendor_id, receipt_date, delivery_challan_number, vehicle_number, notes, created_by
      ) VALUES (
        '${grnNumber}', ${body.poId || 'NULL'}, ${body.vendorId}, '${body.receiptDate}',
        ${body.deliveryChallanNumber ? `'${body.deliveryChallanNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${body.vehicleNumber ? `'${body.vehicleNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      ) RETURNING id;
    `);

    const grnId = grnResult.rows[0].id;
    let grnTotalAcceptedAmount = 0;
    let grnTaxAmount = 0;

    for (const itm of body.items) {
      const acceptedQty = itm.acceptedQty;
      const unitCost = itm.unitCost;
      const lineCost = acceptedQty * unitCost;

      await executeRawSql(`
        INSERT INTO goods_receipt_items (
          grn_id, item_id, received_qty, accepted_qty, rejected_qty, unit_cost, rejection_reason
        ) VALUES (
          ${grnId}, ${itm.itemId}, ${itm.receivedQty.toFixed(3)},
          ${acceptedQty.toFixed(3)}, ${itm.rejectedQty.toFixed(3)},
          ${unitCost.toFixed(2)},
          ${itm.rejectionReason ? `'${itm.rejectionReason.replace(/'/g, "''")}'` : 'NULL'}
        );
      `);

      if (acceptedQty > 0) {
        // Fetch current stock & tax rate
        const itemRes = await executeRawSql(`SELECT current_stock, tax_rate FROM items WHERE id = ${itm.itemId}`);
        const prevStock = parseFloat(itemRes.rows[0]?.current_stock || '0');
        const taxRate = parseFloat(itemRes.rows[0]?.tax_rate || '0');
        const newStock = prevStock + acceptedQty;

        const lineTax = lineCost * (taxRate / 100);
        grnTotalAcceptedAmount += lineCost;
        grnTaxAmount += lineTax;

        // Update items stock and last purchase price
        await executeRawSql(`
          UPDATE items SET
            current_stock = ${newStock.toFixed(3)},
            purchase_price = ${unitCost.toFixed(2)},
            updated_at = NOW()
          WHERE id = ${itm.itemId};
        `);

        // Record stock movement
        await executeRawSql(`
          INSERT INTO stock_movements (
            item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes, created_by
          ) VALUES (
            ${itm.itemId}, 'PURCHASE_RECEIPT', 'GOODS_RECEIPT', '${grnNumber}',
            ${acceptedQty.toFixed(3)}, ${unitCost.toFixed(2)}, ${newStock.toFixed(3)},
            'Stock received via GRN ${grnNumber}', ${req.user?.id || 'NULL'}
          );
        `);

        // Update PO item received quantity if linked to PO
        if (body.poId) {
          await executeRawSql(`
            UPDATE purchase_order_items SET
              received_qty = received_qty + ${acceptedQty.toFixed(3)}
            WHERE po_id = ${body.poId} AND item_id = ${itm.itemId};
          `);
        }
      }
    }

    // Check if PO is partially or completely received
    if (body.poId) {
      const poItemsRes = await executeRawSql(`
        SELECT ordered_qty, received_qty FROM purchase_order_items WHERE po_id = ${body.poId};
      `);
      let allCompleted = true;
      let anyReceived = false;

      for (const row of poItemsRes.rows) {
        const ord = parseFloat(row.ordered_qty);
        const rec = parseFloat(row.received_qty);
        if (rec < ord) allCompleted = false;
        if (rec > 0) anyReceived = true;
      }

      const newStatus = allCompleted ? 'COMPLETED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'APPROVED';
      await executeRawSql(`UPDATE purchase_orders SET status = '${newStatus}', updated_at = NOW() WHERE id = ${body.poId};`);
    }

    // Generate Purchase Invoice for accounting
    const invCountRes = await executeRawSql(`SELECT COUNT(*) as count FROM purchase_invoices`);
    const invNum = parseInt(invCountRes.rows[0]?.count || '0', 10) + 1;
    const systemBillNumber = `PINV-2026-${String(invNum).padStart(4, '0')}`;
    const invoiceTotal = grnTotalAcceptedAmount + grnTaxAmount;

    await executeRawSql(`
      INSERT INTO purchase_invoices (
        invoice_number, system_bill_number, vendor_id, grn_id,
        invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status, created_by
      ) VALUES (
        '${body.deliveryChallanNumber || grnNumber}', '${systemBillNumber}', ${body.vendorId}, ${grnId},
        '${body.receiptDate}', CURRENT_DATE + INTERVAL '30 days',
        ${grnTotalAcceptedAmount.toFixed(2)}, ${grnTaxAmount.toFixed(2)}, ${invoiceTotal.toFixed(2)},
        0.00, 'UNPAID', ${req.user?.id || 'NULL'}
      );
    `);

    // Increment vendor current outstanding
    await executeRawSql(`
      UPDATE vendors SET
        current_outstanding = current_outstanding + ${invoiceTotal.toFixed(2)},
        updated_at = NOW()
      WHERE id = ${body.vendorId};
    `);

    return res.status(201).json({
      success: true,
      message: 'Goods Receipt recorded, inventory replenished, and purchase invoice generated',
      grnNumber,
      grnId,
      systemBillNumber,
    });
  } catch (err) {
    next(err);
  }
});

// 7. List Purchase Invoices
purchasingRouter.get('/invoices', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { status, vendorId, search } = req.query;
    let whereClauses: string[] = ['1=1'];

    if (status && status !== 'ALL') {
      whereClauses.push(`pi.status = '${(status as string).replace(/'/g, "''")}'`);
    }

    if (vendorId && vendorId !== 'ALL') {
      whereClauses.push(`pi.vendor_id = ${parseInt(vendorId as string, 10)}`);
    }

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(pi.system_bill_number) LIKE '%${q}%' OR 
        LOWER(pi.invoice_number) LIKE '%${q}%' OR 
        LOWER(v.name) LIKE '%${q}%' OR 
        LOWER(v.vendor_code) LIKE '%${q}%' OR
        LOWER(COALESCE(gr.grn_number, '')) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    const invoices = await executeRawSql(`
      SELECT 
        pi.*,
        v.name as vendor_name,
        v.vendor_code,
        gr.grn_number,
        (pi.total_amount - pi.paid_amount) as balance_due,
        CASE WHEN pi.due_date < CURRENT_DATE AND pi.status != 'PAID' THEN TRUE ELSE FALSE END as is_overdue
      FROM purchase_invoices pi
      JOIN vendors v ON pi.vendor_id = v.id
      LEFT JOIN goods_receipts gr ON pi.grn_id = gr.id
      WHERE ${whereSql}
      ORDER BY pi.invoice_date DESC, pi.id DESC;
    `);

    // Financial Metrics Summary
    const summaryRes = await executeRawSql(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total_amount), 0.00) as total_invoiced,
        COALESCE(SUM(paid_amount), 0.00) as total_paid,
        COALESCE(SUM(total_amount - paid_amount), 0.00) as total_outstanding,
        COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND status != 'PAID' THEN (total_amount - paid_amount) ELSE 0 END), 0.00) as overdue_amount
      FROM purchase_invoices pi
      WHERE status != 'CANCELLED';
    `);

    return res.json({ 
      success: true, 
      data: invoices.rows,
      summary: summaryRes.rows[0] || {
        total_count: 0,
        total_invoiced: '0.00',
        total_paid: '0.00',
        total_outstanding: '0.00',
        overdue_amount: '0.00',
      }
    });
  } catch (err) {
    next(err);
  }
});

// 7b. Single Purchase Invoice Details & Disbursements
purchasingRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const invoiceId = parseInt(req.params.id as string, 10);
    const invoiceRes = await executeRawSql(`
      SELECT 
        pi.*,
        v.name as vendor_name,
        v.vendor_code,
        v.phone as vendor_phone,
        v.email as vendor_email,
        v.gstin as vendor_gstin,
        v.bank_name,
        v.account_number,
        v.ifsc_code,
        gr.grn_number,
        gr.delivery_challan_number,
        gr.vehicle_number
      FROM purchase_invoices pi
      JOIN vendors v ON pi.vendor_id = v.id
      LEFT JOIN goods_receipts gr ON pi.grn_id = gr.id
      WHERE pi.id = ${invoiceId};
    `);

    if (!invoiceRes.rows || invoiceRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found' });
    }

    const paymentsRes = await executeRawSql(`
      SELECT vp.*, u.full_name as recorded_by_name
      FROM vendor_payments vp
      LEFT JOIN users u ON vp.created_by = u.id
      WHERE vp.purchase_invoice_id = ${invoiceId}
      ORDER BY vp.payment_date DESC;
    `);

    return res.json({
      success: true,
      data: {
        invoice: invoiceRes.rows[0],
        payments: paymentsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 7c. Create Purchase Invoice (Manual / Direct Bill)
purchasingRouter.post('/invoices', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { vendorId, invoiceNumber, grnId, invoiceDate, dueDate, subtotal, taxAmount, totalAmount, notes } = req.body;

    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM purchase_invoices`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    const systemBillNumber = `PINV-2026-${String(nextNum).padStart(4, '0')}`;

    const numSubtotal = parseFloat(subtotal || '0');
    const numTax = parseFloat(taxAmount || '0');
    const numTotal = parseFloat(totalAmount || (numSubtotal + numTax).toString());

    await executeRawSql(`
      INSERT INTO purchase_invoices (
        invoice_number, system_bill_number, vendor_id, grn_id,
        invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status, notes, created_by
      ) VALUES (
        '${(invoiceNumber || systemBillNumber).replace(/'/g, "''")}', '${systemBillNumber}', ${parseInt(vendorId, 10)},
        ${grnId ? parseInt(grnId, 10) : 'NULL'},
        '${invoiceDate || new Date().toISOString().split('T')[0]}',
        ${dueDate ? `'${dueDate}'` : 'CURRENT_DATE + INTERVAL \'30 days\''},
        ${numSubtotal.toFixed(2)}, ${numTax.toFixed(2)}, ${numTotal.toFixed(2)}, 0.00, 'UNPAID',
        ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      );
    `);

    // Increment vendor current outstanding
    await executeRawSql(`
      UPDATE vendors SET
        current_outstanding = current_outstanding + ${numTotal.toFixed(2)},
        updated_at = NOW()
      WHERE id = ${parseInt(vendorId, 10)};
    `);

    return res.status(201).json({
      success: true,
      message: 'Purchase Invoice registered successfully',
      systemBillNumber,
    });
  } catch (err) {
    next(err);
  }
});

// 8. Record Vendor Payment against Purchase Invoice
purchasingRouter.post('/invoices/:id/payment', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const invoiceId = parseInt(req.params.id as string, 10);
    const body = vendorPaymentSchema.parse(req.body);

    const invRes = await executeRawSql(`SELECT * FROM purchase_invoices WHERE id = ${invoiceId}`);
    if (!invRes.rows || invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found' });
    }

    const invoice = invRes.rows[0];
    const remainingDue = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount);

    if (body.amount > remainingDue + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment amount ₹${body.amount.toFixed(2)} exceeds unpaid invoice balance of ₹${remainingDue.toFixed(2)}`,
      });
    }

    // Generate Payment Reference
    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM vendor_payments`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    const paymentNumber = `VPAY-2026-${String(nextNum).padStart(4, '0')}`;

    await executeRawSql(`
      INSERT INTO vendor_payments (
        payment_number, vendor_id, payment_date, payment_mode, amount, reference_number, purchase_invoice_id, notes, created_by
      ) VALUES (
        '${paymentNumber}', ${invoice.vendor_id}, NOW(), '${body.paymentMode}',
        ${body.amount.toFixed(2)},
        ${body.referenceNumber ? `'${body.referenceNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${invoiceId},
        ${body.notes ? `'${body.notes.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      );
    `);

    const newPaidAmount = parseFloat(invoice.paid_amount) + body.amount;
    const newStatus = newPaidAmount >= parseFloat(invoice.total_amount) - 0.01 ? 'PAID' : 'PARTIALLY_PAID';

    await executeRawSql(`
      UPDATE purchase_invoices SET
        paid_amount = ${newPaidAmount.toFixed(2)},
        status = '${newStatus}'
      WHERE id = ${invoiceId};
    `);

    // Decrement vendor's current outstanding
    await executeRawSql(`
      UPDATE vendors SET
        current_outstanding = GREATEST(0.00, current_outstanding - ${body.amount.toFixed(2)}),
        updated_at = NOW()
      WHERE id = ${invoice.vendor_id};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'PAYMENT',
      entity: 'VENDOR_PAYMENT',
      entityId: invoiceId,
      newValues: { paymentNumber, amount: body.amount, newStatus },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Payment of ₹${body.amount.toFixed(2)} recorded successfully via ${body.paymentMode}`,
      paymentNumber,
      newStatus,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Record Purchase Return
purchasingRouter.post('/returns', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { vendorId, itemId, returnQty, unitPrice, reason } = req.body;
    const qty = parseFloat(returnQty);
    const price = parseFloat(unitPrice);
    const totalCredit = qty * price;

    // Check stock
    const itmRes = await executeRawSql(`SELECT current_stock, name FROM items WHERE id = ${itemId}`);
    if (!itmRes.rows || itmRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const currentStock = parseFloat(itmRes.rows[0].current_stock);
    if (currentStock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory: current stock (${currentStock}) is less than return quantity (${qty})`,
      });
    }

    const newStock = currentStock - qty;

    // Decrement stock
    await executeRawSql(`
      UPDATE items SET
        current_stock = ${newStock.toFixed(3)},
        updated_at = NOW()
      WHERE id = ${itemId};
    `);

    // Record Stock Movement
    await executeRawSql(`
      INSERT INTO stock_movements (
        item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes, created_by
      ) VALUES (
        ${itemId}, 'PURCHASE_RETURN', 'VENDOR_RETURN', 'PRET-${Date.now()}',
        -${qty.toFixed(3)}, ${price.toFixed(2)}, ${newStock.toFixed(3)},
        'Return to vendor: ${(reason || 'Damaged goods').replace(/'/g, "''")}', ${req.user?.id || 'NULL'}
      );
    `);

    // Credit vendor balance
    await executeRawSql(`
      UPDATE vendors SET
        current_outstanding = GREATEST(0.00, current_outstanding - ${totalCredit.toFixed(2)}),
        updated_at = NOW()
      WHERE id = ${vendorId};
    `);

    return res.json({
      success: true,
      message: `Purchase return of ${qty} unit(s) recorded and stock adjusted`,
      creditedAmount: totalCredit,
    });
  } catch (err) {
    next(err);
  }
});
