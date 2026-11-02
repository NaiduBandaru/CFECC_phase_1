import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const vendorsRouter = Router();

const vendorSchema = z.object({
  vendorCode: z.string().min(1, 'Vendor code is required'),
  name: z.string().min(1, 'Vendor name is required'),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().default('Visakhapatnam'),
  state: z.string().optional().default('Andhra Pradesh'),
  gstin: z.string().optional().nullable(),
  paymentTermsDays: z.number().int().min(0).default(30),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  openingBalance: z.number().nonnegative().default(0),
  isActive: z.boolean().optional().default(true),
});

// 1. List Vendors with Search, Sort, and Metrics
vendorsRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { search = '', includeInactive = 'false', sortBy = 'name', sortOrder = 'ASC' } = req.query;
    let whereClauses: string[] = [];

    if (includeInactive !== 'true') {
      whereClauses.push('v.is_active = TRUE');
    }

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(v.name) LIKE '%${q}%' OR 
        LOWER(v.vendor_code) LIKE '%${q}%' OR 
        LOWER(v.phone) LIKE '%${q}%' OR 
        LOWER(COALESCE(v.gstin, '')) LIKE '%${q}%' OR
        LOWER(COALESCE(v.contact_person, '')) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const allowedSortColumns: Record<string, string> = {
      name: 'v.name',
      vendor_code: 'v.vendor_code',
      current_outstanding: 'v.current_outstanding',
      created_at: 'v.created_at',
    };
    const sortCol = allowedSortColumns[sortBy as string] || 'v.name';
    const sortDir = (sortOrder as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const result = await executeRawSql(`
      SELECT 
        v.*,
        COALESCE((SELECT COUNT(*) FROM purchase_orders po WHERE po.vendor_id = v.id), 0) as po_count,
        COALESCE((SELECT COUNT(*) FROM purchase_invoices pi WHERE pi.vendor_id = v.id), 0) as invoice_count,
        COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po WHERE po.vendor_id = v.id), 0.00) as total_purchases
      FROM vendors v
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir};
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 2. Get Single Vendor Details
vendorsRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const vendorId = parseInt(req.params.id as string, 10);
    const result = await executeRawSql(`SELECT * FROM vendors WHERE id = ${vendorId}`);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// 3. Get Full 360° Vendor Profile (POs, Invoices, Payments, Activity Trail)
vendorsRouter.get('/:id/profile', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const vendorId = parseInt(req.params.id as string, 10);

    const vendorRes = await executeRawSql(`SELECT * FROM vendors WHERE id = ${vendorId}`);
    if (!vendorRes.rows || vendorRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    const vendor = vendorRes.rows[0];

    // Purchase History
    const poRes = await executeRawSql(`
      SELECT po.*, (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) as item_count
      FROM purchase_orders po
      WHERE po.vendor_id = ${vendorId}
      ORDER BY po.order_date DESC, po.id DESC
      LIMIT 50;
    `);

    // Invoice History
    const invRes = await executeRawSql(`
      SELECT pi.*, gr.grn_number
      FROM purchase_invoices pi
      LEFT JOIN goods_receipts gr ON pi.grn_id = gr.id
      WHERE pi.vendor_id = ${vendorId}
      ORDER BY pi.invoice_date DESC, pi.id DESC
      LIMIT 50;
    `);

    // Payment History
    const payRes = await executeRawSql(`
      SELECT vp.*, pi.system_bill_number, pi.invoice_number as vendor_bill_number
      FROM vendor_payments vp
      LEFT JOIN purchase_invoices pi ON vp.purchase_invoice_id = pi.id
      WHERE vp.vendor_id = ${vendorId}
      ORDER BY vp.payment_date DESC, vp.id DESC
      LIMIT 50;
    `);

    // Activity / Audit Trail
    const auditRes = await executeRawSql(`
      SELECT a.*, u.full_name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.entity = 'VENDOR' AND a.entity_id = '${vendorId}'
      ORDER BY a.created_at DESC
      LIMIT 25;
    `);

    return res.json({
      success: true,
      data: {
        vendor,
        purchaseOrders: poRes.rows,
        invoices: invRes.rows,
        payments: payRes.rows,
        activityHistory: auditRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Create Vendor
vendorsRouter.post('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = vendorSchema.parse(req.body);

    const existing = await executeRawSql(`SELECT id FROM vendors WHERE LOWER(vendor_code) = '${body.vendorCode.toLowerCase().replace(/'/g, "''")}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Vendor code '${body.vendorCode}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO vendors (
        vendor_code, name, contact_person, phone, email, address, city, state, gstin, payment_terms_days,
        bank_name, account_number, ifsc_code, opening_balance, current_outstanding, is_active
      ) VALUES (
        '${body.vendorCode.toUpperCase().replace(/'/g, "''")}',
        '${body.name.replace(/'/g, "''")}',
        ${body.contactPerson ? `'${body.contactPerson.replace(/'/g, "''")}'` : 'NULL'},
        '${body.phone.replace(/'/g, "''")}',
        ${body.email ? `'${body.email.replace(/'/g, "''")}'` : 'NULL'},
        ${body.address ? `'${body.address.replace(/'/g, "''")}'` : 'NULL'},
        '${(body.city || 'Visakhapatnam').replace(/'/g, "''")}',
        '${(body.state || 'Andhra Pradesh').replace(/'/g, "''")}',
        ${body.gstin ? `'${body.gstin.toUpperCase().replace(/'/g, "''")}'` : 'NULL'},
        ${body.paymentTermsDays},
        ${body.bankName ? `'${body.bankName.replace(/'/g, "''")}'` : 'NULL'},
        ${body.accountNumber ? `'${body.accountNumber.replace(/'/g, "''")}'` : 'NULL'},
        ${body.ifscCode ? `'${body.ifscCode.toUpperCase().replace(/'/g, "''")}'` : 'NULL'},
        ${body.openingBalance.toFixed(2)},
        ${body.openingBalance.toFixed(2)},
        ${body.isActive !== false ? 'TRUE' : 'FALSE'}
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

