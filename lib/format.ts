export function formatNumber(num: string | number): string {
  const n = typeof num === "string" ? parseInt(num, 10) : num;
  if (isNaN(n)) return "0";
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + "B";
  if (n >= 1000000) return (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}
