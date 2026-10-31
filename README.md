# LoopBill — Subscription Management System

One system to run plans, subscriptions and recurring billing for Brightloop Software: from setting up products and plans to invoicing, collecting payments and reporting revenue.

## Features

- **Roles** — Admin (full control, only role that can add staff), Staff (day-to-day work, limited access) and Customer (portal showing only their own subscriptions and invoices).
- **Accounts** — signup with unique email and a strong password (more than 8 characters, upper and lower case, special character); password reset by emailed link. New accounts confirm their email by link; a customer record staff created earlier is only attached once the owner confirms the address, so signing up with someone else's email exposes nothing.
- **Catalog** — products (name, type, sales price, cost price, notes, taxes) with variants that add to the price (e.g. brand Odoo +560).
- **Plans** — price, billing period (daily, weekly, monthly, yearly), minimum quantity, availability dates, and per-plan rules for auto-close, early close, pause and renewal.
- **Quotation templates** — reusable plan, payment term, validity days and product lines.
- **Subscriptions** — number, customer, plan, start and expiry dates, payment terms and lines; lifecycle Draft → Quotation → Confirmed → Active → Closed, with pause, resume, renew and optional add-ons.
- **Billing** — invoices are created from subscriptions (manually or by the nightly job) with customer details, lines, taxes and totals filled in. Nothing is billed twice or skipped, including missed days.
- **Taxes and discounts** — admin-defined tax rules; fixed or percentage discounts with minimum purchase or quantity, date range and usage limit, applied automatically to products or whole subscriptions.
- **Invoices and payments** — confirm, cancel, send and print invoices (Draft → Confirmed → Paid); record payments by method, amount, date and note; see paid, outstanding and overdue at any time.
- **Look and feel** — light, dark or follow-the-system theme (saved per browser, no flash on load), an animated sign-in page with a reactive mascot, branded sidebar, and a hero banner with live figures on the dashboard and customer portal. Printable invoices always stay light.
- **Indian GST** — invoices are split into CGST + SGST (customer in our state) or IGST (another state), decided by the customer's state or GSTIN. Taxes have a type (GST or other, such as a cess), products carry HSN/SAC codes, GSTINs are validated, and a GST summary (by month and by rate, with CSV export) is ready for your accountant.
- **Automatic reminders** — customers are e-mailed 3 days before an invoice is due, 1, 7, 14 and 30 days after it is overdue, and 30 and 7 days before a subscription expires. Each reminder is sent once, in the daytime, and a mail outage never loses one.
- **Online payments** — customers pay a confirmed invoice from the portal with Razorpay (UPI, cards, net banking). Without Razorpay keys a built-in test checkout is used for demos. Payments are confirmed by signature and by webhook, and can never be recorded twice.
- **Reports** — active subscriptions, MRR/ARR, revenue collected, amount owed and overdue invoices, with filters.

## Screenshots

### Admin and staff

| | |
|---|---|
| **Dashboard** — active subscriptions, MRR/ARR, collected, outstanding and overdue, 12-month chart<br>![Dashboard](docs/screenshots/dashboard.png) | **Subscriptions** — filter by status and plan<br>![Subscriptions](docs/screenshots/subscriptions.png) |
| **Subscription detail** — lifecycle actions, line items, invoices, activity log<br>![Subscription detail](docs/screenshots/subscription-detail.png) | **New subscription** — plan, quantity, variant, terms, discount and add-ons<br>![New subscription](docs/screenshots/subscription-new.png) |
| **Products and variants**<br>![Products](docs/screenshots/products.png) | **Plans**<br>![Plans](docs/screenshots/plans.png) |
| **Quotation templates**<br>![Quotation templates](docs/screenshots/templates.png) | **Invoices** — draft, outstanding, overdue, paid<br>![Invoices](docs/screenshots/invoices.png) |
| **Payments**<br>![Payments](docs/screenshots/payments.png) | **Run billing**<br>![Run billing](docs/screenshots/billing-run.png) |

### Dark mode

| | |
|---|---|
| **Dashboard**<br>![Dashboard in dark mode](docs/screenshots/dashboard-dark.png) | **Subscriptions**<br>![Subscriptions in dark mode](docs/screenshots/subscriptions-dark.png) |
| **Customer portal**<br>![Portal in dark mode](docs/screenshots/portal-dark.png) | **Sign in**<br>![Sign in, dark mode](docs/screenshots/login-dark.png) |

### GST, checkout and customers

| | |
|---|---|
| **GST invoice** — per-line HSN/SAC, IGST for an out-of-state customer, place of supply<br>![GST invoice](docs/screenshots/invoice-gst.png) | **Pay now** — the portal checkout (test mode shown)<br>![Checkout](docs/screenshots/checkout.png) |
| **Customer GST details** — a valid GSTIN fills in the state<br>![Customer GST fields](docs/screenshots/customer-gst.png) | |

### Customer portal

