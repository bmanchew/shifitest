-- Add sales rep related tables
-- This script adds tables for sales representatives, commissions, and analytics

-- Create commission_rate_type enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_rate_type') THEN
        CREATE TYPE commission_rate_type AS ENUM (
            'percentage',
            'fixed'
        );
    END IF;
END $$;

-- Create the sales_reps table
CREATE TABLE IF NOT EXISTS sales_reps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    merchant_id INTEGER NOT NULL REFERENCES merchants(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    title VARCHAR(100),
    commission_rate DECIMAL(10, 2),
    commission_rate_type commission_rate_type DEFAULT 'percentage',
    max_allowed_finance_amount DECIMAL(12, 2),
    target DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the commissions table to track earnings on contracts
CREATE TABLE IF NOT EXISTS commissions (
    id SERIAL PRIMARY KEY,
    sales_rep_id INTEGER NOT NULL REFERENCES sales_reps(id),
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    amount DECIMAL(12, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    rate_type commission_rate_type NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
    paid_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the sales_rep_analytics table for performance tracking
CREATE TABLE IF NOT EXISTS sales_rep_analytics (
    id SERIAL PRIMARY KEY,
    sales_rep_id INTEGER NOT NULL REFERENCES sales_reps(id),
    period VARCHAR(20) NOT NULL, -- daily, weekly, monthly, quarterly, yearly
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    contracts_count INTEGER NOT NULL DEFAULT 0,
    contracts_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
    commission_earned DECIMAL(12, 2) NOT NULL DEFAULT 0,
    commission_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
    target_achievement_percentage DECIMAL(5, 2) DEFAULT 0,
    average_contract_value DECIMAL(12, 2) DEFAULT 0,
    performance_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sales_rep_id, period, period_start_date)
);

-- Add sales_rep_id to contracts table if it doesn't exist already
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contracts' 
        AND column_name = 'sales_rep_id'
    ) THEN
        ALTER TABLE contracts 
        ADD COLUMN sales_rep_id INTEGER REFERENCES sales_reps(id);
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_reps_merchant_id ON sales_reps(merchant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_sales_rep_id ON commissions(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_commissions_contract_id ON commissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_sales_rep_analytics_sales_rep_id ON sales_rep_analytics(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_contracts_sales_rep_id ON contracts(sales_rep_id);