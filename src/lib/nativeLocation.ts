import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";

/**
 * 안드로이드 설치 앱(Capacitor)에서는 화면이 꺼져도 위치를 받는다.
 * 브라우저·PWA에서는 이 경로를 쓰지 않는다 (navigator.geolocation 은 앱이 열려 있을 때만 동작).
 */
/** 직원에게 나눠 줄 안드로이드 앱 파일 (public/app 에 둔다) */
export const ANDROID_APK_URL = "/app/gwangmun.apk";

export const isNativeApp = () => Capacitor.isNativePlatform();

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type NativeFix = { lat: number; lng: number; accuracy: number | null };

/** 위치 감시를 시작하고, 멈추는 함수를 돌려준다. 알림줄에 「위치 공유 중」이 떠 있는 동안 계속 받는다. */
export async function watchNativeLocation(
  onFix: (f: NativeFix) => void,
  onError: (code: "denied" | "other", message: string) => void,
): Promise<() => void> {
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: "광문농기 위치 공유 중",
      backgroundMessage: "출근 중에만 위치를 보내요. 퇴근하면 자동으로 꺼져요.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 30,
    },
    (loc?: Location, err?: { code?: string; message?: string }) => {
      if (err) {
        onError(err.code === "NOT_AUTHORIZED" ? "denied" : "other", err.message ?? "");
        return;
      }
      if (loc) onFix({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy ?? null });
    },
  );
  return () => { void BackgroundGeolocation.removeWatcher({ id }); };
}

/** 위치 권한이 꺼져 있을 때 휴대폰 설정 화면을 연다 */
export function openLocationSettings() {
  return BackgroundGeolocation.openSettings();
}

/**
 * 백그라운드 5분이 지나면 안드로이드가 웹뷰의 네트워크 요청을 늦춘다.
 * 그래서 앱에서는 위치 저장만 휴대폰 네이티브 HTTP로 보낸다 (권한·RLS는 같은 로그인 토큰으로 똑같이 적용).
 */
export async function nativeUpsertLive(row: Record<string, unknown>): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  const res = await CapacitorHttp.request({
    method: "POST",
    url: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/staff_live_locations?on_conflict=employee_id`,
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    data: row,
  });
  if (res.status >= 300) throw new Error(`위치 저장 실패 (${res.status})`);
}
