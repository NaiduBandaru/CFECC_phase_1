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
  opening_balance: string | number;
  current_outstanding: string | number;
  po_count?: number;
  invoice_count?: number;
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

