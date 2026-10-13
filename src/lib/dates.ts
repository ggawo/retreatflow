/**
 * Utilities for retreat date calculation and formatting.
 * Ensures inclusive calculation of start date, end date, and all in-between days
 * without any timezone offsets (parsing ISO dates to local noon).
 */

export interface RetreatDayOption {
  dateStr: string; // "2026-10-09"
  shortLabel: string; // "Oct 9 (Fri)"
  fullLabel: string; // "Oct 9, 2026 (Friday)"
  dayName: string; // "Friday"
  monthDay: string; // "Oct 9"
  year: number; // 2026
  dayNumber: number; // 1, 2, 3...
  tag: "Start Date" | "End Date" | "In-Between" | "Single Day";
  isStart: boolean;
  isEnd: boolean;
}

/**
 * Robustly parses any date representation into a local Date object set at noon
 * to avoid daylight saving time transitions and timezone day-skipping bugs.
 */
export function parseDateSafe(input?: string | null): Date | null {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;

  // 1. Matches YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  // 2. Matches MM/DD/YYYY or M/D/YYYY
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10) - 1;
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  // 3. Matches month name formats: "Friday Oct 9/2026", "Oct 9/2026", "Oct 9, 2026", "October 9, 2026"
  // Clean off weekday prefix if present
  const cleaned = str
    .replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+/i, "")
    .replace(/\//g, " ");

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
  }

  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate(), 12, 0, 0);
  }

  return null;
}

/**
 * Normalizes any string representation of a date to YYYY-MM-DD for HTML date inputs.
 */
export function toDateInputValue(str?: string | null): string {
  if (!str) return "";
  const d = parseDateSafe(str);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats a date into a clean human readable string: e.g. "Oct 9, 2026"
 */
export function formatHumanDate(str?: string | null): string {
  if (!str) return "";
  const d = parseDateSafe(str);
  if (!d) return str;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Formats a date range into a clean human readable string: e.g. "Oct 9 – 11, 2026"
 */
export function formatHumanDateRange(startDateStr?: string | null, endDateStr?: string | null): string {
  const start = parseDateSafe(startDateStr);
  const end = parseDateSafe(endDateStr) || start;
  if (!start) return "";
  if (!end || start.getTime() === end.getTime()) {
    return formatHumanDate(startDateStr);
  }

  const sMonth = start.toLocaleDateString("en-US", { month: "short" });
  const eMonth = end.toLocaleDateString("en-US", { month: "short" });
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sYear = start.getFullYear();
  const eYear = end.getFullYear();

  if (sYear === eYear) {
    if (sMonth === eMonth) {
      return `${sMonth} ${sDay}–${eDay}, ${sYear}`;
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${sYear}`;
  }
  return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`;
}

/**
 * Returns an array of all inclusive days from startDate to endDate.
 * The first item is ALWAYS the Start Date.
 * The last item is ALWAYS the End Date.
 * Any days in between are included in chronological order.
 */
export function getInclusiveRetreatDays(startDateStr?: string | null, endDateStr?: string | null): RetreatDayOption[] {
  const start = parseDateSafe(startDateStr) || parseDateSafe("2026-10-09") || new Date(2026, 9, 9, 12, 0, 0);
  const end = parseDateSafe(endDateStr) || start;

  if (start > end) {
    // If start is after end, treat as single day
    const y = start.getFullYear();
    const dayName = start.toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const dNum = String(start.getDate()).padStart(2, "0");
    const isoDate = `${y}-${m}-${dNum}`;
    return [{
      dateStr: isoDate,
      shortLabel: `${monthDay} (${dayName.slice(0, 3)})`,
      fullLabel: `${monthDay}, ${y} (${dayName})`,
      dayName,
      monthDay,
      year: y,
      dayNumber: 1,
      tag: "Single Day",
      isStart: true,
      isEnd: true,
    }];
  }

  const days: RetreatDayOption[] = [];
  const cur = new Date(start.getTime());
  const endLimit = new Date(end.getTime());
  let dayNum = 1;
  const isSingleDay = start.getFullYear() === endLimit.getFullYear() &&
                      start.getMonth() === endLimit.getMonth() &&
                      start.getDate() === endLimit.getDate();

  while (cur <= endLimit) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const dNum = String(cur.getDate()).padStart(2, "0");
    const isoDate = `${y}-${m}-${dNum}`;

    const dayName = cur.toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = cur.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const isStart = dayNum === 1;
    const isEnd = cur.getFullYear() === endLimit.getFullYear() &&
                  cur.getMonth() === endLimit.getMonth() &&
                  cur.getDate() === endLimit.getDate();

    let tag: "Start Date" | "End Date" | "In-Between" | "Single Day" = "In-Between";
    if (isSingleDay) {
      tag = "Single Day";
    } else if (isStart) {
      tag = "Start Date";
    } else if (isEnd) {
      tag = "End Date";
    }

    days.push({
      dateStr: isoDate,
      shortLabel: `${monthDay} (${dayName.slice(0, 3)})`,
      fullLabel: `${monthDay}, ${y} (${dayName})`,
      dayName,
      monthDay,
      year: y,
      dayNumber: dayNum,
      tag,
      isStart,
      isEnd,
    });

    cur.setDate(cur.getDate() + 1);
    dayNum++;
  }

  return days;
}
