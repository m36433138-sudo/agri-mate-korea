-- Workspace Module: tasks, logs, documents, finance_records

-- profiles RLS 추가: 직원도 다른 직원 display_name 열람 가능 (과제 배정 표시용)
CREATE POLICY "직원 프로필 열람" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'employee')
  );

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,        -- 담당자
  created_by uuid REFERENCES auth.users(id) NOT NULL,     -- 생성자
  title text NOT NULL,
  description text,
  category text CHECK (category IN (
    'repair','sales','parts','quotation','admin','finance','other'
  )) DEFAULT 'other',
  priority text CHECK (priority IN ('high','medium','low')) DEFAULT 'medium',
  status text CHECK (status IN ('todo','in_progress','done')) DEFAULT 'todo',
  due_date date,
  related_customer_id uuid REFERENCES public.customers(id),
  related_machine_id uuid REFERENCES public.machines(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks 읽기" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
    OR auth.uid() = created_by
  );

CREATE POLICY "tasks 작성" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tasks 수정" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
    OR auth.uid() = created_by
  );

CREATE POLICY "tasks 삭제" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR auth.uid() = created_by
  );

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_customer ON public.tasks(related_customer_id);

-- ============================================================
-- LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_by uuid REFERENCES auth.users(id) NOT NULL,
  log_type text CHECK (log_type IN (
    'call','visit','sms','kakao','repair_work','internal','other'
  )) NOT NULL,
  log_date timestamptz DEFAULT now(),
  title text NOT NULL,
  content text,
  related_customer_id uuid REFERENCES public.customers(id),
  related_machine_id uuid REFERENCES public.machines(id),
  related_task_id uuid REFERENCES public.tasks(id),
  next_action text,
  next_action_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- 팀 전체 읽기 (고객 히스토리 공유)
CREATE POLICY "로그 팀 열람" ON public.logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "로그 작성" ON public.logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = logged_by);

CREATE POLICY "로그 수정" ON public.logs
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = logged_by);

CREATE POLICY "로그 삭제" ON public.logs
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = logged_by);

CREATE INDEX idx_logs_logged_by ON public.logs(logged_by);
CREATE INDEX idx_logs_log_date ON public.logs(log_date DESC);
CREATE INDEX idx_logs_customer ON public.logs(related_customer_id);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  doc_type text CHECK (doc_type IN (
    'quotation','order','subsidy','tax_invoice','purchase'
  )) NOT NULL,
  title text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  machine_id uuid REFERENCES public.machines(id),
  amount numeric(14,0),
  issued_date date DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL,
  notes text,
  file_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 팀 전체 읽기
CREATE POLICY "문서 팀 열람" ON public.documents
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "문서 작성" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "문서 수정" ON public.documents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE POLICY "문서 삭제" ON public.documents
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE INDEX idx_documents_created_by ON public.documents(created_by);
CREATE INDEX idx_documents_customer ON public.documents(customer_id);
CREATE INDEX idx_documents_doc_type ON public.documents(doc_type);
CREATE INDEX idx_documents_valid_until ON public.documents(valid_until);

-- ============================================================
-- FINANCE_RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  record_type text CHECK (record_type IN ('receivable','payment','refund')) NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  document_id uuid REFERENCES public.documents(id),
  amount numeric(14,0) NOT NULL,
  due_date date,
  paid_date date,
  is_paid boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;

-- 팀 전체 읽기
CREATE POLICY "재무 팀 열람" ON public.finance_records
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "재무 작성" ON public.finance_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "재무 수정" ON public.finance_records
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE POLICY "재무 삭제" ON public.finance_records
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE INDEX idx_finance_customer ON public.finance_records(customer_id);
CREATE INDEX idx_finance_is_paid ON public.finance_records(is_paid);
CREATE INDEX idx_finance_due_date ON public.finance_records(due_date);
