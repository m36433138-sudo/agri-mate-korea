import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Link2, ChevronRight } from "lucide-react";
import type { Log, WorkspaceFilters } from "@/types/workspace";
import { LOG_TYPE_ICONS, LOG_TYPE_LABELS } from "@/types/workspace";
import { useLogs } from "@/hooks/useLogs";
import { useProfiles } from "@/hooks/useProfiles";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  filters: WorkspaceFilters;
  onAdd: () => void;
  onEdit: (log: Log) => void;
  onCreateTaskFromLog: (log: Log) => void;
}

export function LogFeed({ filters, onAdd, onEdit, onCreateTaskFromLog }: Props) {
  const { logs, isLoading, deleteLog } = useLogs();
  const { getDisplayName } = useProfiles();
  const { userId, isAdmin } = useUserRole();
  const { toast } = useToast();

  // 필터 적용
  const filtered = logs.filter((l) => {
    if (filters.myOnly && l.logged_by !== userId) return false;
    if (filters.dateFrom) {
      const logDate = l.log_date.split("T")[0];
      if (logDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const logDate = l.log_date.split("T")[0];
      if (logDate > filters.dateTo) return false;
    }
    if (filters.customerSearch) {
      const search = filters.customerSearch.toLowerCase();
      const customerName = l.customers?.name?.toLowerCase() ?? "";
      if (!customerName.includes(search) && !l.title.toLowerCase().includes(search))
        return false;
    }
    return true;
  });

  const handleDelete = async (log: Log) => {
    if (!window.confirm(`"${log.title}" 로그를 삭제하시겠어요?`)) return;
    try {
      await deleteLog.mutateAsync(log.id);
      toast({ title: "삭제됐어요." });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
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
          <Plus className="h-3.5 w-3.5" /> 로그 기록
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
          기록된 로그가 없어요
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <LogItem
              key={log.id}
              log={log}
              authorName={getDisplayName(log.logged_by)}
              canEdit={isAdmin || log.logged_by === userId}
              onEdit={() => onEdit(log)}
              onDelete={() => handleDelete(log)}
              onCreateTask={() => onCreateTaskFromLog(log)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LogItem({
  log, authorName, canEdit, onEdit, onDelete, onCreateTask,
}: {
  log: Log;
  authorName: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCreateTask: () => void;
}) {
  const icon = LOG_TYPE_ICONS[log.log_type] ?? "📌";
  const typeLabel = LOG_TYPE_LABELS[log.log_type];

  let logDateStr = "";
  try {
    logDateStr = format(parseISO(log.log_date), "MM/dd (E) HH:mm", { locale: ko });
  } catch {
    logDateStr = log.log_date.slice(0, 16);
  }

  return (
    <div className="bg-card border rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-base shrink-0 mt-0.5">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* 헤더 라인 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                {typeLabel}
              </span>
              <span className="text-sm font-medium truncate">{log.title}</span>
            </div>
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

          {/* 내용 */}
          {log.content && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.content}</p>
          )}

          {/* 메타 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
            <span>{authorName}</span>
            <span>{logDateStr}</span>
            {log.customers && (
              <span className="flex items-center gap-0.5">
                <Link2 className="h-3 w-3" />{log.customers.name}
              </span>
            )}
          </div>

          {/* 다음 액션 */}
          {log.next_action && (
            <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs text-blue-700">
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">다음 액션:</span>
                <span>{log.next_action}</span>
                {log.next_action_date && (
                  <span className="text-blue-500">
                    ({format(new Date(log.next_action_date), "MM/dd", { locale: ko })})
                  </span>
                )}
              </div>
              <button
                onClick={onCreateTask}
                className="text-[10px] text-blue-600 hover:text-blue-800 underline whitespace-nowrap ml-2"
              >
                할 일로 생성
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
