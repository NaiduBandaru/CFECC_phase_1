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

// 4. Purchase Inward Register Report (Date-range, Vendor, Status)
reportsRouter.get('/purchases/register', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { startDate, endDate, vendorId, status, search } = req.query;
    let whereClauses: string[] = ['1=1'];

    if (startDate) {
      whereClauses.push(`pi.invoice_date >= '${(startDate as string).replace(/'/g, "''")}'`);
    }
    if (endDate) {
      whereClauses.push(`pi.invoice_date <= '${(endDate as string).replace(/'/g, "''")}'`);
    }
    if (vendorId && vendorId !== 'ALL') {
      whereClauses.push(`pi.vendor_id = ${parseInt(vendorId as string, 10)}`);
    }
    if (status && status !== 'ALL') {
      whereClauses.push(`pi.status = '${(status as string).replace(/'/g, "''")}'`);
    }
    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(pi.invoice_number) LIKE '%${q}%' OR 
        LOWER(pi.system_bill_number) LIKE '%${q}%' OR 
        LOWER(v.name) LIKE '%${q}%' OR 
        LOWER(v.vendor_code) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await executeRawSql(`
      SELECT 
        pi.id, pi.invoice_number, pi.system_bill_number, pi.vendor_id,
        v.name as vendor_name, v.vendor_code, v.gstin as vendor_gstin, v.phone as vendor_phone,
        pi.grn_id, grn.grn_number,
        pi.invoice_date, pi.due_date,
        pi.subtotal, pi.tax_amount, pi.total_amount, pi.paid_amount,
        (pi.total_amount - pi.paid_amount) as balance_due,
        pi.status, pi.notes, pi.created_at
      FROM purchase_invoices pi
      JOIN vendors v ON pi.vendor_id = v.id
      LEFT JOIN goods_receipts grn ON pi.grn_id = grn.id
      WHERE ${whereSql}
      ORDER BY pi.invoice_date DESC, pi.id DESC;
    `);

    const totalInvoiced = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount || 0), 0);
    const totalTax = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.tax_amount || 0), 0);
    const totalPaid = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.paid_amount || 0), 0);
    const totalOutstanding = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.balance_due || 0), 0);

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        invoiceCount: result.rows.length,
        totalInvoiced,
        totalTax,
        totalPaid,
        totalOutstanding,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Vendor-Wise Purchase & Payables Summary Report
reportsRouter.get('/purchases/vendor-summary', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const result = await executeRawSql(`
      SELECT 
        v.id as vendor_id,
        v.vendor_code,
        v.name as vendor_name,
        v.contact_person,
        v.phone,
        v.gstin,
        v.payment_terms_days,
        v.current_outstanding,
        COUNT(pi.id) as total_invoices,
        COALESCE(SUM(pi.total_amount), 0.00) as total_purchased,
        COALESCE(SUM(pi.paid_amount), 0.00) as total_paid,
        COALESCE(SUM(pi.total_amount - pi.paid_amount), 0.00) as calculated_outstanding,
        MAX(pi.invoice_date) as last_invoice_date
      FROM vendors v
      LEFT JOIN purchase_invoices pi ON v.id = pi.vendor_id
      GROUP BY v.id, v.vendor_code, v.name, v.contact_person, v.phone, v.gstin, v.payment_terms_days, v.current_outstanding
      ORDER BY total_purchased DESC, v.current_outstanding DESC;
    `);

    const totalPurchased = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_purchased || 0), 0);
    const totalPaid = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_paid || 0), 0);
    const totalOutstanding = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.current_outstanding || 0), 0);

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        vendorCount: result.rows.length,
        totalPurchased,
        totalPaid,
        totalOutstanding,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 6. Item-Wise Purchase Summary & Rate Analysis
