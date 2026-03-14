
-- Create parts table
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_name text NOT NULL,
  part_number text UNIQUE NOT NULL,
  unit text DEFAULT '개',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to parts" ON public.parts FOR ALL TO public USING (true) WITH CHECK (true);

-- Create repair_templates table
CREATE TABLE public.repair_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to repair_templates" ON public.repair_templates FOR ALL TO public USING (true) WITH CHECK (true);

-- Create repair_template_items table
CREATE TABLE public.repair_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.repair_templates(id) ON DELETE CASCADE NOT NULL,
  part_id uuid REFERENCES public.parts(id) NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  notes text
);

ALTER TABLE public.repair_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to repair_template_items" ON public.repair_template_items FOR ALL TO public USING (true) WITH CHECK (true);

-- Create repairs table (new schema with labor_cost, total_cost)
CREATE TABLE public.repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES public.machines(id) NOT NULL,
  repair_date date NOT NULL,
  repair_content text NOT NULL,
  technician text,
  labor_cost integer DEFAULT 0,
  total_cost integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to repairs" ON public.repairs FOR ALL TO public USING (true) WITH CHECK (true);

-- Create repair_parts table
CREATE TABLE public.repair_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid REFERENCES public.repairs(id) ON DELETE CASCADE NOT NULL,
  part_id uuid REFERENCES public.parts(id) NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  notes text
);

ALTER TABLE public.repair_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to repair_parts" ON public.repair_parts FOR ALL TO public USING (true) WITH CHECK (true);

-- Migrate existing repair_history data to repairs table
INSERT INTO public.repairs (machine_id, repair_date, repair_content, technician, labor_cost, total_cost, notes, created_at)
SELECT machine_id, repair_date, repair_content, technician, COALESCE(cost, 0), COALESCE(cost, 0), parts_used, created_at
FROM public.repair_history;
