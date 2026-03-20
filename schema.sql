-- ============================================================
-- Rental Manager — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS reservations (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  source          VARCHAR(50)   NOT NULL,          -- 'Airbnb' | 'Booking' | 'Direct'
  reservation_id  VARCHAR(100),                    -- platform booking ID
  guest_name      VARCHAR(200),                    -- guest full name
  check_in        DATE          NOT NULL,
  check_out       DATE          NOT NULL,
  guests          INTEGER       DEFAULT 1,
  total_payout    DECIMAL(10,2) NOT NULL DEFAULT 0, -- gross amount charged to guest
  commission      DECIMAL(10,2) DEFAULT 0,          -- platform commission (incl. VAT)
  discount        DECIMAL(10,2) DEFAULT 0,          -- discounts applied
  notes           TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  category    VARCHAR(100)  NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  month       INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER       NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Optional: disable RLS for internal single-user app
-- ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- If you want RLS enabled with open access (no auth):
-- ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow all" ON reservations FOR ALL USING (true) WITH CHECK (true);
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow all" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- Migration: add guest_name column (run if table already exists)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_name VARCHAR(200);

-- Migration: add paid column
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;
