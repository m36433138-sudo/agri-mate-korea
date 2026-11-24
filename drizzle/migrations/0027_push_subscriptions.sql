-- 휴대폰 알림(Web Push): 직원이 「알림 켜기」를 누른 기기마다 한 줄. 어떤 알림을 받을지(topics)도 기기마다 고른다.
-- 보내는 쪽(send-push, deposit-sms 함수)은 서비스 키로 읽고, 서명용 비밀키는 vault의 'vapid_private_jwk'에만 둔다.
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  topics text[] NOT NULL DEFAULT ARRAY['onsite','chat','deposit','general'],
  user_agent text,
  fail_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);

GRANT SELECT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions read" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own push subscriptions update" ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own push subscriptions delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- 같은 기기(브라우저)를 다른 직원이 로그인해 쓰면 그 기기 구독을 지금 사람 것으로 옮긴다 (직원만)
CREATE OR REPLACE FUNCTION public.register_push_subscription(_endpoint text, _p256dh text, _auth text, _user_agent text DEFAULT NULL, _topics text[] DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'employee')) THEN
    RAISE EXCEPTION '직원만 알림을 켤 수 있어요';
  END IF;
  IF coalesce(_endpoint, '') !~ '^https://' OR length(_endpoint) > 1000 OR coalesce(_p256dh, '') = '' OR coalesce(_auth, '') = '' THEN
    RAISE EXCEPTION '알림 구독 정보가 올바르지 않아요';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, topics)
  VALUES (_uid, _endpoint, _p256dh, _auth, left(_user_agent, 300), coalesce(_topics, ARRAY['onsite','chat','deposit','general']))
  ON CONFLICT (endpoint) DO UPDATE SET user_id = _uid, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent, topics = coalesce(_topics, public.push_subscriptions.topics), fail_count = 0
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text, text[]) TO authenticated;

-- 서명용 비밀키 읽기: 서버 함수(service_role)만
CREATE OR REPLACE FUNCTION public.push_vapid_private()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vapid_private_jwk' LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.push_vapid_private() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_vapid_private() TO service_role;
