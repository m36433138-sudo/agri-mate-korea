ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'diagram';
ALTER TABLE public.diagrams ADD CONSTRAINT diagrams_kind_check CHECK (kind IN ('diagram','photo'));
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.diagram_hotspots ADD COLUMN IF NOT EXISTS target_diagram_id uuid REFERENCES public.diagrams(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS diagram_hotspots_target_idx ON public.diagram_hotspots(target_diagram_id);
CREATE INDEX IF NOT EXISTS diagrams_model_idx ON public.diagrams(model_name, kind, sort_order);