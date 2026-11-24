import { useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, X } from "lucide-react";
import { isStandalone, pushSupported } from "@/lib/appPush";

const KEY = "installBanner.dismissed";

/** 휴대폰에서 아직 앱 설치·알림을 안 했으면 한 번 권한다 (닫으면 그 기기에서는 다시 안 보임) */
export function InstallAppBanner() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const phone = typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)").matches;
  const subscribed = typeof Notification !== "undefined" && Notification.permission === "granted";
  if (hidden || !phone || (isStandalone() && (subscribed || !pushSupported()))) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* 무시 */ } setHidden(true); };
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-primary text-primary-foreground px-4 py-3.5 card-shadow">
      <BellRing className="h-6 w-6 shrink-0" />
      <Link to="/app-settings" className="flex-1 min-w-0">
        <p className="font-bold leading-tight">{isStandalone() ? "알림을 켜 주세요" : "휴대폰에 앱으로 설치하세요"}</p>
        <p className="text-xs opacity-90">방문수리 배정·메신저·입금을 알림으로 받아요 →</p>
      </Link>
      <button onClick={close} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/15" aria-label="닫기"><X className="h-4 w-4" /></button>
    </div>
  );
}
