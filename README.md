# LoopBill — Subscription Management System

One system to run plans, subscriptions and recurring billing for Brightloop Software: from setting up products and plans to invoicing, collecting payments and reporting revenue.

## Features

- **Roles** — Admin (full control, only role that can add staff), Staff (day-to-day work, limited access) and Customer (portal showing only their own subscriptions and invoices).
- **Accounts** — signup with unique email and a strong password (more than 8 characters, upper and lower case, special character); password reset by emailed link.
- **Catalog** — products (name, type, sales price, cost price, notes, taxes) with variants that add to the price (e.g. brand Odoo +560).
- **Plans** — price, billing period (daily, weekly, monthly, yearly), minimum quantity, availability dates, and per-plan rules for auto-close, early close, pause and renewal.
- **Quotation templates** — reusable plan, payment term, validity days and product lines.
- **Subscriptions** — number, customer, plan, start and expiry dates, payment terms and lines; lifecycle Draft → Quotation → Confirmed → Active → Closed, with pause, resume, renew and optional add-ons.
- **Billing** — invoices are created from subscriptions (manually or by the nightly job) with customer details, lines, taxes and totals filled in. Nothing is billed twice or skipped, including missed days.
- **Taxes and discounts** — admin-defined tax rules; fixed or percentage discounts with minimum purchase or quantity, date range and usage limit, applied automatically to products or whole subscriptions.
- **Invoices and payments** — confirm, cancel, send and print invoices (Draft → Confirmed → Paid); record payments by method, amount, date and note; see paid, outstanding and overdue at any time.
- **Reports** — active subscriptions, MRR/ARR, revenue collected, amount owed and overdue invoices, with filters.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22, Express 5, Zod |
| Database | PostgreSQL 16 with Prisma 6 |
| Auth | bcryptjs, JWT in httpOnly cookies |
| Email | Nodemailer (Mailpit locally) |
| Frontend | React 19, Vite, Tailwind CSS 4, TanStack Query, React Hook Form, Recharts, Lucide |

## Getting started

### Prerequisites

- Node.js 22
- Docker and Docker Compose (or a local PostgreSQL 16)

### 1. Start PostgreSQL and the mail inbox

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` and Mailpit on `http://localhost:8025` (SMTP port 1025).

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

The API runs at `http://localhost:5000`.

> On macOS, AirPlay Receiver may already use port 5000. Either turn it off, or set another `PORT` in `backend/.env` and start the frontend with `VITE_API_TARGET=http://localhost:<port>`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Demo accounts

Created by `npm run seed`, together with sample products, plans, templates, discounts, subscriptions, invoices and payments.

| Role | Email | Password |
|---|---|---|
| Admin | admin@brightloop.in | `Admin@12345` |
| Staff | staff@brightloop.in | `Staff@12345` |
| Customer | riya@sharmaretail.in | `Customer@123` |

## Tests

```bash
cd backend
npm test
```

Unit tests need nothing else. The API integration test in `catalog-subscriptions.test.js` needs the seeded database and is skipped when it is not reachable.

## Project structure

```
backend/
  prisma/             schema and seed
  src/
    modules/          auth, users, customers, taxes, payment-terms, discounts,
                      products, plans, templates, subscriptions, billing,
                      invoices, payments, reports
    lib/              billing-core (money maths in paise), sequences, mailer
    jobs/             nightly activation, billing and auto-close
    middleware/       auth/RBAC, validation, errors
    tests/
frontend/
  src/
    pages/            auth, catalog, subscriptions, invoices, payments,
                      customers, discounts, config, portal, dashboard
    services/         API clients
    components/       layouts and shared UI
```

## API overview

All routes are under `/api` and need a login except `/api/auth`.

| Route | Purpose |
|---|---|
| `/auth` | signup, login, logout, me, forgot and reset password |
| `/users`, `/customers` | staff accounts, customers |
| `/taxes`, `/payment-terms`, `/discounts` | configuration (admin writes, staff reads) |
| `/products`, `/variants`, `/plans`, `/quotation-templates` | catalog (admin writes, staff reads) |
| `/subscriptions` | create, edit, send-quotation, confirm, activate, pause, resume, renew, close, add-on lines |
| `/billing` | run billing, billing status |
| `/invoices`, `/payments` | invoices and payment recording |
| `/reports` | summary and revenue by month |

## Billing rules

- Money is calculated in integer paise, so totals never drift.
- Billing periods are counted from the subscription start date (31 Jan, 28 Feb, 31 Mar and so on).
- A unique constraint on subscription and period start makes double billing impossible.
- Invoice and subscription numbers are sequential per year (`INV/2026/00001`, `SUB/2026/00001`).
