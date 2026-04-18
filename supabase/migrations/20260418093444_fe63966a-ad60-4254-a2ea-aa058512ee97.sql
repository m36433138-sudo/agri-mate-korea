-- Test: 시급 설정 및 정산 시뮬레이션
UPDATE public.employees SET overtime_hourly_rate = 20000 WHERE name = '유호상';
UPDATE public.employees SET overtime_hourly_rate = 18000 WHERE name = '마성수';
UPDATE public.employees SET overtime_hourly_rate = 18000 WHERE name = '김영일';

-- 유호상 4/13~4/15 (3일치, 450분 = 7.5시간) 정산 처리
WITH yh AS (SELECT id FROM public.employees WHERE name='유호상'),
target_records AS (
  SELECT ar.id, ar.overtime_minutes
  FROM public.attendance_records ar, yh
  WHERE ar.employee_id = yh.id
    AND ar.date BETWEEN '2026-04-13' AND '2026-04-15'
    AND ar.is_settled = false
),
settlement AS (
  INSERT INTO public.overtime_settlements
    (employee_id, period_start, period_end, total_overtime_minutes, hourly_rate, bonus_amount, total_payment, notes)
  SELECT yh.id, '2026-04-13', '2026-04-15',
    (SELECT COALESCE(SUM(overtime_minutes),0) FROM target_records),
    20000, 0,
    ROUND((SELECT COALESCE(SUM(overtime_minutes),0) FROM target_records) / 60.0 * 20000),
    'TEST_AUTO_SETTLEMENT'
  FROM yh
  RETURNING id
)
UPDATE public.attendance_records
SET is_settled = true
WHERE id IN (SELECT id FROM target_records);