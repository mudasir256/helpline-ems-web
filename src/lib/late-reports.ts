import { prisma } from "./prisma";
import { formatDate, isCalendarDate, shiftDatePK, todayPK } from "./datetime";

// A forgotten daily report can be added on any of the next 3 days...
export const LATE_REPORT_WINDOW_DAYS = 3;
// ...for at most 2 days in each calendar month. The month is the month of the missed day.
export const LATE_REPORTS_PER_MONTH = 2;

function monthOf(date: string) {
  return date.slice(0, 7);
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

// Distinct missed days already filled in late, per month ("YYYY-MM").
async function lateDaysUsed(employeeId: string, months: string[]) {
  const used = new Map<string, number>();
  for (const month of new Set(months)) {
    const reports = await prisma.dailyReport.findMany({
      where: { employeeId, submittedLate: true, date: { gte: `${month}-01`, lte: `${month}-31` } },
      select: { date: true },
    });
    used.set(month, new Set(reports.map((report) => report.date)).size);
  }
  return used;
}

export type MissedReportDay = {
  date: string;
  month: string;
  monthLabel: string;
  usedInMonth: number;
  remainingInMonth: number;
  canAdd: boolean;
};

/** Days in the last 3 the employee was checked in but sent no report, and whether each can still be filled. */
export async function missedReportDays(employeeId: string, now = new Date()) {
  const today = todayPK(now);
  const window = Array.from({ length: LATE_REPORT_WINDOW_DAYS }, (_, i) => shiftDatePK(today, -(i + 1)));

  const [attendance, reports] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId, date: { in: window } },
      select: { date: true },
    }),
    prisma.dailyReport.findMany({
      where: { employeeId, date: { in: window } },
      select: { date: true },
    }),
  ]);
  const reported = new Set(reports.map((report) => report.date));
  const missed = attendance.map((row) => row.date).filter((date) => !reported.has(date));
  const used = await lateDaysUsed(employeeId, missed.map(monthOf));

  const days: MissedReportDay[] = missed
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const usedInMonth = used.get(monthOf(date)) ?? 0;
      const remainingInMonth = Math.max(0, LATE_REPORTS_PER_MONTH - usedInMonth);
      return {
        date,
        month: monthOf(date),
        monthLabel: monthLabel(date),
        usedInMonth,
        remainingInMonth,
        canAdd: remainingInMonth > 0,
      };
    });

  return { windowDays: LATE_REPORT_WINDOW_DAYS, limitPerMonth: LATE_REPORTS_PER_MONTH, days };
}

/** Returns why a report for an earlier day is not allowed, or null when it is. */
export async function lateReportError(employeeId: string, date: string, now = new Date()) {
  const today = todayPK(now);
  if (!isCalendarDate(date)) return "Choose a valid date";
  if (date > today) return "You cannot send a report for a future date";
  const earliest = shiftDatePK(today, -LATE_REPORT_WINDOW_DAYS);
  if (date < earliest) {
    return `A missing report can only be added within ${LATE_REPORT_WINDOW_DAYS} days. ${formatDate(date)} is too old.`;
  }

  const [attendance, existing] = await Promise.all([
    prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date } }, select: { id: true } }),
    prisma.dailyReport.count({ where: { employeeId, date } }),
  ]);
  if (!attendance) return `You did not check in on ${formatDate(date)}, so there is no report to add`;
  if (existing > 0) return `You already sent a report for ${formatDate(date)}`;

  const used = (await lateDaysUsed(employeeId, [monthOf(date)])).get(monthOf(date)) ?? 0;
  if (used >= LATE_REPORTS_PER_MONTH) {
    return `You have already added ${LATE_REPORTS_PER_MONTH} missing reports for ${monthLabel(date)}. No more can be added for that month.`;
  }
  return null;
}
