
-- Add bank_pending to application_step enum
ALTER TYPE application_step ADD VALUE IF NOT EXISTS 'bank_pending' AFTER 'bank';

-- Update any existing contracts where micro-deposits are pending
UPDATE contracts 
SET current_step = 'bank_pending' 
WHERE current_step = 'bank' 
AND id IN (
  SELECT contract_id 
  FROM application_progress 
  WHERE step = 'bank' 
  AND data LIKE '%pending_manual_verification%'
);
