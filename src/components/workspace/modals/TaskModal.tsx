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
import { useTasks } from "@/hooks/useTasks";
import { useProfiles } from "@/hooks/useProfiles";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskCategory, TaskPriority, TaskStatus } from "@/types/workspace";
import {
  CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, TEAM_DEFAULT_CATEGORY,
} from "@/types/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Task;
}

export function TaskModal({ open, onClose, initialData }: Props) {
  const { userId, profile } = useUserRole();
  const { profiles } = useProfiles();
  const { addTask, updateTask } = useTasks();
  const { toast } = useToast();

  const teamDefault: TaskCategory =
    TEAM_DEFAULT_CATEGORY[(profile as any)?.team ?? ""] ?? "other";

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: teamDefault as string,
    priority: "medium" as string,
    status: "todo" as string,
    due_date: "",
    user_id: userId ?? "",
    related_customer_id: "",
    related_machine_id: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title,
        description: initialData.description ?? "",
        category: initialData.category,
        priority: initialData.priority,
        status: initialData.status,
        due_date: initialData.due_date ?? "",
        user_id: initialData.user_id,
        related_customer_id: initialData.related_customer_id ?? "",
        related_machine_id: initialData.related_machine_id ?? "",
      });
    } else {
      setForm((f) => ({
        ...f,
        title: "",
        description: "",
        category: teamDefault,
        priority: "medium",
        status: "todo",
        due_date: "",
        user_id: userId ?? "",
        related_customer_id: "",
        related_machine_id: "",
      }));
    }
  }, [initialData, open, userId, teamDefault]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !userId) return;

    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      category: form.category as TaskCategory,
      priority: form.priority as TaskPriority,
      status: form.status as TaskStatus,
      due_date: form.due_date || null,
      user_id: form.user_id || userId,
      created_by: initialData?.created_by ?? userId,
      related_customer_id: form.related_customer_id || null,
      related_machine_id: form.related_machine_id || null,
    };

    try {
      if (initialData && initialData.id) {
        await updateTask.mutateAsync({ id: initialData.id, ...payload });
        toast({ title: "할 일이 수정됐어요." });
      } else {
        await addTask.mutateAsync(payload);
        toast({ title: "할 일이 추가됐어요." });
      }
      onClose();
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    }
  };

  // 직원 목록 (담당자 선택용)
  const employees = profiles.filter((p) => p.team !== null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData && initialData.id ? "할 일 수정" : "할 일 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="할 일 제목을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>카테고리</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>우선순위</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>마감일</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>담당자</Label>
            <Select value={form.user_id} onValueChange={(v) => set("user_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>
              <SelectContent>
                {employees.length > 0
                  ? employees.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name ?? "이름 없음"} {p.team ? `(${p.team})` : ""}
                      </SelectItem>
                    ))
                  : userId && (
                      <SelectItem value={userId}>나</SelectItem>
                    )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="추가 내용을 입력하세요"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.title.trim() || addTask.isPending || updateTask.isPending}
          >
            {initialData && initialData.id ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
