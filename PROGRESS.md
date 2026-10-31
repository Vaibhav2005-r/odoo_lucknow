# LoopBill — Implementation Progress & Roadmap

**Repository:** `https://github.com/Vaibhav2005-r/odoo_lucknow.git`  
**Current Branch:** `main`  
**Latest Synced Commit:** `bb2e3f6` (`feat(billing): billing engine, run endpoint, daily job`)  
**Status Date:** 31 October 2026  

---

## 1. Executive Summary

The project is structured according to the **8-Hour Development Plan & Ownership** across 3 developers:
- **Developer A (Identity, Config, Customers, Customer Portal, Repo Owner)**: ~85% done
- **Developer B (Catalog, Plans, Quotation Templates, Subscriptions)**: Stubs in place, ready for implementation
- **Developer C (Billing Engine, Invoicing, Payments, Reports, Financial Maths)**: Billing engine & core maths done; Invoices/Payments API & Reports pending

All **34 backend test suites are passing** (`34 passed, 0 failed`). Both backend (`:5000`) and frontend (`:5174`) servers are running cleanly.

---

## 2. Completed Modules & Features (DONE)

### Backend API (`/backend/src/modules/`)

| Module | Route / File | Status | What Has Been Implemented |
|---|---|---|---|
| **Auth** | `/api/auth` (`auth.routes.js`) | ✅ Done | Signup, Login, Logout, `/me` profile check, Forgot Password, Reset Password with secure SHA-256 tokens, rate-limited, httpOnly JWT cookies. |
| **RBAC Middleware** | `middleware/auth.js` | ✅ Done | `requireAuth`, `requireRole('ADMIN', 'STAFF')`, and `ownScope` (isolates customer data so customers can only access their own records). |
| **Users** | `/api/users` (`users.routes.js`) | ✅ Done | Admin-only staff account creation, user listing, password rule enforcement, self-deactivation protection. |
| **Taxes** | `/api/taxes` (`taxes.routes.js`) | ✅ Done | Tax creation (0–100% rate boundary check), list active/inactive taxes, toggle active status (Admin write, Staff read). |
| **Payment Terms** | `/api/payment-terms` (`payment-terms.routes.js`) | ✅ Done | Payment term configuration (`dueDays` 0–365), list terms, update/archive terms (Admin write, Staff read). |
| **Customers** | `/api/customers` (`customers.routes.js`) | ✅ Done | Customer listing with search and pagination, customer details, customer creation, portal login linkage, customer update (restricted email/GSTIN tampering). |
| **Discounts** | `/api/discounts` (`discounts.routes.js`) | ✅ Done | Discount rules CRUD, FIXED & PERCENTAGE discounts, PRODUCT & SUBSCRIPTION scopes, min purchase, min quantity, date boundaries, usage limits. |
| **Billing Core Engine** | `lib/billing-core.js` | ✅ Done | Integer paise math (`toPaise`, `toRupees`), month-end drift prevention (`addMonthsClamped`), due period generator, allocation engine with remainder distribution. |
| **Billing Service & Daily Job** | `modules/billing/` & `jobs/daily.js` | ✅ Done | Manual billing trigger `/api/billing/run`, status reporting `/api/billing/status`, cron job catch-up billing for missed periods, double-billing guard via `(subscriptionId, periodStart)`. |
| **Number Sequences** | `lib/sequence.js` | ✅ Done | Atomic sequential numbering for subscriptions (`SUB/YYYY/XXXXX`) and invoices (`INV/YYYY/XXXXX`). |

---

### Frontend UI (`/frontend/src/`)

