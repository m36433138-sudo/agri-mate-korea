-- machines 테이블 조회 성능을 위한 인덱스 추가
-- entry_date: 재고중 + 최근 입고 정렬 쿼리 가속 (대시보드 "최근 입고")
CREATE INDEX IF NOT EXISTS idx_machines_status_entry_date
  ON public.machines (status, entry_date DESC);

-- sale_date: 월별 판매 통계 집계 가속 (sale_date IS NOT NULL인 행만)
CREATE INDEX IF NOT EXISTS idx_machines_sale_date
  ON public.machines (sale_date DESC)
  WHERE sale_date IS NOT NULL;