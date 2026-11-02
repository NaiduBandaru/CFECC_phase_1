import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const itemsRouter = Router();

const itemSchema = z.object({
  itemCode: z.string().min(1, 'Item code is required'),
  name: z.string().min(1, 'Item name is required'),
  categoryId: z.number().int().optional().nullable(),
  subcategory: z.string().optional().nullable(),
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
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const categorySchema = z.object({
  code: z.string().min(1, 'Category code is required'),
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
});

const unitSchema = z.object({
  code: z.string().min(1, 'Unit code is required'),
  name: z.string().min(1, 'Unit name is required'),
  precision: z.number().int().min(0).max(4).default(0),
});

// 1. List Items with Category, Search Filters, Low Stock, and Sorting
itemsRouter.get('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { 
      search = '', 
      categoryId, 
      lowStockOnly, 
      sortBy = 'name', 
      sortOrder = 'ASC',
      includeInactive = 'false',
      page = '1', 
      limit = '15' 
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 15;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];

    if (includeInactive !== 'true') {
      whereClauses.push('i.is_active = TRUE');
    }

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(i.item_code) LIKE '%${q}%' OR 
        LOWER(i.name) LIKE '%${q}%' OR 
        LOWER(COALESCE(i.barcode, '')) LIKE '%${q}%' OR
        LOWER(COALESCE(i.brand, '')) LIKE '%${q}%' OR
        LOWER(COALESCE(i.sku, '')) LIKE '%${q}%' OR
        LOWER(COALESCE(i.hsn_code, '')) LIKE '%${q}%'
      )`);
    }

    if (categoryId && categoryId !== 'ALL') {
      whereClauses.push(`i.category_id = ${parseInt(categoryId as string, 10)}`);
    }

    if (lowStockOnly === 'true') {
      whereClauses.push(`i.current_stock <= i.min_stock`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Validate sorting column to prevent injection
    const allowedSortColumns: Record<string, string> = {
      name: 'i.name',
      item_code: 'i.item_code',
      brand: 'i.brand',
      purchase_price: 'i.purchase_price',
      selling_price: 'i.selling_price',
      employee_price: 'i.employee_price',
      current_stock: 'i.current_stock',
      category_name: 'c.name',
      created_at: 'i.created_at',
    };

    const sortCol = allowedSortColumns[sortBy as string] || 'i.name';
    const sortDir = (sortOrder as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const countResult = await executeRawSql(`SELECT COUNT(*) as total FROM items i ${whereSql}`);
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
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir}
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

// 2. Categories & Units List
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

// 3. Create Category
itemsRouter.post('/categories', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = categorySchema.parse(req.body);
    const existing = await executeRawSql(`SELECT id FROM item_categories WHERE LOWER(code) = '${body.code.replace(/'/g, "''").toLowerCase()}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Category code '${body.code}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO item_categories (code, name, description, is_active)
      VALUES (
        '${body.code.toUpperCase().replace(/'/g, "''")}',
        '${body.name.replace(/'/g, "''")}',
        ${body.description ? `'${body.description.replace(/'/g, "''")}'` : 'NULL'},
        TRUE
      ) RETURNING *;
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'CREATE',
      entity: 'ITEM_CATEGORY',
      entityId: insertResult.rows[0].id,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: insertResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// 4. Create Unit
