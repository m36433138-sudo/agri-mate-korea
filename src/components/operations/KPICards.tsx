import { SheetRow, getStatus, OperationStatus } from "@/types/operations";
import { Package, Wrench, Truck, CheckCircle2 } from "lucide-react";

interface KPICardsProps {
  data: SheetRow[];
  activeFilter: OperationStatus | null;
  onFilter: (status: OperationStatus | null) => void;
}

export function KPICards({ data, activeFilter, onFilter }: KPICardsProps) {
  const counts = { 입고대기: 0, 수리중: 0, 출고대기: 0, 완료: 0 };
  data.forEach(row => { counts[getStatus(row)]++; });

  const cards = [
    { status: "입고대기" as OperationStatus, icon: Package, color: "text-orange-600 bg-orange-100", count: counts.입고대기 },
    { status: "수리중" as OperationStatus, icon: Wrench, color: "text-blue-600 bg-blue-100", count: counts.수리중 },
    { status: "출고대기" as OperationStatus, icon: Truck, color: "text-green-600 bg-green-100", count: counts.출고대기 },
    { status: "완료" as OperationStatus, icon: CheckCircle2, color: "text-gray-500 bg-gray-100", count: counts.완료 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <button
          key={c.status}
          onClick={() => onFilter(activeFilter === c.status ? null : c.status)}
          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md ${activeFilter === c.status ? "ring-2 ring-primary border-primary" : "border-border"}`}
        >
          <div className={`rounded-lg p-2 ${c.color}`}>
            <c.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{c.count}</p>
            <p className="text-xs text-muted-foreground">{c.status}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
