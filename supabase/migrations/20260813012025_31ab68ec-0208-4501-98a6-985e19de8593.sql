ALTER TABLE public.insurance_repair_photos
  DROP CONSTRAINT IF EXISTS insurance_repair_photos_kind_check;

ALTER TABLE public.insurance_repair_photos
  ADD CONSTRAINT insurance_repair_photos_kind_check
  CHECK (kind IN ('수리전','수리후','기타','견적서'));

ALTER TABLE public.insurance_repair_photos
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text;