# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:5173
npm run build      # production build
npm run preview    # preview production build
```

## Setup

1. Copy `.env.example` to `.env` and fill in Supabase credentials
2. Run `schema.sql` in the Supabase SQL editor to create the tables
3. `npm install && npm run dev`

## Architecture

**Stack:** Vite + React 18, Tailwind CSS, Supabase JS (no separate backend), Recharts, React Router v6.

**Database (Supabase):**
- `reservations` — one row per booking: `source`, `reservation_id`, `check_in`, `check_out`, `guests`, `total_payout`, `commission`, `discount`
- `expenses` — one row per expense entry: `category`, `amount`, `month` (1–12), `year`

Revenue flow: `total_payout − commission − discount = gross income`, then `gross income − expenses = net income`. This matches the Excel structure (Rendimento Bruto → Rendimento Líquido).

**Pages (`src/pages/`):**
- `Dashboard` — KPI cards, monthly bar chart, source pie chart, recent bookings table
- `Reservations` — full CRUD table filtered by year/month/source; form modal with net preview
- `Expenses` — full CRUD table filtered by year/month/category; sidebar with category breakdown + progress bars
- `Reports` — Excel-style monthly breakdown table (all revenue + expense category rows) + bar charts

**Shared utilities (`src/utils/formatters.js`):**
- `EXPENSE_CATEGORIES` — the canonical list of Portuguese expense categories
- `SOURCES` — `['Airbnb', 'Booking', 'Direct']`
- `formatCurrency` — formats to `pt-PT` locale EUR
- `nightsBetween` — calculates nights from check_in/check_out dates
- `YEAR_OPTIONS` — `[2023..2028]`

**Components:** `Layout` (sidebar + `<Outlet>`), `Modal` (closes on Escape and backdrop click).

## Key conventions

- Revenue attribution: all booking revenue is assigned to the **check_in month**
- All monetary values stored as `DECIMAL(10,2)` in Supabase; parsed with `+value` or `parseFloat` in JS
- Year filter is local state per page (not global); default is `new Date().getFullYear()`
- Supabase client is a singleton in `src/lib/supabase.js`
