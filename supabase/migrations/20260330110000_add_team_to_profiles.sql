-- profiles 테이블에 팀 컬럼 추가 (영업팀 | 기사팀 | 사무팀)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team text;
