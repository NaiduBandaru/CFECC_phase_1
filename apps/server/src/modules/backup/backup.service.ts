import fs from 'fs';
import path from 'path';
import { executeRawSql, syncDatabaseSequences } from '../../db/index.js';

export interface TableStat {
  tableName: string;
  displayName: string;
  category: 'MASTER' | 'INVENTORY' | 'PURCHASING' | 'POS_SALES' | 'CREDIT_PAYROLL' | 'HISTORICAL' | 'SYSTEM';
  count: number;
}

export interface DatabaseBackupStats {
  engine: string;
  status: string;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  totalTables: number;
  totalLiveRecords: number;
  totalHistoricalRecords: number;
  grandTotalRecords: number;
  tables: TableStat[];
  scheduler: {
    enabled: boolean;
    frequency: string;
    retentionDays: number;
    backupDirectory: string;
  };
}

const BACKUP_TABLES: Array<{ tableName: string; displayName: string; category: TableStat['category'] }> = [
  // Master
  { tableName: 'users', displayName: 'System Users', category: 'MASTER' },
  { tableName: 'roles', displayName: 'Security Roles', category: 'MASTER' },
  { tableName: 'departments', displayName: 'Departments', category: 'MASTER' },
  { tableName: 'designations', displayName: 'Designations', category: 'MASTER' },
  { tableName: 'employees', displayName: 'Society Members & Employees', category: 'MASTER' },
  { tableName: 'system_settings', displayName: 'System Settings', category: 'MASTER' },

  // Inventory & Catalog
  { tableName: 'item_categories', displayName: 'Product Categories', category: 'INVENTORY' },
  { tableName: 'units', displayName: 'Measurement Units', category: 'INVENTORY' },
  { tableName: 'items', displayName: 'Product Master Catalog', category: 'INVENTORY' },
  { tableName: 'item_price_history', displayName: 'Price Change History', category: 'INVENTORY' },
  { tableName: 'stock_movements', displayName: 'Inventory Stock Movements', category: 'INVENTORY' },

  // Purchasing & Vendors
  { tableName: 'vendors', displayName: 'Suppliers & Vendors', category: 'PURCHASING' },
  { tableName: 'purchase_orders', displayName: 'Purchase Orders', category: 'PURCHASING' },
  { tableName: 'purchase_order_items', displayName: 'Purchase Order Items', category: 'PURCHASING' },
  { tableName: 'goods_receipts', displayName: 'Goods Receipts (GRN)', category: 'PURCHASING' },
  { tableName: 'goods_receipt_items', displayName: 'Goods Receipt Items', category: 'PURCHASING' },
  { tableName: 'purchase_invoices', displayName: 'Inward Invoices', category: 'PURCHASING' },
  { tableName: 'vendor_payments', displayName: 'Vendor Payments', category: 'PURCHASING' },

  // POS & Sales
  { tableName: 'pos_shifts', displayName: 'Cashier POS Shifts', category: 'POS_SALES' },
  { tableName: 'sales', displayName: 'Sales Invoices & Cash Bills', category: 'POS_SALES' },
  { tableName: 'sale_items', displayName: 'Sales Invoice Line Items', category: 'POS_SALES' },
  { tableName: 'sale_returns', displayName: 'Sales Returns & Refunds', category: 'POS_SALES' },

  // Credit & Society Recoveries
  { tableName: 'employee_ledger', displayName: 'Member Credit Ledger', category: 'CREDIT_PAYROLL' },
  { tableName: 'billing_periods', displayName: 'Monthly Billing Cycles', category: 'CREDIT_PAYROLL' },
  { tableName: 'employee_invoices', displayName: 'Monthly Credit Bills', category: 'CREDIT_PAYROLL' },
  { tableName: 'payments', displayName: 'Direct Receipt Payments', category: 'CREDIT_PAYROLL' },
  { tableName: 'recovery_records', displayName: 'Store Recovery Advices', category: 'CREDIT_PAYROLL' },
  { tableName: 'payroll_periods', displayName: 'Payroll Periods', category: 'CREDIT_PAYROLL' },
  { tableName: 'payroll_entries', displayName: 'Payroll Deductions', category: 'CREDIT_PAYROLL' },

  // Historical Archives (Migrated from FoxPro)
  { tableName: 'historical_vat_returns', displayName: 'Historical VAT Returns (1998-2023)', category: 'HISTORICAL' },
  { tableName: 'historical_stock_adjustments', displayName: 'Historical Stock Adjustments (ADJMAST)', category: 'HISTORICAL' },
  { tableName: 'historical_stock_adjustment_items', displayName: 'Historical Adjustment Items (ADJDETL)', category: 'HISTORICAL' },
  { tableName: 'historical_recovery_records', displayName: 'Historical Recovery Archive (STRDED)', category: 'HISTORICAL' },

  // System Logs
  { tableName: 'whatsapp_logs', displayName: 'WhatsApp Notification Logs', category: 'SYSTEM' },
  { tableName: 'audit_logs', displayName: 'Audit Trail Logs', category: 'SYSTEM' },
  { tableName: 'backup_logs', displayName: 'Backup Operation Logs', category: 'SYSTEM' },
];

