-- 수리 조달/필요사항 메모 테이블
CREATE TABLE public.repair_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch text NOT NULL,         -- "장흥" | "강진"
  row_index integer NOT NULL,   -- 구글시트 행 인덱스 (_rowIndex)
  content text NOT NULL,        -- 조달사항/필요사항 내용
  is_done boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  done_at timestamptz
);

ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_repair_notes"
  ON public.repair_notes FOR ALL
  USING (true) WITH CHECK (true);
