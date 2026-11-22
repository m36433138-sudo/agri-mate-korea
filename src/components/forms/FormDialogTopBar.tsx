import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

/**
 * 휴대폰에서는 전체 화면, PC에서는 기존 크기의 입력 창.
 * 바깥을 눌러도 닫히지 않게 하고(onInteractOutside), 닫기·저장은 위쪽 막대에서만 한다.
 */
export const formDialogContentClass = cn(
  "max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0",
  "max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
  "max-sm:px-4 max-sm:pt-0 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:gap-3",
  "max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=open]:slide-in-from-top-0",
  "max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=closed]:slide-out-to-top-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100",
);

/** 창 안의 스크롤 영역에 붙이는 좌우 여백 상쇄 (DialogContent 패딩과 맞춤) */
export const formDialogBodyClass = "-mx-6 px-6 max-sm:-mx-4 max-sm:px-4";

export function FormDialogTopBar({
  title,
  onClose,
  onSave,
  saving,
  saveDisabled,
  saveLabel = "저장",
  extra,
}: {
  title: ReactNode;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="-mx-6 -mt-6 px-6 pt-4 pb-3 border-b bg-background sm:rounded-t-lg max-sm:-mx-4 max-sm:mt-0 max-sm:px-3 max-sm:pt-[max(0.5rem,env(safe-area-inset-top))] max-sm:pb-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="lg" className="h-11 px-3 gap-1 shrink-0" onClick={onClose}>
          <X className="h-5 w-5" /> 닫기
        </Button>
        <DialogTitle className="flex-1 min-w-0 truncate text-center text-base sm:text-lg flex items-center justify-center gap-2">
          {title}
        </DialogTitle>
        <Button type="button" size="lg" className="h-11 px-4 gap-1 shrink-0" onClick={onSave} disabled={saveDisabled || saving}>
          <Check className="h-5 w-5" /> {saving ? "저장 중..." : saveLabel}
        </Button>
      </div>
      {extra}
    </div>
  );
}
