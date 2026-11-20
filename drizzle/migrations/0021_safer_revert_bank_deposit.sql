CREATE OR REPLACE FUNCTION public.revert_bank_deposit(_deposit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _dep public.bank_deposits;
  _a jsonb;
  _fid uuid;
  _amt bigint;
BEGIN
  SELECT * INTO _dep FROM public.bank_deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '입금 기록을 찾을 수 없어요'; END IF;
  IF _dep.status = 'approved' THEN
    FOR _a IN SELECT * FROM jsonb_array_elements(_dep.allocations) LOOP
      _fid := (_a->>'finance_id')::uuid;
      _amt := (_a->>'amount')::bigint;
      DELETE FROM public.finance_payments WHERE id = (_a->>'payment_id')::uuid;
      UPDATE public.finance_records
         SET paid_amount = GREATEST(0, paid_amount - _amt),
             is_paid = GREATEST(0, paid_amount - _amt) >= amount,
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