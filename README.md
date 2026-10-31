# LoopBill — Subscription Management System

LoopBill runs Brightloop's subscription business in one web app.

## Project Structure
- `backend/`: Node.js Express API + Prisma ORM + PostgreSQL
- `frontend/`: React + Vite + Tailwind CSS

## Requirements
- Node.js 22 LTS
- PostgreSQL 16 (or Docker Compose)

## Getting Started
1. Start PostgreSQL (e.g. via `docker compose up -d` or native local PostgreSQL)
2. Setup backend:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma migrate dev
   npm run seed
   npm test
   npm run dev
   ```

## Dev C - Hour 1 Milestones
- Pure business logic in `src/lib/billing-core.js` (no floating-point drift, all calculations in paise, timezone-safe IST dates)
- 11 unit tests in `src/tests/billing-core.test.js` passing (`npm test`)
- Atomic per-year sequence generator in `src/lib/sequence.js`
- Base seed data initialized in `prisma/seed.js`