reportsRouter.get('/purchases/item-summary', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const result = await executeRawSql(`
      SELECT 
        i.id as item_id,
        i.item_code,
        i.name as item_name,
        i.brand,
        c.name as category_name,
        u.code as unit_code,
        i.current_stock,
        i.purchase_price as current_purchase_price,
        i.selling_price as current_selling_price,
        COALESCE(SUM(poi.ordered_qty), 0.000) as total_ordered_qty,
        COALESCE(SUM(poi.received_qty), 0.000) as total_received_qty,
        COALESCE(SUM(poi.total_price), 0.00) as total_purchase_spend,
        CASE 
          WHEN SUM(poi.ordered_qty) > 0 THEN (SUM(poi.total_price) / SUM(poi.ordered_qty))
          ELSE i.purchase_price
        END as weighted_avg_cost,
        COUNT(DISTINCT poi.po_id) as po_count
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN purchase_order_items poi ON i.id = poi.item_id
      GROUP BY i.id, i.item_code, i.name, i.brand, c.name, u.code, i.current_stock, i.purchase_price, i.selling_price
      ORDER BY total_purchase_spend DESC;
    `);

    const totalSpend = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_purchase_spend || 0), 0);

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        itemCount: result.rows.length,
        totalSpend,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 7. Goods Receipt Notes (GRN) & Inward Receiving Audit Register
reportsRouter.get('/purchases/grn-register', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { startDate, endDate, status } = req.query;
    let whereClauses: string[] = ['1=1'];

    if (startDate) {
      whereClauses.push(`grn.receipt_date >= '${(startDate as string).replace(/'/g, "''")}'`);
    }
    if (endDate) {
      whereClauses.push(`grn.receipt_date <= '${(endDate as string).replace(/'/g, "''")}'`);
    }
    if (status && status !== 'ALL') {
      whereClauses.push(`grn.status = '${(status as string).replace(/'/g, "''")}'`);
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await executeRawSql(`
      SELECT 
        grn.id, grn.grn_number, grn.receipt_date,
        v.name as vendor_name, v.vendor_code,
        po.po_number,
        grn.delivery_challan_number, grn.vehicle_number,
        grn.status, grn.notes, grn.created_at,
        COUNT(gri.id) as item_count,
        COALESCE(SUM(gri.received_qty), 0.000) as total_received_qty,
        COALESCE(SUM(gri.accepted_qty), 0.000) as total_accepted_qty,
        COALESCE(SUM(gri.rejected_qty), 0.000) as total_rejected_qty
      FROM goods_receipts grn
      JOIN vendors v ON grn.vendor_id = v.id
      LEFT JOIN purchase_orders po ON grn.po_id = po.id
      LEFT JOIN goods_receipt_items gri ON grn.id = gri.grn_id
      WHERE ${whereSql}
      GROUP BY grn.id, grn.grn_number, grn.receipt_date, v.name, v.vendor_code, po.po_number, grn.delivery_challan_number, grn.vehicle_number, grn.status, grn.notes, grn.created_at
      ORDER BY grn.receipt_date DESC, grn.id DESC;
    `);

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        grnCount: result.rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 8. Purchase Tax & Input Tax Credit (ITC - GSTR-2B) Reconciliation Report
reportsRouter.get('/purchases/gst-itc', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { startDate, endDate } = req.query;
    let whereClauses: string[] = ['1=1'];

    if (startDate) {
      whereClauses.push(`pi.invoice_date >= '${(startDate as string).replace(/'/g, "''")}'`);
    }
    if (endDate) {
      whereClauses.push(`pi.invoice_date <= '${(endDate as string).replace(/'/g, "''")}'`);
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await executeRawSql(`
      SELECT 
        pi.id, pi.system_bill_number, pi.invoice_number, pi.invoice_date,
        v.name as vendor_name, v.vendor_code, v.gstin as vendor_gstin,
        pi.subtotal as taxable_amount,
        pi.tax_amount as total_gst,
        (pi.tax_amount / 2) as cgst_amount,
        (pi.tax_amount / 2) as sgst_amount,
        pi.total_amount as invoice_total,
        pi.status as payment_status
      FROM purchase_invoices pi
      JOIN vendors v ON pi.vendor_id = v.id
      WHERE ${whereSql}
      ORDER BY pi.invoice_date DESC, pi.id DESC;
    `);

    const totalTaxable = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.taxable_amount || 0), 0);
    const totalGst = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_gst || 0), 0);
    const totalCgst = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.cgst_amount || 0), 0);
    const totalSgst = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.sgst_amount || 0), 0);
    const totalInvoiceVal = result.rows.reduce((sum: number, r: any) => sum + parseFloat(r.invoice_total || 0), 0);

    return res.json({
      success: true,
      data: result.rows,
      summary: {
        recordCount: result.rows.length,
        totalTaxable,
        totalGst,
        totalCgst,
        totalSgst,
        totalInvoiceVal,
      },
    });
  } catch (err) {
    next(err);
  }
});


