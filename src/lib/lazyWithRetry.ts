// 동적 청크 로드 실패(배포 갱신·캐시 불일치) 시 1회 재시도 후 강제 새로고침
import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-at";

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // 두 번째 시도 (일시적 네트워크 오류 대응)
      try {
        return await factory();
      } catch {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        // 무한 새로고침 방지: 10초 내 재시도는 하지 않음
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
        throw err;
      }
    }
  });
}
