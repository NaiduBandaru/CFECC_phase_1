import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';

export const reportsRouter = Router();

// 1. Employee Outstanding Report
reportsRouter.get('/employee-outstanding', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { departmentId } = req.query;
    let whereClause = 'e.current_outstanding > 0';

    if (departmentId && departmentId !== 'ALL') {
      whereClause += ` AND e.department_id = ${parseInt(departmentId as string, 10)}`;
    }

    const result = await executeRawSql(`
      SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.mobile,
        d.name as department_name, des.title as designation_title,
        e.credit_limit, e.current_outstanding, e.available_credit,
        (
          SELECT MAX(transaction_date) 
          FROM employee_ledger el 
          WHERE el.employee_id = e.id AND el.transaction_type = 'CREDIT_SALE'
        ) as last_purchase_date
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE ${whereClause}
      ORDER BY e.current_outstanding DESC;
    `);

    const totalOutstanding = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.current_outstanding), 0);

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        employeeCount: result.rows.length,
        totalOutstanding,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. Stock Valuation & Inventory Report
reportsRouter.get('/inventory-valuation', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const result = await executeRawSql(`
      SELECT 
        i.id, i.item_code, i.name, i.brand,
        c.name as category_name, u.code as unit_code,
        i.current_stock, i.min_stock, i.reorder_level,
        i.purchase_price, i.selling_price, i.employee_price,
        (i.current_stock * i.purchase_price) as valuation_purchase,
        (i.current_stock * i.selling_price) as valuation_retail,
        (i.current_stock <= i.min_stock) as is_low_stock
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE i.is_active = TRUE
      ORDER BY (i.current_stock * i.purchase_price) DESC;
    `);

    const totalValuation = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.valuation_purchase), 0);
    const lowStockCount = result.rows.filter((r: any) => r.is_low_stock).length;

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        totalItems: result.rows.length,
        totalValuation,
        lowStockCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Sales Performance Report
reportsRouter.get('/sales-performance', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const paymentModeSummary = await executeRawSql(`
      SELECT payment_mode, COUNT(*) as invoice_count, SUM(total_amount) as total_amount
      FROM sales
      GROUP BY payment_mode
      ORDER BY total_amount DESC;
    `);

    const topSellingItems = await executeRawSql(`
      SELECT 
        i.name as item_name, i.item_code,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      GROUP BY i.id, i.name, i.item_code
      ORDER BY total_quantity_sold DESC
      LIMIT 10;
    `);

    return res.json({
      success: true,
      paymentModeSummary: paymentModeSummary.rows,
      topSellingItems: topSellingItems.rows,
    });
  } catch (err) {
    next(err);
  }
});

