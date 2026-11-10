import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';
import { sendPosReceipt } from '../../services/whatsapp.service.js';

export const salesRouter = Router();

// 1. Sales Register with Filtering, Sorting, and Summary Metrics
salesRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { 
      startDate, 
      endDate, 
      paymentMode, 
      paymentStatus,
      saleType,
      search = '', 
      sortBy = 'created_at',
      sortOrder = 'DESC',
      page = '1', 
      limit = '50' 
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ['1=1'];

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(s.invoice_number) LIKE '%${q}%' OR 
        LOWER(COALESCE(e.first_name, '')) LIKE '%${q}%' OR 
        LOWER(COALESCE(e.last_name, '')) LIKE '%${q}%' OR 
        LOWER(COALESCE(e.employee_code, '')) LIKE '%${q}%' OR
        LOWER(COALESCE(s.customer_name, '')) LIKE '%${q}%' OR
        LOWER(COALESCE(s.customer_mobile, '')) LIKE '%${q}%'
      )`);
    }

    if (paymentMode && paymentMode !== 'ALL') {
      whereClauses.push(`s.payment_mode = '${(paymentMode as string).replace(/'/g, "''")}'`);
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      whereClauses.push(`s.payment_status = '${(paymentStatus as string).replace(/'/g, "''")}'`);
    }

    if (saleType && saleType !== 'ALL') {
      whereClauses.push(`s.sale_type = '${(saleType as string).replace(/'/g, "''")}'`);
    }

    if (startDate) {
      whereClauses.push(`s.created_at >= '${startDate} 00:00:00'`);
    }

    if (endDate) {
      whereClauses.push(`s.created_at <= '${endDate} 23:59:59'`);
    }

    const whereSql = whereClauses.join(' AND ');

    // Sorting
    const allowedSortColumns: Record<string, string> = {
      created_at: 's.created_at',
      invoice_number: 's.invoice_number',
      total_amount: 's.total_amount',
      customer_name: 's.customer_name',
    };
    const sortCol = allowedSortColumns[sortBy as string] || 's.created_at';
    const sortDir = (sortOrder as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Total Count
    const countResult = await executeRawSql(`
      SELECT COUNT(*) as total FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE ${whereSql};
    `);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Summary Metrics
    const metricsResult = await executeRawSql(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(s.total_amount), 0.00) as total_revenue,
        COALESCE(SUM(CASE WHEN s.payment_mode = 'EMPLOYEE_CREDIT' THEN s.total_amount ELSE 0 END), 0.00) as credit_revenue,
        COALESCE(SUM(CASE WHEN s.payment_mode IN ('CASH', 'UPI', 'CARD') THEN s.total_amount ELSE 0 END), 0.00) as direct_revenue,
        COALESCE(SUM(s.tax_amount), 0.00) as total_tax
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE ${whereSql} AND s.payment_status = 'COMPLETED';
    `);

    // Invoices list
    const salesResult = await executeRawSql(`
      SELECT 
        s.*,
        e.employee_code, e.first_name, e.last_name, e.mobile as employee_mobile,
        d.name as department_name,
        usr.full_name as billed_by_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users usr ON s.billed_by = usr.id
      WHERE ${whereSql}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ${limitNum} OFFSET ${offset};
    `);

    return res.json({
      success: true,
      data: salesResult.rows,
      summary: metricsResult.rows[0] || {
        total_count: 0,
        total_revenue: '0.00',
        credit_revenue: '0.00',
        direct_revenue: '0.00',
        total_tax: '0.00',
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. Single Sale Invoice Details
salesRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const saleId = parseInt(req.params.id as string, 10);

    const saleResult = await executeRawSql(`
      SELECT 
        s.*,
        e.employee_code, e.first_name, e.last_name, e.mobile as employee_mobile,
        e.current_outstanding, e.available_credit, e.credit_limit,
        d.name as department_name, des.title as designation_title,
        usr.full_name as billed_by_name
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN users usr ON s.billed_by = usr.id
      WHERE s.id = ${saleId};
    `);

    if (!saleResult.rows || saleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    const itemsResult = await executeRawSql(`
      SELECT 
        si.*,
        i.name as item_name, i.item_code, i.brand, i.barcode, i.hsn_code,
        u.code as unit_code, u.name as unit_name
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE si.sale_id = ${saleId}
      ORDER BY si.id ASC;
    `);

    const returnsResult = await executeRawSql(`
      SELECT sr.*, u.full_name as processed_by_name
      FROM sale_returns sr
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE sr.sale_id = ${saleId}
      ORDER BY sr.created_at DESC;
    `);

    return res.json({
      success: true,
      sale: saleResult.rows[0],
      items: itemsResult.rows,
      returns: returnsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Cancel / Refund Sales Invoice & Reverse Inventory and Employee Credit
salesRouter.post('/:id/cancel', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const saleId = parseInt(req.params.id as string, 10);
    const { reason = 'Customer return / order cancelled' } = req.body;

    const saleRes = await executeRawSql(`SELECT * FROM sales WHERE id = ${saleId}`);
    if (!saleRes.rows || saleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    const sale = saleRes.rows[0];
    if (sale.payment_status === 'CANCELLED' || sale.payment_status === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'This invoice has already been cancelled or refunded.' });
    }

    const saleItemsRes = await executeRawSql(`SELECT * FROM sale_items WHERE sale_id = ${saleId}`);
    const items = saleItemsRes.rows;

    // 1. Restock items in inventory & write stock_movements
    for (const itm of items) {
      const qty = parseFloat(itm.quantity);
      await executeRawSql(`
        UPDATE items SET
          current_stock = current_stock + ${qty.toFixed(3)},
          updated_at = NOW()
        WHERE id = ${itm.item_id};
      `);

      const updatedStockRes = await executeRawSql(`SELECT current_stock FROM items WHERE id = ${itm.item_id}`);
      const newStock = parseFloat(updatedStockRes.rows[0]?.current_stock || '0');

      await executeRawSql(`
        INSERT INTO stock_movements (
          item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes, created_by
        ) VALUES (
          ${itm.item_id}, 'SALE_RETURN', 'INVOICE_CANCEL', '${sale.invoice_number}',
          ${qty.toFixed(3)}, ${parseFloat(itm.unit_price).toFixed(2)}, ${newStock.toFixed(3)},
          'Return/restock for cancelled invoice ${sale.invoice_number}', ${req.user?.id || 'NULL'}
        );
      `);
    }

    // 2. If Employee Credit, reverse employee outstanding and restore available credit
    if (sale.payment_mode === 'EMPLOYEE_CREDIT' && sale.employee_id) {
      const refundAmount = parseFloat(sale.total_amount);
      await executeRawSql(`
        UPDATE employees SET
          current_outstanding = GREATEST(0.00, current_outstanding - ${refundAmount.toFixed(2)}),
          available_credit = LEAST(credit_limit, available_credit + ${refundAmount.toFixed(2)}),
          updated_at = NOW()
        WHERE id = ${sale.employee_id};
      `);
    }

    // 3. Record Return Note
    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM sale_returns`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    const returnNumber = `RET-2026-${String(nextNum).padStart(4, '0')}`;

    await executeRawSql(`
      INSERT INTO sale_returns (
        return_number, sale_id, refund_amount, refund_method, reason, created_by
      ) VALUES (
        '${returnNumber}', ${saleId}, ${parseFloat(sale.total_amount).toFixed(2)},
        '${sale.payment_mode === 'EMPLOYEE_CREDIT' ? 'CREDIT_ADJUSTMENT' : sale.payment_mode}',
        '${reason.replace(/'/g, "''")}', ${req.user?.id || 'NULL'}
      );
    `);

    // 4. Update sale status
    await executeRawSql(`
      UPDATE sales SET
        payment_status = 'CANCELLED',
        notes = COALESCE(notes, '') || ' [Cancelled: ${reason.replace(/'/g, "''")}]'
      WHERE id = ${saleId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'CANCEL',
      entity: 'SALE_INVOICE',
      entityId: saleId,
      newValues: { returnNumber, reason },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Invoice ${sale.invoice_number} cancelled successfully. Inventory restocked and credit adjusted.`,
      returnNumber,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Send Digital Receipt via WhatsApp
salesRouter.post('/:id/send-whatsapp', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const saleId = parseInt(req.params.id as string, 10);
    const saleRes = await executeRawSql(`
      SELECT s.*, e.first_name, e.last_name, e.mobile as emp_mobile
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE s.id = ${saleId};
    `);

    if (!saleRes.rows || saleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    const sale = saleRes.rows[0];
    const phone = sale.emp_mobile || sale.customer_mobile;
    const customerName = sale.first_name ? `${sale.first_name} ${sale.last_name}` : sale.customer_name || 'Valued Customer';

    if (!phone) {
      return res.status(400).json({ success: false, message: 'No phone number available for this invoice.' });
    }

    const itemsRes = await executeRawSql(`
      SELECT si.*, i.name as item_name
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      WHERE si.sale_id = ${saleId}
    `);

    const result = await sendPosReceipt({
      phone,
      customerName,
      billNumber: sale.invoice_number,
      totalAmount: sale.total_amount,
      subtotal: sale.subtotal,
      taxAmount: sale.tax_amount,
      paymentMode: sale.payment_mode,
      itemsCount: itemsRes.rows.length,
      itemsList: itemsRes.rows.map((r: any) => ({
        name: r.item_name,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        totalPrice: r.total_price,
      })),
      date: new Date(sale.created_at).toLocaleString('en-IN'),
      saleId: sale.id,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: `WhatsApp Delivery Failed: ${result.errorMessage || 'Access Denied / Meta API Error'}`,
        recipient: phone,
        details: result,
      });
    }

    return res.json({
      success: true,
      message: result.mode === 'LIVE'
        ? `Official invoice receipt dispatched to ${phone} via WhatsApp Meta Cloud API (Msg ID: ${result.messageId || 'SENT'}).`
        : `Digital receipt logged for ${phone} via WhatsApp service.`,
      recipient: phone,
      details: result,
    });
  } catch (err) {
    next(err);
  }
});
