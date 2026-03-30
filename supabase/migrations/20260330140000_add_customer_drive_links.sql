-- 고객별 구글 드라이브 폴더 링크 관리
CREATE TABLE public.customer_drive_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text NOT NULL,       -- 예: "융자서류", "수리사진 2024"
  url text NOT NULL,         -- 구글 드라이브 공유 링크
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_drive_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_customer_drive_links"
  ON public.customer_drive_links FOR ALL
  USING (true) WITH CHECK (true);
