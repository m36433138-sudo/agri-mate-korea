-- 기계별 작업기(부착기) 관리 테이블
CREATE TABLE public.machine_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  name text NOT NULL,           -- 작업기명 (로터리, 쟁기 등)
  model text,                   -- 모델명
  serial_number text,           -- 제조번호
  notes text,                   -- 비고
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.machine_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_machine_attachments"
  ON public.machine_attachments FOR ALL
  USING (true) WITH CHECK (true);
