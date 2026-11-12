-- 도면 목록 검색: 부품번호(하이픈·공백 무시)·부품명으로 도면 찾기
create or replace function public.search_diagram_parts(query text, result_limit integer default 300)
returns table (diagram_id uuid, part_codes text[], match_count integer)
language sql
stable
security invoker
set search_path = 'public'
as $$
  with q as (
    select
      trim(query) as raw,
      regexp_replace(trim(query), '[%_\\\\]', '', 'g') as raw_like,
      upper(regexp_replace(trim(query), '[^0-9A-Za-z가-힣]', '', 'g')) as norm
  ),
  hits as (
    select
      h.diagram_id,
      count(distinct h.part_code)::integer as match_count,
      (array_agg(distinct h.part_code order by h.part_code))[1:3] as part_codes
    from public.diagram_hotspots h
    cross join q
    where q.norm <> ''
      and (
        upper(regexp_replace(h.part_code, '[^0-9A-Za-z가-힣]', '', 'g')) like '%' || q.norm || '%'
        or coalesce(h.part_name, '') ilike '%' || q.raw_like || '%'
      )
    group by h.diagram_id
  )
  select h.diagram_id, h.part_codes, h.match_count
  from hits h
  order by h.match_count desc, h.diagram_id
  limit result_limit
$$;

revoke execute on function public.search_diagram_parts(text, integer) from public, anon;
grant execute on function public.search_diagram_parts(text, integer) to authenticated, service_role;