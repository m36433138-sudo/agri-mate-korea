import { qtyChoices } from "@/lib/insuranceEstimate";
import { cn } from "@/lib/utils";

type Props = {
  /** 도면 소요 수량 ("YH6140 1 / YH7140 2" 등) */
  note: string | null | undefined;
  machineModel: string | null | undefined;
  value: number;
  onPick: (qty: number) => void;
  className?: string;
};

/** 도면에 적힌 기종별 소요 수량을 눌러서 견적 수량으로 고른다 */
export default function QtyNoteChips({ note, machineModel, value, onPick, className }: Props) {
  const choices = qtyChoices(note, machineModel);
  if (choices.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} role="group" aria-label="도면 기종별 수량">
      <span className="text-[10px] text-muted-foreground">도면 수량</span>
      {choices.map((c, i) => {
        const label = c.models.length ? c.models.join("·") : "";
        if (c.qty == null) {
          return <span key={i} className="rounded-md border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground" title="이 기종에는 안 쓰이는 부품">{label} 안 씀</span>;
        }
        const active = value === c.qty;
        return (
          <button key={i} type="button" onClick={() => onPick(c.qty!)} aria-pressed={active}
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] leading-tight transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
              c.matched && !active && "border-primary/60 text-primary",
            )}>
            {label && <span className="mr-0.5">{label}</span>}<b>{c.qty}개</b>{c.matched && <span className="ml-0.5 opacity-80">(이 기계)</span>}
          </button>
        );
      })}
    </div>
  );
}
