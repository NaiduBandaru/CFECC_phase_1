import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken, requirePermission } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const employeesRouter = Router();

// Validation Schemas
const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  mobile: z.string().min(10, 'Valid 10-digit mobile number is required'),
  alternateMobile: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  currentAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  departmentId: z.number().int().optional().nullable(),
  designationId: z.number().int().optional().nullable(),
  joiningDate: z.string().min(1, 'Joining date is required'),
  employmentType: z.string().default('PERMANENT'),
  employmentStatus: z.string().default('ACTIVE'),
  creditEnabled: z.boolean().default(true),
  creditLimit: z.number().nonnegative().default(10000),
  // Initial Salary
  basicSalary: z.number().nonnegative().default(0),
  da: z.number().nonnegative().default(0),
  hra: z.number().nonnegative().default(0),
  otherAllowances: z.number().nonnegative().default(0),
  // Bank Details
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
});

// 1. List Employees with Search, Filters & Pagination
employeesRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const {
      search = '',
      departmentId,
      status,
      creditEligibility,
      page = '1',
      limit = '10',
      sortBy = 'e.id',
      sortOrder = 'ASC',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = ['1=1'];

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(e.employee_code) LIKE '%${q}%' OR 
        LOWER(e.first_name) LIKE '%${q}%' OR 
        LOWER(e.last_name) LIKE '%${q}%' OR 
        LOWER(e.mobile) LIKE '%${q}%' OR
        LOWER(e.email) LIKE '%${q}%'
      )`);
    }

    if (departmentId && departmentId !== 'ALL') {
      whereClauses.push(`e.department_id = ${parseInt(departmentId as string, 10)}`);
    }

    if (status && status !== 'ALL') {
      whereClauses.push(`e.employment_status = '${(status as string).replace(/'/g, "''")}'`);
    }

    if (creditEligibility && creditEligibility !== 'ALL') {
      const isEligible = creditEligibility === 'ELIGIBLE';
      whereClauses.push(`e.credit_enabled = ${isEligible ? 'TRUE' : 'FALSE'}`);
    }

    const whereSql = whereClauses.join(' AND ');

    // Count total
    const countResult = await executeRawSql(`
      SELECT COUNT(*) as total FROM employees e WHERE ${whereSql}
    `);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Fetch records
    const listResult = await executeRawSql(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.date_of_birth, e.gender, e.profile_image_url,
        e.mobile, e.alternate_mobile, e.email, e.current_address, e.permanent_address,
        e.department_id, d.name as department_name, d.code as department_code,
        e.designation_id, des.title as designation_title,
        e.joining_date, e.employment_type, e.employment_status,
        e.credit_enabled, e.credit_limit, e.current_outstanding, e.available_credit,
        e.created_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ${whereSql}
      ORDER BY ${sortBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}
      LIMIT ${limitNum} OFFSET ${offset};
    `);

    return res.json({
      success: true,
      data: listResult.rows,
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

// 2. Department & Designation lookups
employeesRouter.get('/departments', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const depts = await executeRawSql(`SELECT * FROM departments WHERE is_active = TRUE ORDER BY name ASC`);
    const desigs = await executeRawSql(`SELECT * FROM designations WHERE is_active = TRUE ORDER BY title ASC`);
    return res.json({
      success: true,
      departments: depts.rows,
      designations: desigs.rows,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Employee Full Profile (Supports 11 Tabs)
employeesRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);

    // Base details
    const empResult = await executeRawSql(`
      SELECT 
        e.*,
        d.name as department_name,
        des.title as designation_title,
        mgr.first_name || ' ' || mgr.last_name as manager_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
      WHERE e.id = ${employeeId}
    `);

    if (!empResult.rows || empResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = empResult.rows[0];

    // Tab 5: Salary Information
    const salaryResult = await executeRawSql(`
      SELECT * FROM employee_salaries 
      WHERE employee_id = ${employeeId}
      ORDER BY effective_date DESC
      LIMIT 1;
    `);

    // Tab 6: Bank Details
    const bankResult = await executeRawSql(`
      SELECT * FROM employee_bank_details 
      WHERE employee_id = ${employeeId}
      LIMIT 1;
    `);

    // Tab 8: Documents
    const docsResult = await executeRawSql(`
      SELECT * FROM employee_documents 
      WHERE employee_id = ${employeeId}
      ORDER BY uploaded_at DESC;
    `);

    // Tab 9: Purchase History (POS Sales)
    const purchasesResult = await executeRawSql(`
      SELECT s.id, s.invoice_number, s.total_amount, s.payment_mode, s.created_at,
             COUNT(si.id) as item_count
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.employee_id = ${employeeId}
      GROUP BY s.id, s.invoice_number, s.total_amount, s.payment_mode, s.created_at
      ORDER BY s.created_at DESC
      LIMIT 10;
    `);

    // Tab 10: Billing Statements & Ledger History
    const statementsResult = await executeRawSql(`
      SELECT ei.*, bp.period_name, bp.period_code
      FROM employee_invoices ei
      JOIN billing_periods bp ON ei.billing_period_id = bp.id
      WHERE ei.employee_id = ${employeeId}
      ORDER BY ei.created_at DESC;
    `);

    const ledgerResult = await executeRawSql(`
      SELECT * FROM employee_ledger
      WHERE employee_id = ${employeeId}
      ORDER BY transaction_date DESC, id DESC
      LIMIT 20;
    `);

    // Tab 11: Audit / Activity History
    const activityResult = await executeRawSql(`
      SELECT al.*, u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity = 'EMPLOYEE' AND al.entity_id = '${employeeId}'
      ORDER BY al.created_at DESC
      LIMIT 10;
    `);

    return res.json({
      success: true,
      data: {
        overview: employee,
        personal: {
          employeeCode: employee.employee_code,
          firstName: employee.first_name,
          lastName: employee.last_name,
          dateOfBirth: employee.date_of_birth,
          gender: employee.gender,
          maritalStatus: employee.marital_status,
          profileImageUrl: employee.profile_image_url,
        },
        contact: {
          mobile: employee.mobile,
          alternateMobile: employee.alternate_mobile,
          email: employee.email,
          currentAddress: employee.current_address,
          permanentAddress: employee.permanent_address,
        },
        employment: {
          departmentId: employee.department_id,
          departmentName: employee.department_name,
          designationId: employee.designation_id,
          designationTitle: employee.designation_title,
          joiningDate: employee.joining_date,
          employmentType: employee.employment_type,
          reportingManagerId: employee.reporting_manager_id,
          managerName: employee.manager_name,
          employmentStatus: employee.employment_status,
          exitDate: employee.exit_date,
        },
        salary: salaryResult.rows[0] || null,
        bank: bankResult.rows[0] || null,
        storeCredit: {
          creditEnabled: employee.credit_enabled,
          creditLimit: parseFloat(employee.credit_limit),
          currentOutstanding: parseFloat(employee.current_outstanding),
          availableCredit: parseFloat(employee.available_credit),
          billingCycleDay: employee.billing_cycle_day,
        },
        documents: docsResult.rows,
        purchases: purchasesResult.rows,
        billing: {
          statements: statementsResult.rows,
          ledger: ledgerResult.rows,
        },
        activity: activityResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Create Employee
employeesRouter.post('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = createEmployeeSchema.parse(req.body);

    // Check unique employee code
    const existing = await executeRawSql(`
      SELECT id FROM employees WHERE employee_code = '${body.employeeCode.replace(/'/g, "''")}'
    `);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Employee code '${body.employeeCode}' already exists.` });
    }

    const availableCredit = body.creditLimit;

    const insertResult = await executeRawSql(`
      INSERT INTO employees (
        employee_code, first_name, last_name, date_of_birth, gender,
        mobile, alternate_mobile, email, current_address, permanent_address,
        department_id, designation_id, joining_date, employment_type,
        employment_status, credit_enabled, credit_limit, current_outstanding, available_credit
      ) VALUES (
        '${body.employeeCode.replace(/'/g, "''")}',
        '${body.firstName.replace(/'/g, "''")}',
        '${body.lastName.replace(/'/g, "''")}',
        ${body.dateOfBirth ? `'${body.dateOfBirth}'` : 'NULL'},
        ${body.gender ? `'${body.gender}'` : 'NULL'},
        '${body.mobile.replace(/'/g, "''")}',
        ${body.alternateMobile ? `'${body.alternateMobile.replace(/'/g, "''")}'` : 'NULL'},
        ${body.email ? `'${body.email.replace(/'/g, "''")}'` : 'NULL'},
        ${body.currentAddress ? `'${body.currentAddress.replace(/'/g, "''")}'` : 'NULL'},
        ${body.permanentAddress ? `'${body.permanentAddress.replace(/'/g, "''")}'` : 'NULL'},
        ${body.departmentId || 'NULL'},
        ${body.designationId || 'NULL'},
        '${body.joiningDate}',
        '${body.employmentType}',
        '${body.employmentStatus}',
        ${body.creditEnabled ? 'TRUE' : 'FALSE'},
        ${body.creditLimit.toFixed(2)},
        0.00,
        ${availableCredit.toFixed(2)}
      ) RETURNING id;
    `);

    const newEmpId = insertResult.rows[0].id;

    // Insert initial salary if provided
    if (body.basicSalary > 0) {
      const gross = body.basicSalary + body.da + body.hra + body.otherAllowances;
      await executeRawSql(`
        INSERT INTO employee_salaries (
          employee_id, basic_salary, da, hra, other_allowances, net_base_salary, effective_date
        ) VALUES (
          ${newEmpId}, ${body.basicSalary.toFixed(2)}, ${body.da.toFixed(2)}, ${body.hra.toFixed(2)},
          ${body.otherAllowances.toFixed(2)}, ${gross.toFixed(2)}, '${body.joiningDate}'
        );
      `);
    }

    // Insert bank details if provided
    if (body.bankName && body.accountNumber && body.ifscCode) {
      await executeRawSql(`
        INSERT INTO employee_bank_details (
          employee_id, account_holder_name, bank_name, account_number, ifsc_code
        ) VALUES (
          ${newEmpId},
          '${(body.firstName + ' ' + body.lastName).replace(/'/g, "''")}',
          '${body.bankName.replace(/'/g, "''")}',
          '${body.accountNumber.replace(/'/g, "''")}',
          '${body.ifscCode.replace(/'/g, "''")}'
        );
      `);
    }

    await logAudit({
      userId: req.user?.id,
      action: 'CREATE',
      entity: 'EMPLOYEE',
      entityId: newEmpId,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Employee registered successfully',
      employeeId: newEmpId,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Update Employee
employeesRouter.put('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);
    const body = req.body;

    await executeRawSql(`
      UPDATE employees SET
        first_name = '${body.firstName.replace(/'/g, "''")}',
        last_name = '${body.lastName.replace(/'/g, "''")}',
        mobile = '${body.mobile.replace(/'/g, "''")}',
        alternate_mobile = ${body.alternateMobile ? `'${body.alternateMobile.replace(/'/g, "''")}'` : 'NULL'},
        email = ${body.email ? `'${body.email.replace(/'/g, "''")}'` : 'NULL'},
        current_address = ${body.currentAddress ? `'${body.currentAddress.replace(/'/g, "''")}'` : 'NULL'},
        permanent_address = ${body.permanentAddress ? `'${body.permanentAddress.replace(/'/g, "''")}'` : 'NULL'},
        department_id = ${body.departmentId || 'NULL'},
        designation_id = ${body.designationId || 'NULL'},
        employment_status = '${body.employmentStatus || 'ACTIVE'}',
        updated_at = NOW()
      WHERE id = ${employeeId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'UPDATE',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) {
    next(err);
  }
});

