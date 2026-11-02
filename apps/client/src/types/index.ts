export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  employeeId?: number | null;
}

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  profile_image_url?: string | null;
  mobile: string;
  alternate_mobile?: string | null;
  email?: string | null;
  current_address?: string | null;
  permanent_address?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  designation_id?: number | null;
  designation_title?: string | null;
  joining_date: string;
  employment_type: string;
  employment_status: string;
  credit_enabled: boolean;
  credit_limit: string | number;
  current_outstanding: string | number;
  available_credit: string | number;
  created_at: string;
}

export interface Item {
  id: number;
  item_code: string;
  name: string;
  category_id?: number | null;
  category_name?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  description?: string | null;
  unit_id?: number | null;
  unit_code?: string | null;
  unit_name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  hsn_code?: string | null;
  purchase_price: string | number;
  selling_price: string | number;
  employee_price: string | number;
  current_stock: string | number;
  min_stock: string | number;
  reorder_level: string | number;
  tax_rate: string | number;
  image_url?: string | null;
  is_active: boolean;
}

export interface ItemPriceHistory {
  id: number;
  item_id: number;
  old_purchase_price: string | number;
  new_purchase_price: string | number;
  old_selling_price: string | number;
  new_selling_price: string | number;
  old_employee_price: string | number;
  new_employee_price: string | number;
  reason?: string | null;
  changed_by?: number | null;
  changed_by_name?: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  description?: string | null;
}

export interface Unit {
  id: number;
  code: string;
  name: string;
  precision: number;
}

export interface Vendor {
  id: number;
  vendor_code: string;
  name: string;
  contact_person?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  gstin?: string | null;
  payment_terms_days: number;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  opening_balance: string | number;
  current_outstanding: string | number;
  is_active: boolean;
  po_count?: number;
  invoice_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Sale {
  id: number;
  invoice_number: string;
  sale_type: string;
  employee_id?: number | null;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  subtotal: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  payment_mode: string;
  payment_status: string;
  billed_by_name?: string | null;
  item_count?: number;
  created_at: string;
}

export interface BillingPeriod {
  id: number;
  period_code: string;
  period_name: string;
  start_date: string;
  end_date: string;
  billing_date: string;
  status: 'OPEN' | 'DRAFT' | 'FINALIZED' | 'CLOSED';
  total_employees_billed: number;
  total_billed_amount: string | number;
  total_recovered_amount: string | number;
  finalized_at?: string | null;
}

export interface EmployeeStatement {
  id: number;
  invoice_number: string;
  billing_period_id: number;
  period_name: string;
  period_code: string;
  employee_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  mobile: string;
  department_name?: string | null;
  opening_balance: string | number;
  current_purchases: string | number;
  adjustments: string | number;
  payments_received: string | number;
  recoveries_deducted: string | number;
  closing_outstanding: string | number;
  status: string;
  whatsapp_status: string;
  whatsapp_sent_at?: string | null;
}

export interface PurchaseOrderItem {
  id: number;
  po_id: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  unit_code?: string;
  ordered_qty: string | number;
  received_qty: string | number;
  unit_price: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total_price: string | number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  order_date: string;
  expected_delivery_date?: string | null;
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  status: 'PENDING' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  item_count?: number;
  created_at: string;
  items?: PurchaseOrderItem[];
}

export interface GoodsReceipt {
  id: number;
  grn_number: string;
  po_id?: number | null;
  po_number?: string | null;
  vendor_id: number;
  vendor_name: string;
  receipt_date: string;
  delivery_challan_number?: string | null;
  vehicle_number?: string | null;
  status: string;
  notes?: string | null;
  item_count?: number;
  created_at: string;
}

export interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  system_bill_number: string;
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  grn_id?: number | null;
  grn_number?: string | null;
  invoice_date: string;
  due_date?: string | null;
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  attachment_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface VendorPayment {
  id: number;
  payment_number: string;
  vendor_id: number;
  vendor_name?: string;
  payment_date: string;
  payment_mode: string;
  amount: string | number;
  reference_number?: string | null;
  purchase_invoice_id?: number | null;
  invoice_number?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PayrollPeriod {
  id: number;
  period_code: string;
  month_year: string;
  start_date: string;
  end_date: string;
  payout_date: string;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'DISBURSED';
  total_gross_pay: string | number;
  total_deductions: string | number;
  total_net_pay: string | number;
  created_at: string;
}

export interface PayrollEntry {
  id: number;
  payroll_period_id: number;
  employee_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  department_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  pan_number?: string | null;
  basic_salary: string | number;
  da: string | number;
  hra: string | number;
  other_allowances: string | number;
  gross_salary: string | number;
  store_recovery_amount: string | number;
  statutory_deductions: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  payment_status: 'PENDING' | 'PAID' | 'FAILED';
  paid_at?: string | null;
}

export interface RecoveryRecord {
  id: number;
  recovery_number: string;
  employee_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  department_name?: string | null;
  billing_period_id: number;
  billing_period_name?: string | null;
  recovery_source: string;
  amount_deducted: string | number;
  payroll_period_id?: number | null;
  payroll_period_code?: string | null;
  status: string;
  recovered_at: string;
  remarks?: string | null;
}

export interface PurchaseReportItem {
  id: number;
  invoice_number: string;
  system_bill_number: string;
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  vendor_gstin?: string | null;
  vendor_phone?: string | null;
  grn_id?: number | null;
  grn_number?: string | null;
  invoice_date: string;
  due_date?: string | null;
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  balance_due: string | number;
  status: string;
  notes?: string | null;
}

export interface VendorPurchaseSummary {
  vendor_id: number;
  vendor_code: string;
  vendor_name: string;
  contact_person?: string | null;
  phone: string;
  gstin?: string | null;
  payment_terms_days: number;
  current_outstanding: string | number;
  total_invoices: number;
  total_purchased: string | number;
  total_paid: string | number;
  calculated_outstanding: string | number;
  last_invoice_date?: string | null;
}

export interface ItemPurchaseSummary {
  item_id: number;
  item_code: string;
  item_name: string;
  brand?: string | null;
  category_name?: string | null;
  unit_code?: string | null;
  current_stock: string | number;
  current_purchase_price: string | number;
  current_selling_price: string | number;
  total_ordered_qty: string | number;
  total_received_qty: string | number;
  total_purchase_spend: string | number;
  weighted_avg_cost: string | number;
  po_count: number;
}

export interface GrnReportItem {
  id: number;
  grn_number: string;
  receipt_date: string;
  vendor_name: string;
  vendor_code: string;
  po_number?: string | null;
  delivery_challan_number?: string | null;
  vehicle_number?: string | null;
  status: string;
  notes?: string | null;
  item_count: number;
  total_received_qty: string | number;
  total_accepted_qty: string | number;
  total_rejected_qty: string | number;
}

export interface GstItcReportItem {
  id: number;
  system_bill_number: string;
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  vendor_code: string;
  vendor_gstin?: string | null;
  taxable_amount: string | number;
  total_gst: string | number;
  cgst_amount: string | number;
  sgst_amount: string | number;
  invoice_total: string | number;
  payment_status: string;
}


