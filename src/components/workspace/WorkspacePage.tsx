import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, CheckSquare, BookOpen, FileText, TrendingUp, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import { WorkspaceCalendar } from "./WorkspaceCalendar";
import { TaskBoard } from "./TaskBoard";
import { LogFeed } from "./LogFeed";
import { DocumentList } from "./DocumentList";
import { FinanceDashboard } from "./FinanceDashboard";
import { TaskModal } from "./modals/TaskModal";
import { LogModal } from "./modals/LogModal";
import { DocumentModal } from "./modals/DocumentModal";
import { FinanceModal } from "./modals/FinanceModal";

import { useTasks } from "@/hooks/useTasks";
import { useLogs } from "@/hooks/useLogs";
import { useDocuments } from "@/hooks/useDocuments";
import { useFinance } from "@/hooks/useFinance";
import { useUserRole } from "@/hooks/useUserRole";

import type { Task, Log, Document, FinanceRecord, CalendarEvent, WorkspaceFilters } from "@/types/workspace";
import { CATEGORY_DOT_COLORS, CATEGORY_LABELS } from "@/types/workspace";

type ModalState =
  | { type: "task"; data?: Task }
  | { type: "log"; data?: Log; defaultTaskId?: string }
  | { type: "document"; data?: Document }
  | { type: "finance"; data?: FinanceRecord; defaultDocumentId?: string }
  | null;

