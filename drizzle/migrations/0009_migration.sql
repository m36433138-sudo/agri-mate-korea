CREATE OR REPLACE FUNCTION public.search_diagram_parts(query text, result_limit integer DEFAULT 300)
 RETURNS TABLE(diagram_id uuid, part_codes text[], match_count integer)
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
declare
  norm text := upper(regexp_replace(trim(coalesce(query, '')), '[^0-9A-Za-z가-힣]', '', 'g'));
  raw_like text := regexp_replace(trim(coalesce(query, '')), '[%_\\]', '', 'g');
begin
  if norm = '' then return; end if;
  -- 상수로 넣어야 트라이그램 인덱스를 탄다 (77200처럼 뒷자리만 쳐도 즉시)
  return query execute format($q$
    select h.diagram_id,
           (array_agg(distinct h.part_code order by h.part_code))[1:3] as part_codes,
           count(distinct h.part_code)::integer as match_count
    from public.diagram_hotspots h
    where upper(regexp_replace(h.part_code, '[^0-9A-Za-z가-힣]', '', 'g')) like %L
       or h.part_name ilike %L
    group by h.diagram_id
    order by 3 desc, 1
    limit %s
  $q$, '%' || norm || '%', '%' || raw_like || '%', greatest(1, least(coalesce(result_limit, 300), 1000)));
end
$function$;