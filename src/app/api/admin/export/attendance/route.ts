import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { isObjectId } from "@/lib/object-id";
import { formatTime, todayPK } from "@/lib/datetime";
import { closeOverdueAttendance } from "@/lib/attendance";
import { csvResponse, datesBetween, parseExportRange, toCsv } from "@/lib/csv";

const HEADER = [
  "Date",
  "Employee code",
  "Name",
  "Designation",
  "Project",
  "Check-in",
  "Check-out",
  "Hours",
  "Status",
];

function hoursBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return ms < 0 ? "" : (ms / 3_600_000).toFixed(2);
}

// One row per check-in in the range. Without a project filter, every active employee who did not check in
// on a day (and had joined by then) gets an "Absent" row, so the file works as a monthly register.
export async function GET(request: Request) {
  await closeOverdueAttendance();
  const { searchParams } = new URL(request.url);
  const range = parseExportRange(searchParams);
  if ("error" in range) return jsonError(range.error!);
  const { from, to } = range;
  const projectId = searchParams.get("projectId") || undefined;
  if (projectId && !isObjectId(projectId)) return jsonError("Invalid filter");

  const [records, employees] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: { gte: from, lte: to }, ...(projectId ? { projectId } : {}) },
      include: {
        employee: { select: { employeeCode: true, name: true, designation: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { checkInAt: "asc" }],
    }),
    projectId
      ? Promise.resolve([])
      : prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, employeeCode: true, name: true, designation: true, createdAt: true },
          orderBy: { name: "asc" },
        }),
  ]);

  const rows: Array<Array<string | number>> = [];
  const today = todayPK();
  const byDate = new Map<string, typeof records>();
  for (const record of records) {
    const list = byDate.get(record.date) ?? [];
    list.push(record);
    byDate.set(record.date, list);
  }

  for (const date of datesBetween(from, to)) {
    const day = byDate.get(date) ?? [];
    for (const r of day) {
      rows.push([
        date,
        r.employee.employeeCode,
        r.employee.name,
        r.employee.designation,
        r.project?.name ?? "",
        formatTime(r.checkInAt),
        r.checkOutAt ? formatTime(r.checkOutAt) : "",
        r.checkOutAt ? hoursBetween(r.checkInAt, r.checkOutAt) : "",
        r.checkOutAt ? (r.autoCheckedOut ? "Auto checked out" : "Checked out") : "On duty",
      ]);
    }
    if (date > today) continue;
    const present = new Set(day.map((r) => r.employeeId));
    for (const e of employees) {
      if (present.has(e.id) || todayPK(e.createdAt) > date) continue;
      rows.push([date, e.employeeCode, e.name, e.designation, "", "", "", "", "Absent"]);
    }
  }

  return csvResponse(`helpline-attendance_${from}_to_${to}.csv`, toCsv(HEADER, rows));
}
