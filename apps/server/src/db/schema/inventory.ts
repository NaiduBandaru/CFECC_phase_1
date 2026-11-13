import { pgTable, text, serial, timestamp, boolean, integer, numeric, date } from 'drizzle-orm/pg-core';

export const itemCategories = pgTable('item_categories', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // GROCERY, STATIONERY, APPAREL, ELECTRONICS, PROVISIONS
  name: text('name').notNull(),
  description: text('description'),
  parentId: integer('parent_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // PCS, KG, G, LTR, ML, PKT, BOX, DOZ
  name: text('name').notNull(),
  precision: integer('precision').default(0).notNull(), // decimal digits (0 for count, 3 for weights like kg)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  itemCode: text('item_code').notNull().unique(), // e.g., 'ITM-001'
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => itemCategories.id),
  subcategory: text('subcategory'),
  brand: text('brand'),
  description: text('description'),
  unitId: integer('unit_id').references(() => units.id),
  sku: text('sku'),
  barcode: text('barcode').unique(),
  hsnCode: text('hsn_code'),

  // Pricing (Decimals for exact monetary calculations)
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }).default('0.00').notNull(), // Standard price
  employeePrice: numeric('employee_price', { precision: 12, scale: 2 }).default('0.00').notNull(), // Subsidized/special employee price

  // Dual-Batch Inventory & Pricing (FoxPro FIFO)
  batch1Qty: numeric('batch1_qty', { precision: 12, scale: 3 }).default('0.000').notNull(),
  batch1Rate: numeric('batch1_rate', { precision: 12, scale: 2 }).default('0.00').notNull(),
  batch1Expiry: date('batch1_expiry'),
  batch2Qty: numeric('batch2_qty', { precision: 12, scale: 3 }).default('0.000').notNull(),
  batch2Rate: numeric('batch2_rate', { precision: 12, scale: 2 }).default('0.00').notNull(),
  batch2Expiry: date('batch2_expiry'),
  purchaseRate1: numeric('purchase_rate1', { precision: 12, scale: 2 }).default('0.00').notNull(),
  purchaseRate2: numeric('purchase_rate2', { precision: 12, scale: 2 }).default('0.00').notNull(),
  cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  igstRate: numeric('igst_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  physicalQty: numeric('physical_qty', { precision: 12, scale: 3 }).default('0.000').notNull(),
  stockValue: numeric('stock_value', { precision: 12, scale: 2 }).default('0.00').notNull(),
  purchaseValuation: numeric('purchase_valuation', { precision: 12, scale: 2 }).default('0.00').notNull(),

  // Stock Thresholds & Levels
  currentStock: numeric('current_stock', { precision: 12, scale: 3 }).default('0.000').notNull(),
  minStock: numeric('min_stock', { precision: 12, scale: 3 }).default('5.000').notNull(),
  reorderLevel: numeric('reorder_level', { precision: 12, scale: 3 }).default('10.000').notNull(),

  // Taxation
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0.00').notNull(), // 0, 5, 12, 18, 28

  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const itemPriceHistory = pgTable('item_price_history', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  oldPurchasePrice: numeric('old_purchase_price', { precision: 12, scale: 2 }).notNull(),
  newPurchasePrice: numeric('new_purchase_price', { precision: 12, scale: 2 }).notNull(),
  oldSellingPrice: numeric('old_selling_price', { precision: 12, scale: 2 }).notNull(),
  newSellingPrice: numeric('new_selling_price', { precision: 12, scale: 2 }).notNull(),
  oldEmployeePrice: numeric('old_employee_price', { precision: 12, scale: 2 }).notNull(),
  newEmployeePrice: numeric('new_employee_price', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason'),
  changedBy: integer('changed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => items.id),
  movementType: text('movement_type').notNull(), // 'PURCHASE_RECEIPT', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'
  referenceType: text('reference_type'), // 'GOODS_RECEIPT', 'SALE', 'SALE_RETURN', 'MANUAL_ADJUSTMENT'
  referenceId: text('reference_id'),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(), // Positive or negative
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 3 }).notNull(),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

