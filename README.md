# LoopBill — Subscription Management System

> Problem statement: *"Subscription Management System — Build one system to run plans, subscriptions and recurring billing in one place."* (Brightloop Software)

LoopBill runs Brightloop's subscription business in one web app:
- **Catalog** — products (with variants), recurring plans, taxes, discounts, payment terms
- **Sales** — quotation templates → subscriptions with a clear Draft → Quotation → Confirmed → Active → Closed flow
- **Billing** — one click (or the nightly job) creates every due invoice, with taxes and discounts filled in
- **Collections** — payments recorded against invoices; paid, outstanding and overdue visible at all times
- **Reporting** — active subscriptions, MRR/ARR, revenue collected, amount owed, overdue — with filters
- **Customer portal** — customers see and manage their own subscriptions and invoices

---

## Architecture & Technology Stack

- **Runtime**: Node.js 22 LTS
- **API**: Express 5
- **ORM & Database**: Prisma 6 (`@prisma/client@6`), PostgreSQL 16
- **Validation**: Zod 3
- **Authentication**: bcryptjs + jsonwebtoken in httpOnly cookies (RBAC: ADMIN, STAFF, CUSTOMER)
- **Email**: Nodemailer (configured for Mailpit local inbox or SMTP)
- **Frontend**: React 19 + Vite, TanStack Query 5, React Hook Form, Tailwind CSS 4, Recharts, Lucide

---

## Getting Started

### 1. Prerequisites
- Node.js 22 LTS
- Docker & Docker Compose (or local PostgreSQL 16)

### 2. Start Services
```bash
docker compose up -d
```
Starts:
- PostgreSQL on `localhost:5432`
- Mailpit web UI on `http://localhost:8025` (SMTP port 1025)

### 3. Setup Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm test
npm run dev
```
Backend runs at `http://localhost:5000`.

### 4. Setup Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

---

## Demo Accounts (Seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@brightloop.in | `Admin@12345` |
| Staff | staff@brightloop.in | `Staff@12345` |
| Customer (Portal) | riya@sharmaretail.in | `Customer@123` |

---

## 8-Hour Development Plan & Ownership

- **Developer A (Identity, Customers, Configuration, Portal UI, Repo & DB Owner)**
  - Auth (signup, login, logout, me, forgot/reset password with secure tokens)
  - RBAC middleware (`requireAuth`, `requireRole`, `ownScope`)
  - User and Customer management
  - Taxes and Payment terms configuration
  - Customer Self-Service Portal
- **Developer B (Catalog & Subscriptions)**
  - Products with variants, Plans, Quotation templates
  - Subscriptions lifecycle (Draft → Quotation → Confirmed → Active → Closed)
  - Add-ons management and frontend subscription forms
- **Developer C (Billing, Money & Reports)**
  - Pure billing math core (`billing-core.js`) with 100% precision in paise
  - Billing engine and scheduled cron catch-up jobs
  - Invoices and Payment recording
  - Real-time reporting and financial metrics (MRR, ARR, overdue)

---

## Milestones Log

### Hour 1 (Foundation)
- **Developer A**:
  - Full repo scaffold & architecture
  - Prisma schema validation & client generation
  - Express 5 app layout with router stubs for all modules
  - Auth API (`/signup`, `/login`, `/logout`, `/me`, `/forgot-password`, `/reset-password`)
  - RBAC (`requireAuth`, `requireRole`, `ownScope`) & error handling
  - Frontend shell with React 19, Tailwind CSS 4, AuthContext, RequireRole, and responsive AppLayout & PortalLayout
  - Auth UI pages (Login, Signup with live security checklist, ForgotPassword, ResetPassword)
  - Full test suite passing (18/18 tests pass)
- **Developer C**:
  - `billing-core.js` with pure math engine in paise
  - 11 initial billing core unit tests passing
  - `sequence.js` atomic sequential number generation
  - Base seed definition in `prisma/seed.js`
