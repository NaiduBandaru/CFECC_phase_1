import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const payrollRouter = Router();

// 1. List Payroll Periods
payrollRouter.get('/periods', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const result = await executeRawSql(`
      SELECT pp.*,
        usr.full_name as approved_by_name
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
payrollRouter.post('/periods', authenticateToken, async (req: Request, res: Response, next) => {
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

// 3. Process Payroll & Link Store Recovery from Billing
payrollRouter.post('/calculate', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { payrollPeriodId, billingPeriodId } = req.body;

    const periodRes = await executeRawSql(`SELECT * FROM payroll_periods WHERE id = ${payrollPeriodId}`);
    if (!periodRes.rows || periodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found' });
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
        }
      } else {
        recoveryAmount = Math.min(parseFloat(emp.current_outstanding), gross * 0.5); // Cap recovery to 50% gross
      }

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

// 4. List Payroll Entries
payrollRouter.get('/entries', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { periodId } = req.query;
    if (!periodId) {
      return res.status(400).json({ success: false, message: 'periodId is required' });
    }

    const result = await executeRawSql(`
      SELECT pe.*,
        e.employee_code, e.first_name, e.last_name,
        d.name as department_name, des.title as designation_title,
        bd.bank_name, bd.account_number, bd.ifsc_code
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employee_bank_details bd ON e.id = bd.employee_id
      WHERE pe.payroll_period_id = ${parseInt(periodId as string, 10)}
      ORDER BY e.employee_code ASC;
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});
