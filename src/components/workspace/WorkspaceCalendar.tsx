import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/types/workspace";

interface Props {
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  selectedDate: Date | null;
}

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function WorkspaceCalendar({ events, onDateClick, selectedDate }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // 날짜별 이벤트 맵 (YYYY-MM-DD → CalendarEvent[])
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      if (!e.date) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  return (
    <div className="bg-card border rounded-xl p-4 select-none">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">
          {format(currentMonth, "yyyy년 MM월", { locale: ko })}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-medium pb-1 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventMap[key] ?? [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);
          const dayOfWeek = day.getDay();

          // 중복 없이 최대 3개 색상 도트
          const uniqueColors = [...new Set(dayEvents.map((e) => e.color))].slice(0, 3);

          return (
            <button
              key={key}
              onClick={() => onDateClick(day)}
              className={`
                relative flex flex-col items-center py-1 rounded-lg transition-colors
                ${isCurrentMonth ? "hover:bg-muted" : "opacity-30"}
                ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary" : ""}
              `}
            >
              <span
                className={`text-xs leading-none font-medium w-6 h-6 flex items-center justify-center rounded-full
                  ${isTodayDay && !isSelected ? "bg-primary/10 text-primary font-bold" : ""}
                  ${isSelected ? "text-primary-foreground" : ""}
                  ${dayOfWeek === 0 && !isSelected ? "text-red-500" : ""}
                  ${dayOfWeek === 6 && !isSelected ? "text-blue-500" : ""}
                `}
              >
                {format(day, "d")}
              </span>

              {/* 이벤트 도트 */}
              {uniqueColors.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {uniqueColors.map((color, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? "white" : color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 오늘로 돌아가기 */}
      {!isSameMonth(currentMonth, new Date()) && (
        <div className="mt-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setCurrentMonth(new Date())}
          >
            오늘로 돌아가기
          </Button>
        </div>
      )}
    </div>
  );
}
