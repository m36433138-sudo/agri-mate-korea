-- 견적 제품 카탈로그: 농기계를 대분류(트랙터·이앙기·콤바인·작업기…)로 묶고 사진·주요 사양을 붙인다.
-- 사진은 고객에게 보내는 견적서 그림에도 들어가므로 공개 버킷(product-images)에 둔다. 올리기·지우기는 직원만.
ALTER TABLE public.quote_products
  ADD COLUMN IF NOT EXISTS machine_group text,
  ADD COLUMN IF NOT EXISTS brand text DEFAULT '얀마',
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS highlights text,
  ADD COLUMN IF NOT EXISTS description text;

-- 지금 있는 제품을 소분류 이름으로 대분류에 나눈다
UPDATE public.quote_products SET machine_group = CASE
  WHEN category ILIKE '%옵션%' OR category ILIKE '%부속%' OR category = '자율주행' THEN '옵션·부속'
  WHEN category ILIKE '%트랙터%' THEN '트랙터'
  WHEN category ILIKE '%콤바인%' THEN '콤바인'
  WHEN category ILIKE '%이앙기%' THEN '이앙기'
  WHEN category ILIKE '%로타리%' OR category ILIKE '%해로우%' OR category ILIKE '%쟁기%' OR category ILIKE '%작업기%' THEN '작업기'
  WHEN category ILIKE '%관리기%' OR category ILIKE '%방제기%' THEN '관리기·방제기'
  ELSE '기타'
END
WHERE machine_group IS NULL;
UPDATE public.quote_products SET brand = '얀마' WHERE brand IS NULL;

CREATE INDEX IF NOT EXISTS quote_products_group_idx ON public.quote_products (machine_group, category, sort_order);

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'))));
CREATE POLICY "Staff update product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'))));
CREATE POLICY "Staff delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND ((SELECT public.has_role((SELECT auth.uid()), 'admin')) OR (SELECT public.has_role((SELECT auth.uid()), 'employee'))));
