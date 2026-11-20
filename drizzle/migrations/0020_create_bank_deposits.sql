CREATE TABLE public.bank_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'sms' CHECK (source IN ('sms','paste')),
  bank text NOT NULL DEFAULT '은행',
  depositor_name text,
  amount bigint NOT NULL CHECK (amount > 0),
  deposited_at timestamptz NOT NULL,
  balance bigint,
  raw_text text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','ignored')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  unallocated_amount bigint NOT NULL DEFAULT 0,
  decided_by uuid,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_deposits_status_idx ON public.bank_deposits (status, deposited_at DESC);

CREATE TABLE public.deposit_sms_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.deposit_sms_settings (id) VALUES (true);

GRANT SELECT, INSERT, UPDATE ON public.bank_deposits TO authenticated;
GRANT ALL ON public.bank_deposits TO service_role;
GRANT SELECT, UPDATE ON public.deposit_sms_settings TO authenticated;
GRANT ALL ON public.deposit_sms_settings TO service_role;

ALTER TABLE public.bank_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposit viewers read" ON public.bank_deposits FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'view_receivables')));
CREATE POLICY "deposit managers insert" ON public.bank_deposits FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_receivables')));
CREATE POLICY "deposit managers update" ON public.bank_deposits FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_receivables')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_permission((SELECT auth.uid()), 'manage_receivables')));

CREATE POLICY "admins read deposit sms settings" ON public.deposit_sms_settings FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));
CREATE POLICY "admins update deposit sms settings" ON public.deposit_sms_settings FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

-- 승인: 입금을 미수금 여러 건에 나눠 넣고 상태를 한 번에 바꾼다 (RLS 적용)
CREATE OR REPLACE FUNCTION public.approve_bank_deposit(_deposit_id uuid, _allocations jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _dep public.bank_deposits;
  _a jsonb;
  _fid uuid;
  _amt bigint;
  _rec public.finance_records;
  _sum bigint := 0;
  _pid uuid;
  _done jsonb := '[]'::jsonb;
  _customer uuid;
  _paid_date date;
BEGIN
  SELECT * INTO _dep FROM public.bank_deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '입금 기록을 찾을 수 없어요'; END IF;
  IF _dep.status <> 'pending' THEN RAISE EXCEPTION '이미 처리된 입금이에요'; END IF;
  IF jsonb_typeof(_allocations) <> 'array' OR jsonb_array_length(_allocations) = 0 THEN
    RAISE EXCEPTION '연결할 미수금을 골라주세요';
  END IF;
  _paid_date := (_dep.deposited_at AT TIME ZONE 'Asia/Seoul')::date;

  FOR _a IN SELECT * FROM jsonb_array_elements(_allocations) LOOP
    _fid := (_a->>'finance_id')::uuid;
    _amt := (_a->>'amount')::bigint;
    IF _amt IS NULL OR _amt <= 0 THEN RAISE EXCEPTION '나눠 넣을 금액을 확인해주세요'; END IF;
    SELECT * INTO _rec FROM public.finance_records WHERE id = _fid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '미수금을 찾을 수 없어요'; END IF;
    IF _rec.is_paid OR _amt > (_rec.amount - _rec.paid_amount) THEN
      RAISE EXCEPTION '미수금 잔액보다 많이 넣을 수 없어요 (잔액 %원)', (_rec.amount - _rec.paid_amount);
    END IF;
    _sum := _sum + _amt;
    _customer := COALESCE(_customer, _rec.customer_id);

    INSERT INTO public.finance_payments (finance_id, amount, paid_date, method, notes, created_by)
    VALUES (_fid, _amt, _paid_date, '계좌이체',
            left('입금 문자 매칭 · ' || _dep.bank || ' · 입금자 ' || COALESCE(_dep.depositor_name, '-'), 200), auth.uid())
    RETURNING id INTO _pid;

    UPDATE public.finance_records
       SET paid_amount = paid_amount + _amt,
           is_paid = (paid_amount + _amt) >= amount,
           paid_date = _paid_date,
           updated_by = auth.uid()
     WHERE id = _fid;

    _done := _done || jsonb_build_object('finance_id', _fid, 'amount', _amt, 'payment_id', _pid);
  END LOOP;

  IF _sum > _dep.amount THEN RAISE EXCEPTION '입금액보다 많이 나눠 넣을 수 없어요'; END IF;

  UPDATE public.bank_deposits
     SET status = 'approved', customer_id = _customer, allocations = _done,
         unallocated_amount = _dep.amount - _sum, decided_by = auth.uid(), decided_at = now()
   WHERE id = _deposit_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_bank_deposit(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_bank_deposit(uuid, jsonb) TO authenticated;

-- 승인 되돌리기: 그때 넣은 입금 기록만 지우고 잔액을 다시 계산
CREATE OR REPLACE FUNCTION public.revert_bank_deposit(_deposit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _dep public.bank_deposits;
  _a jsonb;
  _fid uuid;
  _paid bigint;
BEGIN
  SELECT * INTO _dep FROM public.bank_deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '입금 기록을 찾을 수 없어요'; END IF;
  IF _dep.status = 'approved' THEN
    FOR _a IN SELECT * FROM jsonb_array_elements(_dep.allocations) LOOP
      _fid := (_a->>'finance_id')::uuid;
      DELETE FROM public.finance_payments WHERE id = (_a->>'payment_id')::uuid;
      SELECT COALESCE(sum(amount), 0) INTO _paid FROM public.finance_payments WHERE finance_id = _fid;
      UPDATE public.finance_records
         SET paid_amount = _paid, is_paid = _paid >= amount,
             paid_date = (SELECT max(paid_date) FROM public.finance_payments WHERE finance_id = _fid),
             updated_by = auth.uid()
       WHERE id = _fid;
    END LOOP;
  END IF;
  UPDATE public.bank_deposits
     SET status = 'pending', customer_id = NULL, allocations = '[]'::jsonb, unallocated_amount = 0,
         decided_by = NULL, decided_at = NULL
   WHERE id = _deposit_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revert_bank_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_bank_deposit(uuid) TO authenticated;