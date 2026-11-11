import { config } from '../config/index.js';
import { executeRawSql } from '../db/index.js';

export interface WhatsAppCredentials {
  apiUrl: string;
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  isConfigured: boolean;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED';
  mode: 'LIVE' | 'SIMULATED';
  errorMessage?: string;
  details?: any;
}

/**
 * Normalizes Indian and international phone numbers to E.164 without leading '+'
 * e.g., '9848022338' -> '919848022338'
 * '+91 98480 22338' -> '919848022338'
 * '09848022338' -> '919848022338'
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');

  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.substring(1);
  }

  // If 10 digits (Standard Indian Mobile), prefix India country code 91
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
}

/**
 * Retrieves active WhatsApp Cloud API credentials from DB system_settings (if overridden) or .env config
 */
export async function getWhatsAppCredentials(): Promise<WhatsAppCredentials> {
  let phoneNumberId = config.whatsapp.phoneNumberId;
  let accessToken = config.whatsapp.accessToken;
  let businessAccountId = config.whatsapp.businessAccountId;
  let webhookVerifyToken = config.whatsapp.webhookVerifyToken;
  let apiVersion = config.whatsapp.apiVersion;
  let apiUrl = config.whatsapp.apiUrl;

  try {
    const dbSettings = await executeRawSql(`
      SELECT key, value FROM system_settings
      WHERE key IN (
        'whatsapp_phone_number_id',
        'whatsapp_access_token',
        'whatsapp_business_account_id',
        'whatsapp_webhook_verify_token',
        'whatsapp_api_version'
      );
    `);

    if (dbSettings.rows && dbSettings.rows.length > 0) {
      for (const row of dbSettings.rows) {
        if (row.key === 'whatsapp_phone_number_id' && row.value?.trim()) {
          phoneNumberId = row.value.trim();
        }
        if (row.key === 'whatsapp_access_token' && row.value?.trim()) {
          accessToken = row.value.trim();
        }
        if (row.key === 'whatsapp_business_account_id' && row.value?.trim()) {
          businessAccountId = row.value.trim();
        }
        if (row.key === 'whatsapp_webhook_verify_token' && row.value?.trim()) {
          webhookVerifyToken = row.value.trim();
        }
        if (row.key === 'whatsapp_api_version' && row.value?.trim()) {
          apiVersion = row.value.trim();
        }
      }
    }
  } catch (err) {
    // If DB is not available yet, default to config
  }

  const isConfigured = Boolean(phoneNumberId && accessToken);

  return {
    apiUrl: `${apiUrl}/${apiVersion}`,
    apiVersion,
    phoneNumberId,
    accessToken,
    businessAccountId,
    webhookVerifyToken,
    isConfigured,
  };
}

/**
 * Save / Update WhatsApp credentials in the database
 */
export async function updateWhatsAppCredentials(params: {
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
}): Promise<void> {
  const settingsToUpsert: { key: string; value: string; desc: string }[] = [];

  if (params.phoneNumberId !== undefined) {
    settingsToUpsert.push({
      key: 'whatsapp_phone_number_id',
      value: params.phoneNumberId.trim(),
      desc: 'Meta WhatsApp Cloud API Phone Number ID',
    });
  }

  if (params.accessToken !== undefined && params.accessToken.trim() !== '') {
    settingsToUpsert.push({
      key: 'whatsapp_access_token',
      value: params.accessToken.trim(),
      desc: 'Meta WhatsApp Cloud API Access Token',
    });
  }

  if (params.businessAccountId !== undefined) {
    settingsToUpsert.push({
      key: 'whatsapp_business_account_id',
      value: params.businessAccountId.trim(),
      desc: 'Meta WhatsApp Business Account ID (WABA ID)',
    });
  }

  if (params.webhookVerifyToken !== undefined) {
    settingsToUpsert.push({
      key: 'whatsapp_webhook_verify_token',
      value: params.webhookVerifyToken.trim(),
      desc: 'Meta WhatsApp Webhook Verification Secret Token',
    });
  }

  for (const s of settingsToUpsert) {
    await executeRawSql(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES ('${s.key}', '${s.value.replace(/'/g, "''")}', '${s.desc}', NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW();
    `);
  }
}

/**
 * Sends a raw message payload to the Meta WhatsApp Cloud API endpoint
 */
export async function sendMetaCloudMessage(recipientPhone: string, messagePayload: any): Promise<SendResult> {
  const cleanPhone = normalizePhoneNumber(recipientPhone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      status: 'FAILED',
      mode: 'SIMULATED',
      errorMessage: `Invalid mobile number: "${recipientPhone}". Phone must have at least 10 digits.`,
    };
  }

  const creds = await getWhatsAppCredentials();

  // If credentials are not set, run in Simulated Sandbox Mode and log to audit table
  if (!creds.isConfigured) {
    const simulatedId = `wa_sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return {
      success: true,
      messageId: simulatedId,
      status: 'SIMULATED',
      mode: 'SIMULATED',
      details: {
        note: 'WhatsApp API credentials not yet entered in Settings. Running in simulated test mode.',
        recipientPhone: cleanPhone,
        payload: messagePayload,
      },
    };
  }

  // Official Meta Cloud API Request
  const endpoint = `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/messages`;

  const requestBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    ...messagePayload,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = (await response.json()) as any;

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || `Meta API Error (HTTP ${response.status})`;
      const errorDetails = responseData?.error?.error_data?.details || responseData?.error?.type;
      return {
        success: false,
        status: 'FAILED',
        mode: 'LIVE',
        errorMessage: `${errorMsg}${errorDetails ? ` (${errorDetails})` : ''}`,
        details: responseData,
      };
    }

    const messageId = responseData?.messages?.[0]?.id || `wa_meta_${Date.now()}`;

    return {
      success: true,
      messageId,
      status: 'SENT',
      mode: 'LIVE',
      details: responseData,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'FAILED',
      mode: 'LIVE',
      errorMessage: err.message || 'Network exception while connecting to Meta Cloud API',
    };
  }
}

