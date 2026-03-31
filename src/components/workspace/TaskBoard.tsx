import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Link2 } from "lucide-react";
import type { Task, WorkspaceFilters } from "@/types/workspace";
import {
  CATEGORY_COLORS, CATEGORY_LABELS, PRIORITY_COLORS,
  PRIORITY_LABELS, STATUS_LABELS,
} from "@/types/workspace";
import { useTasks } from "@/hooks/useTasks";
import { useProfiles } from "@/hooks/useProfiles";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const STATUS_COLS: Array<{ key: Task["status"]; label: string; color: string }> = [
  { key: "todo",        label: "미완료",  color: "border-slate-200" },
  { key: "in_progress", label: "진행중",  color: "border-yellow-200" },
  { key: "done",        label: "완료",    color: "border-green-200" },
];

interface Props {
  filters: WorkspaceFilters;
  onAdd: () => void;
  onEdit: (task: Task) => void;
}

export function TaskBoard({ filters, onAdd, onEdit }: Props) {
  const { tasks, isLoading, deleteTask, updateTask } = useTasks();
  const { getDisplayName } = useProfiles();
  const { userId, isAdmin } = useUserRole();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  // 필터 적용
  const filtered = tasks.filter((t) => {
    if (filters.myOnly && t.user_id !== userId && t.created_by !== userId) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.dateFrom && t.due_date && t.due_date < filters.dateFrom) return false;
    if (filters.dateTo && t.due_date && t.due_date > filters.dateTo) return false;
    if (filters.customerSearch) {
      const search = filters.customerSearch.toLowerCase();
      const customerName = t.customers?.name?.toLowerCase() ?? "";
      if (!customerName.includes(search) && !t.title.toLowerCase().includes(search))
        return false;
    }
    return true;
  });

  const handleDelete = async (task: Task) => {
    if (!window.confirm(`"${task.title}" 을 삭제하시겠어요?`)) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast({ title: "삭제됐어요." });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  const handleStatusChange = async (task: Task, newStatus: Task["status"]) => {
    await updateTask.mutateAsync({ id: task.id, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> 할 일 추가
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLS.map(({ key, label, color }) => {
          const colTasks = filtered.filter((t) => t.status === key);
          return (
            <div key={key} className={`border-t-2 ${color} pt-3 space-y-2`}>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-sm font-semibold text-foreground/80">{label}</span>
                <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
                  {colTasks.length}
                </span>
              </div>

              {colTasks.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg">
                  없음
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    today={today}
                    assigneeName={getDisplayName(task.user_id)}
                    canEdit={isAdmin || task.user_id === userId || task.created_by === userId}
                    onEdit={() => onEdit(task)}
                    onDelete={() => handleDelete(task)}
                    onStatusChange={(s) => handleStatusChange(task, s)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task, today, assigneeName, canEdit, onEdit, onDelete, onStatusChange,
}: {
  task: Task;
  today: string;
  assigneeName: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: Task["status"]) => void;
}) {
  const isOverdue = task.status !== "done" && task.due_date && task.due_date < today;

  return (
    <div
      className={`bg-card border rounded-lg p-3 space-y-2 hover:shadow-sm transition-shadow
        ${isOverdue ? "border-red-200 bg-red-50/50" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[task.category]}`}
        >
          {CATEGORY_LABELS[task.category]}
        </Badge>
        <span className={`text-[11px] font-medium ${PRIORITY_COLORS[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <div className="flex items-center gap-1">
          <span>담당: {assigneeName}</span>
        </div>
        {task.due_date && (
          <div className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
            <span>
              {isOverdue ? "⚠ " : ""}마감:{" "}
              {format(new Date(task.due_date), "MM/dd (E)", { locale: ko })}
            </span>
          </div>
        )}
        {task.customers && (
          <div className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            <span>{task.customers.name}</span>
          </div>
        )}
      </div>

      {/* 상태 변경 버튼 */}
      {canEdit && task.status !== "done" && (
        <button
          onClick={() =>
            onStatusChange(task.status === "todo" ? "in_progress" : "done")
          }
          className="w-full text-[11px] text-muted-foreground hover:text-foreground border border-dashed rounded py-0.5 hover:border-solid hover:bg-muted transition-all"
        >
          {task.status === "todo" ? "→ 진행중으로" : "→ 완료로"}
        </button>
      )}
    </div>
  );
}
