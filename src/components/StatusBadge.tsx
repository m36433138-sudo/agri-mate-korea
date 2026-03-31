import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  if (status === "재고중") return <Badge variant="stock">재고중</Badge>;
  if (status === "판매완료") return <Badge variant="sold">판매완료</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export function TypeBadge({ type }: { type: string }) {
  if (type === "새기계") return <Badge variant="newMachine">새기계</Badge>;
  if (type === "중고기계") return <Badge variant="usedMachine">중고기계</Badge>;
  if (type === "타사구매") return <Badge variant="outline" className="border-orange-400 text-orange-600">타사구매</Badge>;
  return <Badge variant="secondary">{type}</Badge>;
}