// 6. Update Store Credit Configuration
employeesRouter.put('/:id/credit', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);
    const { creditEnabled, creditLimit } = req.body;

    // Fetch current outstanding
    const emp = await executeRawSql(`SELECT current_outstanding FROM employees WHERE id = ${employeeId}`);
    if (!emp.rows || emp.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const outstanding = parseFloat(emp.rows[0].current_outstanding);
    const newLimit = parseFloat(creditLimit);
    const newAvailable = Math.max(0, newLimit - outstanding);

    await executeRawSql(`
      UPDATE employees SET
        credit_enabled = ${creditEnabled ? 'TRUE' : 'FALSE'},
        credit_limit = ${newLimit.toFixed(2)},
        available_credit = ${newAvailable.toFixed(2)},
        updated_at = NOW()
      WHERE id = ${employeeId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'UPDATE_CREDIT',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      newValues: { creditEnabled, creditLimit, newAvailable },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Store credit settings updated successfully',
      creditLimit: newLimit,
      availableCredit: newAvailable,
    });
  } catch (err) {
    next(err);
  }
});

// 7. Update Employee Salary Structure
employeesRouter.put('/:id/salary', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);
    const { basicSalary, da, hra, otherAllowances, statutoryDeductions, effectiveDate } = req.body;

    const basic = parseFloat(basicSalary || 0);
    const daVal = parseFloat(da || 0);
    const hraVal = parseFloat(hra || 0);
    const allowVal = parseFloat(otherAllowances || 0);
    const statVal = parseFloat(statutoryDeductions || 0);
    const gross = basic + daVal + hraVal + allowVal;

    await executeRawSql(`
      INSERT INTO employee_salaries (
        employee_id, basic_salary, da, hra, other_allowances, statutory_deductions, net_base_salary, effective_date
      ) VALUES (
        ${employeeId}, ${basic.toFixed(2)}, ${daVal.toFixed(2)}, ${hraVal.toFixed(2)},
        ${allowVal.toFixed(2)}, ${statVal.toFixed(2)}, ${gross.toFixed(2)},
        '${effectiveDate || new Date().toISOString().split('T')[0]}'
      );
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'UPDATE_SALARY',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      newValues: req.body,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Salary structure updated successfully' });
  } catch (err) {
    next(err);
  }
});

