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
