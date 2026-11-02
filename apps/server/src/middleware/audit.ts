import { executeRawSql } from '../db/index.js';

export async function logAudit(options: {
  userId?: number;
  action: string;
  entity: string;
  entityId?: string | number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
}) {
  try {
    const oldValJson = options.oldValues ? `'${JSON.stringify(options.oldValues).replace(/'/g, "''")}'` : 'NULL';
    const newValJson = options.newValues ? `'${JSON.stringify(options.newValues).replace(/'/g, "''")}'` : 'NULL';
    const userIdVal = options.userId ? options.userId : 'NULL';
    const entityIdVal = options.entityId ? `'${options.entityId}'` : 'NULL';
    const ipVal = options.ipAddress ? `'${options.ipAddress}'` : 'NULL';

    await executeRawSql(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, old_values, new_values, ip_address)
      VALUES (${userIdVal}, '${options.action}', '${options.entity}', ${entityIdVal}, ${oldValJson}, ${newValJson}, ${ipVal})
    `);
  } catch (err) {
    console.error('[Audit Log Error]:', err);
  }
}
