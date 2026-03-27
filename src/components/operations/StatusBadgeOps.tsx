import { Badge } from "@/components/ui/badge";
import { OperationStatus, getTechnicianColor } from "@/types/operations";

const STATUS_STYLES: Record<OperationStatus, string> = {
  입고대기: "bg-orange-100 text-orange-700 ring-orange-600/20",
  수리중: "bg-blue-100 text-blue-700 ring-blue-600/20",
  출고대기: "bg-green-100 text-green-700 ring-green-600/20",
  보류: "bg-gray-100 text-gray-500 ring-gray-500/20",
};

export function OpsStatusBadge({ status }: { status: OperationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function BranchBadge({ branch }: { branch: string }) {
  const isJH = branch === "장흥";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isJH ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-blue-50 text-blue-700 ring-blue-600/20"}`}>
      {branch}
    </span>
  );
}

export function TechBadge({ name }: { name: string }) {
  const color = getTechnicianColor(name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name || "미배정"}
    </span>
  );
}
