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

    const q = (query as string).replace(/'/g, "''").toLowerCase().trim();
    const result = await executeRawSql(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.mobile, e.email,
        e.cs_no, e.category, e.credit_enabled, e.credit_limit, e.current_outstanding, e.available_credit,
        e.share_capital, e.thrift_deposit, e.domestic_balance, e.festival_advance_balance, e.unrecovered_dues,
        e.employment_status, d.name as department_name, des.title as designation_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE (
        LOWER(e.employee_code) LIKE '%${q}%' OR 
        LOWER(COALESCE(e.cs_no, '')) LIKE '%${q}%' OR
        LOWER(e.first_name) LIKE '%${q}%' OR 
        LOWER(e.last_name) LIKE '%${q}%' OR 
        LOWER(e.mobile) LIKE '%${q}%'
      ) AND e.employment_status = 'ACTIVE'
      LIMIT 15;
    `);

    return res.json({
      success: true,
      employees: result.rows.map((r: any) => ({
        id: r.id,
        employeeCode: r.employee_code,
        csNo: r.cs_no,
        category: r.category,
        name: `${r.first_name} ${r.last_name}`.trim(),
        mobile: r.mobile,
        department: r.department_name,
        designation: r.designation_title,
        creditEnabled: r.credit_enabled,
        creditLimit: parseFloat(r.credit_limit),
        currentOutstanding: parseFloat(r.current_outstanding),
        availableCredit: parseFloat(r.available_credit),
        shareCapital: parseFloat(r.share_capital || 0),
        thriftDeposit: parseFloat(r.thrift_deposit || 0),
        domesticBalance: parseFloat(r.domestic_balance || 0),
        festivalAdvance: parseFloat(r.festival_advance_balance || 0),
        unrecoveredDues: parseFloat(r.unrecovered_dues || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 2. Barcode or Item search for POS (supports 4-digit numpad codes)
posRouter.get('/lookup-item', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { query = '', barcode = '' } = req.query;

    let whereClause = 'i.is_active = TRUE';
    if (barcode) {
      whereClause += ` AND i.barcode = '${(barcode as string).replace(/'/g, "''")}'`;
    } else if (query) {
      const rawQ = (query as string).replace(/'/g, "''").trim();
      const q = rawQ.toLowerCase();
      const isDigits = /^\d+$/.test(rawQ);
      const padded = isDigits && rawQ.length < 4 ? rawQ.padStart(4, '0') : rawQ;

      whereClause += ` AND (
        i.item_code = '${rawQ}' OR
        i.item_code = '${padded}' OR
        LOWER(i.item_code) LIKE '%${q}%' OR 
        LOWER(i.name) LIKE '%${q}%' OR 
        LOWER(COALESCE(i.barcode, '')) LIKE '%${q}%'
      )`;
    }

    const result = await executeRawSql(`
      SELECT 
        i.id, i.item_code, i.name, i.barcode, i.current_stock,
        i.selling_price, i.employee_price, i.tax_rate,
        i.batch1_qty, i.batch1_rate, i.batch2_qty, i.batch2_rate,
        i.cgst_rate, i.sgst_rate, i.vat_rate, i.hsn_code,
        c.name as category_name, u.code as unit_code
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN i.item_code = '${(query as string).trim()}' THEN 0
          WHEN i.item_code = '${(query as string).trim().padStart(4, '0')}' THEN 1
          ELSE 2
        END,
        i.item_code ASC
      LIMIT 25;
    `);

    return res.json({ success: true, items: result.rows });
  } catch (err) {
    next(err);
  }
});

