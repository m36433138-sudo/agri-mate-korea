import { useSyncExternalStore } from "react";

/** 안드로이드 크롬의 「앱 설치」 요청을 앱이 뜨자마자 잡아 두었다가 버튼을 누를 때 띄운다 */
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; installed = true; emit(); });
}

export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => !!deferred, () => false);
  const justInstalled = useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => installed, () => false);
  const prompt = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  };
  return { canPrompt, prompt, justInstalled };
}
