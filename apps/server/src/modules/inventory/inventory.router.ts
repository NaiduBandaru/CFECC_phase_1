import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';
import { getLegacyStockAdjustments } from '../../lib/foxproData.js';

export const inventoryRouter = Router();

// 1. Stock Status & Valuation
inventoryRouter.get('/stock', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { categoryId, search = '', lowStockOnly } = req.query;

    let whereClauses = ['i.is_active = TRUE'];

    if (search) {
      const q = (search as string).replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(LOWER(i.name) LIKE '%${q}%' OR LOWER(i.item_code) LIKE '%${q}%')`);
    }

    if (categoryId && categoryId !== 'ALL') {
      whereClauses.push(`i.category_id = ${parseInt(categoryId as string, 10)}`);
    }

    if (lowStockOnly === 'true') {
      whereClauses.push(`i.current_stock <= i.min_stock`);
    }

    const whereSql = whereClauses.join(' AND ');

    const items = await executeRawSql(`
      SELECT 
        i.id, i.item_code, i.name, i.brand, i.barcode, i.current_stock, i.min_stock, i.reorder_level,
        i.purchase_price, i.selling_price, i.employee_price,
        (i.current_stock * i.purchase_price) as stock_valuation,
        c.name as category_name,
        u.code as unit_code
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE ${whereSql}
      ORDER BY (i.current_stock <= i.min_stock) DESC, i.name ASC;
    `);

    return res.json({ success: true, data: items.rows });
  } catch (err) {
    next(err);
  }
});

// 2. Stock Movement History
inventoryRouter.get('/movements', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { itemId, limit = '50' } = req.query;
    let whereClause = '1=1';

    if (itemId) {
      whereClause += ` AND sm.item_id = ${parseInt(itemId as string, 10)}`;
    }

    const movements = await executeRawSql(`
      SELECT 
        sm.*,
        i.name as item_name, i.item_code,
        u.code as unit_code,
        usr.full_name as created_by_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN users usr ON sm.created_by = usr.id
      WHERE ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT ${parseInt(limit as string, 10)};
    `);

    return res.json({ success: true, data: movements.rows });
  } catch (err) {
    next(err);
  }
});

// 3. Manual Stock Adjustment
inventoryRouter.post('/adjust', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const { itemId, adjustmentType, quantity, reason } = req.body;
    // adjustmentType: 'ADJUSTMENT_IN' or 'ADJUSTMENT_OUT'

    const itemRes = await executeRawSql(`SELECT current_stock, purchase_price FROM items WHERE id = ${itemId}`);
    if (!itemRes.rows || itemRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const currentStock = parseFloat(itemRes.rows[0].current_stock);
    const purchasePrice = parseFloat(itemRes.rows[0].purchase_price);
    const qty = parseFloat(quantity);

    let newStock = currentStock;
    if (adjustmentType === 'ADJUSTMENT_IN') {
      newStock += qty;
    } else {
      if (currentStock < qty) {
        return res.status(400).json({ success: false, message: 'Adjustment quantity exceeds current stock.' });
      }
      newStock -= qty;
    }

    await executeRawSql(`
      UPDATE items SET
        current_stock = ${newStock.toFixed(3)},
        updated_at = NOW()
      WHERE id = ${itemId};
    `);

    await executeRawSql(`
      INSERT INTO stock_movements (
        item_id, movement_type, reference_type, quantity, unit_cost, balance_after, notes, created_by
      ) VALUES (
        ${itemId}, '${adjustmentType}', 'MANUAL_ADJUSTMENT',
        ${adjustmentType === 'ADJUSTMENT_IN' ? qty.toFixed(3) : (-qty).toFixed(3)},
        ${purchasePrice.toFixed(2)}, ${newStock.toFixed(3)},
        '${reason.replace(/'/g, "''")}', ${req.user?.id || 'NULL'}
      );
    `);

    await logAudit({
      userId: req.user?.id,
      action: 'STOCK_ADJUSTMENT',
      entity: 'INVENTORY',
      entityId: itemId,
      newValues: { adjustmentType, quantity, newStock, reason },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Stock adjusted successfully', newStock });
  } catch (err) {
    next(err);
  }
});

// 4. Stock Adjustments & Damage Register (Legacy & Live)
inventoryRouter.get('/adjustments', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { limit = '100' } = req.query;
    const limitNum = parseInt(limit as string, 10) || 100;
    const data = await getLegacyStockAdjustments(limitNum);

    // Also fetch live manual adjustments from stock_movements
    const liveMovements = await executeRawSql(`
      SELECT 
        sm.id, sm.created_at as date, sm.quantity, sm.unit_cost, sm.balance_after, sm.notes as reason,
        sm.movement_type,
        i.item_code, i.name as item_name,
        u.code as unit_code,
        usr.full_name as user_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN users usr ON sm.created_by = usr.id
      WHERE sm.reference_type = 'MANUAL_ADJUSTMENT'
      ORDER BY sm.created_at DESC
      LIMIT ${limitNum};
    `);

    return res.json({
      success: true,
      liveAdjustments: liveMovements.rows || [],
      legacyAdjustments: data.adjustments || [],
      totalLegacy: data.total || 0,
    });
  } catch (err) {
    next(err);
  }
});