// 2b. Instant 4-digit code lookup for numpad entry
posRouter.get('/quick-lookup-code', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { code = '' } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const raw = (code as string).trim().replace(/'/g, "''");
    const padded = /^\d+$/.test(raw) && raw.length < 4 ? raw.padStart(4, '0') : raw;

    const result = await executeRawSql(`
      SELECT 
        i.id, i.item_code, i.name, i.barcode, i.current_stock,
        i.selling_price, i.employee_price, i.tax_rate,
        i.batch1_qty, i.batch1_rate, i.batch2_qty, i.batch2_rate,
        i.cgst_rate, i.sgst_rate, i.vat_rate, i.hsn_code,
        c.name as category_name, u.code as unit_code
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE (i.item_code = '${raw}' OR i.item_code = '${padded}') AND i.is_active = TRUE
      LIMIT 1;
    `);

    if (result.rows.length === 0) {
      return res.json({ success: false, message: `Item with code '${raw}' (${padded}) not found.` });
    }

    return res.json({ success: true, item: result.rows[0] });
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
      couponAmount = 0,
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

    const couponDeduction = Math.min(Math.max(0, parseFloat(couponAmount) || 0), subtotal + totalTax);
    totalDiscount += couponDeduction;

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

    // Look up active open shift for terminal / cashier
    const openShiftRes = await executeRawSql(`
      SELECT id FROM pos_shifts 
      WHERE status = 'OPEN' 
      ORDER BY id DESC LIMIT 1
    `);
    const activeShiftId = openShiftRes.rows[0]?.id || null;

    // 4. Record sale
    const finalNotes = couponDeduction > 0
      ? (notes ? `${notes} [Meal Coupon: ₹${couponDeduction.toFixed(2)}]` : `Meal Coupon: ₹${couponDeduction.toFixed(2)}`)
      : (notes || null);

    const saleRes = await executeRawSql(`
      INSERT INTO sales (
        shift_id, invoice_number, sale_type, employee_id, customer_name, customer_mobile,
        subtotal, discount_amount, tax_amount, total_amount, payment_mode, payment_status,
        billed_by, notes
      ) VALUES (
        ${activeShiftId ? activeShiftId : 'NULL'},
        '${invoiceNumber}', '${paymentMode}', ${employeeId || 'NULL'},
        ${customerName ? `'${customerName.replace(/'/g, "''")}'` : 'NULL'},
        ${customerMobile ? `'${customerMobile.replace(/'/g, "''")}'` : 'NULL'},
        ${subtotal.toFixed(2)}, ${totalDiscount.toFixed(2)}, ${totalTax.toFixed(2)}, ${totalAmount.toFixed(2)},
        '${paymentMode}', 'COMPLETED', ${req.user?.id || 'NULL'},
        ${finalNotes ? `'${finalNotes.replace(/'/g, "''")}'` : 'NULL'}
      ) RETURNING id;
    `);

    const saleId = saleRes.rows[0].id;

    // 5. Insert line items & update inventory with Dual-Batch FIFO Logic
    for (const itm of items) {
      const itemRes = await executeRawSql(`
        SELECT id, item_code, name, current_stock, batch1_qty, batch1_rate, batch1_expiry, batch2_qty, batch2_rate, batch2_expiry,
               purchase_price, purchase_rate1, purchase_rate2, cgst_rate, sgst_rate, vat_rate, tax_rate
        FROM items WHERE id = ${itm.itemId}
      `);
      const dbItem = itemRes.rows[0];

      const b1Qty = parseFloat(dbItem?.batch1_qty || '0');
      const b1Rate = parseFloat(dbItem?.batch1_rate || '0') > 0 ? parseFloat(dbItem.batch1_rate) : parseFloat(itm.unitPrice);
      const b2Qty = parseFloat(dbItem?.batch2_qty || '0');
      const b2Rate = parseFloat(dbItem?.batch2_rate || '0') > 0 ? parseFloat(dbItem.batch2_rate) : parseFloat(itm.unitPrice);
      const reqQty = parseFloat(itm.quantity);
      const taxRate = parseFloat(String(itm.taxRate || dbItem?.tax_rate || 0));

      let newB1Qty = b1Qty;
      let newB2Qty = b2Qty;
      const curStock = parseFloat(dbItem?.current_stock || '0');
      const newStock = curStock - reqQty;
      const itemCode = dbItem?.item_code || '';

      if (b1Qty > 0 && reqQty <= b1Qty) {
        // Entire order fulfilled from Active Batch 1
        newB1Qty = b1Qty - reqQty;
        const lineSub = reqQty * b1Rate;
        const lineDiscount = itm.discountAmount || 0;
        const taxable = lineSub - lineDiscount;
        const taxAmt = taxable * (taxRate / 100);
        const lineTotal = taxable + taxAmt;

        await executeRawSql(`
          INSERT INTO sale_items (
            sale_id, item_id, item_code, batch_number, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
          ) VALUES (
            ${saleId}, ${itm.itemId}, '${itemCode}', 1, ${reqQty.toFixed(3)},
            ${b1Rate.toFixed(2)}, ${lineDiscount.toFixed(2)}, ${taxRate.toFixed(2)}, ${taxAmt.toFixed(2)}, ${lineTotal.toFixed(2)}
          );
        `);
      } else if (b1Qty > 0 && reqQty > b1Qty) {
        // Split Batch: Consume all of Batch 1, roll remainder into Batch 2
        const remQty = reqQty - b1Qty;
        newB1Qty = 0;
        newB2Qty = Math.max(0, b2Qty - remQty);

        // 1. Batch 1 portion
        const line1Sub = b1Qty * b1Rate;
        const tax1Amt = line1Sub * (taxRate / 100);
        const line1Total = line1Sub + tax1Amt;

        await executeRawSql(`
          INSERT INTO sale_items (
            sale_id, item_id, item_code, batch_number, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
          ) VALUES (
            ${saleId}, ${itm.itemId}, '${itemCode}', 1, ${b1Qty.toFixed(3)},
            ${b1Rate.toFixed(2)}, 0.00, ${taxRate.toFixed(2)}, ${tax1Amt.toFixed(2)}, ${line1Total.toFixed(2)}
          );
        `);

        // 2. Batch 2 portion
        const line2Sub = remQty * b2Rate;
        const tax2Amt = line2Sub * (taxRate / 100);
        const line2Total = line2Sub + tax2Amt;

        await executeRawSql(`
          INSERT INTO sale_items (
            sale_id, item_id, item_code, batch_number, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
          ) VALUES (
            ${saleId}, ${itm.itemId}, '${itemCode}', 2, ${remQty.toFixed(3)},
            ${b2Rate.toFixed(2)}, 0.00, ${taxRate.toFixed(2)}, ${tax2Amt.toFixed(2)}, ${line2Total.toFixed(2)}
          );
        `);
      } else {
        // Batch 1 is 0: consume from Batch 2 or standard
        const activeRate = b2Qty > 0 && b2Rate > 0 ? b2Rate : parseFloat(itm.unitPrice);
        newB2Qty = Math.max(0, b2Qty - reqQty);
        const lineSub = reqQty * activeRate;
        const lineDiscount = itm.discountAmount || 0;
        const taxable = lineSub - lineDiscount;
        const taxAmt = taxable * (taxRate / 100);
        const lineTotal = taxable + taxAmt;

        await executeRawSql(`
          INSERT INTO sale_items (
            sale_id, item_id, item_code, batch_number, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
          ) VALUES (
            ${saleId}, ${itm.itemId}, '${itemCode}', ${b2Qty > 0 ? 2 : 1}, ${reqQty.toFixed(3)},
            ${activeRate.toFixed(2)}, ${lineDiscount.toFixed(2)}, ${taxRate.toFixed(2)}, ${taxAmt.toFixed(2)}, ${lineTotal.toFixed(2)}
          );
        `);
      }

      // FoxPro FIFO Batch Rollover:
      // If Batch 1 is exhausted (newB1Qty <= 0) and Batch 2 has remaining stock (newB2Qty > 0),
      // Batch 2 immediately rolls over to refill Batch 1!
      let finalB1Qty = newB1Qty;
      let finalB1Rate = b1Rate;
      let finalPRate1 = parseFloat(dbItem?.purchase_rate1 || dbItem?.purchase_price || '0');
      let finalB1Expiry = dbItem?.batch1_expiry ? String(dbItem.batch1_expiry).split('T')[0] : null;
      let finalB2Qty = newB2Qty;
      let finalB2Rate = b2Rate;
      let finalPRate2 = parseFloat(dbItem?.purchase_rate2 || '0');
      let finalB2Expiry = dbItem?.batch2_expiry ? String(dbItem.batch2_expiry).split('T')[0] : null;

      if (finalB1Qty <= 0 && finalB2Qty > 0) {
        finalB1Qty = finalB2Qty;
        finalB1Rate = finalB2Rate > 0 ? finalB2Rate : finalB1Rate;
        finalPRate1 = finalPRate2 > 0 ? finalPRate2 : finalPRate1;
        finalB1Expiry = finalB2Expiry;
        finalB2Qty = 0;
        finalB2Rate = 0;
        finalPRate2 = 0;
        finalB2Expiry = null;
      }

      const newStockVal = (finalB1Qty * finalB1Rate) + (finalB2Qty * finalB2Rate);

      // Decrement stock & batch balances in items
      await executeRawSql(`
        UPDATE items SET
          current_stock = ${newStock.toFixed(3)},
          batch1_qty = ${finalB1Qty.toFixed(3)},
          batch1_rate = ${finalB1Rate.toFixed(2)},
          purchase_rate1 = ${finalPRate1.toFixed(2)},
          batch1_expiry = ${finalB1Expiry ? `'${finalB1Expiry}'` : 'NULL'},
          batch2_qty = ${finalB2Qty.toFixed(3)},
          batch2_rate = ${finalB2Rate.toFixed(2)},
          purchase_rate2 = ${finalPRate2.toFixed(2)},
          batch2_expiry = ${finalB2Expiry ? `'${finalB2Expiry}'` : 'NULL'},
          selling_price = ${finalB1Rate.toFixed(2)},
          employee_price = ${finalB1Rate.toFixed(2)},
          purchase_price = ${finalPRate1.toFixed(2)},
          stock_value = ${newStockVal.toFixed(2)},
          updated_at = NOW()
        WHERE id = ${itm.itemId};
      `);

      // Record inventory movement
      const purchasePrice = parseFloat(dbItem?.purchase_price || '0');
      await executeRawSql(`
        INSERT INTO stock_movements (
          item_id, movement_type, reference_type, reference_id, quantity, unit_cost, balance_after, notes, created_by
        ) VALUES (
          ${itm.itemId}, 'SALE', 'SALE', '${invoiceNumber}',
          ${(-reqQty).toFixed(3)}, ${purchasePrice.toFixed(2)}, ${newStock.toFixed(3)},
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
        couponAmount: couponDeduction,
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

// 4. Get Current Active Shift
posRouter.get('/shift/current', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const shiftRes = await executeRawSql(`
      SELECT 
        s.*, 
        u.full_name as cashier_name,
        u.username as cashier_username
      FROM pos_shifts s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'OPEN'
      ORDER BY s.id DESC
      LIMIT 1;
    `);

    if (!shiftRes.rows || shiftRes.rows.length === 0) {
      return res.json({ success: true, activeShift: null });
    }

    const shift = shiftRes.rows[0];

    // Compute live sales metrics for the shift
    const liveMetricsRes = await executeRawSql(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN total_amount ELSE 0 END), 0) as upi_sales,
        COALESCE(SUM(CASE WHEN payment_mode = 'EMPLOYEE_CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM sales
      WHERE shift_id = ${shift.id}
    `);

    const metrics = liveMetricsRes.rows[0];
    const openingFloat = parseFloat(shift.opening_float || '0');
    const cashSales = parseFloat(metrics.cash_sales || '0');
    const expectedCash = openingFloat + cashSales;

    return res.json({
      success: true,
      activeShift: {
        id: shift.id,
        shiftNumber: shift.shift_number,
        terminalId: shift.terminal_id,
        cashierId: shift.cashier_id,
        cashierName: shift.cashier_name || 'Store Cashier',
        startTime: shift.start_time,
        openingFloat,
        status: shift.status,
        liveMetrics: {
          totalTransactions: parseInt(metrics.total_transactions || '0', 10),
          cashSales,
          upiSales: parseFloat(metrics.upi_sales || '0'),
          creditSales: parseFloat(metrics.credit_sales || '0'),
          totalSales: parseFloat(metrics.total_sales || '0'),
          totalTax: parseFloat(metrics.total_tax || '0'),
          expectedCash,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Open New Shift / Cash Register
posRouter.post('/shift/open', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { openingFloat = 0, terminalId = 'POS-01', notes } = req.body;

    // Check if an open shift already exists
    const checkRes = await executeRawSql(`
      SELECT id, shift_number FROM pos_shifts WHERE status = 'OPEN' LIMIT 1
    `);
    if (checkRes.rows && checkRes.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Shift #${checkRes.rows[0].shift_number} is already active. Please close it before starting a new register.`,
      });
    }

    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM pos_shifts`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    const shiftNumber = `SHF-2026-${String(nextNum).padStart(5, '0')}`;

    const parsedFloat = Math.max(0, parseFloat(openingFloat) || 0);

    const insertRes = await executeRawSql(`
      INSERT INTO pos_shifts (
        shift_number, cashier_id, terminal_id, start_time, opening_float,
        expected_cash, status, closing_notes
      ) VALUES (
        '${shiftNumber}', ${req.user?.id || 'NULL'}, '${terminalId.replace(/'/g, "''")}',
        NOW(), ${parsedFloat.toFixed(2)}, ${parsedFloat.toFixed(2)}, 'OPEN',
        ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}
      ) RETURNING id, shift_number, start_time, opening_float;
    `);

    const newShift = insertRes.rows[0];

    await logAudit({
      userId: req.user?.id,
      action: 'POS_SHIFT_OPEN',
      entity: 'POS_SHIFT',
      entityId: newShift.id,
      newValues: { shiftNumber, openingFloat: parsedFloat, terminalId },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `Shift ${shiftNumber} opened with cash float ₹${parsedFloat.toFixed(2)}`,
      shift: newShift,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Close Shift / EOD Register Closure
posRouter.post('/shift/close', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { shiftId, closingCashCounted, closingNotes } = req.body;

    if (!shiftId) {
      return res.status(400).json({ success: false, message: 'Shift ID is required to close register.' });
    }

    const shiftRes = await executeRawSql(`
      SELECT * FROM pos_shifts WHERE id = ${shiftId} AND status = 'OPEN'
    `);
    if (!shiftRes.rows || shiftRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Active shift not found or already closed.' });
    }

    const shift = shiftRes.rows[0];
    const openingFloat = parseFloat(shift.opening_float || '0');

    // Aggregate final sales from sales table
    const salesAggRes = await executeRawSql(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN total_amount ELSE 0 END), 0) as upi_sales,
        COALESCE(SUM(CASE WHEN payment_mode = 'EMPLOYEE_CREDIT' THEN total_amount ELSE 0 END), 0) as credit_sales,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM sales
      WHERE shift_id = ${shiftId}
    `);

    const agg = salesAggRes.rows[0];
    const cashSales = parseFloat(agg.cash_sales || '0');
    const upiSales = parseFloat(agg.upi_sales || '0');
    const creditSales = parseFloat(agg.credit_sales || '0');
    const totalSales = parseFloat(agg.total_sales || '0');
    const totalTransactions = parseInt(agg.total_transactions || '0', 10);

    const expectedCash = openingFloat + cashSales;
    const countedCash = parseFloat(closingCashCounted || '0');
    const cashVariance = countedCash - expectedCash;

    await executeRawSql(`
      UPDATE pos_shifts SET
        end_time = NOW(),
        closing_cash_counted = ${countedCash.toFixed(2)},
        expected_cash = ${expectedCash.toFixed(2)},
        cash_variance = ${cashVariance.toFixed(2)},
        total_cash_sales = ${cashSales.toFixed(2)},
        total_upi_sales = ${upiSales.toFixed(2)},
        total_credit_sales = ${creditSales.toFixed(2)},
        total_sales = ${totalSales.toFixed(2)},
        total_transactions = ${totalTransactions},
        status = 'CLOSED',
        closing_notes = ${closingNotes ? `'${closingNotes.replace(/'/g, "''")}'` : 'NULL'},
        updated_at = NOW()
      WHERE id = ${shiftId}
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'POS_SHIFT_CLOSE',
      entity: 'POS_SHIFT',
      entityId: shiftId,
      newValues: {
        shiftNumber: shift.shift_number,
        expectedCash,
        countedCash,
        cashVariance,
        totalSales,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Shift ${shift.shift_number} successfully closed. Variance: ₹${cashVariance.toFixed(2)}`,
      zReport: {
        shiftId,
        shiftNumber: shift.shift_number,
        startTime: shift.start_time,
        endTime: new Date().toISOString(),
        openingFloat,
        closingCashCounted: countedCash,
        expectedCash,
        cashVariance,
        cashSales,
        upiSales,
        creditSales,
        totalSales,
        totalTransactions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 7. Detailed Z-Report for Thermal Printing
posRouter.get('/shift/z-report/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const shiftId = parseInt(req.params.id as string, 10);
    const shiftRes = await executeRawSql(`
      SELECT 
        s.*, 
        u.full_name as cashier_name,
        u.username as cashier_username
      FROM pos_shifts s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.id = ${shiftId}
    `);

    if (!shiftRes.rows || shiftRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    const shift = shiftRes.rows[0];

    // Department / Category sales breakdown
    const categoryBreakdownRes = await executeRawSql(`
      SELECT 
        COALESCE(c.name, 'General') as category_name,
        COUNT(si.id) as item_count,
        COALESCE(SUM(si.total_price), 0) as category_total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN item_categories c ON i.category_id = c.id
      WHERE s.shift_id = ${shiftId}
      GROUP BY c.name
      ORDER BY category_total DESC
    `);

    // Invoices list in shift
    const invoicesRes = await executeRawSql(`
      SELECT 
        id, invoice_number, created_at, payment_mode, total_amount, customer_name
      FROM sales
      WHERE shift_id = ${shiftId}
      ORDER BY id ASC
    `);

    return res.json({
      success: true,
      report: {
        shift: {
          id: shift.id,
          shiftNumber: shift.shift_number,
          terminalId: shift.terminal_id,
          cashierName: shift.cashier_name || 'Store Cashier',
          startTime: shift.start_time,
          endTime: shift.end_time || new Date().toISOString(),
          status: shift.status,
          openingFloat: parseFloat(shift.opening_float || '0'),
          closingCashCounted: parseFloat(shift.closing_cash_counted || '0'),
          expectedCash: parseFloat(shift.expected_cash || '0'),
          cashVariance: parseFloat(shift.cash_variance || '0'),
          cashSales: parseFloat(shift.total_cash_sales || '0'),
          upiSales: parseFloat(shift.total_upi_sales || '0'),
          creditSales: parseFloat(shift.total_credit_sales || '0'),
          totalSales: parseFloat(shift.total_sales || '0'),
          totalTransactions: parseInt(shift.total_transactions || '0', 10),
          closingNotes: shift.closing_notes,
        },
        categoryBreakdown: categoryBreakdownRes.rows.map((r: any) => ({
          category: r.category_name,
          itemCount: parseInt(r.item_count, 10),
          total: parseFloat(r.category_total),
        })),
        invoices: invoicesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 8. List Shifts History
posRouter.get('/shifts', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { limit = '20', page = '1' } = req.query;
    const limitNum = parseInt(limit as string, 10) || 20;
    const offset = (parseInt(page as string, 10) - 1) * limitNum;

    const result = await executeRawSql(`
      SELECT 
        s.*, 
        u.full_name as cashier_name
      FROM pos_shifts s
      LEFT JOIN users u ON s.cashier_id = u.id
      ORDER BY s.id DESC
      LIMIT ${limitNum} OFFSET ${offset};
    `);

    const countRes = await executeRawSql(`SELECT COUNT(*) as total FROM pos_shifts`);

    return res.json({
      success: true,
      shifts: result.rows,
      total: parseInt(countRes.rows[0]?.total || '0', 10),
    });
  } catch (err) {
    next(err);
  }
});
