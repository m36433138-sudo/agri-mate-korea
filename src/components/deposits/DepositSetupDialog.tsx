import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw } from "lucide-react";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deposit-sms`;

export function DepositSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: token } = useQuery({
    queryKey: ["deposit-sms-token"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("deposit_sms_settings").select("token").eq("id", true).maybeSingle();
      if (error) throw error;
      return (data?.token as string) ?? null;
    },
  });
  const url = token ? `${BASE}?token=${token}` : "";

  const regen = useMutation({
    mutationFn: async () => {
      const t = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error } = await (supabase as any).from("deposit_sms_settings").update({ token: t, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-sms-token"] });
      toast({ title: "새 주소를 만들었어요", description: "휴대폰 앱에 새 주소를 다시 넣어야 해요. 예전 주소는 더 이상 받지 않아요." });
    },
  });

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast({ title: "주소를 복사했어요" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>입금 문자 자동 받기 설정</DialogTitle>
          <DialogDescription>입금 문자가 오는 휴대폰에서 한 번만 설정하면, 문자가 올 때마다 확인 대기 목록에 자동으로 떠요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <p className="font-medium">받는 주소 (남에게 알려주지 마세요)</p>
            <div className="flex gap-2">
              <Input readOnly value={url || "불러오는 중..."} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button size="icon" variant="outline" onClick={copy} disabled={!url} aria-label="주소 복사"><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
            <li><b className="text-foreground">안드로이드</b>: Play 스토어에서 「SMS Forwarder」(문자 자동 전달) 같은 앱을 설치해요.</li>
            <li>전달 규칙을 하나 만들고, 보내는 사람을 은행 번호(농협 1588-2100 / 1661-3000, 수협 1588-1515 등) 또는 내용에 「입금」이 들어간 문자로 정해요.</li>
            <li>전달 방법은 <b className="text-foreground">웹훅(Webhook) · POST</b>, 주소에 위 주소를 붙여넣어요. 보낼 내용에는 문자 본문(예: <code>%text%</code> 또는 <code>{"{msg}"}</code>)만 넣으면 돼요.</li>
            <li><b className="text-foreground">아이폰</b>: 단축어 앱 → 자동화 → 「메시지」(내용에 입금 포함) → 「URL의 콘텐츠 가져오기」에서 방법 POST, 주소 붙여넣기, 본문에 메시지 내용을 넣어요.</li>
            <li>설정 후 시험 입금 문자가 오면 30초 안에 이 화면 「입금 확인 대기」에 떠요.</li>
          </ol>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">휴대폰을 잃어버렸거나 주소가 새어 나갔다면 새로 만들어 주세요.</p>
            <Button size="sm" variant="outline" onClick={() => regen.mutate()} disabled={regen.isPending}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> 새 주소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
