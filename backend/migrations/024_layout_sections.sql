-- 024: struktur section GDocs per template → render multi-segment
-- [{anchor, orient, mt, mr, mb, ml}] — anchor = teks normalisasi paragraf awal section NEXT_PAGE
ALTER TABLE templates ADD COLUMN IF NOT EXISTS layout_sections JSONB;
