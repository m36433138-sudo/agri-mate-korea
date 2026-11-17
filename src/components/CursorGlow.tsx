import { useEffect, useRef } from "react";

/** 마우스를 부드럽게 따라오는 반투명 빛 orb — 움직일 때만 그려 느린 컴퓨터에서 CPU를 쓰지 않는다 */
export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const lowEnd =
    typeof window !== "undefined" &&
    ((navigator.hardwareConcurrency ?? 8) <= 4 ||
      window.matchMedia?.("(pointer: coarse)").matches ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (lowEnd) return;
    let raf = 0;
    let tx = -400, ty = -400;
    let cx = -400, cy = -400;

    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      if (glowRef.current) glowRef.current.style.transform = `translate(${cx - 350}px, ${cy - 350}px)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [lowEnd]);

  if (lowEnd) return null;
  return (
    <div
      ref={glowRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-0 w-[700px] h-[700px] rounded-full"
      style={{
        background:
          "radial-gradient(circle, hsl(142 64% 34% / 0.055) 0%, hsl(217 91% 60% / 0.02) 45%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
}
