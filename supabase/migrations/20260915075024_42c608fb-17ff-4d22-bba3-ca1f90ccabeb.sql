CREATE TABLE public.machine_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  original_size bigint,
  compressed_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_photos TO authenticated;
GRANT ALL ON public.machine_photos TO service_role;

ALTER TABLE public.machine_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view machine photos"
ON public.machine_photos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role));

CREATE POLICY "Staff can upload machine photos"
ON public.machine_photos FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role))
);

CREATE POLICY "Staff can delete machine photos"
ON public.machine_photos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role));

CREATE INDEX machine_photos_machine_id_created_at_idx
ON public.machine_photos(machine_id, created_at DESC);

CREATE TRIGGER set_machine_photos_updated_at
BEFORE UPDATE ON public.machine_photos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Staff can read machine photo files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'machine-photos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role))
);

CREATE POLICY "Staff can upload machine photo files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'machine-photos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role))
);

CREATE POLICY "Staff can delete machine photo files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'machine-photos'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role))
);