import { Badge } from "@/components/ui/badge";
import { OperationStatus, getTechnicianColor } from "@/types/operations";

const STATUS_STYLES: Record<OperationStatus, string> = {
  입고대기: "bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-orange-600/20",
  수리대기: "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 ring-yellow-600/20",
  수리중: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-600/20",
  수리완료: "bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 ring-teal-600/20",
  출고대기: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 ring-green-600/20",
  보류: "bg-gray-100 dark:bg-gray-500/15 text-gray-500 ring-gray-500/20",
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
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isJH ? "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 ring-green-600/20" : "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-600/20"}`}>
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
