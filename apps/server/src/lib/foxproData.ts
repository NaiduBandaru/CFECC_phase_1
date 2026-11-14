import { executeRawSql } from '../db/index.js';

// 1. Historical Recovery Archive (Now 100% Native PostgreSQL from historical_recovery_records)
export async function getHistoricalRecoveryArchive(monthCode?: string, search?: string, page = 1, limit = 50) {
  try {
    // 1. Fetch available months list from PostgreSQL
    const monthsRes = await executeRawSql(`
      SELECT DISTINCT month_code 
      FROM historical_recovery_records 
      WHERE month_code IS NOT NULL AND LENGTH(month_code) = 6;
    `);

    const monthsSet = new Set<string>();
    for (const r of monthsRes.rows) {
      if (r.month_code) monthsSet.add(r.month_code.trim());
    }

    const sortedMonths = Array.from(monthsSet).sort((a, b) => {
      // MMYYYY to YYYYMM for chronological sort
      const keyA = a.slice(2) + a.slice(0, 2);
      const keyB = b.slice(2) + b.slice(0, 2);
      return keyB.localeCompare(keyA);
    });

    const targetMonth = monthCode || (sortedMonths.length > 0 ? sortedMonths[0] : '102026');

    // 2. Build where filter
    let whereClauses = [`month_code = '${targetMonth.replace(/'/g, "''")}'`];
    if (search && search.trim()) {
      const q = search.trim().replace(/'/g, "''").toLowerCase();
      whereClauses.push(`(
        LOWER(employee_code) LIKE '%${q}%' OR 
        LOWER(COALESCE(cs_no, '')) LIKE '%${q}%' OR 
        LOWER(employee_name) LIKE '%${q}%'
      )`);
    }

    const whereSql = whereClauses.join(' AND ');

    // 3. Count & Summary
    const summaryRes = await executeRawSql(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(total_deduction), 0) as total_deductions,
        COALESCE(SUM(bill_amt), 0) as total_bills,
        COALESCE(SUM(domestic + old_domestic), 0) as total_domestic,
        COALESCE(SUM(festival), 0) as total_fest,
        COALESCE(SUM(thrift), 0) as total_thrift
      FROM historical_recovery_records
      WHERE ${whereSql};
    `);

    const summaryRow = summaryRes.rows[0] || {};
    const total = parseInt(summaryRow.total_count || '0', 10);
    const offset = (page - 1) * limit;

    // 4. Paginated records
    const recordsRes = await executeRawSql(`
      SELECT 
        employee_code as eno,
        cs_no as csno,
        employee_name as name,
        category,
        grade,
        share_capital as sharecap,
        cum_thrift as cumthrift,
        credit_limit as eligi,
        bill_amt as billamt,
        domestic,
        old_domestic as olddome,
        festival as fest,
        fest_mmyy as festmmyy,
        misc_ded as miscded,
        unrec,
        add_share as addshare,
        thrift,
        coupon_amt as coupamt,
        rec_pay as recpay,
        total_deduction as deduction,
        month_code as monthcode
      FROM historical_recovery_records
      WHERE ${whereSql}
      ORDER BY total_deduction DESC, employee_code ASC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return {
      success: true,
      months: sortedMonths,
      selectedMonth: targetMonth,
      records: recordsRes.rows.map((r) => ({
        ...r,
        sharecap: parseFloat(r.sharecap || 0),
        cumthrift: parseFloat(r.cumthrift || 0),
        eligi: parseFloat(r.eligi || 0),
        billamt: parseFloat(r.billamt || 0),
        domestic: parseFloat(r.domestic || 0),
        olddome: parseFloat(r.olddome || 0),
        fest: parseFloat(r.fest || 0),
        miscded: parseFloat(r.miscded || 0),
        unrec: parseFloat(r.unrec || 0),
        addshare: parseFloat(r.addshare || 0),
        thrift: parseFloat(r.thrift || 0),
        coupamt: parseFloat(r.coupamt || 0),
        recpay: parseFloat(r.recpay || 0),
        deduction: parseFloat(r.deduction || 0),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalMembers: total,
        totalDeductions: parseFloat(summaryRow.total_deductions || 0),
        totalBills: parseFloat(summaryRow.total_bills || 0),
        totalDomestic: parseFloat(summaryRow.total_domestic || 0),
        totalFest: parseFloat(summaryRow.total_fest || 0),
        totalThrift: parseFloat(summaryRow.total_thrift || 0),
      },
    };
  } catch (err: any) {
    console.error('[Historical Recovery] PostgreSQL error:', err);
    return { success: false, months: [], records: [], total: 0, message: err.message };
  }
}

// 2. GSTR-3B Slab-Wise Summary (Now 100% Native PostgreSQL from historical_vat_returns)
export async function getVatGstSlabSummary(monthCode?: string) {
  try {
    const vatRes = await executeRawSql(`
      SELECT * FROM historical_vat_returns ORDER BY id DESC;
    `);

    if (!vatRes.rows || vatRes.rows.length === 0) {
      return { success: false, months: [], slabs: [], message: 'No historical tax return data found in PostgreSQL' };
    }

    const uniqueMonths = vatRes.rows.map((r) => r.month_code).sort((a, b) => {
      const keyA = a.length === 6 ? a.slice(2) + a.slice(0, 2) : a;
      const keyB = b.length === 6 ? b.slice(2) + b.slice(0, 2) : b;
      return keyB.localeCompare(keyA);
    });

    const selectedMonth = monthCode || (uniqueMonths.length > 0 ? uniqueMonths[0] : '102026');
    const monthRow = vatRes.rows.find((r) => r.month_code === selectedMonth) || vatRes.rows[0] || {};

    const slabs = [
      {
        rate: '0% (Exempt / Nil Rated)',
        taxRate: 0,
        purchaseTaxable: parseFloat(monthRow.pur0 || '0') || 0,
        purchaseTax: 0,
        salesTaxable: parseFloat(monthRow.sales0 || '0') || 0,
        salesTax: 0,
      },
      {
        rate: '3% (Gems / Bullion)',
        taxRate: 3,
        purchaseTaxable: parseFloat(monthRow.pur3 || '0') || 0,
        purchaseTax: (parseFloat(monthRow.pur3 || '0') || 0) * 0.03,
        salesTaxable: parseFloat(monthRow.sales3 || '0') || 0,
        salesTax: (parseFloat(monthRow.sales3 || '0') || 0) * 0.03,
      },
      {
        rate: '5% (Essential Food, Provisions, Grains)',
        taxRate: 5,
        purchaseTaxable: parseFloat(monthRow.pur5 || '0') || 0,
        purchaseTax: (parseFloat(monthRow.pur5 || '0') || 0) * 0.05,
        salesTaxable: parseFloat(monthRow.sales5 || '0') || 0,
        salesTax: (parseFloat(monthRow.sales5 || '0') || 0) * 0.05,
      },
      {
        rate: '12% (Packaged Food & Dairy)',
        taxRate: 12,
        purchaseTaxable: parseFloat(monthRow.pur12 || '0') || 0,
        purchaseTax: (parseFloat(monthRow.pur12 || '0') || 0) * 0.12,
        salesTaxable: parseFloat(monthRow.sales12 || '0') || 0,
        salesTax: (parseFloat(monthRow.sales12 || '0') || 0) * 0.12,
      },
      {
        rate: '18% (Personal Care, Soaps, Detergents, Household)',
        taxRate: 18,
        purchaseTaxable: parseFloat(monthRow.pur18 || '0') || 0,
        purchaseTax: (parseFloat(monthRow.pur18 || '0') || 0) * 0.18,
        salesTaxable: parseFloat(monthRow.sales18 || '0') || 0,
        salesTax: (parseFloat(monthRow.sales18 || '0') || 0) * 0.18,
      },
      {
        rate: '28% (Luxury & Consumer Appliances)',
        taxRate: 28,
        purchaseTaxable: parseFloat(monthRow.pur28 || '0') || 0,
        purchaseTax: (parseFloat(monthRow.pur28 || '0') || 0) * 0.28,
        salesTaxable: parseFloat(monthRow.sales28 || '0') || 0,
        salesTax: (parseFloat(monthRow.sales28 || '0') || 0) * 0.28,
      },
      {
        rate: '40% (Aerated Drinks / Special)',
        taxRate: 40,
        purchaseTaxable: parseFloat(monthRow.pur40 || '0') || 0,
        purchaseTax: (parseFloat(monthRow.pur40 || '0') || 0) * 0.40,
        salesTaxable: parseFloat(monthRow.sales40 || '0') || 0,
        salesTax: (parseFloat(monthRow.sales40 || '0') || 0) * 0.40,
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
  } catch (err: any) {
    console.error('[Historical Tax Returns] PostgreSQL error:', err);
    return { success: false, months: [], slabs: [], message: err.message };
  }
}

// 3. Stock Adjustments & Damage Register (Now 100% Native PostgreSQL from historical_stock_adjustments)
export async function getLegacyStockAdjustments(limit = 100) {
  try {
    const mastRes = await executeRawSql(`
      SELECT 
        bill_number, emp_no, cs_no, item_count, total_amount,
        TO_CHAR(bill_date, 'YYYY-MM-DD') as date
      FROM historical_stock_adjustments
      ORDER BY bill_number DESC
      LIMIT ${limit};
    `);

    if (!mastRes.rows || mastRes.rows.length === 0) {
      return { success: true, adjustments: [], total: 0 };
    }

    const billNumbers = mastRes.rows.map((r) => r.bill_number);
    const itemsRes = await executeRawSql(`
      SELECT 
        bill_number, item_no, item_code, quantity as qty, rate, amount,
        TO_CHAR(item_date, 'YYYY-MM-DD') as date
      FROM historical_stock_adjustment_items
      WHERE bill_number IN (${billNumbers.join(', ')})
      ORDER BY id ASC;
    `);

    const linesByBill: Record<number, any[]> = {};
    for (const itm of itemsRes.rows) {
      if (!linesByBill[itm.bill_number]) linesByBill[itm.bill_number] = [];
      linesByBill[itm.bill_number].push({
        itemNo: itm.item_no,
        itemCode: itm.item_code,
        qty: parseFloat(itm.qty || 0),
        rate: parseFloat(itm.rate || 0),
        date: itm.date,
      });
    }

    const adjustments = mastRes.rows.map((r) => ({
      billNo: r.bill_number,
      empNo: r.emp_no,
      csNo: r.cs_no,
      itemCount: r.item_count,
      totalAmount: parseFloat(r.total_amount || 0),
      date: r.date,
      lines: linesByBill[r.bill_number] || [],
    }));

    const countRes = await executeRawSql(`SELECT COUNT(*) as total FROM historical_stock_adjustments;`);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    return { success: true, adjustments, total };
  } catch (err: any) {
    console.error('[Historical Stock Adjustments] PostgreSQL error:', err);
    return { success: false, adjustments: [], total: 0, message: err.message };
  }
}
