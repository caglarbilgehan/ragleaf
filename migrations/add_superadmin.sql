-- Add is_superadmin column to users table
-- Run this migration on production before deploying the new code

-- Add the column (default false, so existing users are unaffected)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Set the first admin user as superadmin (adjust the email as needed)
-- UPDATE users SET is_superadmin = TRUE WHERE is_admin = TRUE AND id = 1;

-- Verify
SELECT id, email, is_admin, is_superadmin, default_org_id FROM users LIMIT 10;
