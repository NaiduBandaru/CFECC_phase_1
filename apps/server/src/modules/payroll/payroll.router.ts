import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const payrollRouter = Router();

// 1. List Payroll Periods
payrollRouter.get('/periods', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const result = await executeRawSql(`
      SELECT pp.*,
        usr.full_name as approved_by_name,
        (SELECT COUNT(*) FROM payroll_entries pe WHERE pe.payroll_period_id = pp.id) as employee_count
      FROM payroll_periods pp
      LEFT JOIN users usr ON pp.approved_by = usr.id
      ORDER BY pp.start_date DESC;
    `);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 2. Create Payroll Period
payrollRouter.post('/periods', authenticateToken, requireRole('SUPER_ADMIN', 'HR_PAYROLL', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { periodCode, monthYear, startDate, endDate, payoutDate } = req.body;

    const existing = await executeRawSql(`SELECT id FROM payroll_periods WHERE period_code = '${periodCode}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Payroll period '${periodCode}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO payroll_periods (
        period_code, month_year, start_date, end_date, payout_date, status
      ) VALUES (
        '${periodCode}', '${monthYear}', '${startDate}', '${endDate}', '${payoutDate}', 'DRAFT'
      ) RETURNING id;
    `);

    return res.status(201).json({
      success: true,
      message: 'Payroll period created successfully',
      periodId: insertResult.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Process Payroll & Calculate Store Recovery from Billing Statements
payrollRouter.post('/calculate', authenticateToken, requireRole('SUPER_ADMIN', 'HR_PAYROLL', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { payrollPeriodId, billingPeriodId } = req.body;

    const periodRes = await executeRawSql(`SELECT * FROM payroll_periods WHERE id = ${payrollPeriodId}`);
    if (!periodRes.rows || periodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found' });
    }

    const period = periodRes.rows[0];
    if (period.status === 'DISBURSED') {
      return res.status(400).json({ success: false, message: 'Cannot recalculate a disbursed payroll period.' });
    }

    // Fetch active employees with base salaries
    const employees = await executeRawSql(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.current_outstanding,
        COALESCE(es.basic_salary, 25000.00) as basic_salary,
        COALESCE(es.da, 5000.00) as da,
        COALESCE(es.hra, 6000.00) as hra,
        COALESCE(es.other_allowances, 2000.00) as other_allowances,
        COALESCE(es.statutory_deductions, 2400.00) as statutory_deductions
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT * FROM employee_salaries 
        WHERE employee_id = e.id 
        ORDER BY effective_date DESC LIMIT 1
      ) es ON true
      WHERE e.employment_status = 'ACTIVE';
    `);

    let totalGross = 0;
    let totalStoreRecovery = 0;
    let totalNet = 0;

    // Delete existing unapproved entries for this period to recalculate
    await executeRawSql(`DELETE FROM payroll_entries WHERE payroll_period_id = ${payrollPeriodId}`);

    for (const emp of employees.rows) {
      const basic = parseFloat(emp.basic_salary);
      const da = parseFloat(emp.da);
      const hra = parseFloat(emp.hra);
      const allowances = parseFloat(emp.other_allowances);
      const statutory = parseFloat(emp.statutory_deductions);
      const gross = basic + da + hra + allowances;

      // Determine Store Recovery: check finalized invoice for the billing period or current outstanding
      let recoveryAmount = 0;
      if (billingPeriodId) {
        const invRes = await executeRawSql(`
          SELECT closing_outstanding FROM employee_invoices
          WHERE billing_period_id = ${billingPeriodId} AND employee_id = ${emp.id}
        `);
        if (invRes.rows && invRes.rows.length > 0) {
          recoveryAmount = parseFloat(invRes.rows[0].closing_outstanding);
        } else {
          recoveryAmount = parseFloat(emp.current_outstanding);
        }
      } else {
        recoveryAmount = parseFloat(emp.current_outstanding);
      }

      // Store recovery cannot exceed gross salary minus statutory deductions
      recoveryAmount = Math.min(recoveryAmount, Math.max(0, gross - statutory));

      // Total deductions
      const totalDeductions = statutory + recoveryAmount;
      const net = Math.max(0, gross - totalDeductions);

      await executeRawSql(`
        INSERT INTO payroll_entries (
          payroll_period_id, employee_id, basic_salary, da, hra, other_allowances,
          gross_salary, store_recovery_amount, statutory_deductions, other_deductions,
          total_deductions, net_salary, payment_status
        ) VALUES (
          ${payrollPeriodId}, ${emp.id}, ${basic.toFixed(2)}, ${da.toFixed(2)}, ${hra.toFixed(2)},
          ${allowances.toFixed(2)}, ${gross.toFixed(2)}, ${recoveryAmount.toFixed(2)},
          ${statutory.toFixed(2)}, 0.00, ${totalDeductions.toFixed(2)}, ${net.toFixed(2)}, 'PENDING'
        );
      `);

      totalGross += gross;
      totalStoreRecovery += recoveryAmount;
      totalNet += net;
    }

    // Update payroll period
    await executeRawSql(`
      UPDATE payroll_periods SET
        status = 'CALCULATED',
        total_gross_salary = ${totalGross.toFixed(2)},
        total_store_recovery = ${totalStoreRecovery.toFixed(2)},
        total_net_salary = ${totalNet.toFixed(2)}
      WHERE id = ${payrollPeriodId};
    `);

    return res.json({
      success: true,
      message: `Payroll computed for ${employees.rows.length} employees. Total Store Recovery: ₹${totalStoreRecovery.toFixed(2)}`,
      totalGross,
      totalStoreRecovery,
      totalNet,
    });
  } catch (err) {
    next(err);
  }
});

// 4. List Payroll Entries for a Period
payrollRouter.get('/entries', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { periodId } = req.query;
    if (!periodId) {
      return res.status(400).json({ success: false, message: 'periodId is required' });
    }

    const result = await executeRawSql(`
      SELECT pe.*,
        e.employee_code, e.first_name, e.last_name, e.mobile, e.email,
        d.name as department_name, des.title as designation_title,
        bd.bank_name, bd.account_number, bd.ifsc_code
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN LATERAL (
        SELECT bank_name, account_number, ifsc_code 
        FROM employee_bank_details 
        WHERE employee_id = e.id 
        LIMIT 1
      ) bd ON true
      WHERE pe.payroll_period_id = ${parseInt(periodId as string, 10)}
      ORDER BY e.employee_code ASC;
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 5. Disburse Payroll & Execute Store Recovery Settlements
payrollRouter.post('/disburse', authenticateToken, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next) => {
  try {
    const { payrollPeriodId, billingPeriodId } = req.body;
    if (!payrollPeriodId) {
      return res.status(400).json({ success: false, message: 'payrollPeriodId is required' });
    }

    const periodRes = await executeRawSql(`SELECT * FROM payroll_periods WHERE id = ${payrollPeriodId}`);
    if (!periodRes.rows || periodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found' });
    }

    const period = periodRes.rows[0];
    if (period.status === 'DISBURSED') {
      return res.status(400).json({ success: false, message: 'This payroll period is already disbursed.' });
    }

    const entriesRes = await executeRawSql(`
      SELECT pe.*, e.employee_code, e.current_outstanding, e.available_credit, e.credit_limit
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.payroll_period_id = ${payrollPeriodId};
    `);

    let recoveryCount = 0;
    let totalRecovered = 0;

    for (const entry of entriesRes.rows) {
      const recoveryAmt = parseFloat(entry.store_recovery_amount);
      if (recoveryAmt > 0) {
        // Generate Recovery Number
        const recCountRes = await executeRawSql(`SELECT COUNT(*) as count FROM recovery_records`);
        const recNum = `REC-2026-${String(parseInt(recCountRes.rows[0]?.count || '0', 10) + 1).padStart(4, '0')}`;

        // Insert recovery record
        await executeRawSql(`
          INSERT INTO recovery_records (
            recovery_number, employee_id, billing_period_id, recovery_source,
            amount_deducted, payroll_period_id, status, recovered_at, remarks
          ) VALUES (
            '${recNum}', ${entry.employee_id}, ${billingPeriodId || '1'}, 'PAYROLL_DEDUCTION',
            ${recoveryAmt.toFixed(2)}, ${payrollPeriodId}, 'COMPLETED', NOW(),
            'Recovered via salary deduction for period ${period.period_code}'
          );
        `);

        // Update employee outstanding balance and restore available credit
        const newOutstanding = Math.max(0, parseFloat(entry.current_outstanding) - recoveryAmt);
        const newCredit = Math.min(parseFloat(entry.credit_limit), parseFloat(entry.available_credit) + recoveryAmt);

        await executeRawSql(`
          UPDATE employees SET
            current_outstanding = ${newOutstanding.toFixed(2)},
            available_credit = ${newCredit.toFixed(2)},
            updated_at = NOW()
          WHERE id = ${entry.employee_id};
        `);

        // Post to employee ledger
        await executeRawSql(`
          INSERT INTO employee_ledger (
            employee_id, transaction_date, transaction_type, reference_type, reference_id,
            debit_amount, credit_amount, running_balance, remarks, created_by
          ) VALUES (
            ${entry.employee_id}, NOW(), 'PAYROLL_RECOVERY', 'PAYROLL_ENTRY', '${period.period_code}',
            0.00, ${recoveryAmt.toFixed(2)}, ${newOutstanding.toFixed(2)},
            'Monthly store purchase recovery deduction from salary', ${req.user?.id || 'NULL'}
          );
        `);

        // Update employee invoice if billingPeriodId provided
        if (billingPeriodId) {
          await executeRawSql(`
            UPDATE employee_invoices SET
              status = 'RECOVERED',
              recoveries_deducted = ${recoveryAmt.toFixed(2)},
              closing_outstanding = GREATEST(0.00, closing_outstanding - ${recoveryAmt.toFixed(2)}),
              updated_at = NOW()
            WHERE billing_period_id = ${billingPeriodId} AND employee_id = ${entry.employee_id};
          `);
        }

        recoveryCount++;
        totalRecovered += recoveryAmt;
      }

      // Mark individual entry as PAID
      await executeRawSql(`
        UPDATE payroll_entries SET payment_status = 'PAID' WHERE id = ${entry.id};
      `);
    }

    // Mark payroll period as DISBURSED
    await executeRawSql(`
      UPDATE payroll_periods SET
        status = 'DISBURSED',
        processed_at = NOW(),
        approved_by = ${req.user?.id || 'NULL'}
      WHERE id = ${payrollPeriodId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'DISBURSE_PAYROLL',
      entity: 'PAYROLL',
      entityId: payrollPeriodId,
      newValues: { recoveryCount, totalRecovered, periodCode: period.period_code },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Payroll disbursed! ${recoveryCount} store recovery deductions executed totaling ₹${totalRecovered.toFixed(2)}. Employee credit lines replenished.`,
      recoveryCount,
      totalRecovered,
    });
  } catch (err) {
    next(err);
  }
});

// 6. List Recovery Records Register
payrollRouter.get('/recovery-records', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { employeeId, search = '' } = req.query;
    let whereClauses = ['1=1'];

    if (employeeId && employeeId !== 'ALL') {
      whereClauses.push(`rr.employee_id = ${parseInt(employeeId as string, 10)}`);
    }

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(rr.recovery_number) LIKE '%${q}%' OR 
        LOWER(e.first_name) LIKE '%${q}%' OR 
        LOWER(e.last_name) LIKE '%${q}%' OR 
        LOWER(e.employee_code) LIKE '%${q}%' OR
        LOWER(COALESCE(pp.period_code, '')) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    const records = await executeRawSql(`
      SELECT 
        rr.*,
        e.employee_code, e.first_name, e.last_name,
        d.name as department_name,
        pp.period_code as payroll_period_code,
        bp.period_name as billing_period_name
      FROM recovery_records rr
      JOIN employees e ON rr.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN payroll_periods pp ON rr.payroll_period_id = pp.id
      LEFT JOIN billing_periods bp ON rr.billing_period_id = bp.id
      WHERE ${whereSql}
      ORDER BY rr.recovered_at DESC, rr.id DESC;
    `);

    // Financial Metrics Summary
    const summaryRes = await executeRawSql(`
      SELECT 
        COUNT(*) as total_recoveries_count,
        COALESCE(SUM(amount_deducted), 0.00) as total_recovered_amount
      FROM recovery_records rr
      WHERE rr.status = 'COMPLETED';
    `);

    return res.json({
      success: true,
      data: records.rows,
      summary: summaryRes.rows[0] || { total_recoveries_count: 0, total_recovered_amount: '0.00' },
    });
  } catch (err) {
    next(err);
  }
});
