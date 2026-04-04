
-- 작업현황판 수리 임시저장 테이블
CREATE TABLE public.operation_repair_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL,
  row_index integer NOT NULL,
  customer_name text,
  machine_type text,
  model text,
  technician text,
  description text,
  labor_cost integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_finalized boolean DEFAULT false,
  UNIQUE(branch, row_index)
);

-- 임시저장 부품 테이블
CREATE TABLE public.operation_repair_draft_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES public.operation_repair_drafts(id) ON DELETE CASCADE NOT NULL,
  part_code varchar,
  part_name varchar NOT NULL,
  quantity integer DEFAULT 1,
  unit_price integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.operation_repair_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_repair_draft_parts ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Admin/employee access operation_repair_drafts"
ON public.operation_repair_drafts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Admin/employee access operation_repair_draft_parts"
ON public.operation_repair_draft_parts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));
