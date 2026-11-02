import { pgTable, text, serial, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const whatsappLogs = pgTable('whatsapp_logs', {
  id: serial('id').primaryKey(),
  recipientPhone: text('recipient_phone').notNull(),
  recipientName: text('recipient_name'),
  messageType: text('message_type').notNull(), // 'BILLING_STATEMENT', 'PAYMENT_RECEIPT', 'CREDIT_ALERT'
  referenceType: text('reference_type'), // 'EMPLOYEE_INVOICE', 'PAYMENT'
  referenceId: text('reference_id'),
  templateName: text('template_name').notNull(),
  payload: jsonb('payload'),
  status: text('status').default('PENDING').notNull(), // 'PENDING', 'SENT', 'DELIVERED', 'FAILED'
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

