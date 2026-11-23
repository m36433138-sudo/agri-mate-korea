-- 입금 문자 받은 기록: 휴대폰 전달 앱이 보낸 요청을 결과(저장·입금 문자 아님·키 틀림·중복)와 함께 남긴다.
-- 「보냈다는데 안 들어왔다」를 휴대폰 문제인지 앱 문제인지 바로 가릴 수 있게. 30일 지난 기록은 함수가 지운다.
CREATE TABLE public.deposit_sms_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('saved','duplicate','not_deposit','unauthorized','empty','test','error')),
  raw_text text,
  content_type text,
  body_keys text,
  deposit_id uuid REFERENCES public.bank_deposits(id) ON DELETE SET NULL
);
CREATE INDEX deposit_sms_inbox_received_idx ON public.deposit_sms_inbox (received_at DESC);

GRANT SELECT ON public.deposit_sms_inbox TO authenticated;
GRANT ALL ON public.deposit_sms_inbox TO service_role;
ALTER TABLE public.deposit_sms_inbox ENABLE ROW LEVEL SECURITY;

-- 설정 화면과 같은 범위: 관리자만 본다 (쓰기는 서버 함수만)
CREATE POLICY "admins read deposit sms inbox" ON public.deposit_sms_inbox FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));