// 8. Update Employee Bank Details
employeesRouter.put('/:id/bank', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);
    const { accountHolderName, bankName, accountNumber, ifscCode, branch } = req.body;

    const existing = await executeRawSql(`SELECT id FROM employee_bank_details WHERE employee_id = ${employeeId}`);

    if (existing.rows && existing.rows.length > 0) {
      await executeRawSql(`
        UPDATE employee_bank_details SET
          account_holder_name = '${accountHolderName.replace(/'/g, "''")}',
          bank_name = '${bankName.replace(/'/g, "''")}',
          account_number = '${accountNumber.replace(/'/g, "''")}',
          ifsc_code = '${ifscCode.replace(/'/g, "''")}',
          branch = ${branch ? `'${branch.replace(/'/g, "''")}'` : 'NULL'}
        WHERE employee_id = ${employeeId};
      `);
    } else {
      await executeRawSql(`
        INSERT INTO employee_bank_details (
          employee_id, account_holder_name, bank_name, account_number, ifsc_code, branch
        ) VALUES (
          ${employeeId}, '${accountHolderName.replace(/'/g, "''")}', '${bankName.replace(/'/g, "''")}',
          '${accountNumber.replace(/'/g, "''")}', '${ifscCode.replace(/'/g, "''")}',
          ${branch ? `'${branch.replace(/'/g, "''")}'` : 'NULL'}
        );
      `);
    }

    await logAudit({
      userId: req.user?.id,
      action: 'UPDATE_BANK',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      newValues: req.body,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Bank details saved successfully' });
  } catch (err) {
    next(err);
  }
});

// 9. Attach / Upload Document
employeesRouter.post('/:id/documents', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);
    const { documentType, documentName, documentUrl, fileSize, mimeType } = req.body;

    const insertResult = await executeRawSql(`
      INSERT INTO employee_documents (
        employee_id, document_type, document_name, document_url, file_size, mime_type
      ) VALUES (
        ${employeeId}, '${documentType.replace(/'/g, "''")}', '${documentName.replace(/'/g, "''")}',
        '${(documentUrl || '#').replace(/'/g, "''")}', ${fileSize || 1024}, '${mimeType || 'application/pdf'}'
      ) RETURNING id;
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'UPLOAD_DOCUMENT',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      newValues: { documentType, documentName },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      documentId: insertResult.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

// 10. Delete Document
employeesRouter.delete('/:id/documents/:docId', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const employeeId = parseInt(req.params.id as string, 10);
    const docId = parseInt(req.params.docId as string, 10);

    await executeRawSql(`DELETE FROM employee_documents WHERE id = ${docId} AND employee_id = ${employeeId}`);

    return res.json({ success: true, message: 'Document removed successfully' });
  } catch (err) {
    next(err);
  }
});

