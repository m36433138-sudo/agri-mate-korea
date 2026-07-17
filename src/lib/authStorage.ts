const AUTO_LOGIN_KEY = "agrimate-auto-login";

function getStorage() {
  const autoLogin = localStorage.getItem(AUTO_LOGIN_KEY);
  // 기존 동작 유지: 설정값이 없으면 자동 로그인 ON (localStorage)
  return autoLogin === "false" ? sessionStorage : localStorage;
}

export const authStorage = {
  getItem(key: string): string | null {
    return getStorage().getItem(key);
  },
  setItem(key: string, value: string): void {
    getStorage().setItem(key, value);
  },
  removeItem(key: string): void {
    getStorage().removeItem(key);
  },
};

export function setAutoLogin(enabled: boolean) {
  localStorage.setItem(AUTO_LOGIN_KEY, enabled ? "true" : "false");
}

export function getAutoLogin(): boolean {
  return localStorage.getItem(AUTO_LOGIN_KEY) !== "false";
}
