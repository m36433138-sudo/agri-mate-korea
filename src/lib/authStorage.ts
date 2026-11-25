/**
 * 로그인 정보 저장소. 자동 로그인(기본 켬)이면 localStorage 에 두어 앱·브라우저를 닫아도 로그인이 유지된다.
 * 끄면 sessionStorage 라서 창을 닫으면 로그아웃된다 (공용 PC용).
 * 예전에 한 번 끈 설정이 남아 계속 로그아웃되던 문제 때문에 설정 키를 새로 바꿔 다시 켬으로 시작한다.
 */
const AUTO_LOGIN_KEY = "agrimate-auto-login-v2";
const LEGACY_KEY = "agrimate-auto-login";
const LAST_ID_KEY = "agrimate-last-login-id";

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function getAutoLogin(): boolean {
  return safe(() => localStorage.getItem(AUTO_LOGIN_KEY) !== "false", true);
}

function store(): Storage {
  return getAutoLogin() ? localStorage : sessionStorage;
}

export const authStorage = {
  getItem(key: string): string | null {
    return safe(() => {
      const primary = store();
      const v = primary.getItem(key);
      if (v != null) return v;
      // 다른 쪽에 남아 있는 로그인(설정을 바꾸기 전 것)을 지금 저장소로 옮겨 이어 쓴다
      const other = primary === localStorage ? sessionStorage : localStorage;
      const old = other.getItem(key);
      if (old != null) { primary.setItem(key, old); other.removeItem(key); }
      return old;
    }, null);
  },
  setItem(key: string, value: string): void {
    safe(() => {
      store().setItem(key, value);
      (store() === localStorage ? sessionStorage : localStorage).removeItem(key);
    }, undefined);
  },
  removeItem(key: string): void {
    safe(() => { localStorage.removeItem(key); sessionStorage.removeItem(key); }, undefined);
  },
};

export function setAutoLogin(enabled: boolean) {
  safe(() => { localStorage.setItem(AUTO_LOGIN_KEY, enabled ? "true" : "false"); localStorage.removeItem(LEGACY_KEY); }, undefined);
}

/** 마지막으로 로그인한 아이디 (로그인 화면에 미리 채움) */
export function getLastLoginId(): string {
  return safe(() => localStorage.getItem(LAST_ID_KEY) ?? "", "");
}
export function setLastLoginId(id: string) {
  safe(() => localStorage.setItem(LAST_ID_KEY, id), undefined);
}
