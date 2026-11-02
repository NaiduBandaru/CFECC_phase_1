import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const posRouter = Router();

// 1. Employee lookup for POS
posRouter.get('/lookup-employee', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { query = '' } = req.query;
    if (!query) {
      return res.json({ success: true, employees: [] });
    }

    const q = (query as string).replace(/'/g, "''").toLowerCase();
    const result = await executeRawSql(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.mobile, e.email,
        e.credit_enabled, e.credit_limit, e.current_outstanding, e.available_credit,
        e.employment_status, d.name as department_name, des.title as designation_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE (
        LOWER(e.employee_code) LIKE '%${q}%' OR 
        LOWER(e.first_name) LIKE '%${q}%' OR 
        LOWER(e.last_name) LIKE '%${q}%' OR 
        LOWER(e.mobile) LIKE '%${q}%'
      ) AND e.employment_status = 'ACTIVE'
      LIMIT 10;
    `);

    return res.json({
      success: true,
      employees: result.rows.map((r: any) => ({
        id: r.id,
        employeeCode: r.employee_code,
        name: `${r.first_name} ${r.last_name}`,
        mobile: r.mobile,
        department: r.department_name,
        designation: r.designation_title,
        creditEnabled: r.credit_enabled,
        creditLimit: parseFloat(r.credit_limit),
        currentOutstanding: parseFloat(r.current_outstanding),
        availableCredit: parseFloat(r.available_credit),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 2. Barcode or Item search for POS
posRouter.get('/lookup-item', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { query = '', barcode = '' } = req.query;

    let whereClause = 'i.is_active = TRUE';
    if (barcode) {
      whereClause += ` AND i.barcode = '${(barcode as string).replace(/'/g, "''")}'`;
    } else if (query) {
      const q = (query as string).replace(/'/g, "''").toLowerCase();
      whereClause += ` AND (
        LOWER(i.item_code) LIKE '%${q}%' OR 
        LOWER(i.name) LIKE '%${q}%' OR 
        LOWER(i.barcode) LIKE '%${q}%'
      )`;
    }

    const result = await executeRawSql(`
      SELECT 
        i.id, i.item_code, i.name, i.barcode, i.current_stock,
        i.selling_price, i.employee_price, i.tax_rate,
        c.name as category_name, u.code as unit_code
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE ${whereClause}
      LIMIT 20;
    `);

    return res.json({ success: true, items: result.rows });
  } catch (err) {
    next(err);
  }
});

