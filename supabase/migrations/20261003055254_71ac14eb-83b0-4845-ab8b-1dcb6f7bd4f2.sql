CREATE TABLE public.part_tips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_code text NOT NULL,
  part_name text,
  content text NOT NULL,
  photo_paths text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_part_tips_part_code ON public.part_tips (part_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_tips TO authenticated;
GRANT ALL ON public.part_tips TO service_role;
ALTER TABLE public.part_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read part tips" ON public.part_tips FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can add part tips" ON public.part_tips FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can edit part tips" ON public.part_tips FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete part tips" ON public.part_tips FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER trg_part_tips_updated_at BEFORE UPDATE ON public.part_tips FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_part_tips_modifier BEFORE INSERT OR UPDATE ON public.part_tips FOR EACH ROW EXECUTE FUNCTION set_last_modifier();
-- 부품 사진 저장소 접근 규칙 (버킷은 별도 생성)
CREATE POLICY "Staff can read part photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'part-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can upload part photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'part-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete part photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'part-photos' AND public.is_staff(auth.uid()));