itemsRouter.post('/units', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = unitSchema.parse(req.body);
    const existing = await executeRawSql(`SELECT id FROM units WHERE LOWER(code) = '${body.code.replace(/'/g, "''").toLowerCase()}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Unit code '${body.code}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO units (code, name, precision)
      VALUES (
        '${body.code.toUpperCase().replace(/'/g, "''")}',
        '${body.name.replace(/'/g, "''")}',
        ${body.precision}
      ) RETURNING *;
    `);

    return res.status(201).json({
      success: true,
      message: 'Unit created successfully',
      unit: insertResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// 4b. Global Pricing Overview & Margin Metrics
itemsRouter.get('/pricing/overview', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const statsResult = await executeRawSql(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(AVG(CASE WHEN purchase_price > 0 THEN ((selling_price - purchase_price) / purchase_price) * 100 ELSE 0 END), 0.00) as avg_retail_markup_pct,
        COALESCE(AVG(CASE WHEN selling_price > 0 THEN ((selling_price - employee_price) / selling_price) * 100 ELSE 0 END), 0.00) as avg_subsidy_discount_pct,
        COALESCE((SELECT COUNT(*) FROM item_price_history), 0) as total_revisions_count
      FROM items
      WHERE is_active = TRUE;
    `);

    return res.json({
      success: true,
      data: statsResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// 4c. Global Price Revision History Across All Items
itemsRouter.get('/pricing/history', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { limit = '50' } = req.query;
    const historyResult = await executeRawSql(`
      SELECT 
        iph.*,
        i.name as item_name,
        i.item_code,
        c.name as category_name,
        u.full_name as changed_by_name
      FROM item_price_history iph
      JOIN items i ON iph.item_id = i.id
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN users u ON iph.changed_by = u.id
      ORDER BY iph.created_at DESC
      LIMIT ${parseInt(limit as string, 10)};
    `);

    return res.json({
      success: true,
      data: historyResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// 4d. Bulk Category / Store Price Revision
itemsRouter.post('/pricing/bulk-update', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { categoryId, percentageChange, targetField, reason } = req.body;
    const pct = parseFloat(percentageChange);
    if (isNaN(pct) || pct === 0) {
      return res.status(400).json({ success: false, message: 'Valid percentage change is required.' });
    }

    if (!['selling_price', 'employee_price'].includes(targetField)) {
      return res.status(400).json({ success: false, message: 'Invalid target pricing field.' });
    }

    let whereClause = 'is_active = TRUE';
    if (categoryId && categoryId !== 'ALL') {
      whereClause += ` AND category_id = ${parseInt(categoryId, 10)}`;
    }

    const itemsRes = await executeRawSql(`SELECT * FROM items WHERE ${whereClause}`);
    const itemsToUpdate = itemsRes.rows;

    let updatedCount = 0;
    for (const itm of itemsToUpdate) {
      const oldVal = parseFloat(itm[targetField]);
      const newVal = Math.round((oldVal * (1 + pct / 100)) * 100) / 100;
      if (oldVal === newVal) continue;

      const oldPurchase = parseFloat(itm.purchase_price);
      const oldSelling = parseFloat(itm.selling_price);
      const oldEmp = parseFloat(itm.employee_price);

      const newSelling = targetField === 'selling_price' ? newVal : oldSelling;
      const newEmp = targetField === 'employee_price' ? newVal : oldEmp;

      await executeRawSql(`
        INSERT INTO item_price_history (
          item_id, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price,
          old_employee_price, new_employee_price, reason, changed_by
        ) VALUES (
          ${itm.id}, ${oldPurchase.toFixed(2)}, ${oldPurchase.toFixed(2)},
          ${oldSelling.toFixed(2)}, ${newSelling.toFixed(2)},
          ${oldEmp.toFixed(2)}, ${newEmp.toFixed(2)},
          '${(reason || `Bulk ${pct > 0 ? '+' : ''}${pct}% ${targetField} adjustment`).replace(/'/g, "''")}',
          ${req.user?.id || 'NULL'}
        );
      `);

      await executeRawSql(`
        UPDATE items SET
          ${targetField} = ${newVal.toFixed(2)},
          updated_at = NOW()
        WHERE id = ${itm.id};
      `);
      updatedCount++;
    }

    await logAudit({
      userId: req.user?.id,
      action: 'BULK_PRICE_UPDATE',
      entity: 'ITEM_PRICING',
      entityId: 0,
      newValues: { categoryId, percentageChange: pct, targetField, updatedCount },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Bulk pricing update completed for ${updatedCount} commodity items.`,
      updatedCount,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Get Single Item Details
itemsRouter.get('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const itemId = parseInt(req.params.id as string, 10);
    const result = await executeRawSql(`
      SELECT 
        i.*,
        c.name as category_name,
        u.code as unit_code,
        u.name as unit_name
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE i.id = ${itemId};
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    return res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// 6. Get Item Price History
itemsRouter.get('/:id/price-history', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const itemId = parseInt(req.params.id as string, 10);
    const historyResult = await executeRawSql(`
      SELECT 
        iph.*,
        u.full_name as changed_by_name
      FROM item_price_history iph
      LEFT JOIN users u ON iph.changed_by = u.id
      WHERE iph.item_id = ${itemId}
      ORDER BY iph.created_at DESC;
    `);

    return res.json({
      success: true,
      data: historyResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// 7. Create Item
itemsRouter.post('/', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const body = itemSchema.parse(req.body);

    const existing = await executeRawSql(`SELECT id FROM items WHERE item_code = '${body.itemCode.replace(/'/g, "''")}'`);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Item code '${body.itemCode}' already exists.` });
    }

    const insertResult = await executeRawSql(`
      INSERT INTO items (
        item_code, name, category_id, subcategory, brand, description, unit_id, sku, barcode, hsn_code,
        purchase_price, selling_price, employee_price, min_stock, reorder_level, tax_rate, image_url, current_stock, is_active
      ) VALUES (
        '${body.itemCode.replace(/'/g, "''")}',
        '${body.name.replace(/'/g, "''")}',
        ${body.categoryId || 'NULL'},
        ${body.subcategory ? `'${body.subcategory.replace(/'/g, "''")}'` : 'NULL'},
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
        ${body.imageUrl ? `'${body.imageUrl.replace(/'/g, "''")}'` : 'NULL'},
        0.000,
        ${body.isActive !== false ? 'TRUE' : 'FALSE'}
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

// 8. Update Item & Track Price History
itemsRouter.put('/:id', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const itemId = parseInt(req.params.id as string, 10);
    const body = req.body;

    const existing = await executeRawSql(`SELECT * FROM items WHERE id = ${itemId}`);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const currentItem = existing.rows[0];

    const oldPurchase = parseFloat(currentItem.purchase_price);
    const newPurchase = parseFloat(body.purchasePrice !== undefined ? body.purchasePrice : currentItem.purchase_price);
    const oldSelling = parseFloat(currentItem.selling_price);
    const newSelling = parseFloat(body.sellingPrice !== undefined ? body.sellingPrice : currentItem.selling_price);
    const oldEmp = parseFloat(currentItem.employee_price);
    const newEmp = parseFloat(body.employeePrice !== undefined ? body.employeePrice : currentItem.employee_price);

    // If any price changed, record to item_price_history
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
        name = '${(body.name || currentItem.name).replace(/'/g, "''")}',
        category_id = ${body.categoryId !== undefined ? (body.categoryId || 'NULL') : (currentItem.category_id || 'NULL')},
        subcategory = ${body.subcategory ? `'${body.subcategory.replace(/'/g, "''")}'` : (body.subcategory === null ? 'NULL' : (currentItem.subcategory ? `'${currentItem.subcategory.replace(/'/g, "''")}'` : 'NULL'))},
        brand = ${body.brand ? `'${body.brand.replace(/'/g, "''")}'` : (body.brand === null ? 'NULL' : (currentItem.brand ? `'${currentItem.brand.replace(/'/g, "''")}'` : 'NULL'))},
        description = ${body.description ? `'${body.description.replace(/'/g, "''")}'` : (body.description === null ? 'NULL' : (currentItem.description ? `'${currentItem.description.replace(/'/g, "''")}'` : 'NULL'))},
        unit_id = ${body.unitId !== undefined ? (body.unitId || 'NULL') : (currentItem.unit_id || 'NULL')},
        sku = ${body.sku ? `'${body.sku.replace(/'/g, "''")}'` : (body.sku === null ? 'NULL' : (currentItem.sku ? `'${currentItem.sku.replace(/'/g, "''")}'` : 'NULL'))},
        barcode = ${body.barcode ? `'${body.barcode.replace(/'/g, "''")}'` : (body.barcode === null ? 'NULL' : (currentItem.barcode ? `'${currentItem.barcode.replace(/'/g, "''")}'` : 'NULL'))},
        hsn_code = ${body.hsnCode ? `'${body.hsnCode.replace(/'/g, "''")}'` : (body.hsnCode === null ? 'NULL' : (currentItem.hsn_code ? `'${currentItem.hsn_code.replace(/'/g, "''")}'` : 'NULL'))},
        purchase_price = ${newPurchase.toFixed(2)},
        selling_price = ${newSelling.toFixed(2)},
        employee_price = ${newEmp.toFixed(2)},
        min_stock = ${parseFloat(body.minStock !== undefined ? body.minStock : currentItem.min_stock).toFixed(3)},
        reorder_level = ${parseFloat(body.reorderLevel !== undefined ? body.reorderLevel : currentItem.reorder_level).toFixed(3)},
        tax_rate = ${parseFloat(body.taxRate !== undefined ? body.taxRate : currentItem.tax_rate).toFixed(2)},
        image_url = ${body.imageUrl ? `'${body.imageUrl.replace(/'/g, "''")}'` : (body.imageUrl === null ? 'NULL' : (currentItem.image_url ? `'${currentItem.image_url.replace(/'/g, "''")}'` : 'NULL'))},
        is_active = ${body.isActive !== undefined ? (body.isActive ? 'TRUE' : 'FALSE') : (currentItem.is_active ? 'TRUE' : 'FALSE')},
        updated_at = NOW()
      WHERE id = ${itemId};
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'UPDATE',
      entity: 'ITEM',
      entityId: itemId,
      oldValues: currentItem,
      newValues: body,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Item details updated successfully' });
  } catch (err) {
    next(err);
  }
});

