-- =========================================================================
-- SHREE GANESH JEWELLERS — FRESH SQL SCHEMA MIGRATION
-- =========================================================================
-- Copy and paste this script into your Supabase SQL Editor and click 'Run'.
-- This resets any existing tables and prepares the clean schema for all modules.
--
-- IMPORTANT (EXISTING SYSTEMS MIGRATION):
-- If you are updating an existing database and want to preserve your data,
-- DO NOT RUN THIS ENTIRE SCRIPT. Instead, copy and run these lines in your SQL Editor:
-- ALTER TABLE gold_loans ADD COLUMN IF NOT EXISTS repayment_method TEXT DEFAULT 'bullet';
-- ALTER TABLE urd_transactions ADD COLUMN IF NOT EXISTS payment_mode TEXT;
-- ALTER TABLE urd_transactions ADD COLUMN IF NOT EXISTS narration TEXT;
-- =========================================================================

-- 1. DROP EXISTING TABLES IN CASCADE SEQUENCE
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS gold_loans CASCADE;
DROP TABLE IF EXISTS scheme_payments CASCADE;
DROP TABLE IF EXISTS saving_schemes CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bill_items CASCADE;
DROP TABLE IF EXISTS urd_transactions CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS gold_rates CASCADE;

-- 2. CREATE SCHEMAS

-- Customer Profiles
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    address TEXT,
    pan_number TEXT,
    gst_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_customers_phone ON customers(phone);

-- Showroom Stock Inventory
CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_number TEXT UNIQUE NOT NULL,
    ornament_name TEXT NOT NULL,
    metal_type TEXT NOT NULL, -- 'gold' | 'silver'
    weight NUMERIC(8,3) NOT NULL,
    hsn_code TEXT,
    purity TEXT NOT NULL, -- '22KT' | '18KT' | '14KT' | '24KT' | '925 silver'
    quantity INTEGER DEFAULT 1,
    status TEXT DEFAULT 'available', -- 'available' | 'sold'
    added_date DATE DEFAULT CURRENT_DATE,
    label_printed BOOLEAN DEFAULT false
);

-- Invoices / Bills
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT UNIQUE NOT NULL, -- Format: SG-YYYY-XXXX (computed dynamically)
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    bill_date DATE NOT NULL,
    print_gst BOOLEAN DEFAULT true,
    subtotal NUMERIC(10,2) NOT NULL, -- Items total before GST
    gst_amount NUMERIC(10,2) DEFAULT 0, -- Total computed GST (3% on Gold)
    exchange_deduction NUMERIC(10,2) DEFAULT 0, -- Deductions from URD trade-ins
    total_amount NUMERIC(10,2) NOT NULL, -- Net payable = subtotal + gst - exchange
    payment_status TEXT DEFAULT 'paid', -- 'paid' | 'partial' | 'unpaid'
    amount_paid NUMERIC(10,2) DEFAULT 0,
    balance_due NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_bills_number ON bills(bill_number);

-- Bill Line Items (Individual ornaments on invoice)
CREATE TABLE bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stock(id) ON DELETE SET NULL,
    item_number TEXT,
    ornament_name TEXT NOT NULL,
    metal_type TEXT NOT NULL, -- 'gold' | 'silver'
    gross_weight NUMERIC(8,3) NOT NULL,
    stone_weight NUMERIC(8,3) DEFAULT 0,
    net_weight NUMERIC(8,3) NOT NULL,
    hsn_code TEXT,
    per_gram_rate NUMERIC(10,2) NOT NULL,
    making_charges_percent NUMERIC(5,2) DEFAULT 0,
    other_charges NUMERIC(10,2) DEFAULT 0,
    labour_per_gram NUMERIC(10,2) DEFAULT 0, -- Used for Silver charges
    item_total NUMERIC(10,2) NOT NULL,
    gst_rate NUMERIC(4,2) DEFAULT 3.00
);

-- Payment Installments (Split payments)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_mode TEXT NOT NULL, -- 'cash' | 'upi' | 'netbanking' | 'card'
    payment_date TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);

-- URD Buyback / Old Gold Exchange Transactions
CREATE TABLE urd_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(id) ON DELETE SET NULL, -- Null if straight cash buyback
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'exchange' | 'buyback'
    metal_type TEXT NOT NULL, -- 'gold' | 'silver'
    purity TEXT NOT NULL,
    weight NUMERIC(8,3) NOT NULL,
    rate_per_gram NUMERIC(10,2) NOT NULL,
    total_value NUMERIC(10,2) NOT NULL,
    payment_mode TEXT,
    narration TEXT,
    urd_bill_number TEXT,
    transaction_date TIMESTAMPTZ DEFAULT now()
);

-- Customer Saving Schemes
CREATE TABLE saving_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number TEXT UNIQUE NOT NULL, -- Format: SGS-YYYY-XXX
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    monthly_amount NUMERIC(10,2) NOT NULL,
    start_date DATE NOT NULL,
    reminder_day INTEGER DEFAULT 5, -- Day of month to send reminder (1-28)
    status TEXT DEFAULT 'active', -- 'active' | 'matured' | 'closed'
    maturity_interest NUMERIC(10,2) DEFAULT 0,
    total_saved NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12-Month Scheme Deposits
CREATE TABLE scheme_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID REFERENCES saving_schemes(id) ON DELETE CASCADE,
    month_number INTEGER NOT NULL, -- 1 to 12
    month_label TEXT NOT NULL, -- e.g., 'June 2026'
    amount_paid NUMERIC(10,2),
    payment_mode TEXT,
    payment_date DATE,
    is_paid BOOLEAN DEFAULT false
);

-- Gold Mortgage Loans
CREATE TABLE gold_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_number TEXT UNIQUE NOT NULL, -- Format: SGL-YYYY-XXX
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    gold_weight NUMERIC(8,3) NOT NULL,
    gold_purity TEXT NOT NULL,
    appraised_value NUMERIC(10,2) NOT NULL,
    loan_amount NUMERIC(10,2) NOT NULL,
    interest_rate NUMERIC(5,2) DEFAULT 12.00, -- Annual %
    loan_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'active', -- 'active' | 'closed' | 'overdue'
    total_repaid NUMERIC(10,2) DEFAULT 0,
    repayment_method TEXT DEFAULT 'bullet',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Gold Loan Repayments
CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES gold_loans(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_mode TEXT NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT
);

-- Daily Gold/Silver Bazar Rates
CREATE TABLE gold_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate24k NUMERIC(10,2) NOT NULL,
    rate22k NUMERIC(10,2) NOT NULL,
    rate18k NUMERIC(10,2) NOT NULL,
    rate_silver NUMERIC(10,2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE urd_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saving_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users access" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON bills FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON bill_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON urd_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON saving_schemes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON scheme_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON gold_loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON loan_repayments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users access" ON gold_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. SEED INITIAL DAILY BAZAR GOLD RATES
INSERT INTO gold_rates (rate24k, rate22k, rate18k, rate_silver) VALUES (76500.00, 70150.00, 57380.00, 920.00);
