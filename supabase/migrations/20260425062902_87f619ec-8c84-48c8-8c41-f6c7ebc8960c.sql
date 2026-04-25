-- 최근 정비 내역(repair_date DESC, 동순위 시 최근 등록순) 조회 최적화
CREATE INDEX IF NOT EXISTS idx_repairs_repair_date_created_at
  ON public.repairs (repair_date DESC, created_at DESC);