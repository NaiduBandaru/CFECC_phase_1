import fs from 'fs';
import path from 'path';

const FOXPRO_DIR = process.env.FOXPRO_DIR || 'C:\\Users\\naidu\\CFECC Stores data';

interface DbfField {
  name: string;
  type: string;
  len: number;
  dec: number;
  start: number;
}

function getTableFields(filePath: string): { numRecords: number; headerLen: number; recordLen: number; fields: DbfField[] } | null {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const numRecords = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  let off = 32;
  const fields: DbfField[] = [];
  let cursor = 1; // 1 byte delete flag
  while (buf[off] !== 0x0D && off < headerLen) {
    const name = buf.slice(off, off + 11).toString('ascii').replace(/\0/g, '').trim();
    const type = String.fromCharCode(buf[off + 11]);
    const len = buf[off + 16];
    const dec = buf[off + 17];
    fields.push({ name, type, len, dec, start: cursor });
    cursor += len;
    off += 32;
  }
  return { numRecords, headerLen, recordLen, fields };
}

// 1. Historical Recovery Archive (STRDED.DBF)
export function getHistoricalRecoveryArchive(monthCode?: string, search?: string, page = 1, limit = 50) {
  const filePath = path.join(FOXPRO_DIR, 'STRDED.DBF');
  if (!fs.existsSync(filePath)) {
    return { success: false, months: [], records: [], total: 0, message: 'STRDED.DBF not found' };
  }

  const meta = getTableFields(filePath);
  if (!meta) return { success: false, months: [], records: [], total: 0 };

  const buf = fs.readFileSync(filePath);
  const { numRecords, headerLen, recordLen, fields } = meta;

  const monthCodeField = fields.find(f => f.name === 'MONTHCODE');
  const enoField = fields.find(f => f.name === 'ENO');
  const nameField = fields.find(f => f.name === 'NAME');
  const csnoField = fields.find(f => f.name === 'CSNO');

  // Discover all months by sampling last 30,000 records + full scan set
  const monthsSet = new Set<string>();
  const scanStep = numRecords > 20000 ? Math.floor(numRecords / 1000) : 1;
  for (let i = 0; i < numRecords; i += scanStep) {
    if (monthCodeField) {
      const start = headerLen + i * recordLen + monthCodeField.start;
      const m = buf.slice(start, start + monthCodeField.len).toString('latin1').trim();
      if (/^\d{6}$/.test(m)) monthsSet.add(m);
    }
  }

  // Also read last 2,000 records to ensure latest months are 100% captured
  const lastChunkStart = Math.max(0, numRecords - 2000);
  for (let i = lastChunkStart; i < numRecords; i++) {
    if (monthCodeField) {
      const start = headerLen + i * recordLen + monthCodeField.start;
      const m = buf.slice(start, start + monthCodeField.len).toString('latin1').trim();
      if (/^\d{6}$/.test(m)) monthsSet.add(m);
    }
  }

  const sortedMonths = Array.from(monthsSet).sort((a, b) => {
    // MMYYYY to YYYYMM for chronological sort
    const keyA = a.slice(2) + a.slice(0, 2);
    const keyB = b.slice(2) + b.slice(0, 2);
    return keyB.localeCompare(keyA);
  });

  const targetMonth = monthCode || (sortedMonths.length > 0 ? sortedMonths[0] : '102026');
  const q = search ? search.toLowerCase().trim() : '';

  const matchedRecords: any[] = [];
  let totalDeductions = 0;
  let totalBills = 0;
  let totalDomestic = 0;
  let totalFest = 0;
  let totalThrift = 0;

  for (let i = 0; i < numRecords; i++) {
    const rStart = headerLen + i * recordLen;
    // Fast check for month
    if (monthCodeField) {
      const mStart = rStart + monthCodeField.start;
      const m = buf.slice(mStart, mStart + monthCodeField.len).toString('latin1').trim();
      if (m !== targetMonth) continue;
    }

    // Filter search
    if (q) {
      const eno = enoField ? buf.slice(rStart + enoField.start, rStart + enoField.start + enoField.len).toString('latin1').trim().toLowerCase() : '';
      const name = nameField ? buf.slice(rStart + nameField.start, rStart + nameField.start + nameField.len).toString('latin1').trim().toLowerCase() : '';
      const csno = csnoField ? buf.slice(rStart + csnoField.start, rStart + csnoField.start + csnoField.len).toString('latin1').trim().toLowerCase() : '';
      if (!eno.includes(q) && !name.includes(q) && !csno.includes(q)) continue;
    }

    const row: any = {};
    for (const f of fields) {
      row[f.name] = buf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
    }

    const billamt = parseFloat(row.BILLAMT || '0') || 0;
    const domestic = parseFloat(row.DOMESTIC || '0') || 0;
    const olddome = parseFloat(row.OLDDOME || '0') || 0;
    const fest = parseFloat(row.FEST || '0') || 0;
    const miscded = parseFloat(row.MISCDED || '0') || 0;
    const unrec = parseFloat(row.UNREC || '0') || 0;
    const addshare = parseFloat(row.ADDSHARE || '0') || 0;
    const thrift = parseFloat(row.THRIFT || '0') || 0;
    const coupamt = parseFloat(row.COUPAMT || '0') || 0;
    const recpay = parseFloat(row.RECPAY || '0') || 0;

    const netDeduction = billamt + domestic + olddome + fest + miscded + unrec + addshare + thrift - coupamt - recpay;

    totalBills += billamt;
    totalDomestic += (domestic + olddome);
    totalFest += fest;
    totalThrift += thrift;
    totalDeductions += netDeduction;

    matchedRecords.push({
      eno: row.ENO,
      csno: row.CSNO,
      name: row.NAME,
      category: row.CATEGORY === '1' ? 'STAFF' : row.CATEGORY === '0' || row.CATEGORY === '3' ? 'SPECIAL' : 'WORKER',
      grade: row.CATEGORY === '1' ? 'M' : row.CATEGORY === '0' || row.CATEGORY === '3' ? 'Other' : 'NM',
      sharecap: parseFloat(row.SHARECAP || '0') || 0,
      cumthrift: parseFloat(row.CUMTHRIFT || '0') || 0,
      eligi: parseFloat(row.ELIGI || '0') || 0,
      billamt,
      domestic,
      olddome,
      fest,
      festmmyy: row.FESTMMYY || '',
      miscded,
      unrec,
      recpay,
      addshare,
      thrift,
      coupamt,
      deduction: netDeduction,
      monthcode: row.MONTHCODE,
    });
  }

  const total = matchedRecords.length;
  const offset = (page - 1) * limit;
  const paginated = matchedRecords.slice(offset, offset + limit);

  return {
    success: true,
    months: sortedMonths,
    selectedMonth: targetMonth,
    records: paginated,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalMembers: total,
      totalDeductions,
      totalBills,
      totalDomestic,
      totalFest,
      totalThrift,
    },
  };
}