// 11. Bulk Actions (Enable credit, Disable credit, Update employment status)
employeesRouter.post('/bulk-action', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { employeeIds, action, value } = req.body;
    // action: 'SET_CREDIT' (value: boolean) | 'SET_STATUS' (value: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED')

    if (!employeeIds || employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No employees selected' });
    }

    const idsList = employeeIds.map((id: number) => parseInt(id.toString(), 10)).join(',');

    if (action === 'SET_CREDIT') {
      const enableCredit = !!value;
      await executeRawSql(`
        UPDATE employees SET
          credit_enabled = ${enableCredit ? 'TRUE' : 'FALSE'},
          updated_at = NOW()
        WHERE id IN (${idsList});
      `);
    } else if (action === 'SET_STATUS') {
      const newStatus = (value as string).replace(/'/g, "''");
      await executeRawSql(`
        UPDATE employees SET
          employment_status = '${newStatus}',
          updated_at = NOW()
        WHERE id IN (${idsList});
      `);
    }

    await logAudit({
      userId: req.user?.id,
      action: `BULK_${action}`,
      entity: 'EMPLOYEE',
      newValues: { employeeIds, action, value },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Bulk action applied to ${employeeIds.length} employee accounts.`,
    });
  } catch (err) {
    next(err);
  }
});

// 12. Bulk Excel/CSV Import
employeesRouter.post('/import', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { rows } = req.body; // array of { employeeCode, firstName, lastName, mobile, departmentId, designationId, creditLimit, basicSalary }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided for import' });
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (const r of rows) {
      try {
        const code = (r.employeeCode || '').trim();
        const first = (r.firstName || '').trim();
        const last = (r.lastName || '').trim();
        const mobile = (r.mobile || '').trim();

        if (!code || !first || !mobile) {
          errors.push(`Row missing required fields: ${JSON.stringify(r)}`);
          continue;
        }

        const existing = await executeRawSql(`SELECT id FROM employees WHERE employee_code = '${code.replace(/'/g, "''")}'`);
        if (existing.rows && existing.rows.length > 0) {
          errors.push(`Employee code '${code}' already exists`);
          continue;
        }

        const creditLimit = parseFloat(r.creditLimit || 10000);
        const joiningDate = r.joiningDate || new Date().toISOString().split('T')[0];

        const insertRes = await executeRawSql(`
          INSERT INTO employees (
            employee_code, first_name, last_name, mobile, email, department_id, designation_id,
            joining_date, employment_status, credit_enabled, credit_limit, current_outstanding, available_credit
          ) VALUES (
            '${code.replace(/'/g, "''")}', '${first.replace(/'/g, "''")}', '${last.replace(/'/g, "''")}',
            '${mobile.replace(/'/g, "''")}', ${r.email ? `'${r.email.replace(/'/g, "''")}'` : 'NULL'},
            ${r.departmentId || 'NULL'}, ${r.designationId || 'NULL'},
            '${joiningDate}', 'ACTIVE', TRUE, ${creditLimit.toFixed(2)}, 0.00, ${creditLimit.toFixed(2)}
          ) RETURNING id;
        `);

        importedCount++;
      } catch (err: any) {
        errors.push(err.message || 'Error processing row');
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'BULK_IMPORT',
      entity: 'EMPLOYEE',
      newValues: { importedCount, errorCount: errors.length },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Successfully imported ${importedCount} employees.`,
      importedCount,
      errors: errors.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});
