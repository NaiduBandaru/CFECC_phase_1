import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken } from '../../middleware/auth.js';
import {
  getWhatsAppCredentials,
  updateWhatsAppCredentials,
  sendPosReceipt,
  sendMonthlyStatement,
  sendTestMessage,
} from '../../services/whatsapp.service.js';

export const whatsappRouter = Router();

// ==========================================
// 1. Meta Webhook Endpoints (Public for Meta)
// ==========================================

/**
 * Meta Webhook Verification Handshake
 * Meta sends GET request with hub.mode, hub.verify_token, hub.challenge
 */
whatsappRouter.get('/webhook', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const creds = await getWhatsAppCredentials();

  if (mode === 'subscribe' && token === creds.webhookVerifyToken) {
    console.log('[WhatsApp Webhook] ✅ Verification challenge succeeded.');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] ❌ Verification challenge failed. Tokens mismatch.');
  return res.sendStatus(403);
});

/**
 * Meta Webhook Status Updates & Message Delivery Receipts
 * Meta posts delivery notifications (sent, delivered, read, failed)
 */
whatsappRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (value?.statuses) {
            for (const statusObj of value.statuses) {
              const messageId = statusObj.id;
              const deliveryStatus = (statusObj.status || '').toUpperCase(); // 'DELIVERED', 'READ', 'FAILED', 'SENT'
              const recipientId = statusObj.recipient_id;

              if (messageId && deliveryStatus) {
                await executeRawSql(`
                  UPDATE whatsapp_logs
                  SET status = '${deliveryStatus}',
                      sent_at = NOW()
                  WHERE provider_message_id = '${messageId}';
                `);
                console.log(`[WhatsApp Webhook] Message ${messageId} to ${recipientId} status updated to: ${deliveryStatus}`);
              }
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
  } catch (err: any) {
    console.error('[WhatsApp Webhook Error]:', err);
    return res.status(500).send('Internal Error');
  }
});

// ==========================================
// 2. Gateway Configuration & Diagnostics
// ==========================================

/**
 * Get current WhatsApp Gateway Configuration status
 */