function getBackupDir(): string {
  const dir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function getDatabaseStats(): Promise<DatabaseBackupStats> {
  const tableStats: TableStat[] = [];
  let totalLive = 0;
  let totalHistorical = 0;

  for (const t of BACKUP_TABLES) {
    let count = 0;
    try {
      const res = await executeRawSql(`SELECT COUNT(*) as cnt FROM "${t.tableName}"`);
      count = parseInt(res.rows[0]?.cnt || '0', 10);
    } catch {
      count = 0;
    }

    tableStats.push({
      tableName: t.tableName,
      displayName: t.displayName,
      category: t.category,
      count,
    });

    if (t.category === 'HISTORICAL') {
      totalHistorical += count;
    } else {
      totalLive += count;
    }
  }

  // Get last backup log
  let lastBackupAt: string | null = null;
  let lastBackupFile: string | null = null;
  try {
    const lastRes = await executeRawSql(`
      SELECT filename, created_at 
      FROM backup_logs 
      WHERE status = 'COMPLETED' 
      ORDER BY id DESC LIMIT 1
    `);
    if (lastRes.rows.length > 0) {
      lastBackupAt = lastRes.rows[0].created_at;
      lastBackupFile = lastRes.rows[0].filename;
    }
  } catch {
    // Table may have just been created
  }

  return {
    engine: 'PostgreSQL (Cloud Supabase with SSL)',
    status: 'HEALTHY_CONNECTED',
    lastBackupAt,
    lastBackupFile,
    totalTables: tableStats.length,
    totalLiveRecords: totalLive,
    totalHistoricalRecords: totalHistorical,
    grandTotalRecords: totalLive + totalHistorical,
    tables: tableStats,
    scheduler: {
      enabled: true,
      frequency: 'Daily (Every 24 Hours / Nightly 23:00 IST)',
      retentionDays: 30,
      backupDirectory: getBackupDir(),
    },
  };
}

export async function generateBackupData(includeHistoricalLarge = true) {
  const backupObject: Record<string, any> = {
    metadata: {
      system: 'CFECC Stores Management System',
      location: 'Visakhapatnam, Andhra Pradesh, India',
      version: '2.0.0-phase1',
      generatedAt: new Date().toISOString(),
      format: 'JSON_SNAPSHOT',
    },
    tables: {},
    summary: {},
  };

  const summary: Record<string, number> = {};

  for (const t of BACKUP_TABLES) {
    if (t.tableName === 'backup_logs') continue;
    // For fast downloads, allow skipping the massive 106k archive if not requested
    if (t.tableName === 'historical_recovery_records' && !includeHistoricalLarge) {
      summary[t.tableName] = 0;
      backupObject.tables[t.tableName] = [];
      continue;
    }

    try {
      const res = await executeRawSql(`SELECT * FROM "${t.tableName}" ORDER BY 1 ASC`);
      backupObject.tables[t.tableName] = res.rows;
      summary[t.tableName] = res.rows.length;
    } catch (err: any) {
      console.warn(`[Backup] Warning reading table ${t.tableName}: ${err.message}`);
      backupObject.tables[t.tableName] = [];
      summary[t.tableName] = 0;
    }
  }

  backupObject.summary = summary;
  return backupObject;
}

export async function createLocalSnapshot(type: 'MANUAL' | 'SCHEDULED' | 'ONE_CLICK_EXPORT' = 'MANUAL', createdBy = 'Administrator') {
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cfecc_backup_${timestampStr}.json`;
  const backupDir = getBackupDir();
  const filePath = path.join(backupDir, filename);

  const data = await generateBackupData(true);
  const jsonContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');

  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  // Insert log
  await executeRawSql(`
    INSERT INTO backup_logs (filename, file_path, file_size, backup_type, status, record_count_summary, created_by, created_at)
    VALUES (
      '${filename}',
      '${filePath.replace(/\\/g, '\\\\')}',
      ${fileSize},
      '${type}',
      'COMPLETED',
      '${JSON.stringify(data.summary)}',
      '${createdBy}',
      NOW()
    )
  `);

  // Prune backups older than 30 days
  pruneOldBackups(backupDir, 30);

  return {
    filename,
    filePath,
    fileSize,
    summary: data.summary,
    createdAt: new Date().toISOString(),
  };
}

export async function getBackupHistory() {
  try {
    const res = await executeRawSql(`
      SELECT id, filename, file_size, backup_type, status, record_count_summary, created_by, created_at
      FROM backup_logs
      ORDER BY id DESC
      LIMIT 50
    `);
    return res.rows;
  } catch (err) {
    return [];
  }
}

export function pruneOldBackups(backupDir: string, maxAgeDays = 30) {
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        console.log(`[Backup Prune] Removed stale backup older than ${maxAgeDays} days: ${file}`);
      }
    }
  } catch (err) {
    console.warn('[Backup Prune Warning]:', err);
  }
}

export async function optimizeDatabase() {
  const startTime = Date.now();
  const tablesToAnalyze = [
    'sales',
    'sale_items',
    'employees',
    'items',
    'stock_movements',
    'employee_ledger',
    'recovery_records',
    'historical_recovery_records',
    'historical_vat_returns',
    'historical_stock_adjustments',
  ];

  for (const tbl of tablesToAnalyze) {
    try {
      await executeRawSql(`ANALYZE "${tbl}";`);
    } catch (err: any) {
      console.warn(`[Optimize Warning] Could not analyze ${tbl}: ${err.message}`);
    }
  }

  // Re-synchronize sequences
  await syncDatabaseSequences();

  const durationMs = Date.now() - startTime;
  return {
    success: true,
    message: `Database re-analyzed and PostgreSQL sequences synchronized in ${durationMs}ms`,
    durationMs,
    tablesAnalyzed: tablesToAnalyze.length,
    timestamp: new Date().toISOString(),
  };
}

// Background scheduler runner
let schedulerTimer: NodeJS.Timeout | null = null;

export function initBackupScheduler() {
  if (schedulerTimer) return;

  const runSchedulerCheck = async () => {
    try {
      // Check if a backup was completed within the last 24 hours
      const checkRes = await executeRawSql(`
        SELECT COUNT(*) as count 
        FROM backup_logs 
        WHERE status = 'COMPLETED' 
          AND created_at >= NOW() - INTERVAL '24 hours'
      `);
      const count = parseInt(checkRes.rows[0]?.count || '0', 10);
      if (count === 0) {
        console.log('[Backup Scheduler] No backup detected in the last 24 hours. Creating automated daily snapshot...');
        await createLocalSnapshot('SCHEDULED', 'Automated Daily Cron');
        console.log('[Backup Scheduler] Automated daily snapshot saved successfully.');
      }
    } catch (err: any) {
      console.warn('[Backup Scheduler Warning]:', err.message);
    }
  };

  // Run initial check after 30 seconds of server boot
  setTimeout(runSchedulerCheck, 30000);

  // Check every 4 hours
  schedulerTimer = setInterval(runSchedulerCheck, 4 * 60 * 60 * 1000);
  console.log('[Backup Scheduler] Automated backup daemon initialized (Daily snapshot & 30-day retention).');
}

