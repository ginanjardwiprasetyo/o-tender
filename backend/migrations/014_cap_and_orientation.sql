-- TenderBuild — 014: setting cap di master perusahaan + orientasi kertas template
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cap_size INT DEFAULT 110;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cap_pos TEXT DEFAULT 'kiri';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS orientation TEXT DEFAULT 'portrait';
