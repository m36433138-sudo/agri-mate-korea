import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";

export type ErrorCodeRow = {
  id: string;
  repair_id: string;
  error_code: string;
  symptom: string | null;
  action_taken: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repair: any | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function RepairErrorCodeDialog({ open, onOpenChange, repair }: Props) {
  const qc = useQueryClient();
  const repairId = repair?.id as string | undefined;

  const [code, setCode] = useState("");
  const [symptom, setSymptom] = useState("");
  const [action, setAction] = useState("");
  const [resolved, setResolved] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["repair-error-codes", repairId],
    enabled: !!repairId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_error_codes" as any)
        .select("*")
        .eq("repair_id", repairId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ErrorCodeRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["repair-error-codes"] });
    qc.invalidateQueries({ queryKey: ["error-code-log"] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("repair_error_codes" as any).insert({
        repair_id: repairId,
        error_code: code.trim().toUpperCase(),
        symptom: symptom.trim() || null,
        action_taken: action.trim() || null,
        is_resolved: resolved,
        resolved_at: resolved ? today() : null,
        notes: notes.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setCode("");
      setSymptom("");
      setAction("");
      setNotes("");
      setResolved(false);
      invalidate();
      toast({ title: "에러코드 기록이 추가되었습니다." });
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ErrorCodeRow> }) => {
      const { error } = await supabase
        .from("repair_error_codes" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "수정 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repair_error_codes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "삭제되었습니다." });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            에러코드 기록
          </DialogTitle>
        </DialogHeader>

        {repair && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">
              {repair.machines?.model_name} {repair.machines?.serial_number && (
                <span className="font-mono text-xs text-muted-foreground">({repair.machines.serial_number})</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(repair.repair_date)} · {repair.machines?.customers?.name || "고객 미지정"} · {repair.technician || "담당 미지정"}
            </p>
          </div>
        )}

        {/* 신규 입력 */}
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label>에러코드 *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: E-102, P0217"
                className="font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>증상</Label>
              <Input value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="예: 출력 저하 후 경고등 점등" />
            </div>
          </div>
          <div>
            <Label>조치 내용</Label>
            <Textarea value={action} onChange={(e) => setAction(e.target.value)} rows={2} placeholder="예: DPF 강제 재생 후 압력센서 교체" />
          </div>
          <div>
            <Label>비고</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="추가 참고 사항" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={resolved} onCheckedChange={(v) => setResolved(!!v)} />
              조치 완료
            </label>
            <Button
              size="sm"
              disabled={!code.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              <Plus className="h-4 w-4 mr-1" /> 기록 추가
            </Button>
          </div>
        </div>

        {/* 기록 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">아직 기록된 에러코드가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{r.error_code}</Badge>
                  {r.is_resolved ? (
                    <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40">
                      <CheckCircle2 className="h-3 w-3" /> 조치완료
                      {r.resolved_at && <span className="ml-1">{formatDate(r.resolved_at)}</span>}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/40">
                      <AlertTriangle className="h-3 w-3" /> 미조치
                    </Badge>
                  )}
                  <div className="flex-1" />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={r.is_resolved}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({
                          id: r.id,
                          patch: { is_resolved: !!v, resolved_at: v ? today() : null },
                        })
                      }
                    />
                    완료
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("이 에러코드 기록을 삭제할까요?")) deleteMutation.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {r.symptom && <p className="text-sm"><span className="text-muted-foreground">증상 </span>{r.symptom}</p>}
                {r.action_taken && <p className="text-sm"><span className="text-muted-foreground">조치 </span>{r.action_taken}</p>}
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
