-- Update plaid_merchant record if it exists
UPDATE plaid_merchants
SET client_id = 'client_id_test',
    access_token = 'access-sandbox-test-token-12345',
    onboarding_status = 'completed',
    updated_at = NOW()
WHERE merchant_id = 46;

-- Insert new record if no matching record exists
INSERT INTO plaid_merchants (merchant_id, client_id, access_token, onboarding_status, created_at, updated_at)
SELECT 46, 'client_id_test', 'access-sandbox-test-token-12345', 'completed', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM plaid_merchants WHERE merchant_id = 46);

-- Verify the update/insert
SELECT * FROM plaid_merchants WHERE merchant_id = 46;