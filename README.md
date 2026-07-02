# LabTrack — Laboratory Consumables Management System

A full-stack web application for tracking laboratory consumables from the store to the hospital.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, TanStack Query, Recharts, React Router v6
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Auth**: JWT (JSON Web Tokens)
- **Reports**: ExcelJS (Excel export)

---

## Prerequisites

- Node.js v18+
- PostgreSQL 14+
- npm or yarn

---

## Quick Start

### 1. Database Setup

```sql
-- In psql or pgAdmin:
CREATE DATABASE labtrack;
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials

npm install

# Run migrations (creates all tables)
npm run db:migrate

# Seed default data (45 consumables + admin user)
npm run db:seed

# Start development server
npm run dev
```

Backend runs on: `http://localhost:5000`

Default admin credentials:
- Username: `admin`
- Password: `admin123`

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api

npm install
npm run dev
```

Frontend runs on: `http://localhost:3000`

---

## Features

### Inventory Management
- 45 pre-loaded laboratory consumables across 10 categories
- Add, edit, delete consumables
- Search and filter by category and stock status
- Real-time stock balance (auto-updates on dispatch/receive)

### Dispatch to Hospital
- Log every dispatch with destination ward/department
- Staff name, notes, date/time recorded
- Stock automatically subtracted on confirm
- Cannot dispatch more than available stock

### Receive Stock
- Log incoming stock from suppliers
- Invoice/reference number tracking
- Stock automatically added on confirm

### Reports (Daily / Weekly / Monthly / Yearly)
- Summary statistics
- Bar charts by item and category
- Pie chart by category
- Breakdown by destination ward
- Export to Excel (.xlsx)

### Alerts
- Out-of-stock items highlighted
- Low stock items (below minimum level)
- One-click receive from alert screen

### Categories
- Hematology, Chemistry, Microbiology, Immunology
- Serology, Urinalysis, Histology, Blood Bank
- Molecular, General

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Current user |

### Consumables
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/consumables` | List all (supports ?search, ?category, ?status) |
| POST | `/api/consumables` | Create |
| PUT | `/api/consumables/:id` | Update |
| DELETE | `/api/consumables/:id` | Delete |
| GET | `/api/consumables/categories` | All categories |
| GET | `/api/consumables/dashboard` | Dashboard stats |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dispatch` | Dispatch consumable |
| GET | `/api/dispatch` | Dispatch logs (supports ?from, ?to, ?destination) |
| POST | `/api/receive` | Receive stock |
| GET | `/api/receive` | Receive logs |
| GET | `/api/reports` | Reports (supports ?period: daily/weekly/monthly/yearly) |
| GET | `/api/reports/export` | Export Excel |

---

## Database Schema

```
users           — id, name, email, password, role
categories      — id, name, description
consumables     — id, name, category_id, unit, stock, min_stock, price
dispatch_logs   — id, consumable_id, quantity, destination, dispatched_by, notes, dispatched_at
receive_logs    — id, consumable_id, quantity, supplier, received_by, invoice_ref, received_at
```

---

## Production Build

```bash
# Frontend
cd frontend && npm run build

# Serve frontend build with Express (add to backend):
# app.use(express.static('../frontend/dist'));
```

---

## Environment Variables

### Backend `.env`
```
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/labtrack
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:5000/api
```
