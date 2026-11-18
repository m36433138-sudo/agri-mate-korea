import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import DiagramThumbnail from "@/components/diagrams/DiagramThumbnail";
import { useDiagramImageUrl, type Diagram } from "@/hooks/useDiagrams";

/** 미리 만든 썸네일(thumbs/)을 쓰고, 없거나 깨지면 원본을 받아 잘라서 보여준다 */
export function SlowThumb({ diagram }: { diagram: Diagram }) {
  const { data: url } = useDiagramImageUrl(diagram.image_path);
  return url ? <DiagramThumbnail key={url} src={url} title={diagram.title} /> : <Skeleton className="w-full aspect-square" />;
}

export function FastThumb({ thumb, diagram }: { thumb: string; diagram: Diagram }) {
  const [bad, setBad] = useState(false);
  if (bad) return <SlowThumb diagram={diagram} />;
  return (
    <div className="aspect-square w-full overflow-hidden bg-[hsl(var(--diagram-paper))] p-1.5">
      <img src={thumb} alt={diagram.title} loading="lazy" decoding="async" onError={() => setBad(true)} className="h-full w-full object-contain" />
    </div>
  );
}

/** thumb: 주소 = 빠른 썸네일, null = 썸네일 없음(원본 사용), undefined = 아직 불러오는 중 */
export default function DiagramThumb({ diagram, thumb }: { diagram: Diagram; thumb: string | null | undefined }) {
  if (thumb) return <FastThumb thumb={thumb} diagram={diagram} />;
  if (thumb === null) return <SlowThumb diagram={diagram} />;
  return <Skeleton className="w-full aspect-square" />;
}