// 5. Update Vendor
vendorsRouter.put('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const vendorId = parseInt(req.params.id as string, 10);
    const body = vendorSchema.partial().parse(req.body);

    const existingRes = await executeRawSql(`SELECT * FROM vendors WHERE id = ${vendorId}`);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    const current = existingRes.rows[0];

    await executeRawSql(`
      UPDATE vendors SET
        name = '${(body.name || current.name).replace(/'/g, "''")}',
        contact_person = ${body.contactPerson !== undefined ? (body.contactPerson ? `'${body.contactPerson.replace(/'/g, "''")}'` : 'NULL') : (current.contact_person ? `'${current.contact_person.replace(/'/g, "''")}'` : 'NULL')},
        phone = '${(body.phone || current.phone).replace(/'/g, "''")}',
        email = ${body.email !== undefined ? (body.email ? `'${body.email.replace(/'/g, "''")}'` : 'NULL') : (current.email ? `'${current.email.replace(/'/g, "''")}'` : 'NULL')},
        address = ${body.address !== undefined ? (body.address ? `'${body.address.replace(/'/g, "''")}'` : 'NULL') : (current.address ? `'${current.address.replace(/'/g, "''")}'` : 'NULL')},
        city = '${(body.city || current.city || 'Visakhapatnam').replace(/'/g, "''")}',
        state = '${(body.state || current.state || 'Andhra Pradesh').replace(/'/g, "''")}',
        gstin = ${body.gstin !== undefined ? (body.gstin ? `'${body.gstin.toUpperCase().replace(/'/g, "''")}'` : 'NULL') : (current.gstin ? `'${current.gstin.toUpperCase().replace(/'/g, "''")}'` : 'NULL')},
        payment_terms_days = ${body.paymentTermsDays !== undefined ? body.paymentTermsDays : current.payment_terms_days},
        bank_name = ${body.bankName !== undefined ? (body.bankName ? `'${body.bankName.replace(/'/g, "''")}'` : 'NULL') : (current.bank_name ? `'${current.bank_name.replace(/'/g, "''")}'` : 'NULL')},
        account_number = ${body.accountNumber !== undefined ? (body.accountNumber ? `'${body.accountNumber.replace(/'/g, "''")}'` : 'NULL') : (current.account_number ? `'${current.account_number.replace(/'/g, "''")}'` : 'NULL')},
        ifsc_code = ${body.ifscCode !== undefined ? (body.ifscCode ? `'${body.ifscCode.toUpperCase().replace(/'/g, "''")}'` : 'NULL') : (current.ifsc_code ? `'${current.ifsc_code.toUpperCase().replace(/'/g, "''")}'` : 'NULL')},
        is_active = ${body.isActive !== undefined ? (body.isActive ? 'TRUE' : 'FALSE') : (current.is_active ? 'TRUE' : 'FALSE')},
        updated_at = NOW()
      WHERE id = ${vendorId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'UPDATE',
      entity: 'VENDOR',
      entityId: vendorId,
      oldValues: current,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Vendor details updated successfully' });
  } catch (err) {
    next(err);
  }
});