/**
 * 1. Dispatches an Itemized POS Sale Receipt to Customer / Employee
 */
export async function sendPosReceipt(params: {
  phone: string;
  customerName: string;
  billNumber: string;
  totalAmount: number | string;
  subtotal?: number | string;
  taxAmount?: number | string;
  paymentMode: string;
  itemsCount?: number;
  itemsList?: Array<{ name: string; quantity: number | string; unitPrice: number | string; totalPrice: number | string }>;
  currentOutstanding?: number | string;
  availableCredit?: number | string;
  date?: string;
  saleId?: number;
}): Promise<SendResult> {
  const dateStr = params.date || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const formattedAmount = parseFloat((params.totalAmount ?? 0).toString()).toFixed(2);
  const subtotalFormatted = parseFloat((params.subtotal ?? params.totalAmount ?? 0).toString()).toFixed(2);
  const taxFormatted = parseFloat((params.taxAmount ?? 0).toString()).toFixed(2);
  const billNum = params.billNumber || 'RECEIPT';
  const custName = params.customerName || 'Valued Customer';
  const count = params.itemsList?.length || params.itemsCount || 1;

  let itemsFormatted = '';
  if (params.itemsList && params.itemsList.length > 0) {
    itemsFormatted = params.itemsList
      .map((it, idx) => `${idx + 1}. *${it.name}* (x${it.quantity}) - ₹${parseFloat((it.totalPrice ?? 0).toString()).toFixed(2)}`)
      .join('\n');
  }

  // 1. Prepare Rich CFECC Store Receipt Text
  const balanceNote = params.currentOutstanding !== undefined
    ? ` Current Outstanding: Rs. ${parseFloat((params.currentOutstanding ?? 0).toString()).toFixed(2)}.`
    : '';

  const richReceiptText =
`Dear ${custName}, thank you for shopping at CFECC Stores! Your Bill #${billNum} for Rs. ${formattedAmount} (${count} items) has been recorded to your Store Credit Account.${balanceNote}

🧾 *CFECC STORES & EMPLOYEE COOPERATIVE*
📍 Visakhapatnam, Andhra Pradesh
GSTIN: 37AAAAA0000A1Z5
━━━━━━━━━━━━━━━━━━━━━
*TAX INVOICE / CASH MEMO*
━━━━━━━━━━━━━━━━━━━━━
*Bill No:* ${billNum}
*Date:* ${dateStr}
*Customer:* ${custName}
*Payment Method:* ${params.paymentMode}
━━━━━━━━━━━━━━━━━━━━━
*ITEMS PURCHASED (${count}):*
${itemsFormatted || `• Store Merchandise Items (x${count}) - ₹${formattedAmount}`}
━━━━━━━━━━━━━━━━━━━━━
*Subtotal:* ₹${subtotalFormatted}
*GST (Tax):* ₹${taxFormatted}
*GRAND TOTAL:* ₹${formattedAmount}
━━━━━━━━━━━━━━━━━━━━━${params.currentOutstanding !== undefined ? `
💳 *Store Credit Status:*
• Outstanding Balance: ₹${parseFloat((params.currentOutstanding ?? 0).toString()).toFixed(2)}
• Available Credit Limit: ₹${parseFloat((params.availableCredit ?? 0).toString()).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━` : ''}
Thank you for shopping at CFECC Stores!
_Visakhapatnam • CFECC Stores Management Platform_`;

  // Strategy 1: Send the approved Meta Template FIRST (guaranteed delivery outside 24-hr window)
  const templateOrderRef = `${billNum} (Rs ${formattedAmount} | ${params.paymentMode})`;
  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: custName },
            { type: 'text', text: templateOrderRef },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(params.phone, templatePayload);

  // Strategy 2: If template failed, try sending as direct text
  if (!result.success && result.mode === 'LIVE') {
    const textPayload = {
      type: 'text',
      text: { preview_url: false, body: richReceiptText },
    };
    const textResult = await sendMetaCloudMessage(params.phone, textPayload);
    if (textResult.success) {
      result = textResult;
    }
  } else if (result.success && result.mode === 'LIVE') {
    // If template was delivered, also send the full itemized text receipt
    const textPayload = {
      type: 'text',
      text: { preview_url: false, body: richReceiptText },
    };
    sendMetaCloudMessage(params.phone, textPayload).catch(() => {});
  }

  // Record in whatsapp_logs
  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${custName.replace(/'/g, "''")}',
      'POS_RECEIPT', 'SALE', '${billNum}',
      'cfecc_receipt', '${JSON.stringify({ billNumber: billNum, total: formattedAmount }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}

/**
 * 2. Dispatches Monthly Employee Salary Recovery Statement
 */
export async function sendMonthlyStatement(params: {
  phone: string;
  employeeName: string;
  employeeCode: string;
  periodName: string;
  openingBalance: number | string;
  currentPurchases: number | string;
  recoveredAmount: number | string;
  closingOutstanding: number | string;
  invoiceNumber: string;
  invoiceId?: number;
}): Promise<SendResult> {
  const opening = parseFloat((params.openingBalance ?? 0).toString()).toFixed(2);
  const purchases = parseFloat((params.currentPurchases ?? 0).toString()).toFixed(2);
  const recovered = parseFloat((params.recoveredAmount ?? 0).toString()).toFixed(2);
  const closing = parseFloat((params.closingOutstanding ?? 0).toString()).toFixed(2);

  const textBody =
`🏛️ *CFECC STORES - MONTHLY RECOVERY STATEMENT*
━━━━━━━━━━━━━━━━━━━━
*Period:* ${params.periodName}
*Employee:* ${params.employeeName} (${params.employeeCode})
*Statement Ref:* ${params.invoiceNumber}
━━━━━━━━━━━━━━━━━━━━
• *Opening Balance:* ₹${opening}
• *Current Purchases:* ₹${purchases}
• *Payroll Deduction / Recovered:* ₹${recovered}
━━━━━━━━━━━━━━━━━━━━
*CLOSING OUTSTANDING BALANCE:* ₹${closing}
━━━━━━━━━━━━━━━━━━━━
This statement will be reflected in your monthly salary recovery.
_CFECC Stores Management System - Visakhapatnam_`;

  // Strategy 1: Send approved Meta Template first for guaranteed 24/7 delivery
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const templateOrderRef = `Stmt: ${params.periodName} (Deduction: Rs ${closing})`;
  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.employeeName },
            { type: 'text', text: templateOrderRef },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(params.phone, templatePayload);

  // Strategy 2: If template delivered or fallback to rich text
  const textPayload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  if (!result.success && result.mode === 'LIVE') {
    const textResult = await sendMetaCloudMessage(params.phone, textPayload);
    if (textResult.success) result = textResult;
  } else if (result.success && result.mode === 'LIVE') {
    sendMetaCloudMessage(params.phone, textPayload).catch(() => {});
  }

  // Record in whatsapp_logs
  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${params.employeeName.replace(/'/g, "''")}',
      'BILLING_STATEMENT', 'EMPLOYEE_INVOICE', '${params.invoiceNumber}',
      'cfecc_monthly_statement', '${JSON.stringify({ invoiceNumber: params.invoiceNumber, closing }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  if (params.invoiceId && result.success) {
    await executeRawSql(`
      UPDATE employee_invoices SET
        whatsapp_sent_at = NOW(),
        whatsapp_status = '${result.status}'
      WHERE id = ${params.invoiceId};
    `);
  }

  return result;
}

/**
 * 3. Dispatches a Test Message to verify Meta API connection
 */
export async function sendTestMessage(targetPhone: string, testNote?: string): Promise<SendResult> {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // 1. Try sending the Meta verified order confirmation template first
  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'CFECC Administrator' },
            { type: 'text', text: testNote || 'TEST-PING-001' },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(targetPhone, templatePayload);

  // 2. If that template failed, try hello_world template
  if (!result.success && result.mode === 'LIVE') {
    const helloPayload = {
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' },
      },
    };
    const helloResult = await sendMetaCloudMessage(targetPhone, helloPayload);
    if (helloResult.success) {
      result = helloResult;
    }
  }

  // 3. If templates failed, fallback to text
  if (!result.success && result.mode === 'LIVE') {
    const textBody =
`🚀 *CFECC STORES - WHATSAPP API TEST PING*
━━━━━━━━━━━━━━━━━━━━
*System:* CFECC Stores Management Platform
*Timestamp:* ${new Date().toLocaleString('en-IN')}
*Gateway:* Meta WhatsApp Cloud API (Official)
*Status:* ✅ Connected & Operating
━━━━━━━━━━━━━━━━━━━━
${testNote || 'Your Meta WhatsApp Cloud API connection has been successfully verified!'}
_Visakhapatnam, Andhra Pradesh_`;

    const textPayload = {
      type: 'text',
      text: { preview_url: false, body: textBody },
    };

    const textResult = await sendMetaCloudMessage(targetPhone, textPayload);
    if (textResult.success) {
      result = textResult;
    }
  }

  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${targetPhone}', 'System Administrator',
      'API_TEST', 'SYSTEM_DIAGNOSTIC', 'PING_${Date.now()}',
      'jaspers_market_order_confirmation_v1', '${JSON.stringify({ testNote: testNote || 'Test ping' }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}

/**
 * 4. Dispatches Employee Live Store Credit Balance Alert
 */
export async function sendEmployeeBalanceAlert(params: {
  phone: string;
  employeeName: string;
  employeeCode: string;
  currentOutstanding: number | string;
  creditLimit: number | string;
  availableCredit: number | string;
  employeeId: number;
}): Promise<SendResult> {
  const outstanding = parseFloat((params.currentOutstanding ?? 0).toString()).toFixed(2);
  const limit = parseFloat((params.creditLimit ?? 0).toString()).toFixed(2);
  const available = parseFloat((params.availableCredit ?? 0).toString()).toFixed(2);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const textBody =
`💳 *CFECC STORES - MEMBER CREDIT BALANCE*
━━━━━━━━━━━━━━━━━━━━
*Member:* ${params.employeeName} (${params.employeeCode})
*As on:* ${dateStr}
━━━━━━━━━━━━━━━━━━━━
• *Assigned Credit Limit:* ₹${limit}
• *Current Outstanding Balance:* ₹${outstanding}
• *Available Credit for Purchases:* ₹${available}
━━━━━━━━━━━━━━━━━━━━
_CFECC Employees Consumer Cooperative Society Ltd._`;

  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.employeeName },
            { type: 'text', text: `Credit Balance: Rs ${outstanding} (Available: Rs ${available})` },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(params.phone, templatePayload);

  const textPayload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  if (!result.success && result.mode === 'LIVE') {
    const textResult = await sendMetaCloudMessage(params.phone, textPayload);
    if (textResult.success) result = textResult;
  } else if (result.success && result.mode === 'LIVE') {
    sendMetaCloudMessage(params.phone, textPayload).catch(() => {});
  }

  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${params.employeeName.replace(/'/g, "''")}',
      'BALANCE_ALERT', 'EMPLOYEE', '${params.employeeCode}',
      'jaspers_market_order_confirmation_v1', '${JSON.stringify({ outstanding, available }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}

/**
 * 5. Dispatches Purchase Order Notice to Supplier / Vendor
 */
export async function sendVendorPurchaseOrder(params: {
  phone: string;
  vendorName: string;
  poNumber: string;
  totalAmount: number | string;
  itemsCount: number;
  orderDate: string;
  poId: number;
}): Promise<SendResult> {
  const formattedAmount = parseFloat((params.totalAmount ?? 0).toString()).toFixed(2);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const textBody =
`📦 *CFECC STORES - PURCHASE ORDER DISPATCH*
━━━━━━━━━━━━━━━━━━━━
*Supplier:* ${params.vendorName}
*PO Number:* ${params.poNumber}
*Order Date:* ${params.orderDate}
*Total Items:* ${params.itemsCount} line items
*Total PO Value:* ₹${formattedAmount}
━━━━━━━━━━━━━━━━━━━━
Please arrange dispatch according to the agreed terms.
_CFECC Purchasing Division - Visakhapatnam_`;

  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.vendorName },
            { type: 'text', text: `Purchase Order: ${params.poNumber} (Rs ${formattedAmount})` },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(params.phone, templatePayload);

  const textPayload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  if (!result.success && result.mode === 'LIVE') {
    const textResult = await sendMetaCloudMessage(params.phone, textPayload);
    if (textResult.success) result = textResult;
  } else if (result.success && result.mode === 'LIVE') {
    sendMetaCloudMessage(params.phone, textPayload).catch(() => {});
  }

  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${params.vendorName.replace(/'/g, "''")}',
      'VENDOR_PO', 'PURCHASE_ORDER', '${params.poNumber}',
      'jaspers_market_order_confirmation_v1', '${JSON.stringify({ poNumber: params.poNumber, total: formattedAmount }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}

/**
 * 6. Dispatches Vendor Payment Advice
 */
export async function sendVendorPaymentAdvice(params: {
  phone: string;
  vendorName: string;
  paymentNumber: string;
  amount: number | string;
  paymentMode: string;
  referenceNumber?: string;
  paymentId: number;
}): Promise<SendResult> {
  const formattedAmount = parseFloat((params.amount ?? 0).toString()).toFixed(2);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const textBody =
`💰 *CFECC STORES - VENDOR PAYMENT ADVICE*
━━━━━━━━━━━━━━━━━━━━
*Payee:* ${params.vendorName}
*Voucher No:* ${params.paymentNumber}
*Amount Paid:* ₹${formattedAmount}
*Payment Channel:* ${params.paymentMode}
${params.referenceNumber ? `*Ref / UTR:* ${params.referenceNumber}` : ''}
━━━━━━━━━━━━━━━━━━━━
Payment has been credited towards your outstanding invoices.
_CFECC Accounts Department - Visakhapatnam_`;

  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.vendorName },
            { type: 'text', text: `Payment Advice: ${params.paymentNumber} (Rs ${formattedAmount})` },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(params.phone, templatePayload);

  const textPayload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  if (!result.success && result.mode === 'LIVE') {
    const textResult = await sendMetaCloudMessage(params.phone, textPayload);
    if (textResult.success) result = textResult;
  } else if (result.success && result.mode === 'LIVE') {
    sendMetaCloudMessage(params.phone, textPayload).catch(() => {});
  }

  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${params.vendorName.replace(/'/g, "''")}',
      'VENDOR_PAYMENT', 'VENDOR_PAYMENT', '${params.paymentNumber}',
      'jaspers_market_order_confirmation_v1', '${JSON.stringify({ voucher: params.paymentNumber, amount: formattedAmount }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}

/**
 * 7. Dispatches Payroll Salary Recovery Notification
 */
export async function sendPayrollRecoveryAdvice(params: {
  phone: string;
  employeeName: string;
  employeeCode: string;
  periodName: string;
  deductionAmount: number | string;
  netSalary: number | string;
  entryId: number;
}): Promise<SendResult> {
  const deduction = parseFloat((params.deductionAmount ?? 0).toString()).toFixed(2);
  const net = parseFloat((params.netSalary ?? 0).toString()).toFixed(2);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const textBody =
`📄 *CFECC STORES - PAYROLL STORE DEDUCTION ADVICE*
━━━━━━━━━━━━━━━━━━━━
*Employee:* ${params.employeeName} (${params.employeeCode})
*Month:* ${params.periodName}
━━━━━━━━━━━━━━━━━━━━
• *Store Credit Recovery Deducted:* ₹${deduction}
• *Net Disbursed Salary:* ₹${net}
━━━━━━━━━━━━━━━━━━━━
This recovery clears your cooperative credit balance for this cycle.
_CFECC Payroll & Stores Division_`;

  const templatePayload = {
    type: 'template',
    template: {
      name: 'jaspers_market_order_confirmation_v1',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.employeeName },
            { type: 'text', text: `Store Recovery: Rs ${deduction} for ${params.periodName}` },
            { type: 'text', text: dateStr },
          ],
        },
      ],
    },
  };

  let result = await sendMetaCloudMessage(params.phone, templatePayload);

  const textPayload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  if (!result.success && result.mode === 'LIVE') {
    const textResult = await sendMetaCloudMessage(params.phone, textPayload);
    if (textResult.success) result = textResult;
  } else if (result.success && result.mode === 'LIVE') {
    sendMetaCloudMessage(params.phone, textPayload).catch(() => {});
  }

  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${params.employeeName.replace(/'/g, "''")}',
      'PAYROLL_RECOVERY', 'PAYROLL_ENTRY', '${params.entryId}',
      'jaspers_market_order_confirmation_v1', '${JSON.stringify({ deduction, net }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}
