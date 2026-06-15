import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";

/**
 * Human-friendly relative date label for session timestamps.
 *
 * - Same day   → "14:32"
 * - Yesterday  → "Yesterday"
 * - < 7 days   → "Mon"
 * - Older      → "Jun 3"
 */
export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d))       return format(d, "HH:mm");
  if (isYesterday(d))   return "Yesterday";
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE");
  return format(d, "MMM d");
}

/**
 * Compact relative time for memory fact timestamps.
 *
 * - < 1 min  → "just now"
 * - < 1 hr   → "5m ago"
 * - < 1 day  → "3h ago"
 * - Older    → "2d ago"
 */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
