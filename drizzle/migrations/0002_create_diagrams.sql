CREATE TABLE public.diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  model_name TEXT,
  machine_type TEXT,
  notes TEXT,
  image_path TEXT NOT NULL,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagrams TO authenticated;
GRANT ALL ON public.diagrams TO service_role;
ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage diagrams" ON public.diagrams FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER set_last_modifier_diagrams BEFORE INSERT OR UPDATE ON public.diagrams
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modifier();

CREATE TABLE public.diagram_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id UUID NOT NULL REFERENCES public.diagrams(id) ON DELETE CASCADE,
  part_code TEXT NOT NULL,
  part_name TEXT,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  w NUMERIC NOT NULL,
  h NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagram_hotspots TO authenticated;
GRANT ALL ON public.diagram_hotspots TO service_role;
ALTER TABLE public.diagram_hotspots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage diagram hotspots" ON public.diagram_hotspots FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX diagram_hotspots_diagram_idx ON public.diagram_hotspots(diagram_id);

CREATE POLICY "staff read diagram images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'diagram-images' AND public.is_staff(auth.uid()));
CREATE POLICY "staff upload diagram images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diagram-images' AND public.is_staff(auth.uid()));
CREATE POLICY "staff delete diagram images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'diagram-images' AND public.is_staff(auth.uid()));