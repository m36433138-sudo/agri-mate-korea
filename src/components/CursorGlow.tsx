import { useEffect, useRef } from "react";

/** 마우스를 부드럽게 따라오는 반투명 빛 orb */
export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let tx = -400, ty = -400; // target
    let cx = -400, cy = -400; // current (lerp)

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${cx - 350}px, ${cy - 350}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

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