// 9. Bulk Actions (Activate, Deactivate, Delete)
itemsRouter.post('/bulk-action', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { itemIds, action } = req.body;
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No items selected' });
    }

    const idsStr = itemIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)).join(',');
    if (!idsStr) {
      return res.status(400).json({ success: false, message: 'Invalid item IDs' });
    }

    if (action === 'ACTIVATE') {
      await executeRawSql(`UPDATE items SET is_active = TRUE, updated_at = NOW() WHERE id IN (${idsStr})`);
    } else if (action === 'DEACTIVATE') {
      await executeRawSql(`UPDATE items SET is_active = FALSE, updated_at = NOW() WHERE id IN (${idsStr})`);
    } else if (action === 'DELETE') {
      // Soft-delete to preserve foreign key history
      await executeRawSql(`UPDATE items SET is_active = FALSE, updated_at = NOW() WHERE id IN (${idsStr})`);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported bulk action' });
    }

    await logAudit({
      userId: req.user?.id,
      action: `BULK_${action}`,
      entity: 'ITEM',
      entityId: itemIds[0],
      newValues: { itemIds, action },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Bulk ${action.toLowerCase()} applied to ${itemIds.length} items.` });
  } catch (err) {
    next(err);
  }
});

// 10. Bulk Import Items (CSV/JSON)
itemsRouter.post('/import', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { items: importedItems } = req.body;
    if (!importedItems || !Array.isArray(importedItems) || importedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for import' });
    }

    // Load existing categories and units for mapping
    const catRows = await executeRawSql(`SELECT id, code, name FROM item_categories`);
    const unitRows = await executeRawSql(`SELECT id, code, name FROM units`);

    const catMap = new Map<string, number>();
    catRows.rows.forEach(c => {
      catMap.set(c.code.toUpperCase(), c.id);
      catMap.set(c.name.toUpperCase(), c.id);
    });

    const unitMap = new Map<string, number>();
    unitRows.rows.forEach(u => {
      unitMap.set(u.code.toUpperCase(), u.id);
      unitMap.set(u.name.toUpperCase(), u.id);
    });

    let importedCount = 0;
    let updatedCount = 0;

    for (const raw of importedItems) {
      const itemCode = (raw.item_code || raw.itemCode || '').trim();
      const name = (raw.name || '').trim();
      if (!itemCode || !name) continue;

      const categoryName = (raw.category || raw.category_name || '').toString().trim().toUpperCase();
      const unitCode = (raw.unit || raw.unit_code || '').toString().trim().toUpperCase();

      const categoryId = catMap.get(categoryName) || null;
      const unitId = unitMap.get(unitCode) || null;

      const brand = raw.brand ? `'${raw.brand.toString().replace(/'/g, "''")}'` : 'NULL';
      const subcategory = raw.subcategory ? `'${raw.subcategory.toString().replace(/'/g, "''")}'` : 'NULL';
      const barcode = raw.barcode ? `'${raw.barcode.toString().replace(/'/g, "''")}'` : 'NULL';
      const hsnCode = raw.hsn_code || raw.hsnCode ? `'${(raw.hsn_code || raw.hsnCode).toString().replace(/'/g, "''")}'` : 'NULL';
      const sku = raw.sku ? `'${raw.sku.toString().replace(/'/g, "''")}'` : 'NULL';

      const purchasePrice = parseFloat(raw.purchase_price || raw.purchasePrice || 0);
      const sellingPrice = parseFloat(raw.selling_price || raw.sellingPrice || 0);
      const employeePrice = parseFloat(raw.employee_price || raw.employeePrice || 0);
      const minStock = parseFloat(raw.min_stock || raw.minStock || 5);
      const reorderLevel = parseFloat(raw.reorder_level || raw.reorderLevel || 10);
      const taxRate = parseFloat(raw.tax_rate || raw.taxRate || 0);

      const existing = await executeRawSql(`SELECT id FROM items WHERE item_code = '${itemCode.replace(/'/g, "''")}'`);
      if (existing.rows && existing.rows.length > 0) {
        // Update existing item
        await executeRawSql(`
          UPDATE items SET
            name = '${name.replace(/'/g, "''")}',
            category_id = ${categoryId || 'NULL'},
            subcategory = ${subcategory},
            brand = ${brand},
            unit_id = ${unitId || 'NULL'},
            barcode = ${barcode},
            sku = ${sku},
            hsn_code = ${hsnCode},
            purchase_price = ${purchasePrice.toFixed(2)},
            selling_price = ${sellingPrice.toFixed(2)},
            employee_price = ${employeePrice.toFixed(2)},
            min_stock = ${minStock.toFixed(3)},
            reorder_level = ${reorderLevel.toFixed(3)},
            tax_rate = ${taxRate.toFixed(2)},
            updated_at = NOW()
          WHERE item_code = '${itemCode.replace(/'/g, "''")}';
        `);
        updatedCount++;
      } else {
        // Insert new item
        await executeRawSql(`
          INSERT INTO items (
            item_code, name, category_id, subcategory, brand, unit_id, barcode, sku, hsn_code,
            purchase_price, selling_price, employee_price, min_stock, reorder_level, tax_rate, current_stock, is_active
          ) VALUES (
            '${itemCode.replace(/'/g, "''")}',
            '${name.replace(/'/g, "''")}',
            ${categoryId || 'NULL'},
            ${subcategory},
            ${brand},
            ${unitId || 'NULL'},
            ${barcode},
            ${sku},
            ${hsnCode},
            ${purchasePrice.toFixed(2)},
            ${sellingPrice.toFixed(2)},
            ${employeePrice.toFixed(2)},
            ${minStock.toFixed(3)},
            ${reorderLevel.toFixed(3)},
            ${taxRate.toFixed(2)},
            0.000,
            TRUE
          );
        `);
        importedCount++;
      }
    }

    await logAudit({
      userId: req.user?.id,
      action: 'BULK_IMPORT',
      entity: 'ITEM',
      entityId: 0,
      newValues: { importedCount, updatedCount },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Import processed successfully: ${importedCount} created, ${updatedCount} updated.`,
      importedCount,
      updatedCount,
    });
  } catch (err) {
    next(err);
  }
});
