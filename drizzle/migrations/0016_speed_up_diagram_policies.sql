DROP POLICY IF EXISTS "staff manage diagrams" ON public.diagrams;
CREATE POLICY "staff manage diagrams" ON public.diagrams
  FOR ALL TO authenticated
  USING ((SELECT public.is_staff((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_staff((SELECT auth.uid()))));

DROP POLICY IF EXISTS "staff manage diagram hotspots" ON public.diagram_hotspots;
CREATE POLICY "staff manage diagram hotspots" ON public.diagram_hotspots
  FOR ALL TO authenticated
  USING ((SELECT public.is_staff((SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_staff((SELECT auth.uid()))));