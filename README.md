# CFECC STORES MANAGEMENT SYSTEM
## Enterprise Retail, Inventory, POS, Employee Credit & Monthly Payroll Recovery Platform

**Client:** CFECC Stores  
**Location:** Visakhapatnam, Andhra Pradesh, India  
**Design Standard:** Premium Light Enterprise ERP (#172B4D Deep Navy, #2563EB Primary Blue, Inter Typography)

---

## 1. System Overview

The **CFECC Stores Management System** is a centralized ERP application designed from scratch for CFECC Stores in Visakhapatnam. The platform integrates store operations, POS retail transactions, inventory control, vendor management, employee store credit accounts, monthly statement generation, and payroll deduction recovery into a unified PostgreSQL database.

### Core Business Workflow
1. **Employee Master & Credit Limits:** Employees have an authorized monthly store credit limit (default ₹10,000–₹25,000) and live available credit.
2. **Dual-Tier Pricing:** Every commodity maintains both a standard retail `selling_price` and a subsidized `employee_price`.
3. **Point of Sale (POS):** Fast barcode scanning and checkout supporting Cash, UPI, and authorized Employee Monthly Credit.
4. **Audit Trail & Double-Entry Ledger:** Every sale automatically decrements inventory, creates a stock movement audit record, and logs a debit to the employee's live store ledger.
5. **Monthly Billing Engine:** Consolidated monthly billing statement generation calculating opening balance, credit purchases, direct payments, and closing balances with WhatsApp statement dispatch.
6. **Payroll Recovery Integration:** Automated deduction linking store statement balances to monthly payroll payslips, eliminating duplicate recoveries.

---

## 2. Technology Stack

- **Frontend:**
  - React 18+ & TypeScript
  - Vite 6
  - Tailwind CSS (Enterprise Design System)
  - Lucide React
  - React Router 7
  - Recharts (Interactive financial analytics)
  - TanStack Query
- **Backend:**
  - Node.js & Express.js (REST API architecture)
  - TypeScript
  - Zod validation
  - JWT Authentication & RBAC
- **Database:**
  - PostgreSQL with Drizzle ORM
  - Native embedded PostgreSQL engine support via PGlite for zero-config local development and testing
- **Testing:**
  - Vitest test suite for automated database and API lifecycle testing

---

## 3. Project Structure

```
CFECC_phase1/
├── apps/
│   ├── server/             # Express.js REST API with Drizzle ORM
│   │   ├── src/
│   │   │   ├── config/     # Environment & client settings
│   │   │   ├── db/         # Drizzle schema (auth, employees, inventory, sales, billing, payroll)
│   │   │   ├── middleware/ # Auth JWT, RBAC, ErrorHandler, Audit Logging
│   │   │   ├── modules/    # Domain modules (auth, dashboard, employees, items, pos, billing...)
│   │   │   └── index.ts    # Server bootstrap & automated seed
│   │   └── tests/          # Vitest integration tests
│   └── client/             # React SPA with Tailwind & enterprise UI
│       ├── src/
│       │   ├── components/ # AppShell, Sidebar, Header, Modals, StatCards
│       │   ├── context/    # Auth context & session management
│       │   ├── pages/      # Dashboard, Employees (11-Tab profile), POS, Billing, Payroll...
│       │   └── types/      # TypeScript interfaces
├── docs/                   # Architectural blueprints & specifications
├── package.json
└── pnpm-workspace.yaml
```

---

## 4. Quick Start & Execution

### Prerequisites
- Node.js v20+
- pnpm v9+

### Installation & Build
```bash
# Install dependencies
pnpm install

# Build both backend and frontend
pnpm build

# Run automated tests
pnpm test
```

### Running the Application
```bash
# Start backend server (Port 5000)
pnpm --filter @cfecc/server dev

# Start frontend application (Port 5173)
pnpm --filter @cfecc/client dev
```

---

## 5. Default Demonstration Accounts

| Role | Username | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin` | `Admin@123` | Full enterprise control & settings |
| **Store Manager** | `manager` | `Manager@123` | Inventory, purchasing & commodity pricing |
| **POS Cashier** | `cashier` | `Cashier@123` | High-speed POS terminal & receipt generation |

---

## 6. Key Enterprise Modules

1. **Executive Dashboard:** Live KPIs (Sales, Outstanding, Inventory Valuation, Collections, Low-Stock items) with 6-month turnover trends and category distribution charts.
2. **Employee Master Directory & 11-Tab Profile:**
   - Tabs: 1. Overview, 2. Personal KYC, 3. Contact Details, 4. Employment, 5. Salary Structure, 6. Bank Details, 7. Store Credit Limits, 8. Documents, 9. Purchase History, 10. Billing & Ledger, 11. Activity History.
3. **Point of Sale (POS):** Fast barcode scanning, live employee credit availability validation, subsidized staff pricing, and thermal/A4 receipt printing.
4. **Monthly Employee Billing Engine:** Month-end statement generator with double-entry reconciliation and WhatsApp Cloud API notification dispatch.
5. **Payroll & Recovery:** Automated deduction of store dues from employee monthly gross salaries with comprehensive payslip generation.
6. **Purchasing & GRN:** Purchase orders with 3-way matching and verified goods receipt updating stock levels.
7. **Reports Center:** Filterable registers with instant CSV/Excel export for store audit and compliance.
