import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const vendorsRouter = Router();

vendorsRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { search = '' } = req.query;
    let whereClause = 'v.is_active = TRUE';

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClause += ` AND (
        LOWER(v.name) LIKE '%${q}%' OR 
        LOWER(v.vendor_code) LIKE '%${q}%' OR 
        LOWER(v.phone) LIKE '%${q}%' OR 
        LOWER(v.gstin) LIKE '%${q}%'
      )`;
    }

    const result = await executeRawSql(`
      SELECT v.*,
        COALESCE((SELECT COUNT(*) FROM purchase_orders po WHERE po.vendor_id = v.id), 0) as po_count,
        COALESCE((SELECT COUNT(*) FROM purchase_invoices pi WHERE pi.vendor_id = v.id), 0) as invoice_count
      FROM vendors v
      WHERE ${whereClause}
      ORDER BY v.name ASC;
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

vendorsRouter.post('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = req.body;
    const insertResult = await executeRawSql(`
      INSERT INTO vendors (
        vendor_code, name, contact_person, phone, email, address, city, state, gstin, payment_terms_days,
        bank_name, account_number, ifsc_code, opening_balance, current_outstanding
      ) VALUES (
        '${body.vendorCode.replace(/'/g, "''")}',
        '${body.name.replace(/'/g, "''")}',
        ${body.contactPerson ? `'${body.contactPerson.replace(/'/g, "''")}'` : 'NULL'},
        '${body.phone.replace(/'/g, "''")}',
        ${body.email ? `'${body.email.replace(/'/g, "''")}'` : 'NULL'},
        ${body.address ? `'${body.address.replace(/'/g, "''")}'` : 'NULL'},
        '${body.city || 'Visakhapatnam'}',
        '${body.state || 'Andhra Pradesh'}',
        ${body.gstin ? `'${body.gstin.replace(/'/g, "''")}'` : 'NULL'},
        ${parseInt(body.paymentTermsDays || '30', 10)},
        ${body.bankName ? `'${body.bankName.replace(/'/g, "''")}'` : 'NULL'},
        ${body.accountNumber ? `'${body.accountNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${body.ifscCode ? `'${body.ifscCode.replace(/'/g, "''")}'` : 'NULL'},
        ${parseFloat(body.openingBalance || '0').toFixed(2)},
        ${parseFloat(body.openingBalance || '0').toFixed(2)}
      ) RETURNING id;
    `);

    const newVendorId = insertResult.rows[0].id;

    await logAudit({
      userId: req.user?.id,
      action: 'CREATE',
      entity: 'VENDOR',
      entityId: newVendorId,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Vendor added successfully', vendorId: newVendorId });
  } catch (err) {
    next(err);
  }
});

