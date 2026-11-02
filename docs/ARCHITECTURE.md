# CFECC Stores Management System - Technical Architecture

## 1. Vision & Domain Model
CFECC Stores Management System is a unified, high-reliability Enterprise Resource Planning (ERP) platform designed for CFECC Stores in Visakhapatnam, Andhra Pradesh.

It integrates:
- Employee Master & KYC (11-Tab profile, credit limits, department, designation, salary)
- Store Items Master & Category Taxonomy (with Dual Pricing: Regular & Subsidized Employee Price)
- Purchasing & Supplier Network (Purchase Orders, Goods Receipt GRN, Purchase Invoices)
- Inventory Control (Real-time stock ledger, batch & reorder tracking, stock movement audit trail)
- Point of Sale (POS) High-Speed Terminal (Barcode scanning, multi-tender: Cash, UPI, Employee Credit)
- Financial Ledger & Monthly Statement Engine (Opening balances, credit sales, recoveries, WhatsApp dispatch)
- Monthly Payroll Integration (Automated recovery deduction, payslips, reconciliation)
- Business Intelligence & Reporting (Excel / PDF exports, operational dashboards)

## 2. Monorepo Organization
```
CFECC_phase1/
├── apps/
│   ├── server/             # Express.js REST API with Drizzle ORM, Zod, JWT
│   └── client/             # React + Vite + TypeScript + Tailwind + TanStack
├── docs/                   # Full Technical Architecture & Specifications
├── package.json
└── pnpm-workspace.yaml
```

## 3. Technology Stack Justification
- **Express.js & TypeScript:** Lightweight, bulletproof predictability, fast startup, standard enterprise middleware.
- **Drizzle ORM & PostgreSQL:** Type-safe SQL, zero bloat, high performance, clean migrations, supports both PostgreSQL server and PGlite/embedded mode for local developer productivity.
- **React, Vite & Tailwind CSS:** Sub-second HMR, high productivity, accessible design primitives.
- **TanStack Query:** State caching, automatic background invalidation, smooth offline-resilient UI.
- **Zod:** Unified schema validation across API endpoints and client forms.
