import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const billingRouter = Router();

// 1. List Billing Periods
billingRouter.get('/periods', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const result = await executeRawSql(`
      SELECT bp.*,
        usr.full_name as finalized_by_name,
        COALESCE(
          (SELECT SUM(closing_outstanding) FROM employee_invoices ei WHERE ei.billing_period_id = bp.id),
          bp.total_billed_amount
        ) as total_billed_amount,
        COALESCE(
          (SELECT COUNT(*) FROM employee_invoices ei WHERE ei.billing_period_id = bp.id),
          bp.total_employees_billed
        ) as total_employees_billed
      FROM billing_periods bp
      LEFT JOIN users usr ON bp.finalized_by = usr.id
      ORDER BY bp.start_date DESC;
    `);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 2. Create New Billing Period
billingRouter.post('/periods', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { periodCode, periodName, startDate, endDate, billingDate } = req.body;

    const existing = await executeRawSql(`SELECT id FROM billing_periods WHERE period_code = '${periodCode}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Billing period code '${periodCode}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO billing_periods (
        period_code, period_name, start_date, end_date, billing_date, status
      ) VALUES (
        '${periodCode}', '${periodName.replace(/'/g, "''")}', '${startDate}', '${endDate}', '${billingDate}', 'OPEN'
      ) RETURNING id;
    `);

    return res.status(201).json({
      success: true,
      message: 'Billing period created successfully',
      periodId: insertResult.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Run Monthly Billing Engine for a Period
billingRouter.post('/generate', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { periodId } = req.body;

    const periodRes = await executeRawSql(`SELECT * FROM billing_periods WHERE id = ${periodId}`);
    if (!periodRes.rows || periodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Billing period not found' });
    }

    const period = periodRes.rows[0];
    if (period.status === 'FINALIZED' || period.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot regenerate statements for a finalized or closed billing period.',
      });
    }

    // 1. Fetch all employees who have credit purchases, active outstanding, or ledger activity
    const activeEmployees = await executeRawSql(`
      SELECT e.id, e.employee_code, e.first_name, e.last_name, e.current_outstanding, e.mobile
      FROM employees e
      WHERE e.credit_enabled = TRUE
      ORDER BY e.id ASC;
    `);

    let totalBilled = 0;
    let employeeCount = 0;

    for (const emp of activeEmployees.rows) {
      // 2. Calculate credit purchases in this period
      const salesRes = await executeRawSql(`
        SELECT COALESCE(SUM(total_amount), 0) as period_purchases
        FROM sales
        WHERE employee_id = ${emp.id}
          AND payment_mode = 'EMPLOYEE_CREDIT'
          AND created_at >= '${period.start_date}'
          AND created_at <= '${period.end_date} 23:59:59';
      `);
      const currentPurchases = parseFloat(salesRes.rows[0]?.period_purchases || '0');

      // 3. Direct payments in this period
      const paymentsRes = await executeRawSql(`
        SELECT COALESCE(SUM(amount), 0) as period_payments
        FROM payments
        WHERE employee_id = ${emp.id}
          AND payment_date >= '${period.start_date}'
          AND payment_date <= '${period.end_date} 23:59:59';
      `);
      const paymentsReceived = parseFloat(paymentsRes.rows[0]?.period_payments || '0');

      // 4. Recoveries deducted in this period
      const recoveryRes = await executeRawSql(`
        SELECT COALESCE(SUM(amount_deducted), 0) as period_recoveries
        FROM recovery_records
        WHERE employee_id = ${emp.id}
          AND status = 'COMPLETED'
          AND recovered_at >= '${period.start_date}'
          AND recovered_at <= '${period.end_date} 23:59:59';
      `);
      const recoveriesDeducted = parseFloat(recoveryRes.rows[0]?.period_recoveries || '0');

      // Opening balance = Current Outstanding - purchases + payments + recoveries
      const closingOutstanding = parseFloat(emp.current_outstanding);
      const openingBalance = Math.max(0, closingOutstanding - currentPurchases + paymentsReceived + recoveriesDeducted);

      // Only generate invoice if there are purchases, opening balance, or activity
      if (currentPurchases > 0 || closingOutstanding > 0) {
        const stmtNumber = `STMT-${period.period_code}-${String(emp.id).padStart(4, '0')}`;

        // Upsert employee invoice
        const existingStmt = await executeRawSql(`
          SELECT id FROM employee_invoices 
          WHERE billing_period_id = ${periodId} AND employee_id = ${emp.id}
        `);

        if (existingStmt.rows && existingStmt.rows.length > 0) {
          await executeRawSql(`
            UPDATE employee_invoices SET
              opening_balance = ${openingBalance.toFixed(2)},
              current_purchases = ${currentPurchases.toFixed(2)},
              payments_received = ${paymentsReceived.toFixed(2)},
              recoveries_deducted = ${recoveriesDeducted.toFixed(2)},
              closing_outstanding = ${closingOutstanding.toFixed(2)},
              updated_at = NOW()
            WHERE id = ${existingStmt.rows[0].id};
          `);
        } else {
          await executeRawSql(`
            INSERT INTO employee_invoices (
              invoice_number, billing_period_id, employee_id, opening_balance,
              current_purchases, adjustments, payments_received, recoveries_deducted,
              closing_outstanding, status
            ) VALUES (
              '${stmtNumber}', ${periodId}, ${emp.id}, ${openingBalance.toFixed(2)},
              ${currentPurchases.toFixed(2)}, 0.00, ${paymentsReceived.toFixed(2)},
              ${recoveriesDeducted.toFixed(2)}, ${closingOutstanding.toFixed(2)}, 'GENERATED'
            );
          `);
        }

        totalBilled += closingOutstanding;
        employeeCount++;
      }
    }

    // Update summary on period
    await executeRawSql(`
      UPDATE billing_periods SET
        total_employees_billed = ${employeeCount},
        total_billed_amount = ${totalBilled.toFixed(2)},
        status = 'DRAFT'
      WHERE id = ${periodId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'GENERATE_BILLING',
      entity: 'BILLING_PERIOD',
      entityId: periodId,
      newValues: { employeeCount, totalBilled },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Billing statements generated for ${employeeCount} employees. Total outstanding: ₹${totalBilled.toFixed(2)}`,
      totalEmployeesBilled: employeeCount,
      totalBilledAmount: totalBilled,
    });
  } catch (err) {
    next(err);
  }
});

