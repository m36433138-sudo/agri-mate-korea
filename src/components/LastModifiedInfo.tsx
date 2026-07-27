import { useProfiles } from "@/hooks/useProfiles";
import { UserCog } from "lucide-react";

type Props = {
  updatedBy?: string | null;
  updatedAt?: string | null;
  className?: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LastModifiedInfo({ updatedBy, updatedAt, className }: Props) {
  const { getDisplayName } = useProfiles();
  if (!updatedBy && !updatedAt) return null;

  const name = updatedBy ? getDisplayName(updatedBy) : "-";
  const when = updatedAt ? formatDateTime(updatedAt) : "";

  return (
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      <UserCog className="h-3.5 w-3.5" />
      <span>
        마지막 수정: <span className="font-medium text-foreground">{name}</span>
        {when && <span className="ml-1">· {when}</span>}
      </span>
    </div>
  );
}
