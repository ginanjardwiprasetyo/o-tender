-- Add attachments column to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