| | |
|---|---|
| **My subscriptions**<br>![Portal subscriptions](docs/screenshots/portal-subscriptions.png) | **My invoices**<br>![Portal invoices](docs/screenshots/portal-invoices.png) |

### Sign in

![Login](docs/screenshots/login.png)

## How it works

### Architecture

```mermaid
flowchart LR
    subgraph Client
        UI["React app<br/>admin / staff screens + customer portal"]
    end
    subgraph Server["Express API"]
        MW["Auth + RBAC<br/>validation, errors"]
        MOD["Modules<br/>catalog, subscriptions, billing,<br/>invoices, payments, reports"]
        JOB["Nightly job 00:05<br/>activate, bill, auto-close"]
    end
    DB[("PostgreSQL<br/>via Prisma")]
    MAIL["SMTP / Mailpit"]

    UI -- "REST /api + httpOnly cookie" --> MW --> MOD
    JOB --> MOD
    MOD --> DB
    MOD -- "quotations, invoices,<br/>reset links" --> MAIL
```

### Subscription lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Quotation: send quotation
    Quotation --> Confirmed: customer accepts or staff confirms
    Draft --> Confirmed: staff confirms
    Confirmed --> Active: start date reached or activated
    Active --> Active: pause / resume / renew / switch add-ons
    Active --> Closed: close early or auto-close at expiry
    Draft --> Closed
    Quotation --> Closed
    Confirmed --> Closed
    Closed --> [*]
```

Pause, early close, renewal and auto-close are allowed per plan, according to the plan's flags.

### Invoice lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft: created from subscription
    Draft --> Confirmed: confirm
    Draft --> Cancelled: cancel
    Confirmed --> Paid: payments cover the total
    Confirmed --> Cancelled: cancel (no payments)
    Paid --> [*]
    Cancelled --> [*]
```

### Billing run

```mermaid
sequenceDiagram
    participant T as Nightly job / Run Billing
    participant S as Billing service
    participant D as Database
    T->>S: run(today)
    S->>D: active, unpaused subscriptions with next invoice date <= today
    loop each subscription, each missed period
        S->>S: price lines, apply discounts, add taxes (in paise)
        S->>D: create draft invoice (unique per subscription + period start)
        S->>D: use up discounts, move next invoice date forward
    end
    Note over S,D: A second run finds nothing to bill, so nothing is billed twice
```

### Data model

```mermaid
erDiagram
    CUSTOMER ||--o{ SUBSCRIPTION : has
    CUSTOMER ||--o{ INVOICE : receives
    PLAN ||--o{ SUBSCRIPTION : "sold as"
    PRODUCT ||--o{ PLAN : "priced by"
    PRODUCT ||--o{ PRODUCT_VARIANT : "comes in"
    PRODUCT }o--o{ TAX : "taxed by"
    QUOTATION_TEMPLATE ||--o{ TEMPLATE_LINE : contains
    QUOTATION_TEMPLATE ||--o{ SUBSCRIPTION : "starts"
    PAYMENT_TERM ||--o{ SUBSCRIPTION : "applies to"
    DISCOUNT }o--o{ PRODUCT : "product scope"
    DISCOUNT ||--o{ SUBSCRIPTION : "subscription scope"
    SUBSCRIPTION ||--|{ SUBSCRIPTION_LINE : has
    SUBSCRIPTION ||--o{ SUBSCRIPTION_LOG : "audit trail"
    SUBSCRIPTION ||--o{ INVOICE : "billed as"
    INVOICE ||--|{ INVOICE_LINE : has
    INVOICE ||--o{ PAYMENT : "settled by"
```

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
npx prisma migrate deploy
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

The app runs at `http://localhost:5173`. The sign-in page shows one-click demo-account buttons while developing; set `VITE_SHOW_DEMO_LOGINS=true` to show them in a production build.

### Run everything in containers (optional)

```bash
docker compose --profile app up --build -d
docker compose exec api npm run seed
```

The app is then at `http://localhost:8080` (nginx serves the frontend and proxies `/api` to the API; the API applies database migrations on start). Set `JWT_SECRET` in your environment first; terminate TLS in front of nginx for anything beyond a local demo. Plain `docker compose up -d` still starts only PostgreSQL and Mailpit for local development.

## Configuration

Set these in `backend/.env` (see `.env.example`). Everything has a sensible default except the database and the secret.

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `JWT_SECRET` | required |
| `CLIENT_URL` | public address of the web app, used in e-mail links |
| `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_GSTIN` | printed on invoices; the first two digits of the GSTIN are our state, which decides CGST + SGST versus IGST |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | outgoing e-mail |
| `REMINDERS_ENABLED`, `REMINDER_HOUR`, `REMINDER_BATCH_LIMIT` | automatic reminders: on/off (default on), hour to send (default 9), most e-mails per run (default 500) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | turn on Razorpay checkout |
| `PAYMENT_GATEWAY` | `mock` (built-in test checkout, the default outside production) or `none` |
| `TRUST_PROXY` | number of reverse proxies in front of the API (set to 1 behind nginx) |