| Section | Route | File | Status | What Has Been Implemented |
|---|---|---|---|---|
| **App Layout** | `/app/*` | `components/layout/AppLayout.jsx` | ✅ Done | Responsive sidebar, topbar, navigation active states, user avatar & role badge, logout action. |
| **Portal Layout** | `/portal/*` | `components/layout/PortalLayout.jsx` | ✅ Done | Dedicated customer self-service layout. |
| **Authentication** | `/login`, `/signup`, `/forgot-password`, `/reset-password` | `pages/auth/*` | ✅ Done | Full login & registration forms, live password requirement checklist, toast feedback. |
| **Admin: Users** | `/app/users` | `pages/users/Users.jsx` | ✅ Done | Staff accounts list, search filter, Add Staff modal with password checklist. |
| **Config: Taxes** | `/app/taxes` | `pages/config/Taxes.jsx` | ✅ Done | Tax list table, Add/Edit Tax modal, active status toggles. |
| **Config: Terms** | `/app/payment-terms` | `pages/config/PaymentTerms.jsx` | ✅ Done | Payment terms cards/table, due days display, Add/Edit modal. |
| **Config: Discounts**| `/app/discounts` | `pages/discounts/Discounts.jsx`| ✅ Done | Discount rules table, scope pills, validity date badges, usage limit tracking. |
| **Customers** | `/app/customers` & `/app/customers/:id` | `pages/customers/*` | ✅ Done | Customer list with search & pagination, customer profile view, contact details, linked portal user status. |

---

### Database & Tests Status
- **Schema**: PostgreSQL Prisma schema complete (`User`, `Customer`, `Tax`, `PaymentTerm`, `Product`, `ProductVariant`, `Plan`, `QuotationTemplate`, `TemplateLine`, `Discount`, `Subscription`, `SubscriptionLine`, `SubscriptionLog`, `Invoice`, `InvoiceLine`, `Payment`, `Sequence`).
- **Seed Data**: Users (`admin@brightloop.in`, `staff@brightloop.in`, `riya@sharmaretail.in`), default GST tax (`GST 18%`), and standard payment terms.
- **Backend Tests (34 passing)**:
  - `auth.test.js` (8 tests)
  - `billing-core.test.js` (11 tests)
  - `billing.test.js` (3 tests)
  - `customers.test.js` (4 tests)
  - `discounts.test.js` (4 tests)
  - `payment-terms.test.js` (2 tests)
  - `taxes.test.js` (3 tests)
  - `users.test.js` (3 tests)

---

## 3. Pending Tasks (What to Work on Next)

### Priority 1: Developer B — Catalog & Subscriptions

#### 1. Backend Modules (Currently 85-byte stubs)
- [ ] **Products & Variants** (`backend/src/modules/products/`):
  - `products.routes.js`: CRUD for products (SERVICE, GOODS, ADDON), attach taxes (`taxIds`).
  - `variants.routes.js`: CRUD for product variants (attribute name, value, `extraPrice`).
