export function formatPrice(price: number | null | undefined): string {
  if (price == null || isNaN(price as number)) return "-";
  return `₩${Number(price).toLocaleString("ko-KR")}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("ko-KR");
}
