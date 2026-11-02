import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.router.js';
import { dashboardRouter } from './modules/dashboard/dashboard.router.js';
import { employeesRouter } from './modules/employees/employees.router.js';
import { itemsRouter } from './modules/items/items.router.js';
import { vendorsRouter } from './modules/vendors/vendors.router.js';
import { purchasingRouter } from './modules/purchasing/purchasing.router.js';
import { inventoryRouter } from './modules/inventory/inventory.router.js';
import { posRouter } from './modules/pos/pos.router.js';
import { salesRouter } from './modules/sales/sales.router.js';
import { billingRouter } from './modules/billing/billing.router.js';
import { payrollRouter } from './modules/payroll/payroll.router.js';
import { reportsRouter } from './modules/reports/reports.router.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.router.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'UP',
      system: 'CFECC Stores Management System',
      location: 'Visakhapatnam, Andhra Pradesh',
      timestamp: new Date().toISOString(),
    });
  });

  // Domain API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/vendors', vendorsRouter);
  app.use('/api/purchasing', purchasingRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/pos', posRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/whatsapp', whatsappRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

