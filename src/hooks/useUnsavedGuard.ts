import { useCallback, useEffect, useRef, useState } from "react";

export const UNSAVED_CONFIRM = "입력하던 내용이 저장되지 않았어요. 그래도 닫을까요?";

/**
 * 입력 창의 "저장 안 한 변경"을 감지해 닫기 전에 한 번 더 묻는다.
 * - snapshot: 저장 대상 값들을 JSON 문자열로 만든 것
 * - ready: 기존 값(부품 목록 등)을 다 불러왔는지. 불러온 뒤의 값을 기준으로 삼는다.
 * 창이 열린 다음 렌더(초기화 effect가 반영된 뒤)의 snapshot을 기준값으로 잡는다.
 */
export function useUnsavedGuard({
  open,
  ready = true,
  snapshot,
  onClose,
}: {
  open: boolean;
  ready?: boolean;
  snapshot: string;
  onClose: () => void;
}) {
  const base = useRef<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSettled(open);
    if (!open) base.current = null;
  }, [open]);

  useEffect(() => {
    if (open && settled && ready && base.current === null) base.current = snapshot;
  }, [open, settled, ready, snapshot, tick]);

  const dirty = open && base.current !== null && base.current !== snapshot;

  /** 저장했지만 창을 계속 열어 둘 때: 지금 값을 새 기준으로 삼는다 */
  const markClean = useCallback(() => {
    base.current = null;
    setTick((t) => t + 1);
  }, []);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(UNSAVED_CONFIRM)) return;
    onClose();
  }, [dirty, onClose]);

  return { dirty, markClean, requestClose };
}
