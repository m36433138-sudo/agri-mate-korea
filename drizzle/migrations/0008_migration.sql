-- 부품번호 일부(예: 77200)·부품명 검색을 34만 행에서도 즉시 찾도록 정규화 식 트라이그램 인덱스
CREATE INDEX IF NOT EXISTS diagram_hotspots_code_norm_trgm
  ON public.diagram_hotspots USING gin ((upper(regexp_replace(part_code, '[^0-9A-Za-z가-힣]', '', 'g'))) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS diagram_hotspots_name_trgm
  ON public.diagram_hotspots USING gin (part_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS diagram_hotspots_code_idx
  ON public.diagram_hotspots USING btree (part_code);
ANALYZE public.diagram_hotspots;