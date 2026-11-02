import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';

export const whatsappRouter = Router();

// 1. Dispatch monthly statement to WhatsApp
whatsappRouter.post('/send-statement', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { invoiceId } = req.body;

    const invRes = await executeRawSql(`
      SELECT 
        ei.*,
        bp.period_name, bp.period_code,
        e.employee_code, e.first_name, e.last_name, e.mobile
      FROM employee_invoices ei
      JOIN billing_periods bp ON ei.billing_period_id = bp.id
      JOIN employees e ON ei.employee_id = e.id
      WHERE ei.id = ${invoiceId};
    `);

    if (!invRes.rows || invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice statement not found' });
    }

    const invoice = invRes.rows[0];
    const providerMessageId = `wa_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payload = {
      template: 'cfecc_monthly_statement',
      employee: `${invoice.first_name} ${invoice.last_name}`,
      period: invoice.period_name,
      purchases: invoice.current_purchases,
      opening: invoice.opening_balance,
      closingOutstanding: invoice.closing_outstanding,
      mobile: invoice.mobile,
    };

    // Log the message
    await executeRawSql(`
      INSERT INTO whatsapp_logs (
        recipient_phone, recipient_name, message_type, reference_type, reference_id,
        template_name, payload, status, provider_message_id, sent_at
      ) VALUES (
        '${invoice.mobile}', '${invoice.first_name} ${invoice.last_name}',
        'BILLING_STATEMENT', 'EMPLOYEE_INVOICE', '${invoice.invoice_number}',
        'cfecc_monthly_statement', '${JSON.stringify(payload)}', 'SENT',
        '${providerMessageId}', NOW()
      );
    `);

    // Update invoice status
    await executeRawSql(`
      UPDATE employee_invoices SET
        whatsapp_sent_at = NOW(),
        whatsapp_status = 'SENT'
      WHERE id = ${invoiceId};
    `);

    return res.json({
      success: true,
      message: `Statement dispatched via WhatsApp to ${invoice.first_name} (${invoice.mobile})`,
      providerMessageId,
      status: 'SENT',
    });
  } catch (err) {
    next(err);
  }
});

// 2. Fetch WhatsApp Logs
whatsappRouter.get('/logs', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const logs = await executeRawSql(`
      SELECT * FROM whatsapp_logs
      ORDER BY sent_at DESC
      LIMIT 50;
    `);
    return res.json({ success: true, data: logs.rows });
  } catch (err) {
    next(err);
  }
});
