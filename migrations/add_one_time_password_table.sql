-- Add one_time_passwords table for customer authentication
CREATE TABLE IF NOT EXISTS one_time_passwords (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  email TEXT,
  otp TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'authentication',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  user_agent TEXT
);

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_one_time_passwords_phone ON one_time_passwords(phone);

-- Create index on otp for faster verification lookups
CREATE INDEX IF NOT EXISTS idx_one_time_passwords_otp ON one_time_passwords(otp);