// 4. List Statements for a Billing Period
billingRouter.get('/statements', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { periodId, search = '' } = req.query;

    let whereClauses = ['1=1'];
    if (periodId && periodId !== 'ALL') {
      whereClauses.push(`ei.billing_period_id = ${parseInt(periodId as string, 10)}`);
    }

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(ei.invoice_number) LIKE '%${q}%' OR 
        LOWER(e.employee_code) LIKE '%${q}%' OR 
        LOWER(COALESCE(e.cs_no, '')) LIKE '%${q}%' OR 
        LOWER(COALESCE(e.hr_no, '')) LIKE '%${q}%' OR 
        LOWER(e.first_name) LIKE '%${q}%' OR 
        LOWER(e.last_name) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await executeRawSql(`
      SELECT 
        ei.*,
        bp.period_name, bp.period_code,
        e.employee_code, e.cs_no, e.grade, e.category, e.hr_no,
        e.first_name, e.last_name, e.mobile,
        d.name as department_name, des.title as designation_title
      FROM employee_invoices ei
      JOIN billing_periods bp ON ei.billing_period_id = bp.id
      JOIN employees e ON ei.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ${whereSql}
      ORDER BY ei.closing_outstanding DESC;
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 4b. Get Specific Statement Details (with line-item sales, payments & deductions breakdown)
billingRouter.get('/statements/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
    const stmtId = parseInt(idStr, 10);

    if (isNaN(stmtId)) {
      return res.status(400).json({ success: false, message: 'Invalid statement ID' });
    }

    const stmtRes = await executeRawSql(`
      SELECT 
        ei.*,
        bp.period_name, bp.period_code,
        TO_CHAR(bp.start_date, 'YYYY-MM-DD') as period_start_date,
        TO_CHAR(bp.end_date, 'YYYY-MM-DD') as period_end_date,
        TO_CHAR(bp.billing_date, 'YYYY-MM-DD') as billing_date,
        e.employee_code, e.cs_no, e.grade, e.category, e.hr_no,
        e.first_name, e.last_name, e.mobile, e.email, e.credit_limit,
        e.current_outstanding as live_employee_outstanding,
        d.name as department_name, des.title as designation_title
      FROM employee_invoices ei
      JOIN billing_periods bp ON ei.billing_period_id = bp.id
      JOIN employees e ON ei.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ei.id = ${stmtId};
    `);

    if (!stmtRes.rows || stmtRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Statement record not found' });
    }

    const stmt = stmtRes.rows[0];

    // Itemized credit sales during this period
    const salesRes = await executeRawSql(`
      SELECT s.id, s.invoice_number, s.created_at, s.subtotal, s.tax_amount, s.total_amount, s.payment_mode,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      WHERE s.employee_id = ${stmt.employee_id}
        AND s.payment_mode = 'EMPLOYEE_CREDIT'
        AND s.created_at >= '${stmt.period_start_date} 00:00:00'
        AND s.created_at <= '${stmt.period_end_date} 23:59:59'
      ORDER BY s.created_at DESC;
    `);

    // Direct payments during period
    const paymentsRes = await executeRawSql(`
      SELECT * FROM payments
      WHERE employee_id = ${stmt.employee_id}
        AND payment_date >= '${stmt.period_start_date} 00:00:00'
        AND payment_date <= '${stmt.period_end_date} 23:59:59'
      ORDER BY payment_date DESC;
    `);

    // Recoveries during period
    const recoveriesRes = await executeRawSql(`
      SELECT * FROM recovery_records
      WHERE employee_id = ${stmt.employee_id}
        AND recovered_at >= '${stmt.period_start_date} 00:00:00'
        AND recovered_at <= '${stmt.period_end_date} 23:59:59'
      ORDER BY recovered_at DESC;
    `);

    return res.json({
      success: true,
      data: {
        statement: stmt,
        sales: salesRes.rows,
        payments: paymentsRes.rows,
        recoveries: recoveriesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Finalize Billing Period
billingRouter.post('/finalize', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { periodId } = req.body;

    await executeRawSql(`
      UPDATE billing_periods SET
        status = 'FINALIZED',
        finalized_at = NOW(),
        finalized_by = ${req.user?.id || 'NULL'}
      WHERE id = ${periodId};
    `);

    await executeRawSql(`
      UPDATE employee_invoices SET
        status = 'APPROVED',
        updated_at = NOW()
      WHERE billing_period_id = ${periodId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'FINALIZE_BILLING',
      entity: 'BILLING_PERIOD',
      entityId: periodId,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Billing period finalized and approved for recovery.' });
  } catch (err) {
    next(err);
  }
});

