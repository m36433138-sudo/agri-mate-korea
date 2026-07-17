import { useState } from "react";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, MessageSquare, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ShareQuoteDialog({
  open, onOpenChange, targetRef, filename, phoneNumber,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetRef: React.RefObject<HTMLDivElement>;
  filename: string;
  phoneNumber?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const capture = async (): Promise<{ blob: Blob; url: string } | null> => {
    if (!targetRef.current) return null;
    setLoading(true);
    try {
      const canvas = await html2canvas(targetRef.current, { scale: 2, backgroundColor: "#fff", useCORS: true });
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return { blob, url };
    } catch (e: any) {
      toast.error("이미지 생성 실패: " + e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const doDownload = async () => {
    const r = previewUrl ? { blob: null as any, url: previewUrl } : await capture();
    if (!r) return;
    const a = document.createElement("a");
    a.href = r.url; a.download = `${filename}.png`; a.click();
    toast.success("다운로드 완료");
  };

  const doShare = async () => {
    const r = await capture();
    if (!r) return;
    const file = new File([r.blob], `${filename}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename, text: filename });
      } catch (e: any) {
        if (e?.name !== "AbortError") toast.error("공유 실패");
      }
    } else {
      toast("이 기기는 파일 공유를 지원하지 않습니다. 다운로드 후 전송해주세요.");
      doDownload();
    }
  };

  const doSMS = async () => {
    const r = await capture();
    if (!r) return;
    // 문자에는 이미지 첨부 표준 URL이 없어서 이미지 저장 + 문자앱 실행
    const a = document.createElement("a");
    a.href = r.url; a.download = `${filename}.png`; a.click();
    const num = (phoneNumber || "").replace(/\D/g, "");
    setTimeout(() => {
      window.location.href = num ? `sms:${num}` : "sms:";
    }, 300);
  };

  const doPrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreviewUrl(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>견적서 공유</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {previewUrl && (
            <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
              <img src={previewUrl} alt="미리보기" className="w-full" />
            </div>
          )}
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> 이미지 생성 중...</div>}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={doShare} disabled={loading} className="h-16 flex-col gap-1">
              <Share2 className="w-5 h-5" />
              <span className="text-xs">카톡/앱으로 공유</span>
            </Button>
            <Button onClick={doDownload} disabled={loading} variant="secondary" className="h-16 flex-col gap-1">
              <Download className="w-5 h-5" />
              <span className="text-xs">이미지 저장</span>
            </Button>
            <Button onClick={doSMS} disabled={loading} variant="secondary" className="h-16 flex-col gap-1">
              <MessageSquare className="w-5 h-5" />
              <span className="text-xs">문자 (저장+문자앱)</span>
            </Button>
            <Button onClick={doPrint} variant="secondary" className="h-16 flex-col gap-1">
              <Printer className="w-5 h-5" />
              <span className="text-xs">인쇄</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            "카톡/앱으로 공유"는 모바일 브라우저에서 카톡·문자·메일 등 앱 선택창을 띄웁니다. 데스크탑에서는 이미지 저장 후 전송해주세요.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
