import { Router, Request, Response } from 'express';
import { executeRawSql } from '../../db/index.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import {
  getWhatsAppCredentials,
  updateWhatsAppCredentials,
  sendPosReceipt,
  sendMonthlyStatement,
  sendTestMessage,
  sendEmployeeBalanceAlert,
  sendVendorPurchaseOrder,
  sendVendorPaymentAdvice,
  sendPayrollRecoveryAdvice,
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
whatsappRouter.get('/config', authenticateToken, requireRole('SUPER_ADMIN'), async (_req: Request, res: Response, next) => {
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
whatsappRouter.post('/config', authenticateToken, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next) => {
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
whatsappRouter.post('/send-test', authenticateToken, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next) => {
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
whatsappRouter.post('/send-statement', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
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
whatsappRouter.post('/bulk-dispatch-statements', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
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
whatsappRouter.post('/send-receipt', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_MANAGER', 'CASHIER'), async (req: Request, res: Response, next) => {
  try {
    const { saleId, customPhone } = req.body;

    if (!saleId) {
      return res.status(400).json({ success: false, message: 'Sale ID is required' });
    }

    const saleRes = await executeRawSql(`
      SELECT 
        s.*,
        e.first_name, e.last_name, e.mobile AS employee_mobile,
        e.current_outstanding, e.available_credit,
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

    // Fetch itemized cart lines for this sale
    const itemsRes = await executeRawSql(`
      SELECT 
        si.quantity, si.unit_price, si.discount_amount, si.tax_amount, si.total_price,
        i.name AS item_name, i.item_code
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      WHERE si.sale_id = ${parseInt(saleId, 10)}
      ORDER BY si.id ASC;
    `);

    const itemsList = (itemsRes.rows || []).map((it: any) => ({
      name: it.item_name,
      quantity: parseFloat(it.quantity.toString()),
      unitPrice: it.unit_price,
      totalPrice: it.total_price,
    }));

    const customerName = sale.first_name ? `${sale.first_name} ${sale.last_name}` : sale.customer_name || 'Valued Customer';
    const billNumber = sale.invoice_number || sale.bill_number || `BILL-${sale.id}`;
    const totalAmount = sale.total_amount ?? sale.final_amount ?? 0;
    const saleDate = new Date(sale.created_at || sale.sale_date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const result = await sendPosReceipt({
      phone: targetPhone,
      customerName,
      billNumber,
      totalAmount,
      subtotal: sale.subtotal,
      taxAmount: sale.tax_amount,
      paymentMode: sale.payment_mode || 'CASH',
      itemsCount: parseInt(sale.items_count || '1', 10),
      itemsList,
      currentOutstanding: sale.payment_mode === 'EMPLOYEE_CREDIT' ? sale.current_outstanding : undefined,
      availableCredit: sale.payment_mode === 'EMPLOYEE_CREDIT' ? sale.available_credit : undefined,
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
whatsappRouter.get('/logs', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER'), async (_req: Request, res: Response, next) => {
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

/**
 * 4. Dispatch Live Credit Balance Alert to Employee
 */
whatsappRouter.post('/send-employee-balance', authenticateToken, requireRole('SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'CASHIER'), async (req: Request, res: Response, next) => {
  try {
    const { employeeId, customPhone } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const empRes = await executeRawSql(`
      SELECT id, employee_code, first_name, last_name, mobile, credit_limit, current_outstanding, available_credit
      FROM employees
      WHERE id = ${parseInt(employeeId, 10)};
    `);

    if (!empRes.rows || empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const emp = empRes.rows[0];
    const targetPhone = customPhone || emp.mobile;

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Employee has no registered mobile number' });
    }

    const result = await sendEmployeeBalanceAlert({
      phone: targetPhone,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      employeeCode: emp.employee_code,
      currentOutstanding: emp.current_outstanding,
      creditLimit: emp.credit_limit,
      availableCredit: emp.available_credit,
      employeeId: emp.id,
    });

    return res.json({
      success: result.success,
      message: result.success
        ? `Balance alert dispatched to ${emp.first_name} (${targetPhone}) [${result.mode}]`
        : `Failed to dispatch: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Dispatch Purchase Order notice to Vendor
 */
whatsappRouter.post('/send-vendor-po', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const { poId, customPhone } = req.body;
    if (!poId) {
      return res.status(400).json({ success: false, message: 'PO ID is required' });
    }

    const poRes = await executeRawSql(`
      SELECT 
        po.*,
        v.name as vendor_name,
        v.phone as vendor_phone,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) as items_count
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.id = ${parseInt(poId, 10)};
    `);

    if (!poRes.rows || poRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }

    const po = poRes.rows[0];
    const targetPhone = customPhone || po.vendor_phone;

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Vendor has no registered mobile number' });
    }

    const result = await sendVendorPurchaseOrder({
      phone: targetPhone,
      vendorName: po.vendor_name,
      poNumber: po.po_number,
      totalAmount: po.total_amount,
      itemsCount: parseInt(po.items_count || '1', 10),
      orderDate: po.order_date,
      poId: po.id,
    });

    return res.json({
      success: result.success,
      message: result.success
        ? `PO notice dispatched to ${po.vendor_name} (${targetPhone}) [${result.mode}]`
        : `Failed to dispatch: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. Dispatch Vendor Payment Advice
 */
whatsappRouter.post('/send-vendor-payment', authenticateToken, requireRole('SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { paymentId, customPhone } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Payment ID is required' });
    }

    const payRes = await executeRawSql(`
      SELECT 
        vp.*,
        v.name as vendor_name,
        v.phone as vendor_phone
      FROM vendor_payments vp
      JOIN vendors v ON vp.vendor_id = v.id
      WHERE vp.id = ${parseInt(paymentId, 10)};
    `);

    if (!payRes.rows || payRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const pay = payRes.rows[0];
    const targetPhone = customPhone || pay.vendor_phone;

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Vendor has no registered mobile number' });
    }

    const result = await sendVendorPaymentAdvice({
      phone: targetPhone,
      vendorName: pay.vendor_name,
      paymentNumber: pay.payment_number,
      amount: pay.amount,
      paymentMode: pay.payment_mode,
      referenceNumber: pay.reference_number,
      paymentId: pay.id,
    });

    return res.json({
      success: result.success,
      message: result.success
        ? `Payment advice dispatched to ${pay.vendor_name} (${targetPhone}) [${result.mode}]`
        : `Failed to dispatch: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. Dispatch Salary Store Recovery Advice
 */
whatsappRouter.post('/send-payroll-advice', authenticateToken, requireRole('SUPER_ADMIN', 'HR_PAYROLL', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { payrollEntryId, customPhone } = req.body;
    if (!payrollEntryId) {
      return res.status(400).json({ success: false, message: 'Payroll Entry ID is required' });
    }

    const entryRes = await executeRawSql(`
      SELECT 
        pe.*,
        pp.month_year,
        e.employee_code, e.first_name, e.last_name, e.mobile
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.id = ${parseInt(payrollEntryId, 10)};
    `);

    if (!entryRes.rows || entryRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    const entry = entryRes.rows[0];
    const targetPhone = customPhone || entry.mobile;

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Employee has no registered mobile number' });
    }

    const result = await sendPayrollRecoveryAdvice({
      phone: targetPhone,
      employeeName: `${entry.first_name} ${entry.last_name}`,
      employeeCode: entry.employee_code,
      periodName: entry.month_year,
      deductionAmount: entry.store_recovery_amount,
      netSalary: entry.net_salary,
      entryId: entry.id,
    });

    return res.json({
      success: result.success,
      message: result.success
        ? `Payroll deduction notice dispatched to ${entry.first_name} (${targetPhone}) [${result.mode}]`
        : `Failed to dispatch: ${result.errorMessage}`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 8. Bulk Dispatch Salary Store Recovery Advice for a Payroll Period
 */
whatsappRouter.post('/bulk-payroll-advice', authenticateToken, requireRole('SUPER_ADMIN', 'HR_PAYROLL', 'ACCOUNTS_OFFICER'), async (req: Request, res: Response, next) => {
  try {
    const { payrollPeriodId } = req.body;
    if (!payrollPeriodId) {
      return res.status(400).json({ success: false, message: 'Payroll Period ID is required' });
    }

    const entriesRes = await executeRawSql(`
      SELECT 
        pe.*,
        pp.month_year,
        e.employee_code, e.first_name, e.last_name, e.mobile
      FROM payroll_entries pe
      JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.payroll_period_id = ${parseInt(payrollPeriodId, 10)}
        AND pe.store_recovery_amount > 0;
    `);

    const entries = entriesRes.rows;
    if (entries.length === 0) {
      return res.json({ success: true, message: 'No recovery records to dispatch in this period', count: 0 });
    }

    let successCount = 0;
    let failedCount = 0;

    for (const entry of entries) {
      if (entry.mobile) {
        const res = await sendPayrollRecoveryAdvice({
          phone: entry.mobile,
          employeeName: `${entry.first_name} ${entry.last_name}`,
          employeeCode: entry.employee_code,
          periodName: entry.month_year,
          deductionAmount: entry.store_recovery_amount,
          netSalary: entry.net_salary,
          entryId: entry.id,
        });
        if (res.success) successCount++;
        else failedCount++;
      } else {
        failedCount++;
      }
    }

    return res.json({
      success: true,
      message: `Dispatched ${successCount} WhatsApp payroll notices (${failedCount} skipped or failed)`,
      successCount,
      failedCount,
    });
  } catch (err) {
    next(err);
  }
});