// 6. Record Direct Employee Payment
billingRouter.post('/payments', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'CASHIER'), async (req: Request, res: Response, next) => {
  try {
    const { employeeId, paymentMode, amount, transactionReference, remarks } = req.body;
    const payAmount = parseFloat(amount);

    if (payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const empRes = await executeRawSql(`SELECT * FROM employees WHERE id = ${employeeId}`);
    if (!empRes.rows || empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const employee = empRes.rows[0];
    const currentOutstanding = parseFloat(employee.current_outstanding);
    const newOutstanding = Math.max(0, currentOutstanding - payAmount);
    const newAvailable = Math.min(parseFloat(employee.credit_limit), parseFloat(employee.credit_limit) - newOutstanding);

    const countRes = await executeRawSql(`SELECT COUNT(*) as count FROM payments`);
    const nextNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
    const paymentNumber = `PAY-2026-${String(nextNum).padStart(4, '0')}`;

    // Record payment
    const payRes = await executeRawSql(`
      INSERT INTO payments (
        payment_number, employee_id, payment_mode, amount, transaction_reference, remarks, received_by
      ) VALUES (
        '${paymentNumber}', ${employeeId}, '${paymentMode}', ${payAmount.toFixed(2)},
        ${transactionReference ? `'${transactionReference.replace(/'/g, "''")}'` : 'NULL'},
        ${remarks ? `'${remarks.replace(/'/g, "''")}'` : 'NULL'},
        ${req.user?.id || 'NULL'}
      ) RETURNING id;
    `);

    // Update employee balance
    await executeRawSql(`
      UPDATE employees SET
        current_outstanding = ${newOutstanding.toFixed(2)},
        available_credit = ${newAvailable.toFixed(2)},
        updated_at = NOW()
      WHERE id = ${employeeId};
    `);

    // Post to Employee Ledger
    await executeRawSql(`
      INSERT INTO employee_ledger (
        employee_id, transaction_date, transaction_type, reference_type, reference_id,
        debit_amount, credit_amount, running_balance, remarks, created_by
      ) VALUES (
        ${employeeId}, NOW(), 'PAYMENT_RECEIVED', 'PAYMENT', '${paymentNumber}',
        0.00, ${payAmount.toFixed(2)}, ${newOutstanding.toFixed(2)},
        'Direct Payment Received (${paymentMode}) ref: ${transactionReference || paymentNumber}',
        ${req.user?.id || 'NULL'}
      );
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'COLLECT_PAYMENT',
      entity: 'PAYMENT',
      entityId: payRes.rows[0].id,
      newValues: { paymentNumber, employeeId, payAmount, newOutstanding },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `Payment of ₹${payAmount.toFixed(2)} recorded. New outstanding: ₹${newOutstanding.toFixed(2)}`,
      paymentNumber,
      newOutstanding,
    });
  } catch (err) {
    next(err);
  }
});