- [ ] **Plans** (`backend/src/modules/plans/plans.routes.js`):
  - Plan CRUD linked to a Product, billing period (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`), pricing, flags (`autoClose`, `closable`, `pausable`, `renewable`).
- [ ] **Quotation Templates** (`backend/src/modules/templates/templates.routes.js`):
  - Template CRUD with default Plan, default Payment Term, validity days, and pre-configured lines (`TemplateLine`).
- [ ] **Subscriptions Lifecycle** (`backend/src/modules/subscriptions/`):
  - `subscriptions.routes.js` & `subscriptions.service.js`:
    - Create subscription (Draft) manually or from a Quotation Template.
    - Transitions: `sendQuotation` (Draft → Quotation) → `confirm` (Quotation → Confirmed) → `activate` (Confirmed → Active) → `close` (Active → Closed).
    - Lifecycle controls: `pause`, `resume`, `renew`.
    - Add-on management: switch add-on lines active/inactive, add dynamic add-on lines.
    - Subscription recalculation via `recalcSubscription` when lines or discounts change.

#### 2. Frontend Pages for Developer B
- [ ] **Catalog / Products View** (`frontend/src/pages/catalog/Products.jsx`):
  - Product list with variants, prices, tax tags, and Add Product modal.
- [ ] **Plans View** (`frontend/src/pages/catalog/Plans.jsx`):
  - List of recurring billing plans with period badges and terms.
- [ ] **Quotation Templates View** (`frontend/src/pages/catalog/Templates.jsx`):
  - Template creation with line item builder.
- [ ] **Subscriptions View** (`frontend/src/pages/subscriptions/`):
  - `SubscriptionList.jsx`: Table with filters by status (Draft, Quotation, Confirmed, Active, Closed), customer, plan.
  - `SubscriptionDetail.jsx`: Header with action buttons (`Send Quotation`, `Confirm`, `Pause`, `Resume`, `Close`, `Renew`), line items table with add-on toggles, invoice history tab, and audit trail log.
  - `SubscriptionForm.jsx`: New quotation / subscription creator with template auto-fill.

---

### Priority 2: Developer C — Invoices, Payments & Reports

#### 1. Backend Modules (Currently 85-byte stubs)
- [ ] **Invoices** (`backend/src/modules/invoices/invoices.routes.js` & `invoices.service.js`):
  - `GET /api/invoices`: View filters (`ALL`, `DRAFT`, `OUTSTANDING`, `OVERDUE`, `PAID`, `CANCELLED`), search by invoice number or customer name.
  - `GET /api/invoices/:id`: Full invoice details with line items snapshot, payments applied, and customer snapshot.
  - `POST /api/invoices/:id/confirm` & `/api/invoices/bulk-confirm`: Confirm draft invoices into outstanding state.
  - `POST /api/invoices/:id/cancel`: Cancel unpaid invoice.
  - `POST /api/invoices/:id/send` & `remind`: Email invoice / payment reminder via Nodemailer.
- [ ] **Payments** (`backend/src/modules/payments/payments.routes.js` & `payments.service.js`):
  - `POST /api/invoices/:id/payments`: Record payment against invoice (CASH, BANK_TRANSFER, UPI, CARD, CHEQUE, OTHER), atomically update invoice `amountPaid`, and mark status `PAID` once fully settled.
  - `GET /api/payments`: Payment ledger with date range and customer filters.
- [ ] **Reports** (`backend/src/modules/reports/reports.routes.js` & `reports.service.js`):
  - `GET /api/reports/summary`: Active subscriptions count, MRR, ARR, revenue collected, amount outstanding, amount overdue.
  - `GET /api/reports/revenue-by-month`: Monthly revenue aggregation for chart visualization.

#### 2. Frontend Pages for Developer C
- [ ] **Invoices View** (`frontend/src/pages/invoices/`):
  - `InvoiceList.jsx`: Tabs for Draft, Outstanding, Overdue, Paid, Cancelled; bulk confirm button.
  - `InvoiceDetail.jsx`: Printable invoice preview, tax breakdown, Record Payment modal.
- [ ] **Payments View** (`frontend/src/pages/payments/PaymentList.jsx`):
  - Payment transactions table.
- [ ] **Dashboard / Reports** (`frontend/src/pages/reports/Dashboard.jsx`):
  - KPI cards: Active Subscriptions, MRR, ARR, Collected, Overdue.
  - Revenue chart (using Recharts).

---

### Priority 3: Developer A — Customer Portal UI
- [ ] **Customer Portal Pages** (`frontend/src/pages/portal/`):
  - `PortalDashboard.jsx`: Active plan overview, next billing date, outstanding invoices banner.
  - `PortalSubscriptions.jsx`: View own subscriptions, manage optional add-ons, request cancellation.
  - `PortalInvoices.jsx`: View & download invoices, review payment receipts.

---

## 4. How to Run the Environment

### Services & Ports
- **Frontend App**: `http://localhost:5174` (or `:5173`)
- **Backend API**: `http://localhost:5000`
- **PostgreSQL**: `localhost:5432` (`loopbill` / `loopbill`, db `loopbill`)

### Commands
```bash
# Backend tests
cd backend
npm test

# Run backend development server
cd backend
npm run dev

# Run frontend development server
cd frontend
npm run dev
```

### Seed Accounts
| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@brightloop.in` | `Admin@12345` |
| **Staff** | `staff@brightloop.in` | `Staff@12345` |
| **Customer** | `riya@sharmaretail.in` | `Customer@123` |

