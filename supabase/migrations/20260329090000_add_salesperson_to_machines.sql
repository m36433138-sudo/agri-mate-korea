-- machines 테이블에 영업사원 컬럼 추가
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS salesperson text;
