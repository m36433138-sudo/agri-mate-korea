import { useEffect, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcOvertime, isHolidayOrWeekend, type AttendanceRecord } from "@/hooks/useAttendance";
import { distanceKm } from "@/lib/onsiteRoute";

const db = supabase as any;
export const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export type Me = { id: string; name: string; team: string | null; user_id: string };
type Pos = { lat: number; lng: number; accuracy: number | null };

function currentPosition(): Promise<Pos | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

/** 로그인한 사람의 직원 정보 (직원 관리에서 계정이 연결된 경우만) */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me-employee"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data } = await db.from("employees").select("id, name, team, user_id").eq("user_id", uid).maybeSingle();
      return (data as Me) ?? null;
    },
  });
}

/**
 * 로그인 계정에 직원 정보가 없을 때(관리자 계정 등): 같은 이름의 연결 안 된 직원이 있으면 그 직원에 연결하고,
 * 없으면 새 직원으로 등록해 연결한다. 직원 정보를 고칠 수 있는 관리자만 된다.
 */
export function useLinkMyself() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fallbackName: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("로그인이 필요해요");
      const { data: prof } = await db.from("profiles").select("display_name").eq("id", uid).maybeSingle();
      const name = (prof?.display_name || fallbackName || "").trim();
      if (!name || name.includes("@")) throw new Error("내 이름(표시 이름)이 없어요. 사용자 관리에서 이름을 먼저 넣어 주세요.");
      const { data: same } = await db.from("employees").select("id, user_id").eq("name", name).is("user_id", null).limit(1);
      if (same?.length) {
        const { error } = await db.from("employees").update({ user_id: uid }).eq("id", same[0].id);
        if (error) throw new Error(error.message);
        return { name, created: false };
      }
      const { error } = await db.from("employees").insert({ name, user_id: uid, is_active: true });
      if (error) throw new Error(error.message.includes("row-level") ? "직원 정보는 관리자만 연결할 수 있어요. 관리자에게 부탁해 주세요." : error.message);
      return { name, created: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-employee"] }),
  });
}

/** 오늘 내 출퇴근 기록 + 출근·퇴근 (위치는 출퇴근 기록과 위치 기록에 함께 남긴다) */
export function useMyAttendance() {
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const today = kstDate();

  const { data: record, isLoading } = useQuery<AttendanceRecord | null>({
    queryKey: ["my-attendance", me?.id, today],
    enabled: !!me,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("attendance_records").select("*").eq("employee_id", me!.id).eq("date", today).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-attendance"] });
    qc.invalidateQueries({ queryKey: ["attendance-records"] });
    qc.invalidateQueries({ queryKey: ["attendance-records-all"] });
  };

  const logPoint = async (action: "clock_in" | "clock_out", pos: Pos | null) => {
    if (!pos || !me) return;
    await db.from("technician_locations").insert({ technician_name: me.name, action, latitude: pos.lat, longitude: pos.lng, accuracy: pos.accuracy });
  };

  const clockIn = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("직원 정보에 이 계정이 연결돼 있지 않아요. 관리자에게 연결을 부탁하세요.");
      const pos = await currentPosition();
      const { error } = await db.from("attendance_records").upsert({
        employee_id: me.id, date: today, clock_in: new Date().toISOString(), is_holiday: isHolidayOrWeekend(today),
        latitude_in: pos?.lat ?? null, longitude_in: pos?.lng ?? null,
      }, { onConflict: "employee_id,date" });
      if (error) throw new Error(error.message);
      await logPoint("clock_in", pos);
      if (pos) await publishLive(me, pos, true);
      return pos;
    },
    onSuccess: refresh,
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      if (!me || !record?.clock_in) throw new Error("오늘 출근 기록이 없어요. 먼저 출근을 눌러 주세요.");
      const pos = await currentPosition();
      const now = new Date().toISOString();
      const ot = calcOvertime(record.clock_in, now, isHolidayOrWeekend(today));
      const { error } = await db.from("attendance_records").update({
        clock_out: now, overtime_minutes: ot.total, morning_ot_minutes: ot.morning, afternoon_ot_minutes: ot.afternoon,
        latitude_out: pos?.lat ?? null, longitude_out: pos?.lng ?? null,
      }).eq("id", record.id);
      if (error) throw new Error(error.message);
      await logPoint("clock_out", pos);
      await stopLive(me);
      return pos;
    },
    onSuccess: refresh,
  });

  return { me, meLoading, record, isLoading, clockIn, clockOut, working: !!record?.clock_in && !record?.clock_out };
}

