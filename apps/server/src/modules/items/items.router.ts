import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const itemsRouter = Router();

const createItemSchema = z.object({
  itemCode: z.string().min(1, 'Item code is required'),
  name: z.string().min(1, 'Item name is required'),
  categoryId: z.number().int().optional().nullable(),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitId: z.number().int().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  purchasePrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  employeePrice: z.number().nonnegative(),
  minStock: z.number().nonnegative().default(5),
  reorderLevel: z.number().nonnegative().default(10),
  taxRate: z.number().nonnegative().default(0),
});

// 1. List Items with Category & Search Filters
itemsRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { search = '', categoryId, lowStockOnly, page = '1', limit = '15' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 15;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = ['i.is_active = TRUE'];

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(i.item_code) LIKE '%${q}%' OR 
        LOWER(i.name) LIKE '%${q}%' OR 
        LOWER(i.barcode) LIKE '%${q}%' OR
        LOWER(i.brand) LIKE '%${q}%'
      )`);
    }

    if (categoryId && categoryId !== 'ALL') {
      whereClauses.push(`i.category_id = ${parseInt(categoryId as string, 10)}`);
    }

    if (lowStockOnly === 'true') {
      whereClauses.push(`i.current_stock <= i.min_stock`);
    }

    const whereSql = whereClauses.join(' AND ');

    const countResult = await executeRawSql(`SELECT COUNT(*) as total FROM items i WHERE ${whereSql}`);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const itemsResult = await executeRawSql(`
      SELECT 
        i.*,
        c.name as category_name,
        u.code as unit_code,
        u.name as unit_name
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE ${whereSql}
      ORDER BY i.name ASC
      LIMIT ${limitNum} OFFSET ${offset};
    `);

    return res.json({
      success: true,
      data: itemsResult.rows,
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

// 2. Categories & Units
itemsRouter.get('/categories', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const cats = await executeRawSql(`SELECT * FROM item_categories WHERE is_active = TRUE ORDER BY name ASC`);
    const unts = await executeRawSql(`SELECT * FROM units ORDER BY name ASC`);
    return res.json({
      success: true,
      categories: cats.rows,
      units: unts.rows,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Create Item
itemsRouter.post('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = createItemSchema.parse(req.body);

    const existing = await executeRawSql(`SELECT id FROM items WHERE item_code = '${body.itemCode.replace(/'/g, "''")}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Item code '${body.itemCode}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO items (
        item_code, name, category_id, brand, description, unit_id, sku, barcode, hsn_code,
        purchase_price, selling_price, employee_price, min_stock, reorder_level, tax_rate, current_stock
      ) VALUES (
        '${body.itemCode.replace(/'/g, "''")}',
        '${body.name.replace(/'/g, "''")}',
        ${body.categoryId || 'NULL'},
        ${body.brand ? `'${body.brand.replace(/'/g, "''")}'` : 'NULL'},
        ${body.description ? `'${body.description.replace(/'/g, "''")}'` : 'NULL'},
        ${body.unitId || 'NULL'},
        ${body.sku ? `'${body.sku.replace(/'/g, "''")}'` : 'NULL'},
        ${body.barcode ? `'${body.barcode.replace(/'/g, "''")}'` : 'NULL'},
        ${body.hsnCode ? `'${body.hsnCode.replace(/'/g, "''")}'` : 'NULL'},
        ${body.purchasePrice.toFixed(2)},
        ${body.sellingPrice.toFixed(2)},
        ${body.employeePrice.toFixed(2)},
        ${body.minStock.toFixed(3)},
        ${body.reorderLevel.toFixed(3)},
        ${body.taxRate.toFixed(2)},
        0.000
      ) RETURNING id;
    `);

    const newItemId = insertResult.rows[0].id;

    await logAudit({
      userId: req.user?.id,
      action: 'CREATE',
      entity: 'ITEM',
      entityId: newItemId,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Store item created successfully',
      itemId: newItemId,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Update Item & Track Price History
itemsRouter.put('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const itemId = parseInt(req.params.id as string, 10);
    const body = req.body;

    // Fetch existing prices
    const existing = await executeRawSql(`SELECT * FROM items WHERE id = ${itemId}`);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const currentItem = existing.rows[0];

    // Check if prices changed
    const oldPurchase = parseFloat(currentItem.purchase_price);
    const newPurchase = parseFloat(body.purchasePrice || currentItem.purchase_price);
    const oldSelling = parseFloat(currentItem.selling_price);
    const newSelling = parseFloat(body.sellingPrice || currentItem.selling_price);
    const oldEmp = parseFloat(currentItem.employee_price);
    const newEmp = parseFloat(body.employeePrice || currentItem.employee_price);

    if (oldPurchase !== newPurchase || oldSelling !== newSelling || oldEmp !== newEmp) {
      await executeRawSql(`
        INSERT INTO item_price_history (
          item_id, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price,
          old_employee_price, new_employee_price, reason, changed_by
        ) VALUES (
          ${itemId}, ${oldPurchase.toFixed(2)}, ${newPurchase.toFixed(2)},
          ${oldSelling.toFixed(2)}, ${newSelling.toFixed(2)},
          ${oldEmp.toFixed(2)}, ${newEmp.toFixed(2)},
          '${(body.priceChangeReason || 'Regular Price Revision').replace(/'/g, "''")}',
          ${req.user?.id || 'NULL'}
        );
      `);
    }

    await executeRawSql(`
      UPDATE items SET
        name = '${body.name.replace(/'/g, "''")}',
        category_id = ${body.categoryId || 'NULL'},
        brand = ${body.brand ? `'${body.brand.replace(/'/g, "''")}'` : 'NULL'},
        description = ${body.description ? `'${body.description.replace(/'/g, "''")}'` : 'NULL'},
        unit_id = ${body.unitId || 'NULL'},
        barcode = ${body.barcode ? `'${body.barcode.replace(/'/g, "''")}'` : 'NULL'},
        purchase_price = ${newPurchase.toFixed(2)},
        selling_price = ${newSelling.toFixed(2)},
        employee_price = ${newEmp.toFixed(2)},
        min_stock = ${parseFloat(body.minStock || currentItem.min_stock).toFixed(3)},
        reorder_level = ${parseFloat(body.reorderLevel || currentItem.reorder_level).toFixed(3)},
        tax_rate = ${parseFloat(body.taxRate || currentItem.tax_rate).toFixed(2)},
        updated_at = NOW()
      WHERE id = ${itemId};
    `);

    return res.json({ success: true, message: 'Item details updated successfully' });
  } catch (err) {
    next(err);
  }
});