// 2. GSTR-3B Slab-Wise Summary (VAT.DBF)
export function getVatGstSlabSummary(monthCode?: string) {
  const filePath = path.join(FOXPRO_DIR, 'VAT.DBF');
  if (!fs.existsSync(filePath)) {
    return { success: false, months: [], slabs: [], message: 'VAT.DBF not found' };
  }

  const meta = getTableFields(filePath);
  if (!meta) return { success: false, months: [], slabs: [] };

  const buf = fs.readFileSync(filePath);
  const { numRecords, headerLen, recordLen, fields } = meta;

  const records: any[] = [];
  const months: string[] = [];

  for (let i = 0; i < numRecords; i++) {
    const rStart = headerLen + i * recordLen;
    const row: any = {};
    for (const f of fields) {
      row[f.name] = buf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
    }
    if (row.MONTHCODE && row.MONTHCODE.trim()) {
      records.push(row);
      months.push(row.MONTHCODE.trim());
    }
  }

  // Deduplicate and reverse sort months
  const uniqueMonths = Array.from(new Set(months)).sort((a, b) => {
    const keyA = a.length === 6 ? a.slice(2) + a.slice(0, 2) : a;
    const keyB = b.length === 6 ? b.slice(2) + b.slice(0, 2) : b;
    return keyB.localeCompare(keyA);
  });

  const selectedMonth = monthCode || (uniqueMonths.length > 0 ? uniqueMonths[0] : '102026');
  const monthRow = records.find(r => r.MONTHCODE === selectedMonth) || records[records.length - 1] || {};

  // Construct standard GSTR-3B rate slabs
  const slabs = [
    {
      rate: '0% (Exempt / Nil Rated)',
      taxRate: 0,
      purchaseTaxable: parseFloat(monthRow.PUR0 || '0') || 0,
      purchaseTax: 0,
      salesTaxable: parseFloat(monthRow.SALES0 || '0') || 0,
      salesTax: 0,
    },
    {
      rate: '3% (Gems / Bullion)',
      taxRate: 3,
      purchaseTaxable: parseFloat(monthRow.PUR3 || '0') || 0,
      purchaseTax: (parseFloat(monthRow.PUR3 || '0') || 0) * 0.03,
      salesTaxable: parseFloat(monthRow.SALES3 || '0') || 0,
      salesTax: (parseFloat(monthRow.SALES3 || '0') || 0) * 0.03,
    },
    {
      rate: '5% (Essential Food, Provisions, Grains)',
      taxRate: 5,
      purchaseTaxable: parseFloat(monthRow.PUR5 || '0') || 0,
      purchaseTax: (parseFloat(monthRow.PUR5 || '0') || 0) * 0.05,
      salesTaxable: parseFloat(monthRow.SALES5 || '0') || 0,
      salesTax: (parseFloat(monthRow.SALES5 || '0') || 0) * 0.05,
    },
    {
      rate: '12% (Packaged Food & Dairy)',
      taxRate: 12,
      purchaseTaxable: parseFloat(monthRow.PUR12 || monthRow.PUR14 || '0') || 0,
      purchaseTax: (parseFloat(monthRow.PUR12 || monthRow.PUR14 || '0') || 0) * 0.12,
      salesTaxable: parseFloat(monthRow.SALES12 || monthRow.SALES14 || '0') || 0,
      salesTax: (parseFloat(monthRow.SALES12 || monthRow.SALES14 || '0') || 0) * 0.12,
    },
    {
      rate: '18% (Personal Care, Soaps, Detergents, Household)',
      taxRate: 18,
      purchaseTaxable: parseFloat(monthRow.PUR18 || '0') || 0,
      purchaseTax: (parseFloat(monthRow.PUR18 || '0') || 0) * 0.18,
      salesTaxable: parseFloat(monthRow.SALES18 || '0') || 0,
      salesTax: (parseFloat(monthRow.SALES18 || '0') || 0) * 0.18,
    },
    {
      rate: '28% (Luxury & Consumer Appliances)',
      taxRate: 28,
      purchaseTaxable: parseFloat(monthRow.PUR28 || '0') || 0,
      purchaseTax: (parseFloat(monthRow.PUR28 || '0') || 0) * 0.28,
      salesTaxable: parseFloat(monthRow.SALES28 || '0') || 0,
      salesTax: (parseFloat(monthRow.SALES28 || '0') || 0) * 0.28,
    },
    {
      rate: '40% (Aerated Drinks / Special)',
      taxRate: 40,
      purchaseTaxable: parseFloat(monthRow.PUR40 || '0') || 0,
      purchaseTax: (parseFloat(monthRow.PUR40 || '0') || 0) * 0.40,
      salesTaxable: parseFloat(monthRow.SALES40 || '0') || 0,
      salesTax: (parseFloat(monthRow.SALES40 || '0') || 0) * 0.40,
    },
  ];

  const totalPurchaseTaxable = slabs.reduce((sum, s) => sum + s.purchaseTaxable, 0);
  const totalPurchaseTax = slabs.reduce((sum, s) => sum + s.purchaseTax, 0);
  const totalSalesTaxable = slabs.reduce((sum, s) => sum + s.salesTaxable, 0);
  const totalSalesTax = slabs.reduce((sum, s) => sum + s.salesTax, 0);

  return {
    success: true,
    months: uniqueMonths,
    selectedMonth,
    slabs,
    summary: {
      totalPurchaseTaxable,
      totalPurchaseTax,
      totalSalesTaxable,
      totalSalesTax,
      netPayable: Math.max(0, totalSalesTax - totalPurchaseTax),
      netItcCarryForward: Math.max(0, totalPurchaseTax - totalSalesTax),
    },
  };
}

