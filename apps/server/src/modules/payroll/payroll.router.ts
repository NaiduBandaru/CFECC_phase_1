import { Router, Request, Response } from 'express';
import * as XLSX from 'xlsx';
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

// 4b. Export Store Recovery Advice Schedule (CSV / Excel / FoxPro DBF)
payrollRouter.get('/export-recovery-schedule', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { periodId, format = 'csv' } = req.query;
    if (!periodId) {
      return res.status(400).json({ success: false, message: 'periodId is required' });
    }

    const periodRes = await executeRawSql(`SELECT * FROM payroll_periods WHERE id = ${parseInt(periodId as string, 10)}`);
    if (!periodRes.rows || periodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found' });
    }
    const period = periodRes.rows[0];

    const entriesRes = await executeRawSql(`
      SELECT 
        e.employee_code as "EMPCODE",
        COALESCE(pe.cs_no, e.cs_no, '') as "CSNO",
        CONCAT(e.first_name, ' ', e.last_name) as "NAME",
        COALESCE(pe.category, e.category, 'WORKER') as "CATEGORY",
        pe.total_store_deduction as "STORE_DEDUCTION",
        pe.current_month_bills as "BILLS",
        pe.domestic_installment as "DOMESTIC",
        pe.old_domestic as "OLD_DOME",
        pe.festival_advance as "FESTIVAL",
        pe.misc_deductions as "MISC",
        pe.unrecovered_dues as "UNREC",
        pe.additional_shares as "ADD_SHARES",
        pe.thrift_deposit as "THRIFT",
        pe.coupon_amount as "COUPONS",
        pe.direct_receipt_payments as "DIRECT_PAY"
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.payroll_period_id = ${parseInt(periodId as string, 10)}
      ORDER BY e.employee_code ASC;
    `);

    const rows = entriesRes.rows;

    if (format === 'dbf') {
      // Build authentic FoxPro 2.x PAYROLL.DBF (24 bytes per record)
      // Header: 32 bytes + 4 * 32 bytes + 1 byte (0x0D) = 161 bytes
      const headerLen = 161;
      const recordLen = 24;
      const numRecs = rows.length;
      const totalLen = headerLen + numRecs * recordLen + 1; // + 0x1A EOF
      const buf = Buffer.alloc(totalLen, 0);

      const now = new Date();
      buf[0] = 0x03; // FoxBASE+/dBASE III PLUS, no memo
      buf[1] = now.getFullYear() - 2000;
      buf[2] = now.getMonth() + 1;
      buf[3] = now.getDate();
      buf.writeUInt32LE(numRecs, 4);
      buf.writeUInt16LE(headerLen, 8);
      buf.writeUInt16LE(recordLen, 10);

      // Field 1: EMPCODE (C 8)
      let fOff = 32;
      buf.write('EMPCODE\0\0\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'C'.charCodeAt(0);
      buf[fOff + 16] = 8;

      // Field 2: CATEGORY (C 1)
      fOff += 32;
      buf.write('CATEGORY\0\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'C'.charCodeAt(0);
      buf[fOff + 16] = 1;

      // Field 3: CSNO (N 4, 0)
      fOff += 32;
      buf.write('CSNO\0\0\0\0\0\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'N'.charCodeAt(0);
      buf[fOff + 16] = 4;
      buf[fOff + 17] = 0;

      // Field 4: DEDUCTION (N 10, 2)
      fOff += 32;
      buf.write('DEDUCTION\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'N'.charCodeAt(0);
      buf[fOff + 16] = 10;
      buf[fOff + 17] = 2;

      // Header terminator
      buf[160] = 0x0D;

      // Write records
      let rOff = headerLen;
      for (const r of rows) {
        buf[rOff] = 0x20; // active record

        // EMPCODE (8 chars left-aligned or padded)
        const empCode = String(r.EMPCODE || '').padEnd(8, ' ').slice(0, 8);
        buf.write(empCode, rOff + 1, 8, 'ascii');

        // CATEGORY (1 char: '1' for STAFF, '2' for WORKER)
        const cat = r.CATEGORY === 'STAFF' ? '1' : (r.CATEGORY === 'SPECIAL' ? '0' : '2');
        buf.write(cat, rOff + 9, 1, 'ascii');

        // CSNO (4 chars numeric right-aligned)
        const csNo = String(parseInt(r.CSNO || '0', 10) || 0).padStart(4, ' ').slice(-4);
        buf.write(csNo, rOff + 10, 4, 'ascii');

        // DEDUCTION (10 chars numeric 2 decimals right-aligned)
        const dedVal = (parseFloat(r.STORE_DEDUCTION) || 0).toFixed(2);
        const ded = dedVal.padStart(10, ' ').slice(-10);
        buf.write(ded, rOff + 14, 10, 'ascii');

        rOff += recordLen;
      }
      buf[rOff] = 0x1A; // EOF

      res.setHeader('Content-Type', 'application/x-dbf');
      res.setHeader('Content-Disposition', `attachment; filename="PAYROLL_${period.month_year}.DBF"`);
      return res.send(buf);
    } else if (format === 'excel' || format === 'xlsx') {
      const exportData = rows.map(r => ({
        'EMPLOYEE CODE': r.EMPCODE,
        'CS NO': r.CSNO,
        'MEMBER NAME': r.NAME,
        'CATEGORY': r.CATEGORY,
        'STORE DEDUCTION (RS)': parseFloat(r.STORE_DEDUCTION),
        'CURRENT BILLS': parseFloat(r.BILLS),
        'DOMESTIC LOAN': parseFloat(r.DOMESTIC),
        'OLD DOMESTIC': parseFloat(r.OLD_DOME),
        'FESTIVAL ADVANCE': parseFloat(r.FESTIVAL),
        'MISC DEDUCTION': parseFloat(r.MISC),
        'UNREC DUES': parseFloat(r.UNREC),
        'ADDL SHARES': parseFloat(r.ADD_SHARES),
        'THRIFT DEPOSIT': parseFloat(r.THRIFT),
        'COUPONS': parseFloat(r.COUPONS),
        'DIRECT PAYMENTS': parseFloat(r.DIRECT_PAY),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Store Recovery Advice');
      const excelBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="CFECC_Store_Recovery_Advice_${period.month_year}.xlsx"`);
      return res.send(excelBuf);
    } else {
      // CSV format: [EMPCODE, CSNO, NAME, CATEGORY, STORE_DEDUCTION]
      const headers = ['EMPCODE', 'CSNO', 'NAME', 'CATEGORY', 'STORE_DEDUCTION', 'BILLS', 'DOMESTIC', 'FESTIVAL', 'THRIFT'];
      const csvLines = [headers.join(',')];

      for (const r of rows) {
        const line = [
          `"${r.EMPCODE}"`,
          `"${r.CSNO}"`,
          `"${r.NAME.replace(/"/g, '""')}"`,
          `"${r.CATEGORY}"`,
          (parseFloat(r.STORE_DEDUCTION) || 0).toFixed(2),
          (parseFloat(r.BILLS) || 0).toFixed(2),
          (parseFloat(r.DOMESTIC) || 0).toFixed(2),
          (parseFloat(r.FESTIVAL) || 0).toFixed(2),
          (parseFloat(r.THRIFT) || 0).toFixed(2),
        ];
        csvLines.push(line.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="CFECC_Store_Recovery_Schedule_${period.month_year}.csv"`);
      return res.send(csvLines.join('\r\n'));
    }
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

    // Fetch active employees with cooperative society balances
    const employees = await executeRawSql(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.cs_no, e.category, e.mobile,
        e.current_outstanding, e.current_month_bills, e.domestic_balance, e.old_domestic_balance,
        e.festival_advance_balance, e.misc_deductions, e.unrecovered_dues, e.additional_shares,
        e.thrift_deposit, e.coupon_amount, e.direct_receipt_payments,
        COALESCE(es.basic_salary, 0.00) as basic_salary,
        COALESCE(es.da, 0.00) as da,
        COALESCE(es.hra, 0.00) as hra,
        COALESCE(es.other_allowances, 0.00) as other_allowances,
        COALESCE(es.statutory_deductions, 0.00) as statutory_deductions
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT * FROM employee_salaries 
        WHERE employee_id = e.id 
        ORDER BY effective_date DESC LIMIT 1
      ) es ON true
      WHERE e.employment_status = 'ACTIVE'
      ORDER BY e.employee_code ASC;
    `);

    let totalGross = 0;
    let totalStoreRecovery = 0;
    let totalNet = 0;

    // Delete existing unapproved entries for this period to recalculate
    await executeRawSql(`DELETE FROM payroll_entries WHERE payroll_period_id = ${payrollPeriodId}`);

    for (const emp of employees.rows) {
      const basic = parseFloat(emp.basic_salary || '0');
      const da = parseFloat(emp.da || '0');
      const hra = parseFloat(emp.hra || '0');
      const allowances = parseFloat(emp.other_allowances || '0');
      const statutory = parseFloat(emp.statutory_deductions || '0');
      const gross = basic + da + hra + allowances;

      // 10 Cooperative Store Deduction Heads
      const billAmt = parseFloat(emp.current_month_bills || emp.current_outstanding || '0');
      const domestic = parseFloat(emp.domestic_balance || '0');
      const oldDome = parseFloat(emp.old_domestic_balance || '0');
      const fest = parseFloat(emp.festival_advance_balance || '0');
      const misc = parseFloat(emp.misc_deductions || '0');
      const unrec = parseFloat(emp.unrecovered_dues || '0');
      const addShare = parseFloat(emp.additional_shares || '0');
      const thrift = parseFloat(emp.thrift_deposit || '0');
      const coupon = parseFloat(emp.coupon_amount || '0');
      const recPay = parseFloat(emp.direct_receipt_payments || '0');

      // Formula: Deduction = Bills + Domestic + OldDome + Fest + Misc + Unrec + AddShares + Thrift - Coupon - DirectPay
      const storeDeduction = Math.max(0, billAmt + domestic + oldDome + fest + misc + unrec + addShare + thrift - coupon - recPay);

      const totalDeductions = statutory + storeDeduction;
      const net = Math.max(0, gross - totalDeductions);

      await executeRawSql(`
        INSERT INTO payroll_entries (
          payroll_period_id, employee_id, cs_no, category,
          current_month_bills, domestic_installment, old_domestic, festival_advance,
          misc_deductions, unrecovered_dues, additional_shares, thrift_deposit,
          coupon_amount, direct_receipt_payments, total_store_deduction,
          store_recovery_amount, basic_salary, da, hra, other_allowances,
          gross_salary, statutory_deductions, other_deductions,
          total_deductions, net_salary, payment_status, created_at
        ) VALUES (
          ${payrollPeriodId}, ${emp.id},
          ${emp.cs_no ? `'${emp.cs_no.replace(/'/g, "''")}'` : 'NULL'},
          '${(emp.category || 'WORKER').replace(/'/g, "''")}',
          ${billAmt.toFixed(2)}, ${domestic.toFixed(2)}, ${oldDome.toFixed(2)}, ${fest.toFixed(2)},
          ${misc.toFixed(2)}, ${unrec.toFixed(2)}, ${addShare.toFixed(2)}, ${thrift.toFixed(2)},
          ${coupon.toFixed(2)}, ${recPay.toFixed(2)}, ${storeDeduction.toFixed(2)},
          ${storeDeduction.toFixed(2)}, ${basic.toFixed(2)}, ${da.toFixed(2)}, ${hra.toFixed(2)}, ${allowances.toFixed(2)},
          ${gross.toFixed(2)}, ${statutory.toFixed(2)}, 0.00,
          ${totalDeductions.toFixed(2)}, ${net.toFixed(2)}, 'PENDING', NOW()
        );
      `);

      totalGross += gross;
      totalStoreRecovery += storeDeduction;
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

// 4b. Export Store Recovery Advice Schedule (CSV / Excel / FoxPro DBF)
payrollRouter.get('/export-recovery-schedule', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { periodId, format = 'csv' } = req.query;
    if (!periodId) {
      return res.status(400).json({ success: false, message: 'periodId is required' });
    }

    const periodRes = await executeRawSql(`SELECT * FROM payroll_periods WHERE id = ${parseInt(periodId as string, 10)}`);
    if (!periodRes.rows || periodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found' });
    }
    const period = periodRes.rows[0];

    const entriesRes = await executeRawSql(`
      SELECT 
        e.employee_code as "EMPCODE",
        COALESCE(pe.cs_no, e.cs_no, '') as "CSNO",
        CONCAT(e.first_name, ' ', e.last_name) as "NAME",
        COALESCE(pe.category, e.category, 'WORKER') as "CATEGORY",
        pe.total_store_deduction as "STORE_DEDUCTION",
        pe.current_month_bills as "BILLS",
        pe.domestic_installment as "DOMESTIC",
        pe.old_domestic as "OLD_DOME",
        pe.festival_advance as "FESTIVAL",
        pe.misc_deductions as "MISC",
        pe.unrecovered_dues as "UNREC",
        pe.additional_shares as "ADD_SHARES",
        pe.thrift_deposit as "THRIFT",
        pe.coupon_amount as "COUPONS",
        pe.direct_receipt_payments as "DIRECT_PAY"
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.payroll_period_id = ${parseInt(periodId as string, 10)}
      ORDER BY e.employee_code ASC;
    `);

    const rows = entriesRes.rows;

    if (format === 'dbf') {
      // Build authentic FoxPro 2.x PAYROLL.DBF (24 bytes per record)
      // Header: 32 bytes + 4 * 32 bytes + 1 byte (0x0D) = 161 bytes
      const headerLen = 161;
      const recordLen = 24;
      const numRecs = rows.length;
      const totalLen = headerLen + numRecs * recordLen + 1; // + 0x1A EOF
      const buf = Buffer.alloc(totalLen, 0);

      const now = new Date();
      buf[0] = 0x03; // FoxBASE+/dBASE III PLUS, no memo
      buf[1] = now.getFullYear() - 2000;
      buf[2] = now.getMonth() + 1;
      buf[3] = now.getDate();
      buf.writeUInt32LE(numRecs, 4);
      buf.writeUInt16LE(headerLen, 8);
      buf.writeUInt16LE(recordLen, 10);

      // Field 1: EMPCODE (C 8)
      let fOff = 32;
      buf.write('EMPCODE\0\0\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'C'.charCodeAt(0);
      buf[fOff + 16] = 8;

      // Field 2: CATEGORY (C 1)
      fOff += 32;
      buf.write('CATEGORY\0\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'C'.charCodeAt(0);
      buf[fOff + 16] = 1;

      // Field 3: CSNO (N 4, 0)
      fOff += 32;
      buf.write('CSNO\0\0\0\0\0\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'N'.charCodeAt(0);
      buf[fOff + 16] = 4;
      buf[fOff + 17] = 0;

      // Field 4: DEDUCTION (N 10, 2)
      fOff += 32;
      buf.write('DEDUCTION\0\0', fOff, 'ascii');
      buf[fOff + 11] = 'N'.charCodeAt(0);
      buf[fOff + 16] = 10;
      buf[fOff + 17] = 2;

      // Header terminator
      buf[160] = 0x0D;

      // Write records
      let rOff = headerLen;
      for (const r of rows) {
        buf[rOff] = 0x20; // active record

        // EMPCODE (8 chars left-aligned or padded)
        const empCode = String(r.EMPCODE || '').padEnd(8, ' ').slice(0, 8);
        buf.write(empCode, rOff + 1, 8, 'ascii');

        // CATEGORY (1 char: '1' for STAFF, '2' for WORKER)
        const cat = r.CATEGORY === 'STAFF' ? '1' : (r.CATEGORY === 'SPECIAL' ? '0' : '2');
        buf.write(cat, rOff + 9, 1, 'ascii');

        // CSNO (4 chars numeric right-aligned)
        const csNo = String(parseInt(r.CSNO || '0', 10) || 0).padStart(4, ' ').slice(-4);
        buf.write(csNo, rOff + 10, 4, 'ascii');

        // DEDUCTION (10 chars numeric 2 decimals right-aligned)
        const dedVal = (parseFloat(r.STORE_DEDUCTION) || 0).toFixed(2);
        const ded = dedVal.padStart(10, ' ').slice(-10);
        buf.write(ded, rOff + 14, 10, 'ascii');

        rOff += recordLen;
      }
      buf[rOff] = 0x1A; // EOF

      res.setHeader('Content-Type', 'application/x-dbf');
      res.setHeader('Content-Disposition', `attachment; filename="PAYROLL_${period.month_year}.DBF"`);
      return res.send(buf);
    } else if (format === 'excel' || format === 'xlsx') {
      const exportData = rows.map(r => ({
        'EMPLOYEE CODE': r.EMPCODE,
        'CS NO': r.CSNO,
        'MEMBER NAME': r.NAME,
        'CATEGORY': r.CATEGORY,
        'STORE DEDUCTION (RS)': parseFloat(r.STORE_DEDUCTION),
        'CURRENT BILLS': parseFloat(r.BILLS),
        'DOMESTIC LOAN': parseFloat(r.DOMESTIC),
        'OLD DOMESTIC': parseFloat(r.OLD_DOME),
        'FESTIVAL ADVANCE': parseFloat(r.FESTIVAL),
        'MISC DEDUCTION': parseFloat(r.MISC),
        'UNREC DUES': parseFloat(r.UNREC),
        'ADDL SHARES': parseFloat(r.ADD_SHARES),
        'THRIFT DEPOSIT': parseFloat(r.THRIFT),
        'COUPONS': parseFloat(r.COUPONS),
        'DIRECT PAYMENTS': parseFloat(r.DIRECT_PAY),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Store Recovery Advice');
      const excelBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="CFECC_Store_Recovery_Advice_${period.month_year}.xlsx"`);
      return res.send(excelBuf);
    } else {
      // CSV format: [EMPCODE, CSNO, NAME, CATEGORY, STORE_DEDUCTION]
      const headers = ['EMPCODE', 'CSNO', 'NAME', 'CATEGORY', 'STORE_DEDUCTION', 'BILLS', 'DOMESTIC', 'FESTIVAL', 'THRIFT'];
      const csvLines = [headers.join(',')];

      for (const r of rows) {
        const line = [
          `"${r.EMPCODE}"`,
          `"${r.CSNO}"`,
          `"${r.NAME.replace(/"/g, '""')}"`,
          `"${r.CATEGORY}"`,
          (parseFloat(r.STORE_DEDUCTION) || 0).toFixed(2),
          (parseFloat(r.BILLS) || 0).toFixed(2),
          (parseFloat(r.DOMESTIC) || 0).toFixed(2),
          (parseFloat(r.FESTIVAL) || 0).toFixed(2),
          (parseFloat(r.THRIFT) || 0).toFixed(2),
        ];
        csvLines.push(line.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="CFECC_Store_Recovery_Schedule_${period.month_year}.csv"`);
      return res.send(csvLines.join('\r\n'));
    }
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
