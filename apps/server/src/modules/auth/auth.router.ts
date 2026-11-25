import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { executeRawSql } from '../../db/index.js';
import { config } from '../../config/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';

export const authRouter = Router();

// In-memory brute force protection tracking
interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lock

const checkRateLimit = (key: string): { isLocked: boolean; remainingMinutes: number } => {
  const record = rateLimitMap.get(key);
  if (!record) return { isLocked: false, remainingMinutes: 0 };

  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }

  // Clear window if expired
  if (now - record.firstAttemptAt > WINDOW_DURATION_MS) {
    rateLimitMap.delete(key);
    return { isLocked: false, remainingMinutes: 0 };
  }

  return { isLocked: false, remainingMinutes: 0 };
};

const recordFailedAttempt = (key: string) => {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { attempts: 0, firstAttemptAt: now };

  if (now - record.firstAttemptAt > WINDOW_DURATION_MS) {
    record.attempts = 1;
    record.firstAttemptAt = now;
    delete record.lockedUntil;
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  rateLimitMap.set(key, record);
};

const clearRateLimit = (key: string) => {
  rateLimitMap.delete(key);
};

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const rateLimitKey = `${clientIp}_${username.toLowerCase().trim()}`;

    // 1. Check Rate Limit / Brute Force Lockout
    const { isLocked, remainingMinutes } = checkRateLimit(rateLimitKey);
    if (isLocked) {
      await logAudit({
        action: 'RATE_LIMIT_BLOCKED',
        entity: 'USER',
        newValues: { attemptedUsername: username, clientIp },
        ipAddress: clientIp,
      });
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. For security, access is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
      });
    }

    // 2. Parameterized SQL Query (100% immune to SQL injection)
    const sanitizedUsername = username.trim();
    const result = await executeRawSql(`
      SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role_id, u.is_active, u.employee_id,
             r.code as role_code, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.username) = LOWER($1) 
         OR LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `, [sanitizedUsername]);

    if (!result.rows || result.rows.length === 0) {
      // Dummy bcrypt comparison to prevent timing attacks / username harvesting
      await bcrypt.compare(password, '$2a$10$wT3wY2Kx8N27FkL9B8zPeeC0g0eO7G3G6q7j6H5N1P0M8K9L7J6O');
      recordFailedAttempt(rateLimitKey);
      await logAudit({
        action: 'FAILED_LOGIN_UNKNOWN_USER',
        entity: 'USER',
        newValues: { attemptedUsername: username },
        ipAddress: clientIp,
      });
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // 3. Deactivated Account Check
    if (!user.is_active) {
      await logAudit({
        userId: user.id,
        action: 'DEACTIVATED_LOGIN_ATTEMPT',
        entity: 'USER',
        entityId: user.id,
        ipAddress: clientIp,
      });
      return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact society administration.' });
    }

    // 4. Secure Password Verification
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      await logAudit({
        userId: user.id,
        action: 'FAILED_LOGIN_PASSWORD',
        entity: 'USER',
        entityId: user.id,
        ipAddress: clientIp,
      });
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // 5. Successful Login: Clear Rate Limiting Records
    clearRateLimit(rateLimitKey);

    // Update last login timestamp safely
    await executeRawSql(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

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
      ipAddress: clientIp,
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