// 3. POS High-Speed Checkout
posRouter.post('/checkout', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const {
      employeeId,
      customerName,
      customerMobile,
      items, // array of { itemId, quantity, unitPrice, discountAmount, taxRate }
      paymentMode = 'EMPLOYEE_CREDIT', // 'EMPLOYEE_CREDIT', 'CASH', 'UPI', 'SPLIT'
      notes,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart cannot be empty.' });
    }

    // 1. Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    for (const itm of items) {
      const lineSubtotal = itm.quantity * itm.unitPrice;
      const discount = itm.discountAmount || 0;
      const taxable = lineSubtotal - discount;
      const tax = taxable * ((itm.taxRate || 0) / 100);

      subtotal += lineSubtotal;
      totalDiscount += discount;
      totalTax += tax;
    }

    const totalAmount = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;

    // 2. If Employee Credit, verify limits
    let employeeData: any = null;
    if (paymentMode === 'EMPLOYEE_CREDIT') {
      if (!employeeId) {
        return res.status(400).json({ success: false, message: 'Employee must be selected for Employee Store Credit.' });
      }

      const empRes = await executeRawSql(`
        SELECT id, employee_code, first_name, last_name, credit_enabled, credit_limit, current_outstanding, available_credit
        FROM employees
        WHERE id = ${employeeId}
      `);

      if (!empRes.rows || empRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      employeeData = empRes.rows[0];

      if (!employeeData.credit_enabled) {
        return res.status(400).json({
          success: false,
          message: `Store credit is disabled for ${employeeData.first_name} ${employeeData.last_name}.`,
        });
      }

      const availableCredit = parseFloat(employeeData.available_credit);
      if (totalAmount > availableCredit) {
        return res.status(400).json({
          success: false,
          message: `Insufficient store credit. Bill amount (₹${totalAmount.toFixed(2)}) exceeds available credit (₹${availableCredit.toFixed(2)}).`,
        });
      }
    }

    // 3. Generate sequential invoice number
    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM sales`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    const invoiceNumber = `INV-2026-${String(nextNum).padStart(5, '0')}`;

    // 4. Record sale
    const saleRes = await executeRawSql(`
      INSERT INTO sales (
        invoice_number, sale_type, employee_id, customer_name, customer_mobile,
        subtotal, discount_amount, tax_amount, total_amount, payment_mode, payment_status,
        billed_by, notes
      ) VALUES (
        '${invoiceNumber}', '${paymentMode}', ${employeeId || 'NULL'},
        ${customerName ? `'${customerName.replace(/'/g, "''")}'` : 'NULL'},
        ${customerMobile ? `'${customerMobile.replace(/'/g, "''")}'` : 'NULL'},
        ${subtotal.toFixed(2)}, ${totalDiscount.toFixed(2)}, ${totalTax.toFixed(2)}, ${totalAmount.toFixed(2)},
        '${paymentMode}', 'COMPLETED', ${req.user?.id || 'NULL'},
        ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}
      ) RETURNING id;
    `);

    const saleId = saleRes.rows[0].id;

    // 5. Insert line items & update inventory
    for (const itm of items) {
      const lineSubtotal = itm.quantity * itm.unitPrice;
      const discount = itm.discountAmount || 0;
      const taxable = lineSubtotal - discount;
      const tax = taxable * ((itm.taxRate || 0) / 100);
      const lineTotal = taxable + tax;

      await executeRawSql(`
        INSERT INTO sale_items (
          sale_id, item_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
        ) VALUES (
          ${saleId}, ${itm.itemId}, ${parseFloat(itm.quantity).toFixed(3)},
          ${parseFloat(itm.unitPrice).toFixed(2)}, ${parseFloat(discount).toFixed(2)},
          ${parseFloat(String(itm.taxRate || 0)).toFixed(2)}, ${parseFloat(String(tax)).toFixed(2)}, ${lineTotal.toFixed(2)}
        );
      `);

      // Decrement stock & record stock movement
      const curStockRes = await executeRawSql(`SELECT current_stock, purchase_price FROM items WHERE id = ${itm.itemId}`);
      const curStock = parseFloat(curStockRes.rows[0]?.current_stock || '0');
      const purchasePrice = parseFloat(curStockRes.rows[0]?.purchase_price || '0');
      const newStock = curStock - parseFloat(itm.quantity);

      await executeRawSql(`
        UPDATE items SET
          current_stock = ${newStock.toFixed(3)},
          updated_at = NOW()
        WHERE id = ${itm.itemId};
      `);

      await executeRawSql(`
        INSERT INTO stock_movements (
          item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes, created_by
        ) VALUES (
          ${itm.itemId}, 'SALE', 'SALE', '${invoiceNumber}',
          ${(-parseFloat(itm.quantity)).toFixed(3)}, ${purchasePrice.toFixed(2)}, ${newStock.toFixed(3)},
          'POS Sale ${invoiceNumber}', ${req.user?.id || 'NULL'}
        );
      `);
    }

    // 6. If Employee Credit: Update outstanding and ledger
    if (paymentMode === 'EMPLOYEE_CREDIT' && employeeData) {
      const oldOutstanding = parseFloat(employeeData.current_outstanding);
      const newOutstanding = oldOutstanding + totalAmount;
      const newAvailable = Math.max(0, parseFloat(employeeData.credit_limit) - newOutstanding);

      await executeRawSql(`
        UPDATE employees SET
          current_outstanding = ${newOutstanding.toFixed(2)},
          available_credit = ${newAvailable.toFixed(2)},
          updated_at = NOW()
        WHERE id = ${employeeId};
      `);

      await executeRawSql(`
        INSERT INTO employee_ledger (
          employee_id, transaction_date, transaction_type, reference_type, reference_id,
          debit_amount, credit_amount, running_balance, remarks, created_by
        ) VALUES (
          ${employeeId}, NOW(), 'CREDIT_SALE', 'SALE', '${invoiceNumber}',
          ${totalAmount.toFixed(2)}, 0.00, ${newOutstanding.toFixed(2)},
          'POS Store Credit Purchase #${invoiceNumber}', ${req.user?.id || 'NULL'}
        );
      `);
    }

    await logAudit({
      userId: req.user?.id,
      action: 'POS_CHECKOUT',
      entity: 'SALE',
      entityId: saleId,
      newValues: { invoiceNumber, totalAmount, paymentMode, employeeId },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      sale: {
        id: saleId,
        invoiceNumber,
        totalAmount,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        paymentMode,
        employeeName: employeeData ? `${employeeData.first_name} ${employeeData.last_name}` : customerName,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});