export default function WorkspacePage() {
  const { userId } = useUserRole();
  const { tasks } = useTasks();
  const { logs } = useLogs();
  const { documents } = useDocuments();
  const { finance } = useFinance();

  const [modal, setModal] = useState<ModalState>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(true);

  // 공통 필터
  const [filters, setFilters] = useState<WorkspaceFilters>({
    myOnly: true,
    category: "",
    dateFrom: "",
    dateTo: "",
    customerSearch: "",
  });

  const setFilter = (key: keyof WorkspaceFilters, value: string | boolean) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // ── 알림 배지 계산 ──────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const d3 = new Date();
  d3.setDate(d3.getDate() + 3);
  const d3str = d3.toISOString().split("T")[0];

  const urgentCount = useMemo(() => {
    let count = 0;
    tasks.forEach((t) => {
      if (t.status !== "done" && t.due_date && t.due_date <= today) count++;
    });
    finance.forEach((f) => {
      if (!f.is_paid && f.due_date && f.due_date < today) count++;
    });
    documents.forEach((d) => {
      if (d.doc_type === "quotation" && d.valid_until && d.valid_until >= today && d.valid_until <= d3str)
        count++;
    });
    return count;
  }, [tasks, finance, documents, today, d3str]);

  // ── 캘린더 이벤트 ───────────────────────────────────────────
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];

    tasks.forEach((t) => {
      if (!t.due_date) return;
      events.push({
        id: t.id,
        title: t.title,
        date: t.due_date,
        type: "task",
        color: CATEGORY_DOT_COLORS[t.category] ?? "#94A3B8",
      });
    });

    logs.forEach((l) => {
      if (!l.next_action_date) return;
      events.push({
        id: l.id,
        title: l.next_action ?? l.title,
        date: l.next_action_date,
        type: "log",
        color: "#16A34A",
      });
    });

    documents.forEach((d) => {
      if (!d.valid_until) return;
      events.push({
        id: d.id,
        title: `[견적만료] ${d.title}`,
        date: d.valid_until,
        type: "document",
        color: "#EA580C",
      });
    });

    finance.forEach((f) => {
      if (!f.due_date || f.is_paid) return;
      events.push({
        id: f.id,
        title: `[미수금] ${Number(f.amount).toLocaleString("ko-KR")}원`,
        date: f.due_date,
        type: "finance",
        color: "#DC2626",
      });
    });

    return events;
  }, [tasks, logs, documents, finance]);

  // 선택 날짜의 이벤트
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return calendarEvents.filter((e) => e.date === key);
  }, [selectedDate, calendarEvents]);

  // ── 핸들러 ──────────────────────────────────────────────────
  const handleLogCreateTask = (log: Log) => {
    setModal({
      type: "task",
      data: {
        id: "",
        user_id: userId ?? "",
        created_by: userId ?? "",
        title: log.next_action ?? log.title,
        description: `로그 "${log.title}"에서 생성`,
        category: "other",
        priority: "medium",
        status: "todo",
        due_date: log.next_action_date ?? null,
        related_customer_id: log.related_customer_id,
        related_machine_id: log.related_machine_id,
        created_at: "",
      } as Task,
    });
  };

  const todayStr = format(new Date(), "yyyy년 MM월 dd일 (E)", { locale: ko });
  const incompleteTasks = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="space-y-4">
      {/* 상단바 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">내 업무</h1>
          <p className="text-xs text-muted-foreground">{todayStr}</p>
        </div>
        <div className="flex items-center gap-3">
          {incompleteTasks > 0 && (
            <span className="text-xs text-muted-foreground">
              미완료 할 일{" "}
              <span className="font-semibold text-foreground">{incompleteTasks}건</span>
            </span>
          )}
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              🔴 긴급 {urgentCount}건
            </Badge>
          )}
        </div>
      </div>

      {/* 공통 필터 */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border">
        <button
          onClick={() => setFilter("myOnly", !filters.myOnly)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
            filters.myOnly
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted"
          }`}
        >
          {filters.myOnly ? "내 것만" : "전체"}
        </button>

        <Select
          value={filters.category || "_all"}
          onValueChange={(v) => setFilter("category", v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 카테고리</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="h-7 text-xs w-36"
          placeholder="고객명 검색"
          value={filters.customerSearch}
          onChange={(e) => setFilter("customerSearch", e.target.value)}
        />

        <input
          type="date"
          className="h-7 text-xs px-2 border rounded-md bg-background w-36"
          value={filters.dateFrom}
          onChange={(e) => setFilter("dateFrom", e.target.value)}
          placeholder="시작일"
        />
        <span className="text-xs text-muted-foreground">~</span>
        <input
          type="date"
          className="h-7 text-xs px-2 border rounded-md bg-background w-36"
          value={filters.dateTo}
          onChange={(e) => setFilter("dateTo", e.target.value)}
          placeholder="종료일"
        />

        {(filters.category || filters.customerSearch || filters.dateFrom || filters.dateTo) && (
          <button
            onClick={() => setFilters((f) => ({ ...f, category: "", customerSearch: "", dateFrom: "", dateTo: "" }))}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            <X className="h-3 w-3" /> 초기화
          </button>
        )}

        {/* 모바일에서 캘린더 토글 */}
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="ml-auto text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground md:hidden"
        >
          <Calendar className="h-3.5 w-3.5" />
          {showCalendar ? "캘린더 숨기기" : "캘린더 보기"}
        </button>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-col md:flex-row gap-4">

        {/* 좌측: 캘린더 */}
        <div className={`md:w-[300px] md:shrink-0 space-y-3 ${showCalendar ? "" : "hidden md:block"}`}>
          <WorkspaceCalendar
            events={calendarEvents}
            onDateClick={setSelectedDate}
            selectedDate={selectedDate}
          />

          {/* 선택 날짜 이벤트 패널 */}
          {selectedDate && selectedDateEvents.length > 0 && (
            <div className="border rounded-xl p-3 space-y-2 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {format(selectedDate, "MM/dd (E)", { locale: ko })} 일정
                </span>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {selectedDateEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: e.color }}
                  />
                  <span className="truncate">{e.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 탭 */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="tasks">
            <TabsList className="mb-4 h-9">
              <TabsTrigger value="tasks" className="gap-1.5 text-xs">
                <CheckSquare className="h-3.5 w-3.5" />
                할 일
                {incompleteTasks > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] rounded-full px-1.5">
                    {incompleteTasks}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 text-xs">
                <BookOpen className="h-3.5 w-3.5" /> 로그
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> 문서
              </TabsTrigger>
              <TabsTrigger value="finance" className="gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                재무
                {finance.filter((f) => !f.is_paid && f.due_date && f.due_date < today).length > 0 && (
                  <span className="bg-red-100 text-red-600 text-[10px] rounded-full px-1.5">
                    {finance.filter((f) => !f.is_paid && f.due_date && f.due_date < today).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <TaskBoard
                filters={filters}
                onAdd={() => setModal({ type: "task" })}
                onEdit={(task) => setModal({ type: "task", data: task })}
              />
            </TabsContent>

            <TabsContent value="logs">
              <LogFeed
                filters={filters}
                onAdd={() => setModal({ type: "log" })}
                onEdit={(log) => setModal({ type: "log", data: log })}
                onCreateTaskFromLog={handleLogCreateTask}
              />
            </TabsContent>

            <TabsContent value="documents">
              <DocumentList
                filters={filters}
                onAdd={() => setModal({ type: "document" })}
                onEdit={(doc) => setModal({ type: "document", data: doc })}
                onCreateFinance={(docId) => setModal({ type: "finance", defaultDocumentId: docId })}
              />
            </TabsContent>

            <TabsContent value="finance">
              <FinanceDashboard
                filters={filters}
                onAdd={() => setModal({ type: "finance" })}
                onEdit={(record) => setModal({ type: "finance", data: record })}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* FAB */}
      <FabButton
        onTask={() => setModal({ type: "task" })}
        onLog={() => setModal({ type: "log" })}
        onDocument={() => setModal({ type: "document" })}
        onFinance={() => setModal({ type: "finance" })}
      />

      {/* 모달 */}
      <TaskModal
        open={modal?.type === "task"}
        onClose={() => setModal(null)}
        initialData={modal?.type === "task" ? modal.data : undefined}
      />
      <LogModal
        open={modal?.type === "log"}
        onClose={() => setModal(null)}
        initialData={modal?.type === "log" ? modal.data : undefined}
        defaultTaskId={modal?.type === "log" ? modal.defaultTaskId : undefined}
      />
      <DocumentModal
        open={modal?.type === "document"}
        onClose={() => setModal(null)}
        initialData={modal?.type === "document" ? modal.data : undefined}
        onCreateFinance={(docId) => {
          setModal(null);
          setTimeout(() => setModal({ type: "finance", defaultDocumentId: docId }), 100);
        }}
      />
      <FinanceModal
        open={modal?.type === "finance"}
        onClose={() => setModal(null)}
        initialData={modal?.type === "finance" ? modal.data : undefined}
        defaultDocumentId={modal?.type === "finance" ? modal.defaultDocumentId : undefined}
      />
    </div>
  );
}

// ── FAB ──────────────────────────────────────────────────────
function FabButton({
  onTask, onLog, onDocument, onFinance,
}: {
  onTask: () => void;
  onLog: () => void;
  onDocument: () => void;
  onFinance: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    { icon: "✅", label: "할 일 추가",  action: onTask },
    { icon: "📝", label: "로그 기록",   action: onLog },
    { icon: "📄", label: "문서 작성",   action: onDocument },
    { icon: "💰", label: "미수금 등록", action: onFinance },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-50 flex flex-col gap-2">
            {items.map(({ icon, label, action }) => (
              <button
                key={label}
                onClick={() => { setOpen(false); action(); }}
                className="flex items-center gap-2 bg-card border shadow-md rounded-full px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(!open)}
      >
        <Plus className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </Button>
    </div>
  );
}
