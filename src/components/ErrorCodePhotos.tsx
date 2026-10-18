import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon, Loader2 } from "lucide-react";

export const ERROR_CODE_PHOTO_BUCKET = "error-code-photos";

export default function ErrorCodePhotos({ paths }: { paths: string[] }) {
  const [viewer, setViewer] = useState<string | null>(null);
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["error-code-photos", paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(ERROR_CODE_PHOTO_BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      if (data?.some((photo) => photo.error)) throw new Error("사진을 불러오지 못했습니다.");
      return data ?? [];
    },
  });
  if (!paths.length) return null;
  return <>
    <div className="flex flex-wrap gap-2 pt-2">
      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {isError && <Button size="sm" variant="outline" onClick={() => refetch()}><ImageIcon className="mr-1 h-4 w-4" />사진 다시 불러오기</Button>}
      {data.map((photo) => photo.signedUrl && <Button key={photo.path} variant="ghost" className="h-20 w-20 overflow-hidden rounded-md p-0" aria-label="에러코드 사진 크게 보기" onClick={() => setViewer(photo.signedUrl)}>
        <img src={photo.signedUrl} alt="에러코드 증상 및 조치 사진" className="h-full w-full object-cover" />
      </Button>)}
    </div>
    <Dialog open={!!viewer} onOpenChange={() => setViewer(null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>에러코드 사진</DialogTitle></DialogHeader>
        {viewer && <img src={viewer} alt="에러코드 증상 및 조치 사진 확대" className="max-h-[75vh] w-full object-contain" />}
      </DialogContent>
    </Dialog>
  </>;
}