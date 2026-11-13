import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const serverRequire = createRequire(path.join(rootDir, 'apps/server/package.json'));
const { PGlite } = serverRequire('@electric-sql/pglite');

const FOXPRO_DIR = process.env.FOXPRO_DIR || 'C:\\Users\\naidu\\CFECC Stores data';

function parseDbf(filePath, maxRecords = Infinity) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DBF file not found: ${filePath}`);
  }
  const buf = fs.readFileSync(filePath);
  const numRecords = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);

  const fields = [];
  let offset = 32;
  while (buf[offset] !== 0x0D && offset < headerLen) {
    const name = buf.slice(offset, offset + 11).toString('ascii').replace(/\0/g, '').trim();
    fields.push({ name, len: buf[offset + 16] });
    offset += 32;
  }

  const records = [];
  const limit = Math.min(numRecords, maxRecords);
  let pos = headerLen;
  for (let i = 0; i < limit; i++) {
    const isDeleted = buf[pos] === 0x2A;
    pos += 1;
    const rec = {};
    for (const f of fields) {
      rec[f.name] = buf.slice(pos, pos + f.len).toString('latin1').trim();
      pos += f.len;
    }
    rec._isDeleted = isDeleted;
    rec._index = i + 1;
    records.push(rec);
  }
  return records;
}

async function run() {
  const pglite = new PGlite(path.join(rootDir, '.data', 'pglite'));

  console.log('--- Populating Purchase Orders & GRNs from CFECC Stores data ---');

  // 1. Load Vendor Map & Item Map
  const vendRes = await pglite.query('SELECT id, vendor_code FROM vendors');
  const vendorMap = new Map(vendRes.rows.map(v => [v.vendor_code, v.id]));
  const defaultVendorId = vendRes.rows[0]?.id || 1;

  const itemRes = await pglite.query('SELECT id, item_code FROM items');
  const itemMap = new Map(itemRes.rows.map(i => [i.item_code, i.id]));
  const defaultItemId = itemRes.rows[0]?.id || 1;

  // 2. Load PURMAST
  const purPath = path.join(FOXPRO_DIR, 'PURMAST.DBF');
  const purRecords = parseDbf(purPath);
  const activePurchases = purRecords.filter(r => (r.BILLDATE || '').startsWith('2026') || r._index > purRecords.length - 1000);
  console.log(`Processing ${activePurchases.length} active purchase bills...`);

  // 3. Clear existing PO & GRN tables cleanly
  await pglite.exec(`
    DELETE FROM goods_receipt_items;
    DELETE FROM goods_receipts;
    DELETE FROM purchase_order_items;
    DELETE FROM purchase_orders;
  `);

  const activeBillCodes = new Set(activePurchases.map(p => p.BILLCODE.trim()));

  // 4. Ingest Purchase Orders in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < activePurchases.length; i += BATCH_SIZE) {
    const chunk = activePurchases.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const p of chunk) {
      const billCode = p.BILLCODE.trim() || String(p._index);
      const poNum = `PO-${billCode.padStart(5, '0')}`;
      const vendCode = p.VENDOR.trim();
      const vendorId = vendorMap.get(vendCode) || defaultVendorId;

      let orderDate = '2026-03-15';
      if (p.BILLDATE && p.BILLDATE.length === 8 && /^\d+$/.test(p.BILLDATE)) {
        orderDate = `${p.BILLDATE.slice(0, 4)}-${p.BILLDATE.slice(4, 6)}-${p.BILLDATE.slice(6, 8)}`;
      }

      const subtotal = parseFloat(p.GROSSAMT) || 0;
      const taxAmt = parseFloat(p.TAX) || 0;
      const totalAmt = parseFloat(p.INVAMT) || (subtotal + taxAmt);
      const invNo = p.INVNO.trim() || billCode;

      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, 'COMPLETED', $${idx++}, NOW())`);
      values.push(poNum, vendorId, orderDate, orderDate, subtotal, taxAmt, totalAmt, `Invoice: ${invNo}`);
    }

    await pglite.query(`
      INSERT INTO purchase_orders (
        po_number, vendor_id, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, status, notes, created_at
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (po_number) DO NOTHING;
    `, values);
  }
  console.log('✓ Inserted Purchase Orders.');

  // Load created PO Map (po_number -> id)
  const createdPos = await pglite.query('SELECT id, po_number, vendor_id, order_date FROM purchase_orders');
  const poMap = new Map(createdPos.rows.map(p => [p.po_number, p]));

  // 5. Ingest Goods Receipts (GRN)
  for (let i = 0; i < activePurchases.length; i += BATCH_SIZE) {
    const chunk = activePurchases.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const p of chunk) {
      const billCode = p.BILLCODE.trim() || String(p._index);
      const poNum = `PO-${billCode.padStart(5, '0')}`;
      const grnNum = `GRN-${billCode.padStart(5, '0')}`;
      const po = poMap.get(poNum);
      const vendorId = po?.vendor_id || defaultVendorId;
      const poId = po?.id || null;

      let receiptDate = '2026-03-15';
      if (p.BILLDATE && p.BILLDATE.length === 8 && /^\d+$/.test(p.BILLDATE)) {
        receiptDate = `${p.BILLDATE.slice(0, 4)}-${p.BILLDATE.slice(4, 6)}-${p.BILLDATE.slice(6, 8)}`;
      }
      const invNo = p.INVNO.trim() || billCode;

      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, 'AP 31 TT 9999', 'VERIFIED', $${idx++}, NOW())`);
      values.push(grnNum, poId, vendorId, receiptDate, invNo, `Verified inward receipt for Bill ${invNo}`);
    }

    await pglite.query(`
      INSERT INTO goods_receipts (
        grn_number, po_id, vendor_id, receipt_date, delivery_challan_number, vehicle_number, status, notes, created_at
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (grn_number) DO NOTHING;
    `, values);
  }
  console.log('✓ Inserted Goods Receipts (GRN).');

  // Load GRN Map
  const createdGrns = await pglite.query('SELECT id, grn_number FROM goods_receipts');
  const grnMap = new Map(createdGrns.rows.map(g => [g.grn_number, g.id]));

  // Link GRN IDs to purchase_invoices
  for (const g of createdGrns.rows) {
    const billCodePart = g.grn_number.replace('GRN-', '');
    const sysBillNo = `PINV-${billCodePart}`;
    await pglite.query(`UPDATE purchase_invoices SET grn_id = $1 WHERE system_bill_number = $2`, [g.id, sysBillNo]);
  }
  console.log('✓ Linked GRN IDs to purchase invoices.');

  // 6. Ingest Purchase Order Items & Goods Receipt Items from PURDETL.DBF
  const detlPath = path.join(FOXPRO_DIR, 'PURDETL.DBF');
  if (fs.existsSync(detlPath)) {
    console.log('Parsing PURDETL.DBF details...');
    const detlRecords = parseDbf(detlPath);
    console.log(`Parsed ${detlRecords.length} item lines from PURDETL.DBF.`);
    const activeDetails = detlRecords.filter(d => activeBillCodes.has(d.BILLCODE.trim()));
    console.log(`Filtering to ${activeDetails.length} item lines matching active purchase bills...`);

    const PO_ITEM_BATCH = 200;
    for (let i = 0; i < activeDetails.length; i += PO_ITEM_BATCH) {
      const chunk = activeDetails.slice(i, i + PO_ITEM_BATCH);
      const poItemValues = [];
      const poPlaceholders = [];
      const grnItemValues = [];
      const grnPlaceholders = [];
      let pIdx = 1;
      let gIdx = 1;

      for (const d of chunk) {
        const billCode = d.BILLCODE.trim();
        const poNum = `PO-${billCode.padStart(5, '0')}`;
        const grnNum = `GRN-${billCode.padStart(5, '0')}`;
        const po = poMap.get(poNum);
        const grnId = grnMap.get(grnNum);
        if (!po || !grnId) continue;

        const itemCode = d.ITEMCODE.trim();
        const itemId = itemMap.get(itemCode) || defaultItemId;
        const qty = parseFloat(d.QTY) || 1;
        const purRate = parseFloat(d.PURRATE) || 0;
        const amt = parseFloat(d.AMT) || (qty * purRate);

        poPlaceholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 0, 0, $${pIdx++})`);
        poItemValues.push(po.id, itemId, qty, qty, purRate, amt);

        grnPlaceholders.push(`($${gIdx++}, $${gIdx++}, $${gIdx++}, $${gIdx++}, 0, $${gIdx++})`);
        grnItemValues.push(grnId, itemId, qty, qty, purRate);
      }

      if (poPlaceholders.length > 0) {
        await pglite.query(`
          INSERT INTO purchase_order_items (
            po_id, item_id, ordered_qty, received_qty, unit_price, tax_rate, tax_amount, total_price
          ) VALUES ${poPlaceholders.join(', ')};
        `, poItemValues);
      }

      if (grnPlaceholders.length > 0) {
        await pglite.query(`
          INSERT INTO goods_receipt_items (
            grn_id, item_id, received_qty, accepted_qty, rejected_qty, unit_cost
          ) VALUES ${grnPlaceholders.join(', ')};
        `, grnItemValues);
      }
    }
    console.log('✓ Inserted Purchase Order Items & Goods Receipt Items.');
  }

  // Verification counts
  const poCnt = await pglite.query('SELECT COUNT(*) as count FROM purchase_orders');
  const poItemCnt = await pglite.query('SELECT COUNT(*) as count FROM purchase_order_items');
  const grnCnt = await pglite.query('SELECT COUNT(*) as count FROM goods_receipts');
  const grnItemCnt = await pglite.query('SELECT COUNT(*) as count FROM goods_receipt_items');
  const invCnt = await pglite.query('SELECT COUNT(*) as count FROM purchase_invoices');
  const poSum = await pglite.query('SELECT SUM(total_amount) as total FROM purchase_orders');

  console.log('\n======================================================');
  console.log(` Purchase Orders Created:      ${poCnt.rows[0].count}`);
  console.log(` Purchase Order Line Items:    ${poItemCnt.rows[0].count}`);
  console.log(` Goods Receipts (GRN) Created: ${grnCnt.rows[0].count}`);
  console.log(` GRN Line Items Received:      ${grnItemCnt.rows[0].count}`);
  console.log(` Purchase Invoices Linked:     ${invCnt.rows[0].count}`);
  console.log(` Total Purchase Order Value:   ₹${parseFloat(poSum.rows[0].total).toLocaleString('en-IN')}`);
  console.log('======================================================\n');

  await pglite.close();
}

run().catch(console.error);

