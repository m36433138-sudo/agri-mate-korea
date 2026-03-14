export function formatPrice(price: number): string {
  return `₩${price.toLocaleString("ko-KR")}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR");
}