whatsappRouter.get('/config', authenticateToken, async (_req: Request, res: Response, next) => {
  try {
    const creds = await getWhatsAppCredentials();

    return res.json({
      success: true,
      data: {
        isConfigured: creds.isConfigured,
        mode: creds.isConfigured ? 'LIVE_META_CLOUD' : 'SIMULATED_SANDBOX',
        phoneNumberId: creds.phoneNumberId,
        businessAccountId: creds.businessAccountId,
        hasAccessToken: Boolean(creds.accessToken),
        maskedAccessToken: creds.accessToken
          ? `${creds.accessToken.substring(0, 8)}...${creds.accessToken.substring(creds.accessToken.length - 4)}`
          : '',
        apiVersion: creds.apiVersion,
        webhookVerifyToken: creds.webhookVerifyToken,
        webhookUrl: '/api/whatsapp/webhook',
        approvedTemplates: [
          'cfecc_monthly_statement',
          'cfecc_pos_receipt',
          'cfecc_credit_alert',
          'cfecc_api_test',
        ],
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Update Meta WhatsApp Cloud API credentials
 */
whatsappRouter.post('/config', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { phoneNumberId, accessToken, businessAccountId, webhookVerifyToken } = req.body;

    await updateWhatsAppCredentials({
      phoneNumberId,
      accessToken,
      businessAccountId,
      webhookVerifyToken,
    });

    const updated = await getWhatsAppCredentials();

    return res.json({
      success: true,
      message: 'WhatsApp Cloud API settings updated successfully.',
      isConfigured: updated.isConfigured,
      mode: updated.isConfigured ? 'LIVE_META_CLOUD' : 'SIMULATED_SANDBOX',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Send an API test ping to a recipient number to verify Meta Cloud API credentials
 */
whatsappRouter.post('/send-test', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { phoneNumber, customNote } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required.' });
    }

    const result = await sendTestMessage(phoneNumber, customNote);

    return res.json({
      success: result.success,
      message: result.success
        ? `Test message dispatched successfully (Mode: ${result.mode})!`
        : `Failed to dispatch test message: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. Document & Notice Dispatch Endpoints
// ==========================================

/**
 * Dispatch monthly employee statement via WhatsApp
 */
whatsappRouter.post('/send-statement', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required' });
    }

    const invRes = await executeRawSql(`
      SELECT 
        ei.*,
        bp.period_name, bp.period_code,
        e.employee_code, e.first_name, e.last_name, e.mobile
      FROM employee_invoices ei
      JOIN billing_periods bp ON ei.billing_period_id = bp.id
      JOIN employees e ON ei.employee_id = e.id
      WHERE ei.id = ${parseInt(invoiceId, 10)};
    `);

    if (!invRes.rows || invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice statement record not found' });
    }

    const inv = invRes.rows[0];

    if (!inv.mobile) {
      return res.status(400).json({
        success: false,
        message: `Employee ${inv.first_name} ${inv.last_name} has no mobile number registered.`,
      });
    }

    const result = await sendMonthlyStatement({
      phone: inv.mobile,
      employeeName: `${inv.first_name} ${inv.last_name}`,
      employeeCode: inv.employee_code,
      periodName: inv.period_name,
      openingBalance: inv.opening_balance,
      currentPurchases: inv.current_purchases,
      recoveredAmount: inv.recovered_amount || 0,
      closingOutstanding: inv.closing_outstanding,
      invoiceNumber: inv.invoice_number,
      invoiceId: inv.id,
    });

    return res.json({
      success: result.success,
      message: result.success
        ? `Statement dispatched to ${inv.first_name} (${inv.mobile}) [${result.mode}]`
        : `Failed to dispatch: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Bulk dispatch all employee statements for a billing period
 */
whatsappRouter.post('/bulk-dispatch-statements', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { billingPeriodId } = req.body;

    if (!billingPeriodId) {
      return res.status(400).json({ success: false, message: 'Billing Period ID is required' });
    }

    const invRes = await executeRawSql(`
      SELECT 
        ei.*,
        bp.period_name, bp.period_code,
        e.employee_code, e.first_name, e.last_name, e.mobile
      FROM employee_invoices ei
      JOIN billing_periods bp ON ei.billing_period_id = bp.id
      JOIN employees e ON ei.employee_id = e.id
      WHERE ei.billing_period_id = ${parseInt(billingPeriodId, 10)};
    `);

    let dispatchedCount = 0;
    let failedCount = 0;

    for (const inv of invRes.rows) {
      if (!inv.mobile) {
        failedCount++;
        continue;
      }

      const result = await sendMonthlyStatement({
        phone: inv.mobile,
        employeeName: `${inv.first_name} ${inv.last_name}`,
        employeeCode: inv.employee_code,
        periodName: inv.period_name,
        openingBalance: inv.opening_balance,
        currentPurchases: inv.current_purchases,
        recoveredAmount: inv.recovered_amount || 0,
        closingOutstanding: inv.closing_outstanding,
        invoiceNumber: inv.invoice_number,
        invoiceId: inv.id,
      });

      if (result.success) {
        dispatchedCount++;
      } else {
        failedCount++;
      }
    }

    return res.json({
      success: true,
      message: `Dispatched ${dispatchedCount} WhatsApp statements (${failedCount} failed or skipped due to missing phone numbers).`,
      dispatchedCount,
      failedCount,
      totalCount: invRes.rows.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Dispatch POS sale bill memo to customer/employee WhatsApp
 */
whatsappRouter.post('/send-receipt', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    const { saleId, customPhone } = req.body;

    if (!saleId) {
      return res.status(400).json({ success: false, message: 'Sale ID is required' });
    }

    const saleRes = await executeRawSql(`
      SELECT 
        s.*,
        e.first_name, e.last_name, e.mobile AS employee_mobile,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS items_count
      FROM sales s
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE s.id = ${parseInt(saleId, 10)};
    `);

    if (!saleRes.rows || saleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sale record not found' });
    }

    const sale = saleRes.rows[0];
    const targetPhone = customPhone || sale.customer_mobile || sale.employee_mobile;

    if (!targetPhone) {
      return res.status(400).json({
        success: false,
        message: 'No mobile number found for this sale. Please provide a phone number.',
      });
    }

    const customerName = sale.first_name ? `${sale.first_name} ${sale.last_name}` : sale.customer_name || 'Valued Customer';
    const billNumber = sale.invoice_number || sale.bill_number || `BILL-${sale.id}`;
    const totalAmount = sale.total_amount ?? sale.final_amount ?? 0;
    const saleDate = new Date(sale.created_at || sale.sale_date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const result = await sendPosReceipt({
      phone: targetPhone,
      customerName,
      billNumber,
      totalAmount,
      paymentMode: sale.payment_mode || 'CASH',
      itemsCount: parseInt(sale.items_count || '1', 10),
      date: saleDate,
      saleId: sale.id,
    });

    return res.json({
      success: result.success,
      message: result.success
        ? `POS receipt dispatched to ${targetPhone} [${result.mode}]`
        : `Failed to dispatch POS receipt: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetch WhatsApp delivery audit logs
 */
whatsappRouter.get('/logs', authenticateToken, async (_req: Request, res: Response, next) => {
  try {
    const logs = await executeRawSql(`
      SELECT * FROM whatsapp_logs
      ORDER BY sent_at DESC, created_at DESC
      LIMIT 100;
    `);
    return res.json({ success: true, data: logs.rows });
  } catch (err) {
    next(err);
  }
});
