-- 거래처 원장: 천년경영(MJ soft)에서 엑셀로 가져온 2014년~ 매출전표 줄. 고객 화면에서 연·월별로 본다.
-- 앱에서 새로 적는 수리·부품판매는 각자 표에 있고, 원장 화면에서 함께 합쳐 보여 준다(여기에 다시 쓰지 않는다).
-- 주민번호(천년경영 「사업자번호」 칸)는 가져오지 않는다.
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'mjsoft',
  source_key text NOT NULL UNIQUE,          -- 천년경영 전표번호(줄마다 하나) 또는 입금 줄 식별값: 다시 가져와도 두 번 안 들어간다
  legacy_customer_code text,                -- 천년경영 거래처코드(ccode)
  entry_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sale','payment','discount','memo','carry')),
  item_code text,
  item_name text NOT NULL DEFAULT '',
  spec text,
  quantity numeric,
  unit text,
  unit_price bigint NOT NULL DEFAULT 0,
  supply_amount bigint NOT NULL DEFAULT 0,
  vat_amount bigint NOT NULL DEFAULT 0,
  total_amount bigint NOT NULL DEFAULT 0,   -- 매출 합계(부가세 포함)
  paid_amount bigint NOT NULL DEFAULT 0,    -- 입금액
  discount_amount bigint NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,   -- 값 없이 나간 부품(무상·서비스)
  staff text,
  recorded_at timestamptz,                  -- 천년경영에 입력한 시각(TIME)
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_customer_date_idx ON public.ledger_entries (customer_id, entry_date, source_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
-- 고객 정보처럼 직원 모두 본다. 가져오기·고치기·지우기는 관리자만.
CREATE POLICY "staff read ledger" ON public.ledger_entries FOR SELECT TO authenticated
  USING ((SELECT public.is_staff((SELECT auth.uid()))));
CREATE POLICY "admin write ledger" ON public.ledger_entries FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

-- 무상(서비스) 수리: 청구는 0원이지만 원래 얼마짜리였는지와 이유를 남긴다
ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS is_free_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_reason text,
  ADD COLUMN IF NOT EXISTS waived_amount bigint NOT NULL DEFAULT 0;

-- 천년경영 거래처코드로 다시 가져올 때 바로 찾는다
CREATE INDEX IF NOT EXISTS customers_legacy_code_idx ON public.customers (legacy_code) WHERE legacy_code IS NOT NULL;
