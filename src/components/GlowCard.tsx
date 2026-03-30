import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

/**
 * 마우스 위치 기반 내부 glow + 클릭 ripple 효과가 있는 카드
 */
export default function GlowCard({ className, children, onClick }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--glow-x", `${x}%`);
    el.style.setProperty("--glow-y", `${y}%`);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;

    // ripple 생성
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${e.clientX - rect.left - size / 2}px;
      top: ${e.clientY - rect.top - size / 2}px;
    `;
    el.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });

    onClick?.();
  }, [onClick]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={cn(
        "glow-card bg-white rounded-2xl",
        "shadow-[0_1px_3px_0_rgb(0,0,0,0.07),0_1px_2px_-1px_rgb(0,0,0,0.05)]",
        "hover:shadow-[0_8px_24px_-4px_rgb(0,0,0,0.10),0_2px_8px_-2px_rgb(0,0,0,0.06)]",
        "transition-shadow duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}
