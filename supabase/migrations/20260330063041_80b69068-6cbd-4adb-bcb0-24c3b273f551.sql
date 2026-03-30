
-- 1. machine_attachments 테이블
CREATE TABLE public.machine_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  name text NOT NULL,
  model text,
  serial_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.machine_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/employee access machine_attachments" ON public.machine_attachments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee'));

-- 2. employees 테이블
CREATE TABLE public.employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  address text,
  resident_number text,
  team text,
  position text,
  salary integer,
  join_date date,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access employees" ON public.employees
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