async function publishLive(me: Me, pos: Pos, sharing: boolean) {
  await db.from("staff_live_locations").upsert({
    employee_id: me.id, user_id: me.user_id, name: me.name, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, sharing, updated_at: new Date().toISOString(),
  }, { onConflict: "employee_id" });
}

async function stopLive(me: Me) {
  await db.from("staff_live_locations").update({ sharing: false, updated_at: new Date().toISOString() }).eq("employee_id", me.id);
}

const OFF_KEY = "liveLocation.off";
function liveSharingOff(): boolean {
  try { return localStorage.getItem(OFF_KEY) === "1"; } catch { return false; }
}
// 공유 끄기/켜기는 화면 어디서 바꿔도 위치를 보내는 쪽(Layout)이 바로 알도록 한 곳에 둔다
const offListeners = new Set<() => void>();
function setLiveSharingOff(v: boolean) {
  try { localStorage.setItem(OFF_KEY, v ? "1" : "0"); } catch { /* 기기에 못 남겨도 이번엔 적용 */ }
  offListeners.forEach((f) => f());
}
const subscribeOff = (f: () => void) => { offListeners.add(f); return () => { offListeners.delete(f); }; };

type ShareStatus = "idle" | "sharing" | "denied" | "unsupported";
let shareStatus: ShareStatus = "idle";
const statusListeners = new Set<() => void>();
const setShareStatus = (v: ShareStatus) => { if (shareStatus !== v) { shareStatus = v; statusListeners.forEach((f) => f()); } };
const subscribeStatus = (f: () => void) => { statusListeners.add(f); return () => { statusListeners.delete(f); }; };

/**
 * 앱 전체에서 한 번만(Layout) 돈다: 출근해 있고 공유를 끄지 않았으면, 앱이 열려 있는 동안 내 위치를 보낸다.
 * 1분 넘게 지났거나 100m 넘게 움직였을 때만 저장한다.
 */
export function useLiveLocationRunner() {
  const { me, working } = useMyAttendance();
  const off = useSyncExternalStore(subscribeOff, liveSharingOff, () => false);
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!me || !working || off) { setShareStatus("idle"); return; }
    if (!navigator.geolocation) { setShareStatus("unsupported"); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setShareStatus("sharing");
        const now = Date.now();
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        const prev = last.current;
        if (prev && now - prev.at < 60_000 && distanceKm(prev, here) < 0.1) return;
        last.current = { at: now, ...here };
        void publishLive(me, { ...here, accuracy: p.coords.accuracy ?? null }, true);
      },
      (e) => setShareStatus(e.code === 1 ? "denied" : "idle"),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [me, working, off]);
}

/** 화면용: 지금 공유 상태와 끄기/켜기 */
export function useLiveSharing() {
  const { data: me } = useMe();
  const off = useSyncExternalStore(subscribeOff, liveSharingOff, () => false);
  const status = useSyncExternalStore(subscribeStatus, () => shareStatus, () => "idle" as ShareStatus);
  const setOff = (v: boolean) => {
    setLiveSharingOff(v);
    if (v && me) void stopLive(me);
  };
  return { off, setOff, status };
}

export type LiveStaff = { employee_id: string; name: string; lat: number; lng: number; accuracy: number | null; updated_at: string };

/** 지금 위치를 공유 중인 직원들 (12시간 안에 갱신된 것만). 바뀌면 바로 반영. */
export function useLiveStaff(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel("staff_live_locations_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_live_locations" }, () => qc.invalidateQueries({ queryKey: ["live-staff"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, enabled]);
  return useQuery<LiveStaff[]>({
    queryKey: ["live-staff"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 12 * 3600_000).toISOString();
      const { data, error } = await db.from("staff_live_locations").select("employee_id, name, lat, lng, accuracy, updated_at")
        .eq("sharing", true).gte("updated_at", since).not("lat", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
