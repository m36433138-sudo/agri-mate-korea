CREATE TABLE public.blade_sharpenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  branch text NOT NULL DEFAULT '장흥',
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT '연마대기',
  notes text,
  photo_paths text[] NOT NULL DEFAULT '{}',
  sheet_synced boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blade_sharpenings TO authenticated;
GRANT ALL ON public.blade_sharpenings TO service_role;
ALTER TABLE public.blade_sharpenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage blade sharpenings" ON public.blade_sharpenings
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_blade_sharpenings_modifier BEFORE INSERT OR UPDATE ON public.blade_sharpenings
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier();

CREATE POLICY "Staff read blade photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'blade-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff upload blade photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blade-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete blade photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blade-photos' AND public.is_staff(auth.uid()));