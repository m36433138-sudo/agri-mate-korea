-- 작업현황판 행 테이블
CREATE TABLE IF NOT EXISTS public.operation_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL CHECK (branch IN ('장흥','강진')),
  row_index integer NOT NULL,
  source_tab text NOT NULL DEFAULT 'active' CHECK (source_tab IN ('active','archive')),
  status_label text,
  customer_name text,
  machine text,
  model text,
  phone text,
  address text,
  location text,
  technician text,
  requirements text,
  serial_number text,
  entry_date text,
  repair_start_date text,
  repair_done_date text,
  dispatch_date text,
  contacted text,
  contact_note text,
  is_completed boolean NOT NULL DEFAULT false,
  notes text,
  writer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch, source_tab, row_index)
);

CREATE INDEX IF NOT EXISTS idx_operation_rows_branch ON public.operation_rows(branch);
CREATE INDEX IF NOT EXISTS idx_operation_rows_completed ON public.operation_rows(is_completed);
CREATE INDEX IF NOT EXISTS idx_operation_rows_technician ON public.operation_rows(technician);
CREATE INDEX IF NOT EXISTS idx_operation_rows_status ON public.operation_rows(status_label);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.update_operation_rows_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operation_rows_updated_at ON public.operation_rows;
CREATE TRIGGER trg_operation_rows_updated_at
BEFORE UPDATE ON public.operation_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_operation_rows_updated_at();

-- RLS
ALTER TABLE public.operation_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/employee access operation_rows"
ON public.operation_rows
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

-- Realtime
ALTER TABLE public.operation_rows REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_rows;