-- Add missing columns to the support_tickets table
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS due_by TIMESTAMP,
ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'within_target',
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS kb_article_ids INTEGER[],
ADD COLUMN IF NOT EXISTS related_tickets INTEGER[];