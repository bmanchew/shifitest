-- Add smart contract type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smart_contract_type') THEN
        CREATE TYPE smart_contract_type AS ENUM (
            'custom',
            'standard_financing',
            'zero_interest_financing',
            'merchant_specific'
        );
    END IF;
END$$;

-- Create smart_contract_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS smart_contract_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contract_type smart_contract_type NOT NULL,
    abi JSONB NOT NULL,
    bytecode TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create smart_contract_deployments table if it doesn't exist
CREATE TABLE IF NOT EXISTS smart_contract_deployments (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES smart_contract_templates(id),
    contract_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    network_id INTEGER NOT NULL,
    deployed_at TIMESTAMP DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_smart_contract_deployments_template_id ON smart_contract_deployments(template_id);
CREATE INDEX IF NOT EXISTS idx_smart_contract_deployments_contract_address ON smart_contract_deployments(contract_address);