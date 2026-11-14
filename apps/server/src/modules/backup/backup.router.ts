import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import {
  getDatabaseStats,
  generateBackupData,
  createLocalSnapshot,
  getBackupHistory,
  optimizeDatabase,
} from './backup.service.js';

export const backupRouter = Router();

// Middleware: allow token via query param (useful for direct browser link downloads) or Authorization header
const flexibleAuth = (req: Request, res: Response, next: any) => {
  if (req.query.token && typeof req.query.token === 'string') {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticateToken(req, res, () => {
    return requireRole('SUPER_ADMIN', 'STORE_MANAGER')(req, res, next);
  });
};

// 1. Get database statistics & backup health status
backupRouter.get('/stats', flexibleAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getDatabaseStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch database backup stats',
    });
  }
});

// 2. Get backup history log
backupRouter.get('/history', flexibleAuth, async (_req: Request, res: Response) => {
  try {
    const history = await getBackupHistory();
    res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve backup history',
    });
  }
});

// 3. Create server snapshot
backupRouter.post('/create', flexibleAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const createdBy = user?.username ? `${user.username} (${user.role})` : 'Administrator';
    const snapshot = await createLocalSnapshot('MANUAL', createdBy);
    res.json({
      success: true,
      message: `Database snapshot successfully created: ${snapshot.filename}`,
      data: snapshot,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create database snapshot',
    });
  }
});

// 4. Download instant backup (browser direct file download)
backupRouter.get('/export', flexibleAuth, async (req: Request, res: Response) => {
  try {
    const includeHistorical = req.query.includeHistorical !== 'false';
    const backupData = await generateBackupData(includeHistorical);

    const timestampStr = new Date().toISOString().slice(0, 10);
    const filename = `CFECC_Store_Backup_${timestampStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate backup export',
    });
  }
});

// 5. Download previously saved backup file
backupRouter.get('/download/:filename', flexibleAuth, async (req: Request, res: Response) => {
  try {
    const rawParam = req.params.filename;
    const filename = String(Array.isArray(rawParam) ? rawParam[0] : (rawParam || ''));
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const backupDir = path.join(process.cwd(), 'backups');
    const filePath = path.join(backupDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup archive not found on server disk',
      });
    }

    res.download(filePath, safeFilename);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to download backup file',
    });
  }
});

// 6. Database Health & Optimization (Analyze & Sequence Sync)
backupRouter.post('/optimize', flexibleAuth, async (_req: Request, res: Response) => {
  try {
    const result = await optimizeDatabase();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to optimize database',
    });
  }
});
