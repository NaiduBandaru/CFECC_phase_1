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
  paymentMode: string;
  itemsCount: number;
  date?: string;
  saleId?: number;
}): Promise<SendResult> {
  const dateStr = params.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedAmount = parseFloat(params.totalAmount.toString()).toFixed(2);

  // Template Body fallback or interactive text message
  const textBody =
`🧾 *CFECC STORES - SALE MEMO*
━━━━━━━━━━━━━━━━━━━━
*Bill No:* ${params.billNumber}
*Date:* ${dateStr}
*Customer:* ${params.customerName}
*Items Purchased:* ${params.itemsCount}
*Payment Method:* ${params.paymentMode}
━━━━━━━━━━━━━━━━━━━━
*TOTAL AMOUNT:* ₹${formattedAmount}
━━━━━━━━━━━━━━━━━━━━
Thank you for visiting CFECC Stores, Visakhapatnam!
_For balance queries, visit the CFECC Stores counter._`;

  const payload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  const result = await sendMetaCloudMessage(params.phone, payload);

  // Record in whatsapp_logs
  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${params.phone}', '${params.customerName.replace(/'/g, "''")}',
      'POS_RECEIPT', 'SALE', '${params.billNumber}',
      'cfecc_pos_receipt', '${JSON.stringify({ billNumber: params.billNumber, total: formattedAmount }).replace(/'/g, "''")}',
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
  const opening = parseFloat(params.openingBalance.toString()).toFixed(2);
  const purchases = parseFloat(params.currentPurchases.toString()).toFixed(2);
  const recovered = parseFloat(params.recoveredAmount.toString()).toFixed(2);
  const closing = parseFloat(params.closingOutstanding.toString()).toFixed(2);

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

  const payload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  const result = await sendMetaCloudMessage(params.phone, payload);

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
  const timestamp = new Date().toLocaleString('en-IN');
  const textBody =
`🚀 *CFECC STORES - WHATSAPP API TEST PING*
━━━━━━━━━━━━━━━━━━━━
*System:* CFECC Stores Management Platform
*Timestamp:* ${timestamp}
*Gateway:* Meta WhatsApp Cloud API (Official)
*Status:* ✅ Connected & Operating
━━━━━━━━━━━━━━━━━━━━
${testNote || 'Your Meta WhatsApp Cloud API connection has been successfully verified!'}
_Visakhapatnam, Andhra Pradesh_`;

  const payload = {
    type: 'text',
    text: { preview_url: false, body: textBody },
  };

  const result = await sendMetaCloudMessage(targetPhone, payload);

  await executeRawSql(`
    INSERT INTO whatsapp_logs (
      recipient_phone, recipient_name, message_type, reference_type, reference_id,
      template_name, payload, status, provider_message_id, error_message, sent_at
    ) VALUES (
      '${targetPhone}', 'System Administrator',
      'API_TEST', 'SYSTEM_DIAGNOSTIC', 'PING_${Date.now()}',
      'cfecc_api_test', '${JSON.stringify({ testNote: testNote || 'Test ping' }).replace(/'/g, "''")}',
      '${result.status}', ${result.messageId ? `'${result.messageId}'` : 'NULL'},
      ${result.errorMessage ? `'${result.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
      NOW()
    );
  `);

  return result;
}