// 3. Stock Adjustments & Damage Register (ADJMAST.DBF & ADJDETL.DBF)
export function getLegacyStockAdjustments(limit = 100) {
  const mastPath = path.join(FOXPRO_DIR, 'ADJMAST.DBF');
  const detlPath = path.join(FOXPRO_DIR, 'ADJDETL.DBF');

  if (!fs.existsSync(mastPath) || !fs.existsSync(detlPath)) {
    return { success: false, adjustments: [], message: 'ADJMAST.DBF not found' };
  }

  const mastMeta = getTableFields(mastPath);
  const detlMeta = getTableFields(detlPath);
  if (!mastMeta || !detlMeta) return { success: false, adjustments: [] };

  const mastBuf = fs.readFileSync(mastPath);
  const detlBuf = fs.readFileSync(detlPath);

  // Group line items by TBILLNO
  const linesByBill: Record<string, any[]> = {};
  for (let i = 0; i < detlMeta.numRecords; i++) {
    const rStart = detlMeta.headerLen + i * detlMeta.recordLen;
    const row: any = {};
    for (const f of detlMeta.fields) {
      row[f.name] = detlBuf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
    }
    const bill = row.TBILLNO;
    if (!linesByBill[bill]) linesByBill[bill] = [];
    linesByBill[bill].push({
      itemNo: row.TITEMNO,
      itemCode: row.TITEM,
      qty: parseFloat(row.TQTY || '0') || 0,
      rate: parseFloat(row.TRATE || '0') || 0,
      date: row.TDATE,
    });
  }

  // Parse master records in reverse chronological order
  const adjustments: any[] = [];
  for (let i = mastMeta.numRecords - 1; i >= 0 && adjustments.length < limit; i--) {
    const rStart = mastMeta.headerLen + i * mastMeta.recordLen;
    const row: any = {};
    for (const f of mastMeta.fields) {
      row[f.name] = mastBuf.slice(rStart + f.start, rStart + f.start + f.len).toString('latin1').trim();
    }

    const billNo = row.BILLNO;
    const rawDate = row.BILLDATE || '';
    const formattedDate = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;

    adjustments.push({
      billNo: parseInt(billNo, 10),
      empNo: row.EMPNO,
      csNo: row.CSNO,
      itemCount: parseInt(row.ITEMS || '0', 10),
      totalAmount: parseFloat(row.BILLAMT || '0') || 0,
      date: formattedDate,
      lines: linesByBill[billNo] || [],
    });
  }

  return { success: true, adjustments, total: mastMeta.numRecords };
}

