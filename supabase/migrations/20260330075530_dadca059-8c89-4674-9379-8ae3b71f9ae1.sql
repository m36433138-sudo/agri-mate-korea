ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS manufacturer text DEFAULT '얀마';
UPDATE public.machines SET manufacturer = '얀마' WHERE manufacturer IS NULL;