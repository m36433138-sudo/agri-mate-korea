
ALTER TABLE public.attachment_catalog
  ADD COLUMN IF NOT EXISTS rotary_blade_options text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.machine_attachments
  ADD COLUMN IF NOT EXISTS rotary_blade text;
