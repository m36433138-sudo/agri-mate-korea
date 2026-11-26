import { beforeEach, describe, expect, it } from "vitest";
import { authStorage, getAutoLogin, setAutoLogin } from "./authStorage";

describe("자동 로그인 저장소", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("처음엔 켜져 있고, 예전에 끈 설정(옛 키)은 무시한다", () => {
    localStorage.setItem("agrimate-auto-login", "false");
    expect(getAutoLogin()).toBe(true);
  });
  it("켜져 있으면 localStorage 에 저장해 앱을 닫아도 남는다", () => {
    authStorage.setItem("sb-token", "abc");
    expect(localStorage.getItem("sb-token")).toBe("abc");
    expect(sessionStorage.getItem("sb-token")).toBeNull();
  });
  it("끄면 sessionStorage 에 저장한다", () => {
    setAutoLogin(false);
    authStorage.setItem("sb-token", "abc");
    expect(sessionStorage.getItem("sb-token")).toBe("abc");
    expect(localStorage.getItem("sb-token")).toBeNull();
  });
  it("꺼져 있을 때 남은 로그인을 다시 켜면 그대로 이어서 쓰고 localStorage 로 옮긴다", () => {
    sessionStorage.setItem("sb-token", "old");
    expect(authStorage.getItem("sb-token")).toBe("old");
    expect(localStorage.getItem("sb-token")).toBe("old");
    expect(sessionStorage.getItem("sb-token")).toBeNull();
  });
  it("로그아웃하면 양쪽 다 지운다", () => {
    localStorage.setItem("sb-token", "a"); sessionStorage.setItem("sb-token", "b");
    authStorage.removeItem("sb-token");
    expect(localStorage.getItem("sb-token")).toBeNull();
    expect(sessionStorage.getItem("sb-token")).toBeNull();
  });
});
