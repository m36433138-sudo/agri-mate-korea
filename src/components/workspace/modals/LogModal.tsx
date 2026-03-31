import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLogs } from "@/hooks/useLogs";
import { useTasks } from "@/hooks/useTasks";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import type { Log, LogType } from "@/types/workspace";
import { LOG_TYPE_LABELS, LOG_TYPE_ICONS } from "@/types/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Log;
  defaultTaskId?: string;
}

export function LogModal({ open, onClose, initialData, defaultTaskId }: Props) {
  const { userId } = useUserRole();
  const { addLog, updateLog } = useLogs();
  const { tasks } = useTasks();
  const { toast } = useToast();

  const now = new Date().toISOString().slice(0, 16); // datetime-local format

  const [form, setForm] = useState({
    log_type: "call" as string,
    log_date: now,
    title: "",
    content: "",
    related_customer_id: "",
    related_machine_id: "",
    related_task_id: defaultTaskId ?? "",
    next_action: "",
    next_action_date: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        log_type: initialData.log_type,
        log_date: initialData.log_date?.slice(0, 16) ?? now,
        title: initialData.title,
        content: initialData.content ?? "",
        related_customer_id: initialData.related_customer_id ?? "",
        related_machine_id: initialData.related_machine_id ?? "",
        related_task_id: initialData.related_task_id ?? "",
        next_action: initialData.next_action ?? "",
        next_action_date: initialData.next_action_date ?? "",
      });
    } else {
      setForm({
        log_type: "call",
        log_date: new Date().toISOString().slice(0, 16),
        title: "",
        content: "",
        related_customer_id: "",
        related_machine_id: "",
        related_task_id: defaultTaskId ?? "",
        next_action: "",
        next_action_date: "",
      });
    }
  }, [initialData, open, defaultTaskId]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !userId) return;

    const payload = {
      logged_by: initialData?.logged_by ?? userId,
      log_type: form.log_type as LogType,
      log_date: form.log_date,
      title: form.title.trim(),
      content: form.content || null,
      related_customer_id: form.related_customer_id || null,
      related_machine_id: form.related_machine_id || null,
      related_task_id: form.related_task_id || null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
    };

    try {
      if (initialData) {
        await updateLog.mutateAsync({ id: initialData.id, ...payload });
        toast({ title: "로그가 수정됐어요." });
      } else {
        await addLog.mutateAsync(payload);
        toast({ title: "로그가 저장됐어요." });
      }
      onClose();
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "로그 수정" : "로그 기록"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>유형 *</Label>
              <Select value={form.log_type} onValueChange={(v) => set("log_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOG_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {LOG_TYPE_ICONS[v as LogType]} {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>일시</Label>
              <Input
                type="datetime-local"
                value={form.log_date}
                onChange={(e) => set("log_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예: 홍길동 고객 전화 상담"
            />
          </div>

          <div className="space-y-1.5">
            <Label>내용</Label>
            <Textarea
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              placeholder="상담 내용, 처리 사항 등"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>다음 액션</Label>
              <Input
                value={form.next_action}
                onChange={(e) => set("next_action", e.target.value)}
                placeholder="예: 견적서 발송"
              />
            </div>
            <div className="space-y-1.5">
              <Label>다음 액션 날짜</Label>
              <Input
                type="date"
                value={form.next_action_date}
                onChange={(e) => set("next_action_date", e.target.value)}
              />
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="space-y-1.5">
              <Label>연결 할 일</Label>
              <Select
                value={form.related_task_id}
                onValueChange={(v) => set("related_task_id", v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="할 일 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">없음</SelectItem>
                  {tasks.slice(0, 30).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.title.trim() || addLog.isPending || updateLog.isPending}
          >
            {initialData ? "수정" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
