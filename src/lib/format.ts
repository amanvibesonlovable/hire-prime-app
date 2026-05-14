import { formatDistanceToNow } from "date-fns";

export function relTime(date: string | Date | null | undefined) {
  if (!date) return "—";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "—";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatSalary(min?: number | null, max?: number | null, currency = "INR") {
  if (!min && !max) return "Not specified";
  const sym = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => sym + n.toLocaleString();
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt((min || max)!);
}
