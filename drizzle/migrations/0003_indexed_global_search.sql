CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION public.search_normalize(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$ SELECT regexp_replace(lower(coalesce(value,'')), '[[:space:]-]+', '', 'g') $$;
REVOKE ALL ON FUNCTION public.search_normalize(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_normalize(text) TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS machines_global_search_idx ON public.machines USING gin (public.search_normalize(model_name || ' ' || serial_number || ' ' || coalesce(manufacturer,'') || ' ' || coalesce(engine_number,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_global_search_idx ON public.customers USING gin (public.search_normalize(name || ' ' || phone || ' ' || coalesce(address,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS repairs_global_search_idx ON public.repairs USING gin (public.search_normalize(repair_content || ' ' || coalesce(technician,'') || ' ' || coalesce(notes,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS inventory_global_search_idx ON public.inventory USING gin (public.search_normalize(part_name || ' ' || part_code || ' ' || coalesce(alt_part_code,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS parts_global_search_idx ON public.parts USING gin (public.search_normalize(part_name || ' ' || part_number) extensions.gin_trgm_ops);
CREATE OR REPLACE FUNCTION public.global_search(search_query text, page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS TABLE(id text, label text, sub text, category text, link text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH q AS (
 SELECT public.search_normalize(left(trim(search_query),100)) term
), pattern AS (
 SELECT term, '%' || replace(replace(replace(term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' needle FROM q WHERE term <> ''
), candidates AS (
 SELECT m.id::text id, m.model_name label, concat_ws(' · ',m.serial_number,c.name,m.manufacturer) sub, 'machine'::text category, '/machines/' || m.id link,
 CASE WHEN public.search_normalize(m.model_name)=q.term OR public.search_normalize(m.serial_number)=q.term THEN 0 ELSE 1 END rank
 FROM public.machines m LEFT JOIN public.customers c ON c.id=m.customer_id CROSS JOIN pattern q
 WHERE public.search_normalize(m.model_name || ' ' || m.serial_number || ' ' || coalesce(m.manufacturer,'') || ' ' || coalesce(m.engine_number,'')) LIKE q.needle ESCAPE E'\\'
 OR public.search_normalize(c.name || ' ' || c.phone) LIKE q.needle ESCAPE E'\\'
 UNION ALL
 SELECT c.id::text,c.name,concat_ws(' · ',c.phone,c.address),'customer','/customers/' || c.id,
 CASE WHEN public.search_normalize(c.name)=q.term OR public.search_normalize(c.phone)=q.term THEN 0 ELSE 1 END
 FROM public.customers c CROSS JOIN pattern q
 WHERE public.search_normalize(c.name || ' ' || c.phone || ' ' || coalesce(c.address,'')) LIKE q.needle ESCAPE E'\\'
 UNION ALL
 SELECT r.id::text,r.repair_content,concat_ws(' · ',r.repair_date::text,m.model_name,c.name,r.technician),'repair','/machines/' || r.machine_id,1
 FROM public.repairs r JOIN public.machines m ON m.id=r.machine_id LEFT JOIN public.customers c ON c.id=m.customer_id CROSS JOIN pattern q
 WHERE public.search_normalize(r.repair_content || ' ' || coalesce(r.technician,'') || ' ' || coalesce(r.notes,'')) LIKE q.needle ESCAPE E'\\'
 OR public.search_normalize(m.model_name || ' ' || m.serial_number || ' ' || coalesce(c.name,'') || ' ' || r.repair_date::text) LIKE q.needle ESCAPE E'\\'
 UNION ALL
 SELECT i.id::text,i.part_name,concat_ws(' · ',i.part_code,i.branch,i.location_main,i.location_sub),'part','/parts?search=' || i.part_code,
 CASE WHEN public.search_normalize(i.part_code)=q.term THEN 0 ELSE 1 END
 FROM public.inventory i CROSS JOIN pattern q
 WHERE public.search_normalize(i.part_name || ' ' || i.part_code || ' ' || coalesce(i.alt_part_code,'')) LIKE q.needle ESCAPE E'\\'
 UNION ALL
 SELECT p.id::text,p.part_name,p.part_number,'part','/parts?search=' || p.part_number,
 CASE WHEN public.search_normalize(p.part_number)=q.term THEN 0 ELSE 1 END
 FROM public.parts p CROSS JOIN pattern q
 WHERE public.search_normalize(p.part_name || ' ' || p.part_number) LIKE q.needle ESCAPE E'\\'
 AND NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.part_code=p.part_number)
)
SELECT id,label,sub,category,link FROM candidates ORDER BY rank,category,label,id
LIMIT greatest(1,least(coalesce(page_size,20),50)) OFFSET greatest(0,coalesce(page_offset,0));
$$;
REVOKE ALL ON FUNCTION public.global_search(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_search(text,integer,integer) TO authenticated, service_role;