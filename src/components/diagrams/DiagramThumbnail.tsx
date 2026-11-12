import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Cropped previews are kept for the session so revisiting the list is instant.
const cache = new Map<string, string>();

function makePreview(image: HTMLImageElement): string | null {
  if (image.naturalWidth <= image.naturalHeight) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.round(480 * image.naturalHeight * 0.84 / (image.naturalWidth * 0.485));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, image.naturalWidth * 0.015, image.naturalHeight * 0.06,
      image.naturalWidth * 0.485, image.naturalHeight * 0.84, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] < 180 && data[i + 1] < 180 && data[i + 2] < 180) {
          if (x < left) left = x; if (x > right) right = x;
          if (y < top) top = y; if (y > bottom) bottom = y;
        }
      }
    }
    if (right <= left || bottom <= top) return null;
    const cropped = document.createElement("canvas");
    cropped.width = right - left + 17;
    cropped.height = bottom - top + 17;
    const output = cropped.getContext("2d");
    if (!output) return null;
    output.fillStyle = "#fff";
    output.fillRect(0, 0, cropped.width, cropped.height);
    output.drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 8, 8, right - left + 1, bottom - top + 1);
    return cropped.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/** Shows only the enlarged illustration; the full page never flashes first. */
export default function DiagramThumbnail({ src, title }: { src: string; title: string }) {
  const [preview, setPreview] = useState<string | null>(() => cache.get(src) ?? null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview || !ref.current) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "300px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [preview]);

  useEffect(() => {
    if (!visible || preview) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const p = makePreview(img);
      if (p) { cache.set(src, p); setPreview(p); } else setFailed(true);
    };
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [visible, preview, src]);

  return (
    <div ref={ref} className="aspect-square w-full overflow-hidden bg-[hsl(var(--diagram-paper))] p-2">
      {preview || failed ? (
        <img src={preview ?? src} alt={title} className="h-full w-full object-contain" />
      ) : (
        <Skeleton className="h-full w-full" />
      )}
    </div>
  );
}
