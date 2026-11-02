import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { config } from '../../config/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const result = await executeRawSql(`
      SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role_id, u.is_active, u.employee_id,
             r.code as role_code, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.username) = LOWER('${username.replace(/'/g, "''")}') 
         OR LOWER(u.email) = LOWER('${username.replace(/'/g, "''")}')
      LIMIT 1;
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Update last login
    await executeRawSql(`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`);

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      roleId: user.role_id,
      roleCode: user.role_code,
      roleName: user.role_name,
      employeeId: user.employee_id,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '24h' });

    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: tokenPayload,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const result = await executeRawSql(`
      SELECT u.id, u.username, u.email, u.full_name, u.role_id, u.is_active, u.employee_id, u.last_login_at,
             r.code as role_code, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ${userId}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

