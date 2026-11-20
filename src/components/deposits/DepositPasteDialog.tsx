import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import { parseDepositSms, splitSmsBatch } from "@/lib/depositSms";
import { fmtDepositTime } from "./useDeposits";

export function DepositPasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const items = useMemo(
    () => splitSmsBatch(text).map((raw) => ({ raw, parsed: parseDepositSms(raw) })),
    [text],
  );
  const valid = items.filter((i) => i.parsed);

  const save = useMutation({
    mutationFn: async () => {
      const rows = valid.map(({ raw, parsed }) => ({
        source: "paste", bank: parsed!.bank, depositor_name: parsed!.depositorName, amount: parsed!.amount,
        deposited_at: parsed!.depositedAt, balance: parsed!.balance, raw_text: raw, dedupe_key: parsed!.dedupeKey,
      }));
      const { data, error } = await (supabase as any).from("bank_deposits")
        .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
      if (error) throw error;
      return { added: data?.length ?? 0, total: rows.length };
    },
    onSuccess: ({ added, total }) => {
      qc.invalidateQueries({ queryKey: ["bank-deposits"] });
      toast({ title: `입금 ${added}건을 확인 대기에 올렸어요`, description: total > added ? `${total - added}건은 이미 들어와 있던 문자예요.` : undefined });
      setText("");
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "올리지 못했어요", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>입금 문자 붙여넣기</DialogTitle>
          <DialogDescription>은행 문자를 복사해 붙여넣으세요. 여러 건은 빈 줄로 나눠 주면 돼요.</DialogDescription>
        </DialogHeader>
        <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"농협 입금610,000원\n11/20 11:26 301-****-1052-31 최영필 잔액128,549,964원"} />
        {items.length > 0 && (
          <div className="rounded-lg border border-border/60 divide-y divide-border/40 max-h-48 overflow-y-auto text-sm">
            {items.map(({ raw, parsed }, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2">
                {parsed ? (
                  <>
                    <span className="text-xs text-muted-foreground shrink-0">{parsed.bank} · {fmtDepositTime(parsed.depositedAt)}</span>
                    <span className="font-medium truncate">{parsed.depositorName ?? "입금자 모름"}</span>
                    <span className="ml-auto font-semibold tabular-nums">{formatPrice(parsed.amount)}</span>
                  </>
                ) : (
                  <span className="text-xs text-destructive truncate">입금 문자로 읽지 못함: {raw.slice(0, 40)}</span>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => save.mutate()} disabled={valid.length === 0 || save.isPending}>
            {valid.length > 0 ? `${valid.length}건 올리기` : "올리기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
