import { Button } from "@/components/ui/button";
import { Phone, UserRound } from "lucide-react";

/** 이미 고른 고객을 고정 카드로 보여 준다. 「고객 변경」을 눌러야만 검색이 열린다. */
export function SelectedCustomerCard({
  name,
  phone,
  address,
  onChange,
  changeLabel = "고객 변경",
}: {
  name: string;
  phone?: string | null;
  address?: string | null;
  onChange: () => void;
  changeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <UserRound className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        {phone ? (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
            <Phone className="h-3 w-3" /> {phone}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">전화번호 없음</p>
        )}
        {address && <p className="truncate text-[11px] text-muted-foreground">{address}</p>}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={onChange}>
        {changeLabel}
      </Button>
    </div>
  );
}
