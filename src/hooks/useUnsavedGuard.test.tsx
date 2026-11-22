import { act, renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedGuard } from "./useUnsavedGuard";

/** 실제 입력 창처럼: 열릴 때 effect로 값을 초기화하고, 기존 데이터는 나중에 불러온다 */
function useForm({ open, initial, loaded = true }: { open: boolean; initial: string; loaded?: boolean }, onClose: () => void) {
  const [value, setValue] = useState("stale-from-last-time");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  useEffect(() => {
    setReady(open && loaded);
  }, [open, loaded]);
  const guard = useUnsavedGuard({ open, ready, snapshot: value, onClose });
  return { ...guard, setValue };
}

type P = { open: boolean; initial: string; loaded?: boolean };

function setup(initialProps: P) {
  const onClose = vi.fn();
  const hook = renderHook((p: P) => useForm(p, onClose), { initialProps });
  return { ...hook, onClose };
}

describe("useUnsavedGuard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("closes without asking when nothing changed", () => {
    const confirm = vi.spyOn(window, "confirm");
    const { result, rerender, onClose } = setup({ open: false, initial: "saved" });
    rerender({ open: true, initial: "saved" });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.requestClose());
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks before closing when the user changed something", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, rerender, onClose } = setup({ open: false, initial: "saved" });
    rerender({ open: true, initial: "saved" });
    act(() => result.current.setValue("typed"));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.requestClose());
    expect(confirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    act(() => result.current.requestClose());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("waits for loaded data before taking the baseline", () => {
    const { result, rerender } = setup({ open: false, initial: "empty", loaded: false });
    rerender({ open: true, initial: "empty", loaded: false });
    rerender({ open: true, initial: "loaded", loaded: true });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue("edited"));
    expect(result.current.dirty).toBe(true);
  });

  it("markClean makes the current values the new baseline", () => {
    const { result, rerender } = setup({ open: false, initial: "a" });
    rerender({ open: true, initial: "a" });
    act(() => result.current.setValue("saved"));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.markClean());
    expect(result.current.dirty).toBe(false);
  });

  it("forgets the baseline after closing", () => {
    const { result, rerender } = setup({ open: false, initial: "a" });
    rerender({ open: true, initial: "a" });
    act(() => result.current.setValue("typed"));
    rerender({ open: false, initial: "a" });
    rerender({ open: true, initial: "b" });
    expect(result.current.dirty).toBe(false);
  });
});
