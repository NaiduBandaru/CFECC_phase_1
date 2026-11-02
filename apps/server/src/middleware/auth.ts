import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { executeRawSql } from '../db/index.js';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  employeeId?: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.roleCode === 'SUPER_ADMIN') {
      return next(); // Super admin has universal access
    }
    if (!allowedRoles.includes(req.user.roleCode)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role ${req.user.roleCode} does not have required permissions.`,
      });
    }
    next();
  };
}

export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.roleCode === 'SUPER_ADMIN') {
      return next();
    }

    try {
      const result = await executeRawSql(`
        SELECT p.code FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = ${req.user.roleId} AND p.code = '${permissionCode}'
      `);

      if (result.rows && result.rows.length > 0) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Forbidden. Permission '${permissionCode}' is required.`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Permission check error' });
    }
  };
}
