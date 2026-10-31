# LoopBill — Implementation Progress & Roadmap

**Repository:** `https://github.com/Vaibhav2005-r/odoo_lucknow.git`  
**Current Branch:** `main`  
**Latest Synced Commit:** `bb2e3f6` (`feat(billing): billing engine, run endpoint, daily job`)  
**Status Date:** 31 October 2026  

---

## 1. Executive Summary

Every requirement in the Brightloop brief is implemented end to end against the real API and database. The frontend no longer
uses localStorage mock data.

- Backend: auth/RBAC, users, customers, taxes, payment terms, discounts, **products + variants, plans, quotation templates,
  subscription lifecycle (Draft → Quotation → Confirmed → Active → Closed, plus pause / resume / renew / add-ons)**, billing
  engine, invoices, payments, reports.
- Tests: `npm test` in `backend/` runs the unit tests plus `catalog-subscriptions.test.js`, an API-level test of the whole
  flow (skipped automatically when no seeded database is reachable).
- Seed data (`npm run seed`) now includes demo subscriptions, invoices and payments.

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

## 3. Delivered since the last update

| Area | What was added |
|---|---|
| Products & variants | `/api/products`, `/api/variants`: CRUD, tax links, variant extra price (e.g. brand Odoo = +560), in-use rows are deactivated instead of deleted |
| Plans | `/api/plans`: period, minimum quantity, availability dates, auto-close / closable / pausable / renewable flags |
| Quotation templates | `/api/quotation-templates`: plan, payment term, validity days, product + variant lines |
| Subscriptions | create (manual or from template), edit while draft/quotation, send-quotation, confirm, activate, renew, add / toggle / remove add-on lines, stats; plan-rule checks (minimum quantity, availability dates) |
| Frontend | Products, Plans (now with available-from/until dates), Templates (variant picker, server-derived prices), Subscription list / form / detail all use the API |

## 3b. Known limitations

- Product images and SKU are display-only: the schema has no column for them, so uploaded images are not stored.
- The subscription form's price panel is an estimate; the server recalculates exact amounts on save.
- Customers dropdown loads the first 100 customers; add search-as-you-type if the list grows far beyond that.
- macOS uses port 5000 for AirPlay Receiver. Set `PORT` in `backend/.env` and `VITE_API_TARGET` when starting Vite (e.g. `VITE_API_TARGET=http://localhost:5001 npm run dev`), or turn AirPlay Receiver off.

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

