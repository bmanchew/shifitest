-- Add openai to log_source enum
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'openai';