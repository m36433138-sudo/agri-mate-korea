import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fetchVisits, importVisitsFromSheet, mirrorDelete, mirrorVisit, type OnsiteVisit, type VisitInput } from "@/lib/onsiteVisits";
import { geocodeAddress } from "@/lib/onsiteRoute";
import { sendPush } from "@/lib/appPush";

const KEY = ["onsite-visits"];
const db = supabase as any;

/** 방문수리 목록 (앱 DB). 표가 비어 있으면 처음 한 번 시트에서 가져온다. 다른 사람이 고치면 바로 반영. */
export function useOnsiteVisits(canManage: boolean) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const importedOnce = useRef(false);

  const query = useQuery<OnsiteVisit[]>({
    queryKey: KEY,
    queryFn: async () => {
      const rows = await fetchVisits();
      if (rows.length === 0 && canManage && !importedOnce.current) {
        importedOnce.current = true;
        try {
          const n = await importVisitsFromSheet();
          if (n > 0) {
            toast({ title: `시트 「출장」에서 ${n}건을 가져왔어요`, description: "이제 앱이 원본이고, 시트에는 백업으로 따라 써요." });
            return fetchVisits();
          }
        } catch (e) {
          toast({ title: "시트에서 가져오지 못했어요", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
        }
      }
      return rows;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("onsite_visits_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "onsite_visits" }, () => qc.invalidateQueries({ queryKey: KEY }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const backupFailed = () => toast({ title: "앱에는 저장됐어요", description: "구글 시트 백업만 실패했어요. 다음에 저장할 때 다시 써요." });

  const save = useMutation({
    mutationFn: async ({ input, prev }: { input: VisitInput; prev: OnsiteVisit | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      // 주소가 바뀌면 좌표를 다시 찾게 비운다
      const geo = prev && prev.address !== input.address ? { lat: null, lng: null, geocoded_address: null } : {};
      const q = prev
        ? db.from("onsite_visits").update({ ...input, ...geo, updated_by: uid }).eq("id", prev.id)
        : db.from("onsite_visits").insert({ ...input, created_by: uid, updated_by: uid });
      const { data, error } = await q.select("*").single();
      if (error) throw new Error(error.message);
      return { saved: data as OnsiteVisit, prevName: prev?.customer_name, prevTech: prev?.technician?.trim() || null };
    },
    onSuccess: ({ saved, prevName, prevTech }) => {
      qc.invalidateQueries({ queryKey: KEY });
      void mirrorVisit(saved, prevName).then((ok) => { if (!ok) backupFailed(); });
      // 출장기사가 새로 정해지거나 바뀌면 그 기사 휴대폰에 알림
      const tech = saved.technician?.trim();
      if (tech && tech !== prevTech && saved.status !== "완료") {
        void sendPush("onsite", { employee_names: tech.split(/[,·/\s]+/).filter(Boolean) }, {
          title: `방문수리 배정 · ${saved.customer_name}`,
          body: [[saved.machine, saved.model].filter(Boolean).join(" "), saved.detail, saved.address].filter(Boolean).join(" · ").slice(0, 200),
          url: "/onsite-repairs",
          tag: `onsite-${saved.id}`,
        });
      }
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  /** 카드에서 바로 상태·일정 바꾸기 */
  const patch = useMutation({
    mutationFn: async ({ visit, change }: { visit: OnsiteVisit; change: Partial<VisitInput> }) => {
      const { data, error } = await db.from("onsite_visits").update(change).eq("id", visit.id).select("*").single();
      if (error) throw new Error(error.message);
      return data as OnsiteVisit;
    },
    onMutate: async ({ visit, change }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<OnsiteVisit[]>(KEY);
      qc.setQueryData<OnsiteVisit[]>(KEY, (rows) => rows?.map((r) => (r.id === visit.id ? { ...r, ...change } as OnsiteVisit : r)));
      return { before };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(KEY, ctx.before);
      toast({ title: "바꾸지 못했어요", description: e.message, variant: "destructive" });
    },
    onSuccess: (saved, { change }) => {
      // 일정(가기로 한 날)·좌표는 앱 전용이라 시트에 쓸 필요 없다
      const sheetFields = Object.keys(change).some((k) => !["scheduled_on", "lat", "lng", "geocoded_address"].includes(k));
      if (sheetFields) void mirrorVisit(saved).then((ok) => { if (!ok) backupFailed(); });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (v: OnsiteVisit) => {
      const { error } = await db.from("onsite_visits").delete().eq("id", v.id);
      if (error) throw new Error(error.message);
      return v;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: KEY });
      void mirrorDelete(v).then((ok) => { if (!ok) backupFailed(); });
    },
    onError: (e: Error) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const importSheet = useMutation({
    mutationFn: importVisitsFromSheet,
    onSuccess: (n) => { toast({ title: `시트에서 ${n}건을 맞췄어요` }); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: Error) => toast({ title: "시트 가져오기 실패", description: e.message, variant: "destructive" }),
  });

  return { ...query, visits: query.data ?? [], save, patch, remove, importSheet };
}

/**
 * 좌표 없는 주소를 하나씩(초당 1번) 찾아 기록에 저장한다. 못 찾으면 geocoded_address만 남겨 같은 주소로 다시 묻지 않는다.
 * 고칠 권한이 있는 사람 화면에서만 돈다.
 */
export function useGeocodeQueue(visits: OnsiteVisit[], enabled: boolean) {
  const qc = useQueryClient();
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!enabled || busy.current) return;
    const todo = visits.filter((v) => v.status !== "완료" && v.address && v.geocoded_address !== v.address);
    if (!todo.length) return;
    busy.current = true;
    const ac = (abort.current = new AbortController());
    (async () => {
      for (const v of todo.slice(0, 30)) {
        if (ac.signal.aborted) break;
        let hit = null;
        try { hit = await geocodeAddress(v.address!, v.branch, ac.signal); } catch { if (ac.signal.aborted) break; continue; /* 네트워크 문제는 다음에 다시 */ }
        await db.from("onsite_visits").update({ lat: hit?.lat ?? null, lng: hit?.lng ?? null, geocoded_address: v.address }).eq("id", v.id).eq("address", v.address);
        await new Promise((r) => setTimeout(r, 1100));
      }
      busy.current = false;
      if (!ac.signal.aborted) qc.invalidateQueries({ queryKey: KEY });
    })();
  }, [visits, enabled, qc]);
}
