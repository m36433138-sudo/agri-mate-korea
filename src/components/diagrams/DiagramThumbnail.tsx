import { useState } from "react";

/** Catalogue pages keep the illustration on the left and the parts table on the right. */
export default function DiagramThumbnail({ src, title }: { src: string; title: string }) {
  const [preview, setPreview] = useState<string | null>(null);

  const makePreview = (image: HTMLImageElement) => {
    if (image.naturalWidth <= image.naturalHeight) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = Math.round(720 * image.naturalHeight * 0.84 / (image.naturalWidth * 0.485));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, image.naturalWidth * 0.015, image.naturalHeight * 0.06,
        image.naturalWidth * 0.485, image.naturalHeight * 0.84,
        0, 0, canvas.width, canvas.height);

      // Remove blank margins around the drawing, without changing the full-size source.
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (data[i] < 180 && data[i + 1] < 180 && data[i + 2] < 180) {
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
      }
      if (right <= left || bottom <= top) return;
      const cropped = document.createElement("canvas");
      cropped.width = right - left + 17;
      cropped.height = bottom - top + 17;
      const output = cropped.getContext("2d");
      if (!output) return;
      output.drawImage(canvas, left, top, right - left + 1, bottom - top + 1,
        8, 8, right - left + 1, bottom - top + 1);
      setPreview(cropped.toDataURL("image/png"));
    } catch {
      // An unreadable canvas must never prevent opening the original diagram.
      setPreview(null);
    }
  };

  return (
    <div className="aspect-square w-full overflow-hidden bg-diagram-paper p-2">
      <img src={src} crossOrigin="anonymous" alt="" aria-hidden="true" className="hidden"
        loading="lazy" onLoad={(event) => makePreview(event.currentTarget)} />
      <img src={preview ?? src} alt={title} loading="lazy" decoding="async"
        className="h-full w-full object-contain" />
    </div>
  );
}