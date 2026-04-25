import { useEffect, useRef, useState } from "react";

/**
 * 요소가 viewport에 들어올 때까지 false를 유지하다가 한 번 진입하면 true를 반환.
 * 무거운 SVG/blur/그라디언트 등을 viewport에 들어올 때만 렌더링하기 위한 훅.
 */
export function useInView<T extends Element>(rootMargin = "100px"): {
  ref: React.RefObject<T>;
  inView: boolean;
} {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
