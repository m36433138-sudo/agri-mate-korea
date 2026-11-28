-- 수리 완료 알림 주제(repair)를 더하고, 안드로이드 설치 앱(FCM) 기기도 같은 표에 등록한다.
-- 웹 푸시 줄은 endpoint/p256dh/auth, FCM 줄은 endpoint = 'fcm:' || 토큰 (p256dh/auth 는 빈 값).
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'web';
DO $$ BEGIN
  ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_kind_check CHECK (kind IN ('web', 'fcm'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.push_subscriptions ALTER COLUMN topics SET DEFAULT ARRAY['onsite','chat','deposit','general','repair'];
UPDATE public.push_subscriptions SET topics = array_append(topics, 'repair') WHERE NOT ('repair' = ANY (topics));

CREATE OR REPLACE FUNCTION public.register_push_subscription(_endpoint text, _p256dh text, _auth text, _user_agent text DEFAULT NULL::text, _topics text[] DEFAULT NULL::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'employee')) THEN
    RAISE EXCEPTION '직원만 알림을 켤 수 있어요';
  END IF;
  IF coalesce(_endpoint, '') !~ '^https://' OR length(_endpoint) > 1000 OR coalesce(_p256dh, '') = '' OR coalesce(_auth, '') = '' THEN
    RAISE EXCEPTION '알림 구독 정보가 올바르지 않아요';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, topics, kind)
  VALUES (_uid, _endpoint, _p256dh, _auth, left(_user_agent, 300), coalesce(_topics, ARRAY['onsite','chat','deposit','general','repair']), 'web')
  ON CONFLICT (endpoint) DO UPDATE SET user_id = _uid, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent, topics = coalesce(_topics, public.push_subscriptions.topics), fail_count = 0
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

-- 안드로이드 앱이 받은 FCM 토큰을 내 기기로 등록한다 (직원만). 같은 토큰이면 주인·주제만 바꾼다.
CREATE OR REPLACE FUNCTION public.register_fcm_token(_token text, _user_agent text DEFAULT NULL::text, _topics text[] DEFAULT NULL::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'employee')) THEN
    RAISE EXCEPTION '직원만 알림을 켤 수 있어요';
  END IF;
  -- 정규식 반복 횟수는 255까지라 길이는 따로 검사한다
  IF length(coalesce(_token, '')) NOT BETWEEN 20 AND 4000 OR _token !~ '^[A-Za-z0-9_:-]+$' THEN
    RAISE EXCEPTION '알림 토큰이 올바르지 않아요';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, topics, kind)
  VALUES (_uid, 'fcm:' || _token, '', '', left(_user_agent, 300), coalesce(_topics, ARRAY['onsite','chat','deposit','general','repair']), 'fcm')
  ON CONFLICT (endpoint) DO UPDATE SET user_id = _uid, user_agent = EXCLUDED.user_agent,
    topics = coalesce(_topics, public.push_subscriptions.topics), fail_count = 0, kind = 'fcm'
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;
REVOKE ALL ON FUNCTION public.register_fcm_token(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_fcm_token(text, text, text[]) TO authenticated;
