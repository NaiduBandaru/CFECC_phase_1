import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';

export const salesRouter = Router();

// 1. Sales Register
salesRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { startDate, endDate, paymentMode, search = '', page = '1', limit = '15' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 15;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ['1=1'];

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(s.invoice_number) LIKE '%${q}%' OR 
        LOWER(e.first_name) LIKE '%${q}%' OR 
        LOWER(e.last_name) LIKE '%${q}%' OR 
        LOWER(e.employee_code) LIKE '%${q}%' OR
        LOWER(s.customer_name) LIKE '%${q}%'
      )`);
    }

    if (paymentMode && paymentMode !== 'ALL') {
      whereClauses.push(`s.payment_mode = '${(paymentMode as string).replace(/'/g, "''")}'`);
    }

    if (startDate) {
      whereClauses.push(`s.created_at >= '${startDate}'`);
    }

    if (endDate) {
      whereClauses.push(`s.created_at <= '${endDate} 23:59:59'`);
    }

    const whereSql = whereClauses.join(' AND ');

    const countResult = await executeRawSql(`
      SELECT COUNT(*) as total FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE ${whereSql}
    `);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const salesResult = await executeRawSql(`
      SELECT 
        s.*,
        e.employee_code, e.first_name, e.last_name,
        d.name as department_name,
        usr.full_name as billed_by_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users usr ON s.billed_by = usr.id
      WHERE ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset};
    `);

    return res.json({
      success: true,
      data: salesResult.rows,
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
        i.name as item_name, i.item_code, i.brand,
        u.code as unit_code
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE si.sale_id = ${saleId};
    `);

    return res.json({
      success: true,
      sale: saleResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});