### Online payments with Razorpay

1. Create a Razorpay account and copy the **test mode** key id and secret into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. In the Razorpay dashboard add a webhook to `https://<your-host>/api/webhooks/razorpay` for the events `payment.captured`, `order.paid` and `payment.failed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Restart the API. Customers now see **Pay** on a confirmed invoice.

The customer's browser confirms a payment with a signed response and Razorpay confirms it again by webhook; whichever arrives first records it and the other is ignored. If money arrives for an invoice that was settled by hand in the meantime, it is flagged for review (`GET /api/payments/intents?status=REVIEW`) rather than lost or doubled. Outside production the no-money "simulated pay" shortcut stays available only on the test gateway; in production, online payment stays off until keys are set.

The Razorpay integration is covered by tests that replace Razorpay's API with a stub (order creation, signatures, webhooks, retries, forged requests). Run one real test-mode payment before going live.

## Demo accounts

Created by `npm run seed`, together with sample products (including the Odoo brand +560 variant), daily/weekly/monthly/yearly plans, quotation templates, discounts, and subscriptions in every state with invoices (paid, outstanding, overdue and draft) and payments.

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

| Suite | What it covers |
|---|---|
| Unit tests | billing maths, password rule, tax and discount validation, role checks |
| `catalog-subscriptions.test.js` | products, variants, plans, templates, the full subscription lifecycle |
| `features.test.js` | every feature in the brief against a real database: signup, email confirmation and password rules, reset by e-mail (a small SMTP sink stands in for Mailpit), roles, billing catch-up and no double billing, daily/weekly/monthly/yearly periods, pause and resume, plan rules and auto-close, taxes, discounts (limits, dates, minimums), invoices, payments, overdue, reconcile, portal isolation and reports |
| `gst.test.js` | GSTIN rules, CGST/SGST/IGST splitting (including odd paise and cess), invoices through the real billing engine for same-state and other-state customers, HSN/SAC, the GST summary and its CSV |
| `reminders.test.js` | every reminder stage, once only, retries after a failed send, the mail-outage breaker, the per-run cap, renewal reminders |
| `checkout.test.js` | online payments: signatures, the test gateway, a stubbed Razorpay (orders, browser confirmation, webhooks, replays, forged requests), races, and money that cannot be applied |
| `performance.test.js` | every list, search, detail and report endpoint answers in under 2 seconds with thousands of subscriptions |

The database-backed suites need the seeded database and skip themselves when it is not reachable. The performance suite also needs the bulk data below.

The same steps run on every push and pull request in GitHub Actions (`.github/workflows/ci.yml`): create the database from the committed migration, seed it, add 2,500 subscriptions so the performance test runs too, run all tests, and build the frontend.

### Large data set

```bash
npm run seed:bulk            # 3000 subscriptions with invoices and payments
npm run seed:bulk -- 10000   # or choose a size
```

With 5,000 subscriptions and about 40,000 invoices every endpoint responds in under 40 ms.

## Project structure

```
backend/
  prisma/             schema, committed migrations and seed
  src/
    modules/          auth, users, customers, taxes, payment-terms, discounts,
                      products, plans, templates, subscriptions, billing,
                      invoices, payments, reports
    lib/              billing-core (money maths in paise), sequences, mailer
    jobs/             nightly activation, billing and auto-close
    middleware/       auth/RBAC, validation, errors
    tests/
frontend/
  nginx.conf, Dockerfile
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
| `/reports` | summary, revenue by month, GST summary (`/gst-summary`, `/export-gst`) |
| `/reminders` | log of automatic reminders, run them on demand (admin) |
| `/payments/gateway`, `/invoices/:id/checkout` | online payment: which gateway is on, start a payment, confirm it |
| `/webhooks/razorpay` | Razorpay's signed notifications (no login; verified by signature) |
| `/company` | our name, GSTIN and address, and the GST state list |

## GST rules

- Same state as `COMPANY_GSTIN` (customer's state, else the state in their GSTIN, else assumed local): GST is halved into CGST and SGST. Any other state: IGST.
- Taxes marked **Other** (a cess, for example) are charged as they are and never split.
- The split is recorded on every invoice and line at the time it is issued, together with our GSTIN, the place of supply and each product's HSN/SAC, so later changes to a customer or a rate never rewrite history.
- A GSTIN is checked for format and state code (not the check digit, which many test GSTINs fail).

## Billing rules

- Money is calculated in integer paise, so totals never drift.
- Billing periods are counted from the subscription start date (31 Jan, 28 Feb, 31 Mar and so on).
- A unique constraint on subscription and period start makes double billing impossible.
- Invoice and subscription numbers are sequential per year (`INV/2026/00001`, `SUB/2026/00001`).
