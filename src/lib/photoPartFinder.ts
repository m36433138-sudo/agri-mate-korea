import { modelsOf } from "@/lib/diagramModelGroup";

type D = { id: string; kind: string; model_name: string | null };

/** 사진으로 찾기에 고를 수 있는 기종 버튼 (부품 도면이 있는 기종만, 공용 책은 각 기종에 펼침) */
export function photoModelOptions(diagrams: D[]): string[] {
  const set = new Set<string>();
  for (const d of diagrams) if (d.kind === "diagram") modelsOf(d.model_name).forEach((m) => m && set.add(m));
  return [...set].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
}

/** 고른 기종의 부품 도면 id (공용 엔진·커터 책 포함, 기계 사진 제외) */
export function diagramIdsForModel(diagrams: D[], model: string): string[] {
  return diagrams.filter((d) => d.kind === "diagram" && modelsOf(d.model_name).includes(model)).map((d) => d.id);
}

/** 사진을 긴 변 max px JPEG data URL로 줄인다 (AI에 보내는 크기·속도 절약) */
export async function toJpegDataUrl(file: File, max = 1600): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  img.close?.();
  return c.toDataURL("image/jpeg", 0.85);
}
